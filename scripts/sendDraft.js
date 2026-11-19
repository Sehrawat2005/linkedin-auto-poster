const fs = require("fs");
const path = require("path");
const { getImageUrl, generateScenePrompt } = require("./generateImage");
const { sendMessage, sendPhoto } = require("./telegram");

const PENDING_PATH = path.join(__dirname, "..", "pending.json");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The model occasionally emits a literal backslash-n (two characters) instead of
// an actual line break when writing JSON output - this shows up as a stray "\n"
// right before each bullet instead of a real newline. It also sometimes uses a
// unicode arrow/non-breaking-hyphen that renders as a stray glyph (reported as a
// stray "n") on some Telegram clients/fonts. Normalize all of this away here, the
// single choke point every draft passes through before being sent or published.
function sanitizePostText(text) {
  return text
    .replace(/\\r\\n|\\n/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/→/g, "-") // → arrow -> plain hyphen
    .replace(/[‑–—]/g, "-"); // non-breaking hyphen / en/em dash -> plain hyphen
}

// Pollinations occasionally rate-limits (503/400 "failed to get HTTP URL
// content") under load and needs more than a couple quick retries to recover -
// observed needing up to 4 attempts with ~10-15s gaps in practice.
async function trySendPhoto(botToken, chatId, imageUrl) {
  const delays = [5000, 10000, 15000];
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await sendPhoto(botToken, chatId, imageUrl);
      return true;
    } catch (err) {
      console.warn(`sendPhoto attempt ${attempt} failed: ${err.message}`);
      if (attempt < 4) await sleep(delays[attempt - 1]);
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
  groqKey,
}) {
  postText = sanitizePostText(postText);

  // The raw topic phrase is too abstract for the image model on its own (it
  // tends to free-associate on one word and produce something unrelated) -
  // ask Groq for a concrete scene grounded in the actual post first. Non-fatal:
  // fall back to the old topic-based prompt if this call fails for any reason.
  let imageSubject = topic;
  try {
    imageSubject = await generateScenePrompt(postText, topic, groqKey);
  } catch (err) {
    console.warn(`Scene prompt generation failed, falling back to topic (non-fatal): ${err.message}`);
  }
  const imageUrl = getImageUrl(imageSubject);

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
