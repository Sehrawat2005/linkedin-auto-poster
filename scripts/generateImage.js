const GROQ_MODEL = "openai/gpt-oss-120b";

function buildImagePrompt(sceneDescription) {
  return `flat 2D vector illustration, ${sceneDescription}, solid flat colors only, no gradients, no shadows, no depth of field, no 3D rendering, no photorealism, simple geometric shapes, clean outlines, dribbble style tech illustration, bold colors on plain background, high quality, no text, no watermark`;
}

function getImageUrl(sceneDescription) {
  const encoded = encodeURIComponent(buildImagePrompt(sceneDescription));
  return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true`;
}

// A short topic phrase like "Hidden Lambda billing for idle memory" is too
// abstract for an image model to turn into anything relevant - it tends to
// free-associate on a single word (e.g. "cloud") and produce an unrelated
// image. Ask the model for one concrete, physical scene instead, grounded in
// the actual post content, before handing it to the image generator.
async function generateScenePrompt(postText, topic, groqKey) {
  const prompt = `Based on this LinkedIn post, write ONE short, concrete, visually striking scene description (under 25 words) that an image-generation AI could turn into an eye-catching, scroll-stopping flat-illustration graphic - a real physical scene, object, or visual metaphor, not an abstract concept. Make it dynamic and specific: an interesting angle or layout, a sense of motion or tension, a bold visual contrast (e.g. scale, color, light vs dark) - not a plain, static "object sitting on a desk" shot. No text, logos, or recognizable faces. Output ONLY the scene description, nothing else - no preamble, no quotes.

Topic: ${topic}

Post:
"""
${postText}
"""`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqKey}`,
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

  return text.trim().replace(/^["']|["']$/g, "");
}

module.exports = { getImageUrl, generateScenePrompt };
