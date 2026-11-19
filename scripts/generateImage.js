const GROQ_MODEL = "openai/gpt-oss-120b";

function buildImagePrompt(visualConcept) {
  return `${visualConcept}

Render this as a premium, professionally art-directed visual for a technology-focused LinkedIn audience. Preserve the exact subject, meaning, and visual details described above. Let the rendering style, lighting, composition, color palette, perspective, depth, and artistic treatment follow naturally from the concept itself - do not force a single fixed style.

Landscape composition, strong visual hierarchy, one clearly identifiable focal point, balanced negative space, professional and cohesive color combinations, high visual quality, coherent rendering, clearly readable even at small LinkedIn feed thumbnail size.

No text, typography, watermarks, signatures, or unnecessary logos. No generic stock-image aesthetics. No unnecessary decorative elements.`;
}

// Landscape 16:9 per the art-direction brief above - also reads better in the
// LinkedIn feed than the old 1:1 crop.
function getImageUrl(visualConcept) {
  const encoded = encodeURIComponent(buildImagePrompt(visualConcept));
  return `https://image.pollinations.ai/prompt/${encoded}?width=1344&height=768&nologo=true`;
}

// A short topic phrase like "Hidden Lambda billing for idle memory" is too
// abstract for an image model to turn into anything relevant - it tends to
// free-associate on a single word (e.g. "cloud") and produce an unrelated
// image. Ask the model to act as a creative director instead: read the full
// post, identify what it's actually about, and develop one specific visual
// concept in whichever style actually fits that content - before handing the
// result to the image generator.
async function generateScenePrompt(postText, topic, groqKey) {
  const prompt = `You are a senior creative director for a technology-focused LinkedIn publication, responsible for commissioning the single image that will run with this post.

Read the full post below and identify:
- Its central message - the one idea a reader should walk away with.
- The actual technology, concept, problem, solution, or insight being discussed - be specific, not generic.

Then develop ONE unique visual concept that directly represents this specific post - not a generic "tech" image, not a stock-photo cliche, not a random abstract composition of floating icons.

Dynamically choose whichever artistic style best fits THIS post's content and tone - do not default to the same style every time. Choose from (or blend) styles such as: premium 3D illustration, cinematic technology artwork, isometric technology illustration, modern editorial illustration, minimalist vector artwork, photorealistic conceptual scene, technical architecture visualization, professional infographic-style composition, or modern software/product interface visualization - whichever actually serves this specific concept best.

Write a detailed, concrete scene description (approximately 50-80 words) that an image-generation model can turn into that visual. Specify:
- The main subject and focal point
- The environment and supporting objects
- Composition and perspective
- Lighting and visual atmosphere
- A suitable color palette
- The artistic direction/style you chose

Requirements:
- No generic technology imagery (no bare glowing clouds, no meaningless circuit patterns).
- No meaningless abstract shapes or random floating icons with no connection to the post.
- No text, typography, logos, watermarks, or recognizable human faces.
- No explanations, preambles, or commentary - output ONLY the visual concept itself.

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
