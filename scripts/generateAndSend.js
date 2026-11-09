const fs = require("fs");
const path = require("path");
const { generatePost } = require("./generatePost");
const { getTrendingContext } = require("./fetchTrendingContext");
const { discoverCandidates, generateDiscoveredPost } = require("./discoverTopic");
const { sendDraftForReview } = require("./sendDraft");

const PENDING_PATH = path.join(__dirname, "..", "pending.json");
const HISTORY_PATH = path.join(__dirname, "..", "history.json");

function loadHistory() {
  return JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8"));
}

function recordHistory({ topic, sourceObjectId }) {
  const history = loadHistory();
  if (sourceObjectId) {
    history.usedObjectIds = [...(history.usedObjectIds || []), sourceObjectId].slice(-100);
  }
  history.usedTopics = [...(history.usedTopics || []), topic].slice(-40);
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + "\n");
}

async function generateDiscoveryDraft({ groqKey, botToken, chatId, pending }) {
  const history = loadHistory();
  const candidates = await discoverCandidates(history.usedObjectIds || []);
  const result = await generateDiscoveredPost({ candidates, usedTopics: history.usedTopics || [], groqKey });

  console.log(
    `Discovered topic: "${result.topic}"${result.sourceTitle ? ` (from: ${result.sourceTitle})` : " (self-proposed)"}`
  );

  await sendDraftForReview({ ...result, source: "discovery", botToken, chatId, pending });
  recordHistory({ topic: result.topic, sourceObjectId: result.sourceObjectId });
}

async function generateCustomDraft({ topic, groqKey, botToken, chatId, pending }) {
  console.log(`Generating post for custom topic: "${topic}"`);
  const headlines = await getTrendingContext(topic);
  const postText = await generatePost(topic, groqKey, headlines);

  await sendDraftForReview({
    topic,
    category: null,
    sourceTitle: null,
    sourceUrl: null,
    sourceObjectId: null,
    postText,
    source: "custom",
    botToken,
    chatId,
    pending,
  });

  recordHistory({ topic, sourceObjectId: null });
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

  await generateDiscoveryDraft({ groqKey, botToken, chatId, pending });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { generateDiscoveryDraft, generateCustomDraft };
