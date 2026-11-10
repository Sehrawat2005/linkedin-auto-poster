const fs = require("fs");
const path = require("path");
const { getUpdates, sendMessage, answerCallbackQuery, clearInlineKeyboard } = require("./telegram");
const { publishPost } = require("./postToLinkedIn");
const { generateDiscoveryDraft, generateCustomDraft } = require("./generateAndSend");

const PENDING_PATH = path.join(__dirname, "..", "pending.json");

function readIncoming(updates, chatId) {
  let decision = null;
  let customTopic = null;
  let callbackQueryId = null;
  let maxUpdateId = -1;

  for (const update of updates) {
    if (update.update_id > maxUpdateId) maxUpdateId = update.update_id;

    if (update.callback_query) {
      const cq = update.callback_query;
      const cqChatId = cq.message && cq.message.chat && String(cq.message.chat.id);
      if (cqChatId !== chatId) continue;
      if (cq.data === "approve") decision = "approve";
      else if (cq.data === "reject") decision = "reject";
      callbackQueryId = cq.id;
      continue;
    }

    const msg = update.message;
    if (!msg || !msg.text || String(msg.chat.id) !== chatId) continue;

    const raw = msg.text.trim();
    const text = raw.toLowerCase();
    if (text === "approve" || text === "ok") decision = "approve";
    else if (text === "reject" || text === "no") decision = "reject";
    else if (raw.length > 0) customTopic = raw;
  }

  return { decision, customTopic, callbackQueryId, maxUpdateId };
}

function savePending(pending) {
  fs.writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2) + "\n");
}

async function main() {
  const groqKey = process.env.GROQ_API_KEY;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = String(process.env.TELEGRAM_CHAT_ID);
  const linkedinToken = process.env.LINKEDIN_ACCESS_TOKEN;

  if (!groqKey) throw new Error("Missing GROQ_API_KEY env var");
  if (!botToken) throw new Error("Missing TELEGRAM_BOT_TOKEN env var");
  if (!chatId) throw new Error("Missing TELEGRAM_CHAT_ID env var");
  if (!linkedinToken) throw new Error("Missing LINKEDIN_ACCESS_TOKEN env var");

  const pending = JSON.parse(fs.readFileSync(PENDING_PATH, "utf8"));

  const updates = await getUpdates(botToken, pending.telegramOffset);
  const { decision, customTopic, callbackQueryId, maxUpdateId } = readIncoming(updates, chatId);

  if (maxUpdateId >= 0) {
    pending.telegramOffset = maxUpdateId + 1;
  }
  // Persist the offset right away, before doing any slower/riskier work below -
  // a later failure must never cause the same Telegram update to be re-read and
  // re-processed (or acted on) again on the next run.
  savePending(pending);

  if (callbackQueryId) {
    try {
      await answerCallbackQuery(botToken, callbackQueryId, decision === "approve" ? "Approved" : "Rejected");
    } catch (err) {
      // Non-fatal - this only clears the button's loading spinner/toast. The
      // decision itself was already read from the update above and must still
      // be processed either way.
      console.warn(`Could not acknowledge the button tap (continuing anyway): ${err.message}`);
    }
  }

  if (pending.status === "awaiting_review") {
    if (!decision) {
      if (customTopic) {
        await sendMessage(botToken, chatId, "You already have a draft awaiting review - tap a button or reply APPROVE/REJECT first.");
      }
      console.log("No decision yet.");
      return;
    }

    if (pending.draftMessageId) {
      try {
        await clearInlineKeyboard(botToken, chatId, pending.draftMessageId);
      } catch (err) {
        console.warn(`Could not clear the old buttons (non-fatal): ${err.message}`);
      }
    }

    if (decision === "approve") {
      await sendMessage(botToken, chatId, "Got your approval ✅ - publishing to LinkedIn now...");
      try {
        const id = await publishPost({
          accessToken: linkedinToken,
          text: pending.postText,
          imageUrl: pending.imageUrl,
        });
        console.log(`Published. Post id: ${id}`);

        const postUrl = id && id !== "posted" ? `https://www.linkedin.com/feed/update/${id}` : null;
        await sendMessage(botToken, chatId, postUrl ? `✅ Published to LinkedIn!\n${postUrl}` : "✅ Published to LinkedIn.");

        Object.assign(pending, {
          status: "idle",
          topic: null,
          category: null,
          source: null,
          sourceTitle: null,
          sourceUrl: null,
          sourceObjectId: null,
          postText: null,
          imageUrl: null,
          draftMessageId: null,
        });
        savePending(pending);
      } catch (err) {
        console.error(`Publish failed: ${err.message}`);
        await sendMessage(
          botToken,
          chatId,
          `⚠️ Publishing failed: ${err.message}\n\nThe draft is still waiting - tap Approve to try again, or Reject for a new one.`
        );
        // pending.json already reflects the offset update from above; the draft
        // itself is deliberately left as "awaiting_review" so it can be retried.
      }
    } else {
      await sendMessage(botToken, chatId, "Got your rejection ❌ - generating a new draft...");
      try {
        if (pending.source === "custom") {
          await generateCustomDraft({ topic: pending.topic, groqKey, botToken, chatId, pending });
        } else {
          await generateDiscoveryDraft({ groqKey, botToken, chatId, pending });
        }
      } catch (err) {
        console.error(`Regeneration failed: ${err.message}`);
        await sendMessage(botToken, chatId, `⚠️ Couldn't generate a new draft: ${err.message}\n\nTap Reject again to retry.`);
      }
    }
    return;
  }

  // Nothing pending - a plain message is treated as an on-demand topic request.
  if (customTopic) {
    console.log(`Custom topic requested: "${customTopic}"`);
    await sendMessage(botToken, chatId, "Got it, researching and drafting a post on that...");
    try {
      await generateCustomDraft({ topic: customTopic, groqKey, botToken, chatId, pending });
    } catch (err) {
      console.error(`Custom draft generation failed: ${err.message}`);
      await sendMessage(botToken, chatId, `⚠️ Couldn't generate a draft: ${err.message}\n\nSend the topic again to retry.`);
    }
    return;
  }

  console.log("Nothing to do.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
