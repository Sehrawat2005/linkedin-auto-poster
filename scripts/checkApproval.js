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

  if (callbackQueryId) {
    await answerCallbackQuery(botToken, callbackQueryId, decision === "approve" ? "Approved" : "Rejected");
  }

  if (pending.status === "awaiting_review") {
    if (!decision) {
      if (customTopic) {
        await sendMessage(botToken, chatId, "You already have a draft awaiting review - tap a button or reply APPROVE/REJECT first.");
      }
      fs.writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2) + "\n");
      console.log("No decision yet.");
      return;
    }

    if (pending.draftMessageId) {
      await clearInlineKeyboard(botToken, chatId, pending.draftMessageId);
    }

    if (decision === "approve") {
      console.log("Approved - publishing to LinkedIn...");
      const id = await publishPost({
        accessToken: linkedinToken,
        text: pending.postText,
        imageUrl: pending.imageUrl,
      });
      console.log(`Published. Post id: ${id}`);

      await sendMessage(botToken, chatId, "Published to LinkedIn.");

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
      fs.writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2) + "\n");
    } else {
      console.log("Rejected - generating a new draft...");
      await sendMessage(botToken, chatId, "Got it, generating a new draft...");

      if (pending.source === "custom") {
        await generateCustomDraft({ topic: pending.topic, groqKey, botToken, chatId, pending });
      } else {
        await generateDiscoveryDraft({ groqKey, botToken, chatId, pending });
      }
    }
    return;
  }

  // Nothing pending - a plain message is treated as an on-demand topic request.
  if (customTopic) {
    console.log(`Custom topic requested: "${customTopic}"`);
    await sendMessage(botToken, chatId, "Got it, researching and drafting a post on that...");
    await generateCustomDraft({ topic: customTopic, groqKey, botToken, chatId, pending });
    return;
  }

  fs.writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2) + "\n");
  console.log("Nothing to do.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
