# LinkedIn Auto Poster

Generates a human-sounding LinkedIn post + image from a topic (text via Groq's free
API, image via Pollinations.ai's free API), sends it to you on Telegram for review,
and publishes it to your personal LinkedIn profile only after you reply **APPROVE**.
Reply **REJECT** and it generates a fresh draft on the same topic instead.
Fully free: no paid APIs, no paid hosting.

## How the approval flow works

1. Once a day, a GitHub Actions workflow generates a draft (text + image) from the next
   topic in `topics.json` and sends it to you on Telegram, with instructions to reply
   `APPROVE` or `REJECT`.
2. A second workflow checks every 5 minutes for your reply:
   - `APPROVE` (or `ok`) → publishes the post + image to LinkedIn, advances to the next topic.
   - `REJECT` (or `no`) → discards the draft and sends you a new one for the same topic.
3. State (what's pending review, how far the topic rotation is) lives in `pending.json`
   and `topics.json`, committed back to the repo by the workflows.

### On-demand topics

When nothing is awaiting review, just send the bot any plain message describing a
topic (e.g. "a recent AWS security incident and what it teaches us") and it will draft
a post on exactly that topic and send it for review the same way - no need to wait for
the daily schedule or touch `topics.json`. This doesn't affect the topic rotation, so
the queue picks up where it left off afterward.

### How "trending" topics get grounded

For topics tagged with a category (or any on-demand request), the system pulls a few
real, recent headlines from Hacker News's free public search related to that topic and
feeds them to the model as context, so posts about "what's new" or "what's trending"
are grounded in something real instead of invented. This is lightweight grounding, not
a deep research engine - it works well for "is anything notable happening in AWS/cloud/
web dev right now," not for same-day breaking news or very niche topics.

**Note on the public repo:** since this repo needs to be public to stay within GitHub's
free Actions minutes at a 5-minute polling interval, `pending.json` (your draft post text,
before you approve it) is briefly visible to anyone browsing the repo until you approve or
reject it. No credentials are ever stored in the repo — API keys and tokens live only in
encrypted GitHub Secrets, which stay private even on a public repo.

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

## 4. Create your Telegram bot

1. Open Telegram, message **@BotFather**, and send `/newbot`.
2. Give it a display name (e.g. "LinkedIn Posts") and a unique username ending in `bot`
   (e.g. `linkedin_posts_bot` — BotFather will tell you if it's taken).
3. BotFather gives you a **bot token** — copy it.
4. Open a chat with your new bot and send it any message (e.g. "hi") so it knows about you.
5. Get your **chat ID** by visiting this URL in a browser (with your real token):
   `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   Find `"chat":{"id":...}` in the JSON response — that number is your chat ID.

## 5. Push this folder to a GitHub repo

This repo needs to be **public** (see note above) to stay within GitHub's free Actions
minutes at a 5-minute polling interval.

```
cd linkedin-auto-poster
git init
git add .
git commit -m "Initial setup"
gh repo create linkedin-auto-poster --public --source=. --push
```

## 6. Add GitHub secrets

In the repo on GitHub: **Settings → Secrets and variables → Actions → New repository secret**

- `GROQ_API_KEY` — from step 3
- `TELEGRAM_BOT_TOKEN` — from step 4
- `TELEGRAM_CHAT_ID` — from step 4
- `LINKEDIN_ACCESS_TOKEN` — from step 2

## 7. Edit your topics

Open `topics.json` and edit the list. Each entry is `{ "text": "...", "category": "..." }`
— `text` is the exact topic given to the model, `category` is a short keyword (e.g. "AWS",
"web security") used to search for grounding headlines. The rotation only advances to the
next topic once a draft on the current topic is **approved and published** — a rejected
draft retries the same topic.

## 8. Done

- `.github/workflows/generate-and-send.yml` runs daily at 9:00 AM UTC and sends you a draft.
- `.github/workflows/check-approval.yml` runs every 5 minutes and acts on your reply.

Edit the `cron` lines to change timing, or go to the **Actions** tab on GitHub and click
**Run workflow** on either one to trigger it manually for testing.

## Re-authorizing every ~60 days

When publishing starts failing with a 401 error, your LinkedIn token has expired. Repeat
step 2 to get a new token, then update the `LINKEDIN_ACCESS_TOKEN` GitHub secret.
