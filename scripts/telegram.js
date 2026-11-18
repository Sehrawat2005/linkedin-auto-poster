const TELEGRAM_API = "https://api.telegram.org/bot";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Transient network blips (ETIMEDOUT etc.) hitting Telegram from the GitHub Actions
// runner happen occasionally and are not actionable - retry a couple times before
// giving up, so a single blip doesn't fail the whole run and spam a failure email.
async function withRetry(fn, attempts = 3, delayMs = 2000) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.warn(`Attempt ${i}/${attempts} failed: ${err.message}`);
      if (i < attempts) await sleep(delayMs);
    }
  }
  throw lastErr;
}

async function sendMessage(token, chatId, text, extra = {}) {
  const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, ...extra }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(`Telegram sendMessage failed: ${JSON.stringify(data)}`);
  }
  return data.result;
}

async function sendPhoto(token, chatId, photoUrl, caption) {
  const res = await fetch(`${TELEGRAM_API}${token}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(`Telegram sendPhoto failed: ${JSON.stringify(data)}`);
  }
  return data.result;
}

async function getUpdates(token, offset) {
  const url = new URL(`${TELEGRAM_API}${token}/getUpdates`);
  url.searchParams.set("timeout", "0");
  if (offset !== undefined && offset !== null) {
    url.searchParams.set("offset", String(offset));
  }

  return withRetry(async () => {
    const res = await fetch(url.toString());
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(`Telegram getUpdates failed: ${JSON.stringify(data)}`);
    }
    return data.result;
  });
}

async function answerCallbackQuery(token, callbackQueryId, text) {
  const res = await fetch(`${TELEGRAM_API}${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(`Telegram answerCallbackQuery failed: ${JSON.stringify(data)}`);
  }
  return data.result;
}

async function clearInlineKeyboard(token, chatId, messageId) {
  const res = await fetch(`${TELEGRAM_API}${token}/editMessageReplyMarkup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    // Non-fatal - the buttons just stay visible, decision processing already succeeded.
    console.warn(`Telegram clearInlineKeyboard failed: ${JSON.stringify(data)}`);
  }
}

module.exports = { sendMessage, sendPhoto, getUpdates, answerCallbackQuery, clearInlineKeyboard };
