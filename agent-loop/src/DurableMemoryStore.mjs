import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, normalize(value[key])])
    );
  }
  return value;
}

export function stableJson(value) {
  return JSON.stringify(normalize(value));
}

export function requestHash(value) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

export class DurableMemoryStore {
  constructor(path, { initialize = true } = {}) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);

    this.db.exec(`PRAGMA busy_timeout = 10000; PRAGMA foreign_keys = ON;`);

    if (initialize) {
      this.db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;

        CREATE TABLE IF NOT EXISTS cycles (
          cycle_number INTEGER PRIMARY KEY AUTOINCREMENT,
          idempotency_key TEXT NOT NULL UNIQUE,
          request_hash TEXT NOT NULL,
          request_json TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('running','succeeded','failed','interrupted')),
          state_json TEXT,
          error_json TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        ) STRICT;

        CREATE INDEX IF NOT EXISTS idx_cycles_status
          ON cycles(status);

        CREATE TABLE IF NOT EXISTS stress_effects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          idempotency_key TEXT NOT NULL UNIQUE,
          worker_id INTEGER NOT NULL,
          created_at INTEGER NOT NULL
        ) STRICT;
      `);
    }

    this.insertCycle = this.db.prepare(`
      INSERT INTO cycles (
        idempotency_key, request_hash, request_json,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, 'running', ?, ?)
      ON CONFLICT(idempotency_key) DO NOTHING
    `);

    this.selectByKey = this.db.prepare(`
      SELECT * FROM cycles WHERE idempotency_key = ?
    `);

    this.selectByCycle = this.db.prepare(`
      SELECT * FROM cycles WHERE cycle_number = ?
    `);
  }

  reserveCycle(idempotencyKey, request) {
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      throw new TypeError('idempotencyKey must be a non-empty string');
    }

    const hash = requestHash(request);
    const requestJson = stableJson(request);
    const now = Date.now();
    const insert = this.insertCycle.run(idempotencyKey, hash, requestJson, now, now);
    const row = this.selectByKey.get(idempotencyKey);

    if (!row) throw new Error('Cycle reservation disappeared after INSERT');
    const cycle = this.#decode(row);

    if (cycle.requestHash !== hash) {
      return { kind: 'conflict', cycle };
    }

    return {
      kind: Number(insert.changes) === 1 ? 'new' : 'existing',
      cycle
    };
  }

  completeCycle(cycleNumber, state) {
    const now = Date.now();
    const result = this.db.prepare(`
      UPDATE cycles
      SET status = 'succeeded', state_json = ?, error_json = NULL, updated_at = ?
      WHERE cycle_number = ? AND status = 'running'
    `).run(stableJson(state), now, cycleNumber);

    if (Number(result.changes) !== 1) {
      throw new Error(`Cycle ${cycleNumber} could not transition running -> succeeded`);
    }
  }

  failCycle(cycleNumber, error) {
    const now = Date.now();
    const payload = error instanceof Error
      ? { name: error.name, message: error.message }
      : { message: String(error) };

    const result = this.db.prepare(`
      UPDATE cycles
      SET status = 'failed', error_json = ?, updated_at = ?
      WHERE cycle_number = ? AND status = 'running'
    `).run(stableJson(payload), now, cycleNumber);

    if (Number(result.changes) !== 1) {
      throw new Error(`Cycle ${cycleNumber} could not transition running -> failed`);
    }
  }

  markRunningInterrupted() {
    const now = Date.now();
    const result = this.db.prepare(`
      UPDATE cycles
      SET status = 'interrupted',
          error_json = ?,
          updated_at = ?
      WHERE status = 'running'
    `).run(stableJson({ code: 'PROCESS_RESTART' }), now);

    return Number(result.changes);
  }

  getCycleState(cycleNumber) {
    const row = this.selectByCycle.get(cycleNumber);
    return row ? this.#decode(row) : null;
  }

  getByIdempotencyKey(key) {
    const row = this.selectByKey.get(key);
    return row ? this.#decode(row) : null;
  }

  getLatestCycle() {
    const row = this.db.prepare(`SELECT COALESCE(MAX(cycle_number), 0) AS max FROM cycles`).get();
    return Number(row.max);
  }

  countCycles(prefix = null) {
    if (prefix === null) {
      return Number(this.db.prepare(`SELECT COUNT(*) AS n FROM cycles`).get().n);
    }
    return Number(this.db.prepare(`SELECT COUNT(*) AS n FROM cycles WHERE idempotency_key LIKE ?`).get(`${prefix}%`).n);
  }

  countEffects(prefix = null) {
    if (prefix === null) {
      return Number(this.db.prepare(`SELECT COUNT(*) AS n FROM stress_effects`).get().n);
    }
    return Number(this.db.prepare(`SELECT COUNT(*) AS n FROM stress_effects WHERE idempotency_key LIKE ?`).get(`${prefix}%`).n);
  }

  recordStressEffect(idempotencyKey, workerId) {
    this.db.prepare(`
      INSERT INTO stress_effects (idempotency_key, worker_id, created_at)
      VALUES (?, ?, ?)
    `).run(idempotencyKey, workerId, Date.now());
  }

  close() {
    this.db.close();
  }

  #decode(row) {
    return {
      cycleNumber: Number(row.cycle_number),
      idempotencyKey: row.idempotency_key,
      requestHash: row.request_hash,
      request: JSON.parse(row.request_json),
      status: row.status,
      state: row.state_json ? JSON.parse(row.state_json) : null,
      error: row.error_json ? JSON.parse(row.error_json) : null,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at)
    };
  }
}
