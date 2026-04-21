# Hacker News Show HN — Launch Post

## Target submission page
https://news.ycombinator.com/submit

## Title (copy exactly, < 80 chars)

```
Show HN: Vanish – scan 210 data brokers + 30 AI training platforms
```

**Alternative titles if the above feels overused**:
- `Show HN: Vanish – find who's training AI on your data (30 platforms, open-source)`
- `Show HN: Vanish – open-source DeleteMe alternative + AI training opt-out scan`
- `Show HN: Vanish – privacy scanner for 210 data brokers, MIT licensed`

## URL field

```
https://github.com/RAMBOXIE/vanish
```

**Do not fill the Text field** when submitting. HN convention: Show HN posts
that have both a URL and Text are split oddly. Submit URL-only.

## Author comment (post as the FIRST comment yourself, immediately after)

```
Hi HN! Author here. Quick context on why this exists:

I looked at DeleteMe ($129+/yr), Optery ($99+/yr), Incogni ($99+/yr) and
realized the core job is: fill out opt-out forms, wait for email verification,
re-check in 30 days. That doesn't need a subscription.

What's in the repo:

• Local scan of 210 data brokers → 0-100 privacy score.
  Pure heuristic — no API calls, no data transmitted. Runs in browser
  (https://ramboxie.github.io/vanish/) or CLI (npx github:RAMBOXIE/vanish).
• Browser-assisted opt-out for 58 brokers: Vanish opens the real opt-out URL,
  pre-fills the form data in your clipboard, you solve the captcha and click
  submit (~3 seconds per broker).
• 30-day HTTP liveness verify (`vanish verify`) proves whether removal
  actually worked — classifies each as removed / still-present / unknown.
• AI training exposure scan (`vanish ai-scan`): 30 LLM-training platforms
  (LinkedIn, Reddit, ChatGPT, Claude, Gemini, Copilot, Grammarly + 23 more)
  classified as exposed / licensed / safe / action-needed. Every big platform
  quietly flipped to opted-in-by-default in 2024-2025 — LinkedIn's AI-training
  toggle, Reddit's Google deal, Twitter/X feeding Grok, Meta's forced opt-in.
  DeleteMe / Optery / Incogni don't cover any of this.
• HMAC-signed audit trail; encrypted local secret store (scrypt + per-secret
  salt).
• Covers all 3 US credit bureaus (Equifax / Experian / TransUnion) —
  DeleteMe and Optery don't.

Honest limits:
- Captchas are YOUR job. I refuse to hook 2captcha — breaks the zero-cost
  open-source promise.
- Email verification links are your job (we remind you in the flow).
- 58/210 brokers for opt-out (rest are scan-only blueprints with verified
  opt-out URLs — add endpoint config to upgrade).
- No legal review. Use at your own risk.

Would love feedback from anyone who's tried DeleteMe/Optery/Incogni — what
did they do that I'm missing? And suggestions for the next 50 brokers to add.

https://github.com/RAMBOXIE/vanish
```

## Timing

- **Best time to submit**: Tuesday or Wednesday, 8:30–9:30 AM US Eastern
  (= Beijing 9:30 PM–10:30 PM)
- **Avoid**: Monday mornings (everyone's on email catch-up), Friday afternoons
  (crowd already checking out), weekends (front page moves slower)

## What to do in the first 2 hours (critical window)

- Check https://news.ycombinator.com/show every 10-15 min for your post
- **Reply to every single comment**, even just "thanks, that's a great point"
- If a bug is reported, don't argue — acknowledge, say "I'll fix it today"
- If negative (design critique, scope concern, legal worry), stay calm and
  respond with facts. See `response-templates.md`.

## What "success" looks like

- **>100 upvotes in 2 hours** → you're on front page; expect 5k-20k repo visits
- **>50 upvotes in 2 hours** → healthy discussion, maybe late front page
- **20-50 upvotes** → meh but useful feedback
- **<20 upvotes** → too late to worry; collect feedback, iterate, retry in 2-3 weeks

## Day-after actions (if successful)

1. Write down top 3 criticisms from comments
2. Fix the easiest one within 24h, tweet/post "updated"
3. Post to r/privacy with HN discussion URL as social proof (see `reddit-privacy.md`)
4. Submit to privacyguides.org for inclusion review
