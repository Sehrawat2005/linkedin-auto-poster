const GROQ_MODEL = "openai/gpt-oss-120b";

async function generatePost(topic, apiKey, headlines = []) {
  const contextBlock = headlines.length
    ? `\n\nFor grounding, here are a few recent real headlines from this space (use them for inspiration or context if relevant, don't just restate them, and don't invent facts beyond what's reasonable):\n${headlines.map((h) => `- ${h}`).join("\n")}`
    : "";

  const prompt = `Write a LinkedIn post about this topic: "${topic}"${contextBlock}

Structure it like a high-performing LinkedIn post, not a plain paragraph dump:
- Line 1: a short, punchy hook (under 12 words) that makes someone stop scrolling - a bold claim, a surprising detail, or a direct question. No generic openers like "In today's world" or "Let's talk about".
- Blank line after the hook.
- Body: 3-5 points, each its own short paragraph (1-2 sentences, short lines). Start each one with a simple marker like "→" so it scans as a list, not a wall of text.
- Blank line between every paragraph - lots of white space, nothing longer than 2 sentences in a row.
- Closing line: one short line that gives a clear takeaway or asks a genuine question to invite comments.
- Blank line, then 2-3 relevant lowercase hashtags on their own line.

Voice:
- Sound like a real person who knows this space, not a corporate press release or a motivational poster.
- First person where natural, conversational, no buzzwords like "synergy", "leverage", "unlock", "game-changer".
- 180-280 words total, excluding hashtags. Use the extra room for a real example, a concrete number, or a bit more depth on each point - don't just pad with filler.
- Plain text only - no markdown asterisks or headers, since LinkedIn displays them as literal characters, not formatting.
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
