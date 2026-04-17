---
name: holmes-cleanup
description: Privacy scanner + opt-out orchestrator for 200 data brokers. Scan your exposure in 10s (0-100 score), then remove with a guided 18-step wizard. Free open-source alternative to DeleteMe / Optery / Incogni. Agent-native, audit-signed (HMAC-SHA256), local-first. Triple-confirm safety gates for high-risk actions; user-controlled export decision before any delete; shortest-TTL credentials wiped after task.
version: 0.2.0
metadata:
  openclaw:
    requires:
      env:
        - HOLMES_AUDIT_HMAC_KEY
        - HOLMES_SECRET_MASTER_KEY
      bins:
        - node
    primaryEnv: HOLMES_AUDIT_HMAC_KEY
    emoji: "🔍"
    homepage: https://github.com/RAMBOXIE/holmes-cleanup
    os:
      - macos
      - linux
      - windows
    always: false
    skillKey: holmes
---

# holmes-cleanup

## Operating principles / 执行原则
1. Manual trigger only (no scheduled scan mode).
2. No cooldown period; high-risk actions require triple confirmation.
3. Always ask export decision before delete.
4. Notification is user-selected; no clawbot => no notification is acceptable.
5. User judges authenticity; tool provides workflow and organization only.
6. Credentials: shortest TTL, minimum scope, wipe after task.

## Standard flow (MVP)
1. Start session from explicit manual request.
2. Ingest samples from keywords + user-provided evidence.
3. Show responsibility note (user decides authenticity).
4. Build action plan and classify risk level.
5. Run 3-step confirmation for high-risk actions.
6. Ask export decision before any delete action.
7. Execute dry-run actions and produce structured result.
8. Apply notification preference.
9. End session and enforce credential wipe policy.

## Run examples
```bash
# failure: missing confirmations
npm run run -- --manual --keywords "k1,k2" --export-before-delete ask --export-answer yes

# success: full dry-run
npm run run -- --manual --keywords "k1,k2" --sample-file ./examples/sample.json \
  --confirm1 YES --confirm2 YES --confirm3 YES \
  --export-before-delete ask --export-answer no --notify none
```

## Boundaries / 边界
- Current phase is non-destructive dry-run only.
- No real external API calls.
- No real credential persistence.
