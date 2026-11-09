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

async function uploadImage(accessToken, authorUrn, imageUrl) {
  const initRes = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": LINKEDIN_VERSION,
    },
    body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
  });
  if (!initRes.ok) {
    const body = await initRes.text();
    throw new Error(`LinkedIn image init error ${initRes.status}: ${body}`);
  }
  const initData = await initRes.json();
  const uploadUrl = initData.value.uploadUrl;
  const imageUrn = initData.value.image;

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new Error(`Failed to download image from ${imageUrl}: ${imageRes.status}`);
  }
  const imageBytes = Buffer.from(await imageRes.arrayBuffer());

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: imageBytes,
  });
  if (!uploadRes.ok) {
    const body = await uploadRes.text();
    throw new Error(`LinkedIn image upload error ${uploadRes.status}: ${body}`);
  }

  return imageUrn;
}

async function publishPost({ accessToken, text, imageUrl }) {
  const authorUrn = await getAuthorUrn(accessToken);

  const body = {
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
  };

  if (imageUrl) {
    const imageUrn = await uploadImage(accessToken, authorUrn, imageUrl);
    body.content = { media: { id: imageUrn } };
  }

  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": LINKEDIN_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`LinkedIn post error ${res.status}: ${errBody}`);
  }

  return res.headers.get("x-restli-id") || "posted";
}

module.exports = { getAuthorUrn, uploadImage, publishPost };
