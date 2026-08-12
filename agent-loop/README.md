# Durable Agent Loop

This module provides a SQLite-backed cycle store, idempotent execution coordinator, and a real worker-thread stress test.

## Requirements

- Node.js >= 22.13
- Uses built-in `node:sqlite`; no third-party database package is required.

## Guarantees tested

- SQLite allocates cycle numbers atomically with `INTEGER PRIMARY KEY AUTOINCREMENT`.
- `idempotency_key` is `UNIQUE`, so concurrent duplicate requests collapse to one durable cycle.
- Reusing an idempotency key with a different request hash is rejected.
- Completed executions survive a process restart and replay their stored result without repeating side effects.
- Interrupted executions are marked explicitly and are not automatically re-executed.
- Schema and WAL setup are performed by one coordinator before worker connections start, avoiding startup `database is locked` races.

## Stress test

```bash
cd agent-loop
npm run test:stress
```

Defaults to 10 concurrent workers and 100 cycles per worker.

Override with:

```bash
STRESS_WORKERS=20 STRESS_CYCLES=250 npm run test:stress
```

The test has two concurrency phases:

1. 1,000 unique requests must produce 1,000 durable rows and 1,000 side effects.
2. Ten workers replay the same 100 idempotency keys. Exactly 100 original executions may occur; the other 900 requests must replay the durable result.

It also closes and reopens the database to verify restart behavior.
