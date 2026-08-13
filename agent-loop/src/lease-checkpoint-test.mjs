import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LeaseCheckpointStore } from './LeaseCheckpointStore.mjs';

const dir = mkdtempSync(join(tmpdir(), 'relay-lease-test-'));
const dbPath = join(dir, 'relay.sqlite');
const firstStore = new LeaseCheckpointStore(dbPath);
const secondStore = new LeaseCheckpointStore(dbPath);

try {
  const first = firstStore.acquireLease('gemini-chatgpt-relay', 'runner-a', 60_000, 1_000);
  assert.equal(first.acquired, true);
  assert.equal(first.lease.ownerId, 'runner-a');

  const blocked = secondStore.acquireLease('gemini-chatgpt-relay', 'runner-b', 60_000, 1_001);
  assert.equal(blocked.acquired, false);
  assert.equal(blocked.lease.ownerId, 'runner-a');

  const checkpoint = {
    iteration: 7,
    phase: 'WAIT_GEMINI',
    geminiThread: 'GEMINI_HOME_THREAD',
    chatgptThread: 'CHATGPT_HOME_THREAD',
    lastGeminiFingerprint: 'abc',
    lastChatgptFingerprint: 'def',
    stallCount: 0,
  };

  assert.deepEqual(
    firstStore.saveCheckpoint('gemini-chatgpt-relay', 'runner-a', checkpoint, 1_002),
    checkpoint,
  );
  assert.deepEqual(secondStore.getCheckpoint('gemini-chatgpt-relay'), checkpoint);

  const renewed = firstStore.renewLease('gemini-chatgpt-relay', 'runner-a', 120_000, 1_003);
  assert.equal(renewed.renewed, true);
  assert.equal(renewed.lease.expiresAt, 121_003);

  assert.equal(firstStore.releaseLease('gemini-chatgpt-relay', 'runner-a'), true);

  const nextOwner = secondStore.acquireLease('gemini-chatgpt-relay', 'runner-b', 10_000, 2_000);
  assert.equal(nextOwner.acquired, true);
  assert.equal(nextOwner.lease.ownerId, 'runner-b');

  const afterExpiry = firstStore.acquireLease('gemini-chatgpt-relay', 'runner-a', 10_000, 20_001);
  assert.equal(afterExpiry.acquired, true);
  assert.equal(afterExpiry.lease.ownerId, 'runner-a');

  console.log('LEASE_CHECKPOINT_TEST: PASS');
} finally {
  firstStore.close();
  secondStore.close();
  rmSync(dir, { recursive: true, force: true });
}
