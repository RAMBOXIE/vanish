# REAL LOOP STATUS (MVP)

## End-to-end command A: success loop (live)
```bash
node scripts/b1-live.mjs run --live --request-id e2e-success-001 --full-name "Live Success" \
  --auth-token demo_token --auth-scopes submit:spokeo --auth-expires-at 2026-12-31T00:00:00.000Z \
  --output-json reports/e2e-success.json
```
Key output:
- `status: ok`
- `mode: live`
- `results[0].evidence.httpStatus: 200`
- `results[0].evidence.echoRequestId: e2e-success-001`

## End-to-end command B: fail -> retry -> dead letter
```bash
node scripts/b1-live.mjs run --live --state-file data/e2e-state.json --request-id e2e-fail-001 \
  --simulate transient-error --auth-token demo_token --auth-scopes submit:spokeo --auth-expires-at 2026-12-31T00:00:00.000Z \
  --output-json reports/e2e-fail-step1.json

node scripts/queue-cli.mjs retry --state-file data/e2e-state.json --id retry:<dedupeKey> \
  --auth-token demo_token --auth-scopes submit:spokeo --auth-expires-at 2026-12-31T00:00:00.000Z

node scripts/queue-cli.mjs retry --state-file data/e2e-state.json --id retry:<dedupeKey> \
  --auth-token demo_token --auth-scopes submit:spokeo --auth-expires-at 2026-12-31T00:00:00.000Z
```
Key output:
- step1: `summary.retryQueued: 1`
- retry#1: same retry item deduped with incremented `attempt: 2`
- retry#2: `summary.deadLetterQueued: 1`, DLQ reason `retry_limit_reached`

## Phase-next hardening verification
- Official Spokeo endpoint skeleton blocks by default unless `termsAccepted`, `lawfulBasis`, `operatorId`, and configured endpoint are present.
- Secret store supports `setSecret/getSecret/deleteSecret/listMeta` with TTL rejection and no plaintext metadata exposure.
- Audit events persisted through queue state include `signatureAlgorithm: HMAC-SHA256` and `signature: sha256=<hex>`.
- Dashboard data now includes `dead-letter-queue.json`; `npm run dashboard:watch` rebuilds files when the state file changes.

## Proof reports
- Success proof: `reports/proof-2026-04-15T12-41-32-741Z.md`
- Failure/retry proof: `reports/proof-2026-04-15T12-41-43-571Z.md`

## Reality scope
- Real in MVP: live HTTP request + persisted queues + retry/DLQ transitions + signed audit/proof artifacts.
- Guarded skeleton in MVP: official Spokeo endpoint integration with compliance and anti-bot placeholders.
- Substitute in MVP: non-official live endpoint is configurable verifiable endpoint (default Postman Echo), not official Spokeo production integration.
