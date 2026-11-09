const fs = require("fs");
const path = require("path");
const { generatePost } = require("./generatePost");
const { getImageUrl } = require("./generateImage");
const { getTrendingContext } = require("./fetchTrendingContext");
const { sendMessage, sendPhoto } = require("./telegram");

const TOPICS_PATH = path.join(__dirname, "..", "topics.json");
const PENDING_PATH = path.join(__dirname, "..", "pending.json");

async function generateAndSendDraft({ topic, category, topicIndex, groqKey, botToken, chatId, pending }) {
  console.log(`Generating post for topic: "${topic}"`);

  const headlines = await getTrendingContext(category || topic);
  const postText = await generatePost(topic, groqKey, headlines);
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
  await sendPhoto(botToken, chatId, imageUrl);

  pending.status = "awaiting_review";
  pending.topic = topic;
  pending.category = category ?? null;
  pending.topicIndex = topicIndex ?? null;
  pending.postText = postText;
  pending.imageUrl = imageUrl;
  pending.draftMessageId = sentMessage.message_id;
  pending.telegramOffset = pending.telegramOffset ?? 0;
  fs.writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2) + "\n");
  console.log("Draft sent to Telegram, waiting for your approval.");
}

async function main() {
  const groqKey = process.env.GROQ_API_KEY;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!groqKey) throw new Error("Missing GROQ_API_KEY env var");
  if (!botToken) throw new Error("Missing TELEGRAM_BOT_TOKEN env var");
  if (!chatId) throw new Error("Missing TELEGRAM_CHAT_ID env var");

  const pending = JSON.parse(fs.readFileSync(PENDING_PATH, "utf8"));
  if (pending.status === "awaiting_review") {
    console.log("A draft is already awaiting your review on Telegram - skipping new generation.");
    return;
  }

  const topicsState = JSON.parse(fs.readFileSync(TOPICS_PATH, "utf8"));
  if (!topicsState.topics || topicsState.topics.length === 0) {
    throw new Error("topics.json has no topics");
  }
  const topicIndex = topicsState.nextIndex % topicsState.topics.length;
  const entry = topicsState.topics[topicIndex];

  await generateAndSendDraft({
    topic: entry.text,
    category: entry.category,
    topicIndex,
    groqKey,
    botToken,
    chatId,
    pending,
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { generateAndSendDraft };
