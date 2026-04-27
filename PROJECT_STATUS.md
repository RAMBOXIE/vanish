# PROJECT STATUS — vanish

_Last updated: 2026-04-26_

## 0) Stability tier system (current as of 2026-04)

Vanish classifies all 20 routed subcommands into 4 stability tiers. The canonical mapping is in [`src/command-manifest.mjs`](src/command-manifest.mjs); the README's [Capability matrix](README.md#capability-matrix) and CLI's `vanish --help` both render from it (`tests/command-manifest.test.mjs` + `tests/readme-manifest-compliance.test.mjs` lock the consistency).

- **Core (8)** — stable, primary product surface, in hero: `scan`, `opt-out`, `verify`, `report`, `ai-scan`, `ai-opt-out`, `face-scan`, `face-opt-out`
- **Specialist (4)** — stable, narrower scope: `takedown`, `dataset-check`, `third-party-ai`, `clean-ai-history`
- **Labs (4)** — experimental / low-evidence / UX layers: `llm-memory-check` (D), `b1-live` (D, real HTTP but only Spokeo verifiable), `wizard` (UX layer), `dashboard` (UX layer)
- **Internal helpers (4)** — plumbing: `cleanup`, `b1-demo`, `queue`, `dashboard:watch`

Evidence grade legend: A=locally verifiable, B=action provable / result needs follow-up, C=classification or self-confirm, D=research probe.

## 1) Executive summary
vanish now includes a **hardened minimum viable real execution loop** for B1: user input → auth validation/secret-store loading → live HTTP submit or official-mode compliance block → persistent queueing (retry/manual review/DLQ) → signed audit trail → proof report.

vanish 已完成 B1 “真执行闭环”加固版：用户输入 → 授权校验/secret-store 加载 → 真实 HTTP 提交或官方模式合规阻断 → 持久化队列（重试/人工复核/DLQ）→ 签名审计 → 证明报告。

## 2) Completed milestones
### P0 (Completed)
- Manual trigger gate (`--manual` required)
- Triple confirmation gate for high-risk actions
- Pre-delete export decision gate (`ask|yes|no`)
- Notification mode branch (`none|telegram|email|signal`)
- Credential policy statement and enforcement checkpoints

### P1 (Completed)
- Sample intake via keywords and sample file
- Sample normalization + deduplication
- Structured JSON execution result
- Unit tests for critical guardrails
- Review flowchart (Mermaid)

### B1 MVP (Completed)
- Broker adapter registry for Spokeo, Whitepages, and BeenVerified
- Unified broker adapter interface: `prepareRequest`, `submit`, `parseResult`
- Persistent queue state store (`data/queue-state.json` + lock file)
- Retry queue + manual review queue persisted with restart recovery
- Queue CLI: `list`, `retry`, `resolve`
- Auth session module (env/session/auth-file), TTL check, scope check, task-end credential wipe
- B1 runner real-mode (`--live`) with status routing:
  - success → completed + audit
  - transient error → retry queue
  - over retry threshold → manual review queue
- Live-capable Spokeo adapter using configurable verifiable endpoint for real HTTP closure validation
- Phase-next hardening:
  - Official Spokeo endpoint skeleton with compliance block and anti-bot placeholders
  - Encrypted local secret store (Windows DPAPI preferred; AES-GCM fallback)
  - Retry/manual dedupe by broker/request/reason hash
  - Dead-letter queue for retry-limit and non-retryable failures
  - HMAC-signed audit events persisted in state

中文：B1 已完成真执行闭环（含持久化队列、授权校验、live 提交、队列重试升级、审计落地）。

### B2 Workflow Utilities (Completed)
- Quick Mode (`npm run quick` / `vanish quick` style subcommand) for minimal-input dry-run flow
- Local static Queue Dashboard with generated retry/manual-review/status JSON
- Dashboard auto-refresh toggle and `npm run dashboard:watch`
- Broker presets for Spokeo, Whitepages, BeenVerified
- DMCA presets for standard, urgent, followup
- Proof Report generator for Markdown audit reports under `reports/proof-<timestamp>.md`

中文：B2 已完成快速模式、本地队列看板、模板预设与 proof report 生成；仍遵守手动触发、三次确认、删除前导出询问与 dry-run 默认原则。

### B3 Conversation Wizard v1 (Completed)
- Added full wizard state machine engine (`src/wizard/engine.mjs`)
- Added prompt templates for all wizard states (`prompts/wizard/*.md`)
- Added CLI multi-turn simulator (`npm run wizard:demo`)
- Integrated quick-mode blocking responses with wizard-friendly `nextActions`
- Added wizard-focused test suite for progression, commands, and safety gates

中文：B3 已完成第一版对话向导，包含状态机、提示模板、CLI 演示、quick mode 联动与单元测试覆盖。

## 3) Quality checks
- `npm run dry` ✅
- `npm run quick` ✅ (expected safety block with nextActions when confirmations are missing)
- `npm run dashboard:build-data` ✅
- `npm run dashboard:watch` ✅ (short-run verification)
- `npm run report:proof` ✅
- `npm run wizard:demo` ✅ (interactive)
- `npm test` ✅ (includes wizard engine tests)
- `npm run b1:demo` ✅
- `npm run test:b1` ✅ (3/3 pass)

## 4) Current limitations
- Official Spokeo endpoint mode is intentionally blocked unless endpoint configuration and compliance fields are complete
- Live non-official Spokeo path currently uses a verifiable substitute endpoint (default Postman Echo), not official Spokeo production API
- Notification handlers are placeholders
- Whitepages/BeenVerified remain dry-run adapters
- Platform-specific social/DMCA takedown adapters not yet implemented
- Dashboard is local static JSON export with file-watch rebuild, not push streaming UI.

## 5) Next phase (P2)
1. Complete official broker endpoint contracts and compliance review.
2. Add platform strategy templates in `references/`.
3. Improve multilingual review outputs (EN primary / 中文辅助).
4. Add optional webhook notification mode (if approved).
5. Prepare production integration checklist before real API wiring.

## 6) Differentiation (vs. competitors)
- **Same functional target, different delivery form**: we target equivalent outcomes (privacy cleanup + takedown workflow), but deliver through an **Agent-native Skill** instead of a monolithic interface.
- **Conversational orchestration**: process is enforced through explicit state transitions with required fields and exit conditions.
- **Safety governance as protocol**: high-risk operations are blocked unless policy gates pass (manual mode, 3x confirmation, export decision).

与竞品关系：目标一致（完成清理与下架闭环），但形态不同（Skill 化、对话执行、可扩展适配器、安全闸门）。

## 7) Governance principles (locked)
- User decides authenticity.
- Tool provides process capability and evidence organization.
- No irreversible action without triple confirmation.
- No delete action without export decision prompt.
- Least privilege credentials with shortest lifetime.
