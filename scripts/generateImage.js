function buildImagePrompt(topic) {
  return `professional realistic photo related to: ${topic}, clean composition, high quality, no text, no watermark, no cartoon characters, no illustrations`;
}

function getImageUrl(topic) {
  const encoded = encodeURIComponent(buildImagePrompt(topic));
  return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true`;
}

module.exports = { getImageUrl };
