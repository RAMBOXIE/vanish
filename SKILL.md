---
name: holmes-cleanup
description: Manual-first privacy and anti-piracy cleanup skill for one-off sessions. Use when users explicitly request manual cleanup/takedown/delete workflows, need keyword + user-provided sample intake, require strict 3-step confirmation for high-risk actions, must decide export-before-delete, and want user-selected notification behavior. Authenticity judgment remains with the user; tool provides process capability only. Credential handling follows minimum scope, shortest TTL, and post-task wipe.
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
