// Free, keyless search over Hacker News (Algolia), used for both grounding context
// and topic discovery. Relevance-filtered to the query's words so unrelated stories
// (which HN's broader full-text match can surface) don't get treated as "related".
async function searchStories(query, { windowSeconds, hitsPerPage = 5 } = {}) {
  const url = new URL("https://hn.algolia.com/api/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("tags", "story");
  url.searchParams.set("hitsPerPage", String(hitsPerPage));
  if (windowSeconds) {
    const since = Math.floor(Date.now() / 1000) - windowSeconds;
    url.searchParams.set("numericFilters", `created_at_i>${since}`);
  }

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const data = await res.json();

  return (data.hits || [])
    .filter((hit) => hit.title)
    .filter((hit) => words.some((w) => hit.title.toLowerCase().includes(w)))
    .map((hit) => ({
      title: hit.title,
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      objectID: hit.objectID,
      createdAt: hit.created_at,
    }));
}

module.exports = { searchStories };
