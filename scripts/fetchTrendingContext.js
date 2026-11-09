// Lightweight, free "research": pulls a few real recent headlines from Hacker News's
// public search so posts about "what's trending/new" are grounded in something real,
// not invented by the model. Best-effort only - never blocks post generation on failure.
const RECENT_WINDOW_SECONDS = 60 * 60 * 24 * 45; // last 45 days

async function getTrendingContext(query) {
  try {
    const since = Math.floor(Date.now() / 1000) - RECENT_WINDOW_SECONDS;

    const url = new URL("https://hn.algolia.com/api/v1/search");
    url.searchParams.set("query", query);
    url.searchParams.set("tags", "story");
    url.searchParams.set("hitsPerPage", "5");
    url.searchParams.set("numericFilters", `created_at_i>${since}`);

    const res = await fetch(url.toString());
    if (!res.ok) return [];

    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const data = await res.json();
    return (data.hits || [])
      .filter((hit) => hit.title)
      .filter((hit) => {
        const title = hit.title.toLowerCase();
        return queryWords.some((word) => title.includes(word));
      })
      .slice(0, 3)
      .map((hit) => hit.title);
  } catch (err) {
    console.warn(`Trending context lookup failed (continuing without it): ${err.message}`);
    return [];
  }
}

module.exports = { getTrendingContext };
