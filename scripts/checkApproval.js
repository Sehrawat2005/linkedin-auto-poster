const fs = require("fs");
const path = require("path");
const { getUpdates, sendMessage } = require("./telegram");
const { publishPost } = require("./postToLinkedIn");
const { generateAndSendDraft } = require("./generateAndSend");

const TOPICS_PATH = path.join(__dirname, "..", "topics.json");
const PENDING_PATH = path.join(__dirname, "..", "pending.json");

function readDecision(updates, chatId) {
  let decision = null;
  let maxUpdateId = -1;

  for (const update of updates) {
    if (update.update_id > maxUpdateId) maxUpdateId = update.update_id;

    const msg = update.message;
    if (!msg || !msg.text || String(msg.chat.id) !== chatId) continue;

    const text = msg.text.trim().toLowerCase();
    if (text === "approve" || text === "ok") decision = "approve";
    else if (text === "reject" || text === "no") decision = "reject";
  }

  return { decision, maxUpdateId };
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
  const { decision, maxUpdateId } = readDecision(updates, chatId);

  if (maxUpdateId >= 0) {
    pending.telegramOffset = maxUpdateId + 1;
  }

  if (pending.status !== "awaiting_review" || !decision) {
    fs.writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2) + "\n");
    console.log(decision ? `Got "${decision}" but nothing is awaiting review.` : "No new decision.");
    return;
  }

  if (decision === "approve") {
    console.log("Approved - publishing to LinkedIn...");
    const id = await publishPost({
      accessToken: linkedinToken,
      text: pending.postText,
      imageUrl: pending.imageUrl,
    });
    console.log(`Published. Post id: ${id}`);

    const topicsState = JSON.parse(fs.readFileSync(TOPICS_PATH, "utf8"));
    topicsState.nextIndex = (pending.topicIndex + 1) % topicsState.topics.length;
    fs.writeFileSync(TOPICS_PATH, JSON.stringify(topicsState, null, 2) + "\n");

    await sendMessage(botToken, chatId, "Published to LinkedIn.");

    pending.status = "idle";
    pending.topic = null;
    pending.topicIndex = null;
    pending.postText = null;
    pending.imageUrl = null;
    fs.writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2) + "\n");
  } else {
    console.log("Rejected - generating a new draft for the same topic...");
    await sendMessage(botToken, chatId, "Got it, generating a new draft...");
    await generateAndSendDraft({
      topic: pending.topic,
      topicIndex: pending.topicIndex,
      groqKey,
      botToken,
      chatId,
      pending,
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
