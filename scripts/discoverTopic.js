const { searchStories } = require("./hackerNews");

const GROQ_MODEL = "openai/gpt-oss-120b";

// The niche this bot posts in. Edit this list to change what it discovers topics about.
const NICHE_CATEGORIES = [
  { category: "AWS", query: "AWS" },
  { category: "cloud computing", query: "cloud computing" },
  { category: "web development", query: "web development" },
  { category: "software engineering", query: "software engineering" },
  { category: "web security", query: "web security" },
  { category: "serverless", query: "serverless" },
  { category: "digital marketing", query: "digital marketing" },
];

async function fetchCandidates(windowSeconds) {
  const all = [];
  for (const { category, query } of NICHE_CATEGORIES) {
    try {
      const hits = await searchStories(query, { windowSeconds, hitsPerPage: 6 });
      for (const hit of hits) all.push({ ...hit, category });
    } catch (err) {
      console.warn(`Hacker News search failed for "${category}" (continuing): ${err.message}`);
    }
  }

  const seen = new Set();
  return all.filter((c) => {
    if (seen.has(c.objectID)) return false;
    seen.add(c.objectID);
    return true;
  });
}

// Finds real, recent, not-already-used candidates across the niche. Widens the time
// window if nothing turns up in the last week - the caller falls back to a
// self-proposed topic if this still comes back empty.
async function discoverCandidates(usedObjectIds = []) {
  let candidates = (await fetchCandidates(7 * 24 * 3600)).filter((c) => !usedObjectIds.includes(c.objectID));
  if (candidates.length === 0) {
    candidates = (await fetchCandidates(30 * 24 * 3600)).filter((c) => !usedObjectIds.includes(c.objectID));
  }
  return candidates;
}

function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Could not parse JSON from model output: ${text}`);
  }
}

async function generateDiscoveredPost({ candidates, usedTopics = [], groqKey }) {
  const hasCandidates = candidates.length > 0;
  const candidateList = candidates
    .slice(0, 12)
    .map((c, i) => `${i + 1}. [${c.category}] ${c.title}`)
    .join("\n");

  const avoidBlock = usedTopics.length
    ? `\n\nDo not repeat or closely resemble any of these topics already covered recently:\n${usedTopics
        .slice(-15)
        .map((t) => `- ${t}`)
        .join("\n")}`
    : "";

  const pickInstruction = hasCandidates
    ? `Here are real, recent headlines relevant to this niche:\n${candidateList}\n\nPick exactly ONE that would make the most interesting, specific LinkedIn post for a technical/marketing audience - something people would actually want to discuss, not generic. Use it as the real-world basis for your post: give your own take, analysis, or practical takeaway. Don't just restate the headline.`
    : `No fresh relevant headlines were found right now. Instead, come up with ONE specific, non-generic topic in this niche yourself - a practical tip, a common mistake, or a short checklist item. Avoid generic motivational topics.`;

  const prompt = `You write LinkedIn posts for someone whose niche is: software development, website development, AWS, cloud computing, and digital marketing services.

${pickInstruction}${avoidBlock}

Respond with ONLY a JSON object (no markdown fences, no extra commentary) with exactly these keys:
{
  "topic": "a short description of the specific topic/angle you chose",
  "category": "one short category keyword, e.g. AWS, cloud computing, web security, web development, digital marketing",
  "sourceIndex": the integer number from the list above you chose, or null if you came up with your own topic,
  "post": "the full LinkedIn post text"
}

The "post" value must follow this structure:
- Line 1: a short, punchy hook (under 12 words) that makes someone stop scrolling - a bold claim, a surprising detail, or a direct question. No generic openers like "In today's world".
- Blank line after the hook.
- Body: 2-4 points, each its own short paragraph (1-2 sentences, short lines), each starting with "→".
- Blank line between every paragraph - lots of white space, nothing longer than 2 sentences in a row.
- Closing line: one short line with a clear takeaway or a genuine question to invite comments.
- Blank line, then 2-3 relevant lowercase hashtags on their own line.
- Sound like a real person who knows this space, not a corporate press release. First person where natural, conversational, no buzzwords like "synergy", "leverage", "unlock", "game-changer".
- 80-150 words total, excluding hashtags.
- Plain text only - no markdown asterisks or headers, since LinkedIn displays them as literal characters, not formatting.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`Groq returned no content: ${JSON.stringify(data)}`);
  }

  const parsed = extractJson(content);
  const chosen = parsed.sourceIndex && candidates[parsed.sourceIndex - 1] ? candidates[parsed.sourceIndex - 1] : null;

  return {
    topic: parsed.topic,
    category: parsed.category || (chosen && chosen.category) || null,
    sourceTitle: chosen ? chosen.title : null,
    sourceUrl: chosen ? chosen.url : null,
    sourceObjectId: chosen ? chosen.objectID : null,
    postText: parsed.post,
  };
}

module.exports = { discoverCandidates, generateDiscoveredPost };
