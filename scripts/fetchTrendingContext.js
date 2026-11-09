const { searchStories } = require("./hackerNews");

// Lightweight, free "research": pulls a few real recent headlines from Hacker News's
// public search so posts about "what's trending/new" are grounded in something real,
// not invented by the model. Best-effort only - never blocks post generation on failure.
const RECENT_WINDOW_SECONDS = 60 * 60 * 24 * 45; // last 45 days

async function getTrendingContext(query) {
  try {
    const hits = await searchStories(query, { windowSeconds: RECENT_WINDOW_SECONDS, hitsPerPage: 5 });
    return hits.slice(0, 3).map((hit) => hit.title);
  } catch (err) {
    console.warn(`Trending context lookup failed (continuing without it): ${err.message}`);
    return [];
  }
}

module.exports = { getTrendingContext };
