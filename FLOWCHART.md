# vanish Flowchart (MVP / dry-run)

> English-first with Chinese notes for review clarity.

```mermaid
flowchart TD
  A[Manual trigger: --manual 用户手动触发] --> B{Input source 输入来源}
  B -->|--keywords| C[Keyword candidate collection 占位]
  B -->|--sample-file| D[Load user sample JSON]
  C --> E[Normalize and deduplicate samples]
  D --> E

  E --> F[Responsibility notice: authenticity judged by user]
  F --> G{High-risk action? 高风险动作?}
  G -->|No| K[Proceed to dry-run execution]
  G -->|Yes| H[Confirm #1: action summary + impact]
  H --> I[Confirm #2: targets + irreversibility]
  I --> J[Confirm #3: final YES x3 gate]
  J --> L{Contains delete action?}
  L -->|Yes| M[Ask export decision ask/yes/no]
  L -->|No| K
  M --> K

  K --> N[Notification mode none/telegram/email/signal]
  N --> O[Emit structured JSON result]
  O --> P[End session: credential wipe policy]

  classDef block fill:#ffe6e6,stroke:#cc0000,color:#333;
  class H,I,J,M block;
```

## Audit checkpoints / 审计检查点
- `--manual` is mandatory; reject scheduled/background invocations.
- High-risk actions require 3 confirmations; cannot be bypassed.
- Export decision must be collected before delete.
- Notification is user-selected; no-notify is valid.
- Credentials: env-only read, no disk persistence, minimum scope, shortest TTL, wipe after task.
