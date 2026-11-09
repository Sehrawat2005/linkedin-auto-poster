# LinkedIn Auto Poster

Generates a human-sounding LinkedIn post from a topic (using Groq's free API tier)
and publishes it to your personal LinkedIn profile once a day via GitHub Actions.
Fully free: no paid APIs, no paid hosting.

## 1. Create a LinkedIn app (one-time, ~5 minutes)

1. Create a LinkedIn **Page** if you don't already have one: https://www.linkedin.com/company/setup/new/
   (free, required only because LinkedIn apps must be linked to a Page — you'll still post from your personal profile).
2. Go to https://www.linkedin.com/developers/apps and click **Create app**.
   - Link it to the Page you just created.
3. In the app's **Products** tab, add these two self-serve products (no review needed):
   - **Sign In with LinkedIn using OpenID Connect**
   - **Share on LinkedIn**
4. In the app's **Auth** tab:
   - Note your **Client ID** and **Client Secret**.
   - Under "Authorized redirect URLs for your app", add: `http://localhost:8080/callback`

## 2. Get a LinkedIn access token (one-time, repeat every ~60 days)

LinkedIn access tokens for self-serve apps expire after 60 days and don't auto-refresh,
so you'll need to redo this step roughly every 2 months.

```
cd linkedin-auto-poster
npm run auth
```

It will prompt for env vars — run it like:

```
LINKEDIN_CLIENT_ID=your_client_id LINKEDIN_CLIENT_SECRET=your_client_secret npm run auth
```

(On Windows PowerShell:
`$env:LINKEDIN_CLIENT_ID="xxx"; $env:LINKEDIN_CLIENT_SECRET="yyy"; npm run auth`)

It prints a URL — open it in your browser, log in, and approve. The script catches the
redirect automatically and prints your **access token** in the terminal. Copy it.

## 3. Get a free Groq API key

1. Go to https://console.groq.com/keys
2. Create an API key (free tier, generous daily limits).

## 4. Push this folder to a GitHub repo (can be private, free)

```
cd linkedin-auto-poster
git init
git add .
git commit -m "Initial setup"
gh repo create linkedin-auto-poster --private --source=. --push
```

## 5. Add GitHub secrets

In the repo on GitHub: **Settings → Secrets and variables → Actions → New repository secret**

- `GROQ_API_KEY` — from step 3
- `LINKEDIN_ACCESS_TOKEN` — from step 2

## 6. Edit your topics

Open `topics.json` and replace the placeholder topics with your own. Each scheduled run
picks the next topic in the list, posts about it, and loops back to the start when it
reaches the end.

## 7. Done

The workflow in `.github/workflows/post.yml` runs daily at 9:00 AM UTC. Edit the `cron`
line to change the time, or go to the **Actions** tab on GitHub and click **Run workflow**
to post immediately and test it.

## Re-authorizing every ~60 days

When posts start failing with a 401 error, your LinkedIn token has expired. Repeat step 2
to get a new token, then update the `LINKEDIN_ACCESS_TOKEN` GitHub secret with the new value.
