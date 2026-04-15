# B1 STATUS

_Last updated: 2026-04-15_

## Summary
B1 MVP is implemented as a dry-run broker pipeline. It provides a registry, three broker adapters, retry/manual-review queues, an orchestrator, a demo script, and focused tests.

中文备注：B1 当前是 dry-run，不会访问真实数据经纪商，也不会提交真实请求。

## Implemented
- `src/adapters/registry.mjs` resolves broker adapters by name.
- Broker adapters under `src/adapters/brokers/` cover `spokeo`, `whitepages`, and `beenverified`.
- Each broker adapter exposes `prepareRequest`, `submit`, and `parseResult`.
- `src/queue/retry-queue.mjs` supports configurable exponential backoff.
- `src/queue/manual-review-queue.mjs` stores `reason`, `payload`, `createdAt`, and `status`.
- `src/orchestrator/b1-runner.mjs` executes broker lists, aggregates results, queues transient errors, and escalates retry-limit cases to manual review.
- `scripts/b1-demo.mjs` prints a structured JSON dry-run result.

## Validation
- `npm run test:b1`
- `npm run b1:demo`

中文备注：测试覆盖瞬时错误进入重试队列、超过阈值进入人工复核、成功路径不入队。

## Limits
- No real network calls.
- No credential handling.
- Broker responses are simulated for pipeline validation only.
