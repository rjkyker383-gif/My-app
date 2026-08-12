import { Worker } from 'node:worker_threads';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DurableMemoryStore } from './DurableMemoryStore.mjs';
import { IdempotentAgentRunner } from './IdempotentAgentRunner.mjs';

const CONCURRENT = Number(process.env.STRESS_WORKERS ?? 10);
const CYCLES = Number(process.env.STRESS_CYCLES ?? 100);

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function runWorker(dbPath, workerId, mode) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./stress-worker.mjs', import.meta.url), {
      workerData: { dbPath, workerId, cycles: CYCLES, mode }
    });
    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`worker ${workerId} exited with ${code}`));
    });
  });
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

const dir = mkdtempSync(join(tmpdir(), 'agent-stress-'));
const dbPath = join(dir, 'cycles.db');

try {
  // Schema/WAL setup is intentionally single-writer. Concurrent workers only open it afterwards.
  let bootstrap = new DurableMemoryStore(dbPath);
  bootstrap.close();

  const unique = await Promise.all(
    Array.from({ length: CONCURRENT }, (_, i) => runWorker(dbPath, i, 'unique'))
  );

  let store = new DurableMemoryStore(dbPath);
  const uniqueExpected = CONCURRENT * CYCLES;
  const uniqueRows = store.countCycles('unique-');
  const uniqueEffects = store.countEffects('unique-');
  const uniqueErrors = unique.flatMap((r) => r.errors);

  assert(uniqueErrors.length === 0, `unique phase had ${uniqueErrors.length} errors`);
  assert(uniqueRows === uniqueExpected, `unique phase persisted ${uniqueRows}/${uniqueExpected} rows`);
  assert(uniqueEffects === uniqueExpected, `unique phase produced ${uniqueEffects}/${uniqueExpected} effects`);

  const duplicate = await Promise.all(
    Array.from({ length: CONCURRENT }, (_, i) => runWorker(dbPath, i, 'duplicate'))
  );

  const duplicateRows = store.countCycles('dup-');
  const duplicateEffects = store.countEffects('dup-');
  const duplicateErrors = duplicate.flatMap((r) => r.errors);
  const duplicateExecuted = duplicate.reduce((n, r) => n + r.executed, 0);
  const duplicateReplayed = duplicate.reduce((n, r) => n + r.replayed, 0);

  assert(duplicateErrors.length === 0, `duplicate phase had ${duplicateErrors.length} errors`);
  assert(duplicateRows === CYCLES, `duplicate phase persisted ${duplicateRows}/${CYCLES} rows`);
  assert(duplicateEffects === CYCLES, `duplicate phase executed ${duplicateEffects}/${CYCLES} side effects`);
  assert(duplicateExecuted === CYCLES, `workers report ${duplicateExecuted}/${CYCLES} original executions`);
  assert(
    duplicateReplayed === (CONCURRENT - 1) * CYCLES,
    `workers report ${duplicateReplayed}/${(CONCURRENT - 1) * CYCLES} replays`
  );

  // Completed work must replay after the DB is closed/reopened without repeating side effects.
  const restartKey = 'restart-completed';
  const restartRequest = { action: 'restart-test' };
  let runner = new IdempotentAgentRunner(store);
  let sideEffects = 0;
  await runner.execute(restartKey, restartRequest, async () => {
    sideEffects++;
    return { durable: true };
  });
  store.close();

  store = new DurableMemoryStore(dbPath);
  runner = new IdempotentAgentRunner(store);
  const replayAfterRestart = await runner.execute(restartKey, restartRequest, async () => {
    sideEffects++;
    return { durable: false };
  });
  assert(replayAfterRestart.replayed === true, 'completed cycle did not replay after restart');
  assert(sideEffects === 1, `restart replay executed side effect ${sideEffects} times`);

  // Interrupted work is made explicit and never silently executed again.
  const interrupted = store.reserveCycle('restart-interrupted', { action: 'interrupted-test' });
  assert(interrupted.kind === 'new', 'could not create interrupted test cycle');
  store.close();

  store = new DurableMemoryStore(dbPath);
  const interruptedCount = store.markRunningInterrupted();
  assert(interruptedCount === 1, `expected 1 interrupted cycle, marked ${interruptedCount}`);
  runner = new IdempotentAgentRunner(store, { waitTimeoutMs: 100 });
  let interruptedReexecuted = false;
  try {
    await runner.execute('restart-interrupted', { action: 'interrupted-test' }, async () => {
      interruptedReexecuted = true;
      return {};
    });
  } catch (error) {
    assert(
      error.code === 'ORIGINAL_EXECUTION_INTERRUPTED',
      `unexpected interrupted error: ${error.code ?? error.message}`
    );
  }
  assert(interruptedReexecuted === false, 'interrupted cycle was re-executed automatically');

  const allTimings = [...unique, ...duplicate].flatMap((r) => r.timings);
  const report = {
    configuration: { concurrentWorkers: CONCURRENT, cyclesPerWorker: CYCLES },
    uniquePhase: {
      requests: uniqueExpected,
      durableRows: uniqueRows,
      sideEffects: uniqueEffects,
      errors: uniqueErrors.length
    },
    duplicatePhase: {
      requests: CONCURRENT * CYCLES,
      uniqueIdempotencyKeys: CYCLES,
      durableRows: duplicateRows,
      sideEffects: duplicateEffects,
      originalExecutions: duplicateExecuted,
      replayedRequests: duplicateReplayed,
      errors: duplicateErrors.length
    },
    restartPhase: {
      completedReplaySurvivedRestart: replayAfterRestart.replayed,
      completedSideEffects: sideEffects,
      interruptedReexecuted
    },
    timingMs: {
      p50: Number(percentile(allTimings, 0.50).toFixed(2)),
      p95: Number(percentile(allTimings, 0.95).toFixed(2)),
      p99: Number(percentile(allTimings, 0.99).toFixed(2))
    },
    result: 'PASS'
  };

  console.log(JSON.stringify(report, null, 2));
  store.close();
} finally {
  rmSync(dir, { recursive: true, force: true });
}
