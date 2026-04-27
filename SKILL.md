---
name: vanish
description: Privacy scanner + opt-out orchestrator covering 210 data brokers, 30 AI training platforms, 8 face-search services, 13 third-party AI tools (incl. workforce-monitoring), 12 NCII-takedown destinations, plus LLM memorization probing, training-dataset membership checks, and AI history cleanup. Free agent-native alternative to DeleteMe / Optery / Incogni that also covers AI-era threats they don't. Audit-signed (HMAC-SHA256), local-first, triple-confirm safety gates for high-risk actions.
version: 0.3.0
metadata:
  openclaw:
    requires:
      env:
        - VANISH_AUDIT_HMAC_KEY       # REQUIRED in production; dev/test warn-and-use-default-key
      bins:
        - node                        # >= 20
    optionalEnv:
      - name: VANISH_SECRET_MASTER_KEY
        when: "when using the encrypted secret-store with --unlock-master-key (AES-GCM fallback path used only when Windows DPAPI unavailable)"
      - name: OPENAI_API_KEY
        when: "ONLY for `vanish llm-memory-check` against OpenAI. Not needed for any other subcommand. --dry-run bypass exists."
      - name: ANTHROPIC_API_KEY
        when: "ONLY for `vanish llm-memory-check` against Anthropic Claude. Same --dry-run bypass."
      - name: "<BROKER>_LIVE_ENDPOINT"
        when: "ONLY for `vanish b1-live` (experimental adapter). Overrides per-broker HTTP submission URL. Default: postman-echo.com test endpoint."
      - name: "<BROKER>_OFFICIAL_*_ENDPOINT"
        when: "ONLY for official broker live mode. Compliance-gated — requires termsAccepted, lawfulBasis, operatorId before use."
    primaryEnv: VANISH_AUDIT_HMAC_KEY
    emoji: "🔍"
    homepage: https://github.com/RAMBOXIE/vanish
    os:
      - macos
      - linux
      - windows
    always: false                     # NEVER auto-run. No per-reply hook.
    skillKey: vanish
---

# vanish

> Privacy scanner + opt-out orchestrator. Free open-source alternative to DeleteMe ($129+/yr), Optery ($99+/yr), Incogni ($99+/yr) that **also covers the AI-era threats they don't**. Agent-native, audit-signed, local-first.

---

## 🔎 Clawhub compliance declaration

This skill:
- **Never runs automatically.** `always: false` in frontmatter. No per-reply hook, no cron install, no scheduled task.
- **Never sends notifications on its own.** `--notify` flag exists only as a dry-run placeholder (validated against `none|telegram|email|signal`) — no SMTP, Twilio, Signal, Telegram, SendGrid, or similar client library is imported or wired anywhere.
- **Only writes files to declared paths.** See "Filesystem access" section below for the exhaustive list.
- **Only makes network calls to declared endpoints.** See "Network access" section for every outbound target.
- **Declares all environment variables it reads.** See `optionalEnv` in frontmatter for conditional requirements (e.g., `OPENAI_API_KEY` is only read when the user explicitly runs `vanish llm-memory-check` without `--dry-run`).
- **Never installs system-level daemons** — no `crontab` entries, no `launchctl` services, no `schtasks`, no `systemd` units.
- **Invokes a fixed allowlist of system binaries** for browser-opening and clipboard ops (see "System binaries invoked").

---

## Capabilities — 20 subcommands across 5 threat surfaces

**Stability tiers**: Vanish classifies every routed subcommand into one of four tiers — **Core** (8: stable, in hero), **Specialist** (4: stable, narrower scope), **Labs** (4: experimental / low-evidence / UX layers), and **Internal helpers** (4: plumbing). The canonical mapping with tier + evidence grade (A/B/C/D) per command lives in [`src/command-manifest.mjs`](src/command-manifest.mjs); README's [Capability matrix](README.md#capability-matrix) and CLI's `vanish --help` both render from it. The threat-surface grouping below is for narrative; cross-reference the manifest for the stability call.

### 🏢 Data brokers (original v0.2 scope)
- **`scan`** [Core, evidence C] — Heuristic triage across 210 brokers. 0-100 score. Pure local computation, zero network calls. 10-second wall clock.
- **`opt-out`** [Core, evidence B] — Browser-assisted opt-out walkthrough for 58 brokers (opens browser, pre-fills clipboard, you solve captchas). Records HMAC-signed audit + 30-day verify follow-up.
- **`verify`** [Core, evidence A/B] — Re-check past opt-out submissions. Broker entries: HTTP liveness (A). AI-platform / face-service entries: reminder walkthrough with manual confirm (B). One-shot kinds (takedown, history) explicitly skipped.
- **`b1-live`** [Labs, evidence D] — ⚠️ **Labs / experimental** live HTTP submission adapter for 8 brokers. Captchas block real use. Defaults to `postman-echo.com` test endpoint; only Spokeo has a verifiable substitute path in MVP. Use `opt-out` for real work.
- **`cleanup`** [Internal helper], **`wizard`** [Labs, UX layer], **`queue`** [Internal helper], **`report`** [Core, evidence A], **`dashboard`** [Labs, UX layer] — supporting workflow commands (dry-run cleanup, 18-state conversational wizard, queue management, proof-report rendering, static dashboard builder). Plus `b1-demo` and `dashboard:watch` as Internal helpers.

