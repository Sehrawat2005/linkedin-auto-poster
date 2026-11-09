const fs = require("fs");
const path = require("path");
const { getImageUrl } = require("./generateImage");
const { sendMessage, sendPhoto } = require("./telegram");

const PENDING_PATH = path.join(__dirname, "..", "pending.json");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function trySendPhoto(botToken, chatId, imageUrl) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await sendPhoto(botToken, chatId, imageUrl);
      return true;
    } catch (err) {
      console.warn(`sendPhoto attempt ${attempt} failed: ${err.message}`);
      if (attempt < 2) await sleep(3000);
    }
  }
  return false;
}

async function sendDraftForReview({
  topic,
  category,
  sourceTitle,
  sourceUrl,
  sourceObjectId,
  postText,
  source,
  botToken,
  chatId,
  pending,
}) {
  const imageUrl = getImageUrl(topic);

  const sentMessage = await sendMessage(
    botToken,
    chatId,
    `${postText}\n\n---\nTap a button below, or send a new topic anytime to draft something else.`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: "approve" },
            { text: "❌ Reject", callback_data: "reject" },
          ],
        ],
      },
    }
  );

  // Write pending state right after the text message succeeds, so it always matches
  // what's actually sitting in the chat - the photo below is best-effort and must
  // never leave this file out of sync with what you can tap Approve/Reject on.
  pending.status = "awaiting_review";
  pending.topic = topic;
  pending.category = category ?? null;
  pending.source = source;
  pending.sourceTitle = sourceTitle ?? null;
  pending.sourceUrl = sourceUrl ?? null;
  pending.sourceObjectId = sourceObjectId ?? null;
  pending.postText = postText;
  pending.imageUrl = imageUrl;
  pending.draftMessageId = sentMessage.message_id;
  pending.telegramOffset = pending.telegramOffset ?? 0;
  fs.writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2) + "\n");

  const photoSent = await trySendPhoto(botToken, chatId, imageUrl);
  if (!photoSent) {
    console.warn("Image failed to send after retries - continuing text-only, LinkedIn publish will skip the image too.");
    pending.imageUrl = null;
    fs.writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2) + "\n");
    try {
      await sendMessage(botToken, chatId, "(Couldn't generate a preview image this time - this will publish as text-only.)");
    } catch (err) {
      console.warn(`Could not send the image-failure notice (non-fatal): ${err.message}`);
    }
  }

  console.log("Draft sent to Telegram, waiting for your approval.");
}

module.exports = { sendDraftForReview };
