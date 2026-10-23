const http = require("http");
const { URL } = require("url");

const PORT = 8080;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = "openid profile w_member_social";

function readEnvOrExit(name) {
  const val = process.env[name];
  if (!val) {
    console.error(`Missing required env var ${name}.`);
    console.error(`Run like: LINKEDIN_CLIENT_ID=xxx LINKEDIN_CLIENT_SECRET=yyy node scripts/getLinkedInToken.js`);
    process.exit(1);
  }
  return val;
}

async function exchangeCodeForToken(code, clientId, clientSecret) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  }
  return data;
}

function main() {
  const clientId = readEnvOrExit("LINKEDIN_CLIENT_ID");
  const clientSecret = readEnvOrExit("LINKEDIN_CLIENT_SECRET");

  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES);

  console.log("\n1. Open this URL in your browser and authorize the app:\n");
  console.log(authUrl.toString());
  console.log(`\n2. Waiting for the redirect on ${REDIRECT_URI} ...\n`);

  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, REDIRECT_URI);
    if (reqUrl.pathname !== "/callback") {
      res.writeHead(404);
      res.end();
      return;
    }

    const code = reqUrl.searchParams.get("code");
    const error = reqUrl.searchParams.get("error_description");

    if (error) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end(`Authorization failed: ${error}`);
      console.error("Authorization failed:", error);
      server.close();
      process.exit(1);
    }

    try {
      const tokenData = await exchangeCodeForToken(code, clientId, clientSecret);
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Success! You can close this tab and go back to the terminal.");

      console.log("\n=== Access token (save as GitHub secret LINKEDIN_ACCESS_TOKEN) ===\n");
      console.log(tokenData.access_token);
      console.log(`\nExpires in ${tokenData.expires_in} seconds (~${Math.round(tokenData.expires_in / 86400)} days).`);
      console.log("LinkedIn access tokens for self-serve apps do not auto-refresh.");
      console.log("Re-run this script to get a new token before it expires.\n");
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Token exchange failed, check the terminal.");
      console.error(err);
    } finally {
      server.close();
    }
  });

  server.listen(PORT);
}

main();
