const GROQ_MODEL = "openai/gpt-oss-120b";

function buildImagePrompt(visualConcept) {
  return `${visualConcept}

Render this as a premium, professionally art-directed visual for a technology-focused LinkedIn audience - artwork that looks commissioned for a premium technology publication, not a random AI-generated technology illustration. Preserve the exact subject, meaning, and visual details described above exactly - the specific recognizable objects named above must remain clearly identifiable in the final image, not replaced by a generic abstract stand-in. Let the rendering style, lighting, composition, color palette, perspective, depth, and artistic treatment follow naturally from the concept itself - do not force a single fixed style.

Quality bar: sharp, clearly defined objects, high-resolution detail, professional lighting, strong depth and perspective, rich but balanced colors, sophisticated composition, clear visual hierarchy. Reject blurry, muddy, washed-out, unfinished, or poorly defined results.

Landscape composition, one clearly identifiable focal point, balanced negative space, professional and cohesive color combinations, clearly readable even at small LinkedIn feed thumbnail size.

Avoid generic AI-illustration aesthetics: no translucent boxes, no random glowing cubes, no meaningless floating geometric shapes, no vague blue-glow objects, no generic futuristic platform shots. No text, typography, watermarks, signatures, or unnecessary logos. No generic stock-image aesthetics. No unnecessary decorative elements.`;
}

// Landscape 16:9 per the art-direction brief above - also reads better in the
// LinkedIn feed than the old 1:1 crop.
//
// Uses Pollinations' newer gen.pollinations.ai endpoint with model=flux
// (FLUX.1 Schnell) instead of the legacy image.pollinations.ai/prompt
// endpoint, which silently ignores any requested model and always serves
// "sana" (a lightweight model unsuited for detailed, multi-element scenes -
// confirmed via direct testing) regardless of what's passed. flux.1-schnell
// is a free model on the new endpoint (verified against Pollinations' live
// /image/models catalog), but anonymous/keyless access to it is tightly
// rate-limited, so a free Pollinations API key is required for reliable use.
// The key is passed as a query param (`?key=`), which Pollinations documents
// specifically for GET image endpoints that can't set custom headers - this
// is required here since Telegram's servers fetch this URL directly on our
// behalf, so we can't attach an Authorization header to that request.
function getImageUrl(visualConcept, pollinationsKey) {
  const encoded = encodeURIComponent(buildImagePrompt(visualConcept));
  const keyParam = pollinationsKey ? `&key=${encodeURIComponent(pollinationsKey)}` : "";
  return `https://gen.pollinations.ai/image/${encoded}?model=flux&width=1344&height=768${keyParam}`;
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

SEMANTIC ACCURACY IS MANDATORY. The concept must use objects and imagery that actually, recognizably correspond to the specific technology discussed - never substitute an unrelated abstract object for a real technical concept. For example:
- AWS/EKS/Kubernetes: actual container/pod shapes, orchestration diagrams, cloud infrastructure racks.
- Hardware isolation/security boundaries: physical silicon, processors, chips, sealed/isolated enclosures with a visible reason they're sealed.
- Cybersecurity: locks, shields, threat/attack imagery, intrusion/defense scenes - something that reads as "security" at a glance.
- AI/ML: neural-network-like structures, model/data-flow visuals, recognizable "intelligent system" imagery.
- Cloud computing/infrastructure: server racks, distributed network diagrams, data flowing between real-looking infrastructure.
Use the actual technical subject identified above to pick concrete, recognizable objects - not a vague substitute.

Dynamically choose whichever artistic style best fits THIS post's content and tone - do not default to the same style every time. Choose from (or blend) styles such as: premium 3D illustration, cinematic technology artwork, isometric technology illustration, modern editorial illustration, minimalist vector artwork, photorealistic conceptual scene, technical architecture visualization, professional infographic-style composition, or modern software/product interface visualization - whichever actually serves this specific concept best.

Write a detailed, concrete scene description (approximately 50-80 words) that an image-generation model can turn into that visual. Specify:
- The main subject and focal point - must be a recognizable object/scene tied to the actual technology, not an abstract stand-in
- The environment and supporting objects
- Composition and perspective
- Lighting and visual atmosphere
- A suitable color palette
- The artistic direction/style you chose

Requirements:
- No generic technology imagery (no bare glowing clouds, no meaningless circuit patterns).
- No meaningless abstract shapes or random floating icons with no connection to the post.
- Specifically avoid the overused AI-generated cliches: translucent boxes/containers, random glowing cubes, floating geometric shapes with no referent, vague "meaningless blue object" scenes, generic futuristic platforms. If your instinct is to describe one of these, replace it with the concrete, recognizable object the semantic-accuracy examples above point to instead.
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
