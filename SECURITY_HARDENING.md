# Security Hardening

## Credential Strategy
The local secret store lives in `src/auth/secret-store.mjs` and exposes:

- `setSecret(name, plaintext, { ttlSeconds, tags })`
- `getSecret(name)`
- `deleteSecret(name)`
- `listMeta()`

`listMeta()` returns only metadata: name, provider, timestamps, expiry state, and tags. It does not return plaintext, ciphertext, IVs, or authentication tags.

On Windows, the store prefers DPAPI through PowerShell `ConvertFrom-SecureString`, binding encrypted values to the current Windows user profile. On other platforms, or when tests force fallback mode, it uses AES-256-GCM with a key derived from `HOLMES_SECRET_MASTER_KEY`.

TTL is enforced at read time. Expired secrets reject with `SECRET_EXPIRED` and are not returned to callers. `session-auth.mjs` can load token/cookie values from the store via `HOLMES_AUTH_TOKEN_SECRET_NAME`, `HOLMES_AUTH_COOKIE_SECRET_NAME`, or matching runner input fields.

Operational rules:
- Use the shortest practical `ttlSeconds`.
- Prefer scoped broker tokens over broad account credentials.
- Do not log plaintext credentials.
- Delete task-specific secrets after the task or let TTL expiry block reuse.

## Audit Strategy
Audit signing lives in `src/audit/signature.mjs`. Events are canonicalized, signed with HMAC-SHA256, and persisted with:

- `signatureAlgorithm: HMAC-SHA256`
- `signature: sha256=<hex>`

The signing key comes from `HOLMES_AUDIT_HMAC_KEY`; a local development fallback exists for tests and non-production dry runs. Production-like runs should set an environment-specific key and preserve queue-state history as an append-only artifact when possible.

Queue state now persists retry, manual review, dead-letter, completed, failed, and audit arrays. Retry-limit and non-retryable failures are routed to the dead-letter queue. Retry/manual/DLQ enqueue paths deduplicate by `hash(broker + requestId + reason)` to prevent repeated operator noise while retaining `seenCount`, `lastSeenAt`, and retry attempt metadata.

## Official Endpoint Compliance
Spokeo official endpoint configuration is stored in `src/adapters/brokers/config/official-endpoints.json`. Official mode blocks unless:

- An official endpoint is enabled and configured.
- `termsAccepted` is exactly `true`.
- `lawfulBasis` is present.
- `operatorId` is present.

Anti-bot placeholders are explicit and conservative: rate limiting, jitter, declared automation user-agent strategy, and captcha-to-human queue routing. The implementation does not bypass captchas or access controls.

## 中文补充
本阶段的安全加固重点是“凭证不明文落地、审计可验证、失败可追踪”。

凭证存储：
- Windows 环境优先使用 DPAPI，绑定当前用户上下文。
- 非 Windows 或测试 fallback 使用 AES-GCM，并要求 `HOLMES_SECRET_MASTER_KEY`。
- `listMeta()` 只返回元数据，不返回明文或可解密材料。
- TTL 过期后读取会被拒绝，避免长期凭证被重复使用。

审计与队列：
- 审计事件使用 HMAC-SHA256 签名，便于检测篡改。
- 超过最大重试次数和不可重试错误进入 DLQ。
- 重试、人工复核、DLQ 都按 broker/requestId/reason 去重，减少重复噪音，同时保留出现次数和最近出现时间。

官方 endpoint：
- Spokeo 官方模式默认阻断。
- 必须配置 endpoint，并确认 `termsAccepted`、`lawfulBasis`、`operatorId` 后才允许执行。
- captcha 只能进入人工处理队列，不允许绕过。
