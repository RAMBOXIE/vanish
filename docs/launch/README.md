# Launch Materials

Pre-written posts and response templates for launching Vanish to the
privacy / open-source community.

**Before launching, also do**:
1. (Optional) Record a 30-second asciinema or gif demo — `vanish ai-scan --all`
   has the strongest visual punch (colored banner + score + quick wins)
2. Verify GitHub Pages is live at https://ramboxie.github.io/vanish/
3. Run `npm test` one last time (expect 129 passing — 109 original + 20 ai-scan)

## Positioning

Two killer claims for the posts:

1. **"Free alternative to DeleteMe / Optery / Incogni"** — familiar frame,
   clear value prop (saves $99-$129/yr).
2. **"Only tool that checks AI training exposure across 30 LLM platforms"** —
   unique angle, no commercial competitor covers this. LinkedIn (Sept 2024),
   Reddit (Google deal 2024), Twitter/X (Grok), Meta (forced opt-in) all
   flipped defaults to opted-in-by-default while no one was looking.

Leading with AI scan hooks the r/privacy crowd that's been discussing
these policy changes for months. Leading with brokers hooks the HN crowd
that's used DeleteMe and wants a cheaper/cleaner alternative.

## Files

- [`hn-show-hn.md`](./hn-show-hn.md) — Hacker News Show HN post (title, URL, author comment, timing)
- [`reddit-privacy.md`](./reddit-privacy.md) — r/privacy post (wait 48h after HN for social proof)
- [`faq.md`](./faq.md) — 18 predicted Q&A (tech, scope, business, performance, AI training)
- [`response-templates.md`](./response-templates.md) — 12 response templates for negative / tricky comments

## Recommended launch sequence

| Day | Action | Target |
|-----|--------|--------|
| **T-1** | Final README polish, asciinema demo, enable GH Pages | Pre-launch |
| **T+0** | Submit HN Show HN (Tue/Wed 8:30 AM US ET) | Hacker News |
| **T+0** | Reply to first 10 comments within 2h | First impression |
| **T+2d** | Post to r/privacy if HN >50 upvotes | Secondary wave |
| **T+7d** | Submit to [privacyguides.org](https://www.privacyguides.org/) for inclusion | Long-term SEO |
| **T+14d** | Post technical retrospective on dev.to / Hashnode | Developer audience |
| **T+30d** | First `verify` cycle on early users; collect success stories | Social proof |

## Do not do

- **No price-drop claims** ("will be free forever!") — just state current
  facts. MIT license already implies free.
- **No "revolutionary" / "game-changer"** language. HN and r/privacy will
  tear you apart.
- **No begging for upvotes**. Reddit will shadow-ban. HN will flag.
- **No cross-posting** the same post within 24 hours. Looks spammy.
- **No arguing with mods**. If a mod removes your post, ask politely
  what would make it acceptable.

## If launch underperforms

Don't delete the repo. Don't apologize publicly. Collect feedback, iterate
for 2-3 weeks, then try a different angle:
- r/selfhosted (different framing: "privacy CLI tool for selfhost crowd")
- Dev.to technical post (focus on architecture, not product pitch)
- Ship a substantial new feature, re-launch with "v0.3"
- Partner with a privacy influencer (ProtonMail blog, RestorePrivacy, etc.)

The #1 cause of OSS launch "failure" is the author disappearing after 2
weeks. Vanish's value compounds: every new broker, every verify success,
every issue closed makes the next post stronger.
