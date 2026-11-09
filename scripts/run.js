const fs = require("fs");
const path = require("path");
const { generatePost } = require("./generatePost");
const { postToLinkedIn } = require("./postToLinkedIn");

const TOPICS_PATH = path.join(__dirname, "..", "topics.json");

async function main() {
  const groqKey = process.env.GROQ_API_KEY;
  const linkedinToken = process.env.LINKEDIN_ACCESS_TOKEN;

  if (!groqKey) throw new Error("Missing GROQ_API_KEY env var");
  if (!linkedinToken) throw new Error("Missing LINKEDIN_ACCESS_TOKEN env var");

  const state = JSON.parse(fs.readFileSync(TOPICS_PATH, "utf8"));
  if (!state.topics || state.topics.length === 0) {
    throw new Error("topics.json has no topics");
  }

  const index = state.nextIndex % state.topics.length;
  const topic = state.topics[index];

  console.log(`Generating post for topic: "${topic}"`);
  const postText = await generatePost(topic, groqKey);

  console.log("Generated post:\n" + postText);

  console.log("Publishing to LinkedIn...");
  const id = await postToLinkedIn(postText, linkedinToken);
  console.log(`Published. Post id: ${id}`);

  state.nextIndex = (index + 1) % state.topics.length;
  fs.writeFileSync(TOPICS_PATH, JSON.stringify(state, null, 2) + "\n");
  console.log(`Advanced nextIndex to ${state.nextIndex}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
