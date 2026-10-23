const LINKEDIN_VERSION = "202504";

async function getAuthorUrn(accessToken) {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LinkedIn userinfo error ${res.status}: ${body}`);
  }
  const data = await res.json();
  return `urn:li:person:${data.sub}`;
}

async function postToLinkedIn(text, accessToken) {
  const authorUrn = await getAuthorUrn(accessToken);

  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": LINKEDIN_VERSION,
    },
    body: JSON.stringify({
      author: authorUrn,
      commentary: text,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LinkedIn post error ${res.status}: ${body}`);
  }

  return res.headers.get("x-restli-id") || "posted";
}

module.exports = { postToLinkedIn };
