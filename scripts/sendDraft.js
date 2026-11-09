const fs = require("fs");
const path = require("path");
const { getImageUrl } = require("./generateImage");
const { sendMessage, sendPhoto } = require("./telegram");

const PENDING_PATH = path.join(__dirname, "..", "pending.json");

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
  const sourceLine = sourceUrl ? `\n\nSource: ${sourceUrl}` : "";

  const sentMessage = await sendMessage(
    botToken,
    chatId,
    `${postText}${sourceLine}\n\n---\nTap a button below, or send a new topic anytime to draft something else.`,
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
  await sendPhoto(botToken, chatId, imageUrl);

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
  console.log("Draft sent to Telegram, waiting for your approval.");
}

module.exports = { sendDraftForReview };