### 🤖 AI training exposure (v0.3)
- **`ai-scan`** [Core, evidence C] — Classify 30 LLM platforms (ChatGPT / Claude / Gemini / LinkedIn / Reddit / Cursor / etc.) as exposed / licensed / safe / action-needed. Zero network calls. Takes only platform names, no personal data.
- **`ai-opt-out`** [Core, evidence B] — Walkthrough + browser-assisted opt-out for 26 of the 30. Each tool has exact UI toggle name + step-by-step + tier overrides. 60-day reverify (AI platforms silently reset settings).

### 👤 Face-search (v0.3)
- **`face-scan`** [Core, evidence C] — Directory of 8 face-recognition services (PimEyes, FaceCheck.ID, FindClone, Lenso, TinEye, Yandex, Google Lens, Clearview AI). Vanish never handles your photo — opens each service's own search page + prints walkthrough.
- **`face-opt-out`** [Core, evidence B] — Guided deletion requests including Clearview (CCPA/GDPR — LE-only DB you can't search). HMAC audit + 30-day (60 for Clearview) reverify.

### 🧠 Advanced AI-era checks (v0.3)
- **`llm-memory-check`** [Labs, evidence D] — Probe OpenAI + Anthropic with 15 stalker-style prompts, detect verbatim leaks of user identifiers. **Requires user's own API keys in env** (optional: `--dry-run` uses a mock provider). ~$0.01/scan. A clean result does NOT prove safety — paraphrased knowledge slips through.
- **`dataset-check`** [Specialist, evidence B (Common Crawl) / C (others)] — Check if your URL is in Common Crawl (real CDX API query) / LAION / Pile / C4 / WebText / RedPajama / Dolma / FineWeb (walkthrough). Only outbound call: `index.commoncrawl.org` for CC lookup.
- **`clean-ai-history`** [Specialist, evidence B/C] — Discover where AI tools store conversation history on your disk; prints exact shell command to delete. **Vanish never runs `rm` for you** — you copy-paste. Covers 9 tools (Cursor / VS Code Copilot / Claude Desktop / ChatGPT Desktop + 5 web).
- **`third-party-ai`** [Specialist, evidence B] — Catalog + objection-letter generator for 22 AI tools others use on you (workplace meetings, HR/recruiting AI, medical scribes, workforce-monitoring agents). Jurisdiction-cited letters (GDPR Art 21/22/88, CCPA / AB-331, Illinois AIVIA + BIPA, NY Local Law 144 + Electronic Monitoring Act, HIPAA, German BetrVG §87). Includes `--detect-installed` to scan local machine for 8 commercial workforce-monitoring vendors (ActivTrak / Teramind / Hubstaff / Time Doctor / Insightful / Veriato / InterGuard / Viva Insights).

### 🛡️ NCII / leak takedown (v0.3)
- **`takedown`** [Specialist, evidence B] — DMCA letters for 12 leak sites + StopNCII.org hash-registry walkthrough + Google intimate-imagery form + 4 legal templates (DMCA §512(c) / C&D / police report / civil pre-suit). Jurisdictions: US federal (DMCA / SHIELD Act / Take It Down Act 2025), EU GDPR, UK OSA, Canada §162.1, Australia OSA. Vanish never submits — drafts only.

---

## Network access (all outbound targets)

**Scan + offline subcommands (zero network)**: `scan`, `ai-scan`, `face-scan`, `third-party-ai` (without `--detect-installed` is offline too), `takedown` (drafts only), `clean-ai-history` (read-only path discovery), `llm-memory-check --dry-run`.

**Subcommands with declared outbound HTTP**:

| Subcommand | Endpoint | When | User consent |
|-----------|----------|------|-------------|
| `verify` | Broker profile URLs supplied by previous `opt-out` runs | HTTP liveness check on stored `profileUrl` | User added the URL via prior `opt-out` |
| `b1-live` | `postman-echo.com` (default) or `<BROKER>_LIVE_ENDPOINT` | EXPERIMENTAL live submission | Explicit `--live` flag required |
| `dataset-check` | `index.commoncrawl.org` CDX API | Only when `--url` + Common Crawl are selected | User supplies the URL |
| `llm-memory-check` | `api.openai.com`, `api.anthropic.com` | Only without `--dry-run` | User supplies their own API key + specifies providers |
| `ai-opt-out`, `face-opt-out`, `face-scan`, `clean-ai-history`, `takedown` | **none** — these only `spawn` the local OS "open URL" binary to launch the user's browser. No HTTP from the Node process. | — | User can pass `--no-open` |

Every outbound request sends a clear `User-Agent: Vanish-Verify/1.0 (opt-out verification; https://github.com/RAMBOXIE/vanish)` for broker verify, or the standard SDK UA for OpenAI/Anthropic.

---

## Filesystem access

### Writes
| Location | Used by | Data |
|----------|---------|------|
| `data/queue-state.json` (default) or `--state-file <path>` | All subcommands producing audit | Follow-up queue + HMAC-signed audit log |
| `data/queue-state.json.lock` | Queue mutations | Transient lock file (cleaned post-mutation; stale-lock detection has 30s TTL) |
| `data/*.json` | `dashboard` (build-dashboard-data) | Denormalized queue state for the static dashboard HTML |
| User-supplied `--output <path>` | `scan`, `ai-scan`, `third-party-ai`, `takedown`, `dataset-check --json` | Report/letter files |
| `os.tmpdir()/vanish-*` | Tests only | Test isolation dirs (cleaned in `finally` blocks) |
| Per-secret file under secret-store directory | `auth/secret-store` | scrypt-KDF + AES-GCM (Windows: DPAPI preferred) |

### Reads
- Catalog JSON files (read-only, bundled in repo): `src/adapters/brokers/config/broker-catalog.json`, `src/ai-scanner/ai-platforms-catalog.json`, `src/face-scanner/face-services-catalog.json`, `src/ai-history/history-catalog.json`, `src/dataset-check/datasets-catalog.json`, `src/third-party-ai/third-party-catalog.json`, `src/takedown/takedown-catalog.json`, `src/llm-memory/probe-catalog.json`.
- `data/queue-state.json` for audit/verify.
- User-supplied paths via `--state-file`, `--output-json`, `--output-md`, `--share-card`, `--profile-url`.

### Scans (stat() only, read-only, never modifies)
- `clean-ai-history` stats per-OS AI-tool cache paths (e.g., `%APPDATA%\Cursor\User\History`, `~/Library/Application Support/Cursor/`) — reports size, prints shell command, **never deletes**.
- `third-party-ai --detect-installed` stats per-OS workforce-monitoring install paths (e.g., `%PROGRAMFILES%\ActivTrak`, `/Applications/Teramind.app`) — reports what's installed, **never modifies**.

### Never writes outside: user-supplied paths, `data/`, `os.tmpdir()`. No `fs.rename` or `fs.unlink` calls outside the lock-file and session-temp lifecycle.

---

## System binaries invoked

| Binary | Use | Subcommands | Safe? |
|--------|-----|-------------|-------|
| `cmd /c start` | Windows — open URL in default browser | `opt-out`, `ai-opt-out`, `face-opt-out`, `face-scan`, `clean-ai-history`, `takedown` | Yes — user-facing browser only |
| `open` | macOS — open URL | same | Yes |
| `xdg-open` | Linux — open URL | same | Yes |
| `clip` | Windows clipboard write | `ai-opt-out --clipboard` | Yes — copies target setting name so user can Ctrl+F on the page |
| `pbcopy` | macOS clipboard | same | Yes |
| `xclip` / `xsel` | Linux clipboard | same | Yes (attempts both; silently no-ops if neither installed) |

All browser-open + clipboard invocations honor `--no-open` to skip in scripted/test mode.

---

## Operating principles

1. **Manual trigger only** — every subcommand requires explicit invocation. `always: false` in frontmatter. No automation hooks.
2. **Triple YES confirmation** for any high-risk action (3 separate wizard states, each needing exact `YES`).
3. **Export decision** (`yes` / `no`) required before any delete.
4. **User-selected notification** — `--notify` is a dry-run placeholder; no actual sending.
5. **User owns legal judgment** — Vanish provides workflow capability, not legal advice. Templates cite real law but are not legal representation.
6. **Credentials**: minimum scope, shortest TTL, encrypted storage, post-task wipe. HMAC key required in production.
7. **Never submit destructive actions on the user's behalf** — we open pages, show exact commands, record audits. The user clicks submit, runs `rm`, sends the letter.

---

## Safety gates enforced by code

| Gate | Enforcement |
|------|-------------|
| Manual trigger | `--manual` flag required for cleanup; missing flag returns `blocked` with clear `nextActions` |
| Triple confirmation | Three separate states each require exact `YES`; any mismatch blocks |
| Export decision | Must be `yes` or `no` before EXECUTE; `ask` without answer = hard block |
| HMAC signing | Every persisted state mutation signed with `VANISH_AUDIT_HMAC_KEY` |
| Credential lifetime | TTL enforced by `AuthSession.validate({ minTtlSeconds })` |
| Secret storage | scrypt KDF + per-secret salt; Windows DPAPI preferred, AES-GCM fallback |
| Compliance block | `b1-live` official mode requires `termsAccepted`, `lawfulBasis`, `operatorId` |
| Destructive action gating | `clean-ai-history` only prints commands; `takedown` only drafts letters; `face-scan`/`face-opt-out` never upload photos |

---

## Run examples

### Scan (zero network, recommended first step)
```bash
vanish scan --name "John Doe" --email "j@example.com" --phone "+15550101"
vanish scan --name "..." --output-md ./my-report.md
```

### AI training exposure
```bash
vanish ai-scan --linkedin --chatgpt --cursor
vanish ai-opt-out --chatgpt --linkedin    # browser-assisted walkthrough
```

### Face search
```bash
vanish face-scan --pimeyes --facecheck
vanish face-opt-out --pimeyes --clearview
```

### Workforce monitoring
```bash
vanish third-party-ai --detect-installed    # local scan for 8 commercial agents
vanish third-party-ai --context workforce-monitoring \
  --detect-installed \
  --jurisdiction US-state-NY-EMA \
  --company "Acme Corp" \
  --output workforce-objection.md
```

### NCII takedown
```bash
vanish takedown --stopncii                         # hash-register (most effective free tool)
vanish takedown --dmca-letter --all-leak-sites \
  --name "Your Name" --email "legal@you.com" \
  --output dmca-package.md
```

### Full interactive wizard
```bash
vanish wizard
```

### Zero-install via npx
```bash
npx github:RAMBOXIE/vanish scan --name "..." --email "..."
```

---

## Coverage summary

| Threat surface | Catalog size | Walkthrough count | Live-adapter count |
|----------------|:-----------:|:-----------------:|:------------------:|
| Data brokers | 210 | 58 | 8 (experimental) |
| AI training platforms | 30 | 26 | 0 |
| Face-search services | 8 | 8 | 0 |
| Third-party AI tools (incl. workforce-monitoring) | 22 | — | 0 |
| NCII takedown destinations | 12 leak sites + 3 hash registries + 3 search engines | — | 0 |
| Training datasets | 8 | — | 1 (Common Crawl CDX) |
| AI history locations | 9 (4 local-app + 5 web) | — | 0 |
| LLM memorization providers | 2 (OpenAI + Anthropic) | — | API-based, user-key |

**The three "coverage" columns are NOT the same thing. Triage ≠ walkthrough ≠ automated submission. See the capability matrix in README for the distinction.**

---

## Tests

**334 tests** across 26 files. Every commit runs 6-job matrix: Ubuntu/macOS/Windows × Node 20/22.

Coverage includes: safety gates · queue state persistence · retry/dead-letter routing · secret encryption (scrypt KDF) · HMAC audit signing with canonical JSON · timing-safe verification · wizard state transitions · scan scoring heuristic · 210-broker catalog registration · live HTTP round-trip against postman-echo · 30/60-day verify reverification · browser-assisted opt-out flows · share card rendering (broker + triple-threat v2) · AI training classification · face-scan service directory · LLM leak detection with mock fetch · Common Crawl CDX query with mock fetch · AI history cross-platform path expansion · third-party AI objection-letter rendering · workforce-monitoring detection with mock filesystem · takedown DMCA letter substitution · legal-jurisdiction clause dispatch across 10 jurisdictions.

Run: `npm test`

---

## Non-goals (explicit scope boundaries)

Vanish does **NOT**:
- Run as a background service or scheduled task
- Send email, SMS, or push notifications
- Kill processes, terminate services, or alter system configuration
- Block phone-home traffic from monitoring tools
- Provide anti-detection or anti-forensics against monitoring software
- Auto-submit legal documents or send letters for you
- Auto-delete files from your disk (print commands; you execute)
- Upload your photos, emails, documents, or identity information anywhere

These are deliberate. Every capability is scoped to **identification + documentation + evidence + drafted-request generation**. The user is always the final actor.

---

## Attribution

**DeleteMe®**, **Optery®**, and **Incogni®** are trademarks of their respective owners (Abine, Inc.; Optery, Inc.; Surfshark B.V.). Vanish is not affiliated with, endorsed by, or sponsored by any of these services. References exist solely for factual comparison (truthful comparative advertising permitted under US Lanham Act §43(a), EU Directive 2006/114/EC).

Pricing references ($99+/yr, $129+/yr) are entry-tier and approximate as of April 2026.

MIT-licensed — see LICENSE.
