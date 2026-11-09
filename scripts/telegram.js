const TELEGRAM_API = "https://api.telegram.org/bot";

async function sendMessage(token, chatId, text) {
  const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
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

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(`Telegram getUpdates failed: ${JSON.stringify(data)}`);
  }
  return data.result;
}

module.exports = { sendMessage, sendPhoto, getUpdates };
