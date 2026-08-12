import { parentPort, workerData } from 'node:worker_threads';
import { DurableMemoryStore } from './DurableMemoryStore.mjs';
import { IdempotentAgentRunner } from './IdempotentAgentRunner.mjs';

const { dbPath, workerId, cycles, mode } = workerData;
const store = new DurableMemoryStore(dbPath, { initialize: false });
const runner = new IdempotentAgentRunner(store, { waitTimeoutMs: 60000, pollMs: 2 });

let executed = 0;
let replayed = 0;
const errors = [];
const timings = [];

try {
  for (let i = 0; i < cycles; i++) {
    const key = mode === 'duplicate' ? `dup-${i}` : `unique-${workerId}-${i}`;
    const request = { action: 'stress-cycle', slot: i, mode };
    const start = performance.now();

    try {
      const result = await runner.execute(key, request, async (cycleNumber) => {
        store.recordStressEffect(key, workerId);
        executed++;
        await new Promise((resolve) => setTimeout(resolve, (workerId + i) % 4));
        return { ok: true, cycleNumber, key };
      });
      if (result.replayed) replayed++;
    } catch (error) {
      errors.push({
        key,
        message: error instanceof Error ? error.message : String(error),
        code: error?.code ?? null
      });
    }

    timings.push(performance.now() - start);
  }
} finally {
  store.close();
}

parentPort.postMessage({ workerId, mode, executed, replayed, errors, timings });
