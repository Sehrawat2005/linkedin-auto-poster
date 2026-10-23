const GEMINI_MODEL = "gemini-2.0-flash";

async function generatePost(topic, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const prompt = `Write a LinkedIn post about this topic: "${topic}"

Rules:
- Sound like a real person wrote it, not a corporate press release.
- First person, conversational, no buzzwords like "synergy" or "leverage".
- 80-150 words.
- Plain text only, no markdown, no asterisks for bold.
- Break it into short paragraphs (1-3 sentences each) for readability.
- End with 2-3 relevant, lowercase hashtags, nothing more.
- Do not include any preamble like "Here's a post:" - output only the post text itself.`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`Gemini returned no text: ${JSON.stringify(data)}`);
  }

  return text.trim();
}

module.exports = { generatePost };
