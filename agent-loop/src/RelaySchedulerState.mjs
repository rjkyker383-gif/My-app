import { randomUUID } from 'node:crypto';
import { LeaseCheckpointStore } from './LeaseCheckpointStore.mjs';

export const MUTATION_MODES = [
  'implement',
  'verify',
  'break',
  'simplify',
  'test',
  'recon',
  'expand',
];

function errorPayload(error) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, code: error.code ?? null };
  }
  return { name: 'Error', message: String(error), code: null };
}

export class RelaySchedulerState {
  constructor({
    dbPath,
    resource = 'gemini-chatgpt-relay',
    ownerId = `relay-${randomUUID()}`,
    leaseTtlMs = 5 * 60_000,
    intervalMs = 15 * 60_000,
  }) {
    this.store = new LeaseCheckpointStore(dbPath);
    this.resource = resource;
    this.ownerId = ownerId;
    this.leaseTtlMs = leaseTtlMs;
    this.intervalMs = intervalMs;
    this.active = false;
  }

  begin(now = Date.now()) {
    const claim = this.store.acquireLease(this.resource, this.ownerId, this.leaseTtlMs, now);
    if (!claim.acquired) {
      return { kind: 'busy', lease: claim.lease };
    }

    this.active = true;
    const checkpoint = claim.lease.checkpoint ?? {
      iteration: 0,
      phase: 'IDLE',
      successCount: 0,
      stallCount: 0,
      failureCount: 0,
      mutationMode: 'implement',
      lastVerifiedDelta: null,
      lastNextAction: null,
      lastError: null,
      lastSuccessAt: null,
      lastActivityAt: null,
      nextRunAt: 0,
    };

    if (Number(checkpoint.nextRunAt ?? 0) > now) {
      return { kind: 'cooldown', checkpoint, dueAt: Number(checkpoint.nextRunAt) };
    }

    const next = {
      ...checkpoint,
      phase: 'RUNNING',
      lastActivityAt: now,
    };
    this.store.saveCheckpoint(this.resource, this.ownerId, next, now);
    return { kind: 'run', checkpoint: next };
  }

  renew(now = Date.now()) {
    this.#requireActive();
    return this.store.renewLease(this.resource, this.ownerId, this.leaseTtlMs, now);
  }

  recordSuccess({ verifiedDelta, nextAction, mutationMode = null }, now = Date.now()) {
    const current = this.#checkpoint();
    const next = {
      ...current,
      iteration: Number(current.iteration ?? 0) + 1,
      phase: 'IDLE',
      successCount: Number(current.successCount ?? 0) + 1,
      stallCount: 0,
      mutationMode: mutationMode ?? current.mutationMode ?? 'implement',
      lastVerifiedDelta: verifiedDelta ?? null,
      lastNextAction: nextAction ?? null,
      lastError: null,
      lastSuccessAt: now,
      lastActivityAt: now,
      nextRunAt: now + this.intervalMs,
    };
    this.store.saveCheckpoint(this.resource, this.ownerId, next, now);
    return next;
  }

  recordStall(now = Date.now()) {
    const current = this.#checkpoint();
    const stallCount = Number(current.stallCount ?? 0) + 1;
    const modeIndex = stallCount % MUTATION_MODES.length;
    const next = {
      ...current,
      phase: 'IDLE',
      stallCount,
      mutationMode: MUTATION_MODES[modeIndex],
      lastActivityAt: now,
      nextRunAt: now + this.intervalMs,
    };
    this.store.saveCheckpoint(this.resource, this.ownerId, next, now);
    return next;
  }

  recordFailure(error, now = Date.now()) {
    const current = this.#checkpoint();
    const next = {
      ...current,
      phase: 'IDLE',
      failureCount: Number(current.failureCount ?? 0) + 1,
      lastError: errorPayload(error),
      lastActivityAt: now,
      nextRunAt: now + this.intervalMs,
    };
    this.store.saveCheckpoint(this.resource, this.ownerId, next, now);
    return next;
  }

  finish() {
    if (!this.active) return false;
    this.active = false;
    return this.store.releaseLease(this.resource, this.ownerId);
  }

  close() {
    if (this.active) this.finish();
    this.store.close();
  }

  #checkpoint() {
    this.#requireActive();
    const checkpoint = this.store.getCheckpoint(this.resource);
    if (!checkpoint) throw new Error('Relay checkpoint is missing');
    return checkpoint;
  }

  #requireActive() {
    if (!this.active) {
      const error = new Error('Relay lease is not active');
      error.code = 'LEASE_INACTIVE';
      throw error;
    }
  }
}
