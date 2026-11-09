const GROQ_MODEL = "llama-3.3-70b-versatile";

async function generatePost(topic, apiKey) {
  const prompt = `Write a LinkedIn post about this topic: "${topic}"

Rules:
- Sound like a real person wrote it, not a corporate press release.
- First person, conversational, no buzzwords like "synergy" or "leverage".
- 80-150 words.
- Plain text only, no markdown, no asterisks for bold.
- Break it into short paragraphs (1-3 sentences each) for readability.
- End with 2-3 relevant, lowercase hashtags, nothing more.
- Do not include any preamble like "Here's a post:" - output only the post text itself.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`Groq returned no text: ${JSON.stringify(data)}`);
  }

  return text.trim();
}

module.exports = { generatePost };
