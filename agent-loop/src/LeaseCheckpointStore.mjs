import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

function encode(value) {
  return value === undefined ? null : JSON.stringify(value);
}

function decode(value) {
  return value == null ? null : JSON.parse(value);
}

export class LeaseCheckpointStore {
  constructor(path) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA busy_timeout = 10000;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;

      CREATE TABLE IF NOT EXISTS relay_leases (
        resource TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        checkpoint_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;

      CREATE INDEX IF NOT EXISTS idx_relay_leases_expires
        ON relay_leases(expires_at);
    `);
  }

  acquireLease(resource, ownerId, ttlMs, now = Date.now()) {
    this.#validate(resource, ownerId, ttlMs);
    const expiresAt = now + ttlMs;
    const result = this.db.prepare(`
      INSERT INTO relay_leases (
        resource, owner_id, expires_at, checkpoint_json, created_at, updated_at
      ) VALUES (?, ?, ?, NULL, ?, ?)
      ON CONFLICT(resource) DO UPDATE SET
        owner_id = excluded.owner_id,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
      WHERE relay_leases.expires_at <= ?
         OR relay_leases.owner_id = excluded.owner_id
    `).run(resource, ownerId, expiresAt, now, now, now);

    const lease = this.getLease(resource);
    return {
      acquired: Number(result.changes) === 1 && lease?.ownerId === ownerId,
      lease,
    };
  }

  renewLease(resource, ownerId, ttlMs, now = Date.now()) {
    this.#validate(resource, ownerId, ttlMs);
    const expiresAt = now + ttlMs;
    const result = this.db.prepare(`
      UPDATE relay_leases
      SET expires_at = ?, updated_at = ?
      WHERE resource = ? AND owner_id = ? AND expires_at > ?
    `).run(expiresAt, now, resource, ownerId, now);

    return {
      renewed: Number(result.changes) === 1,
      lease: this.getLease(resource),
    };
  }

  saveCheckpoint(resource, ownerId, checkpoint, now = Date.now()) {
    const result = this.db.prepare(`
      UPDATE relay_leases
      SET checkpoint_json = ?, updated_at = ?
      WHERE resource = ? AND owner_id = ? AND expires_at > ?
    `).run(encode(checkpoint), now, resource, ownerId, now);

    if (Number(result.changes) !== 1) {
      const error = new Error('Cannot save checkpoint without an active owned lease');
      error.code = 'LEASE_NOT_OWNED';
      throw error;
    }

    return this.getCheckpoint(resource);
  }

  getCheckpoint(resource) {
    const row = this.db.prepare(`
      SELECT checkpoint_json FROM relay_leases WHERE resource = ?
    `).get(resource);
    return row ? decode(row.checkpoint_json) : null;
  }

  getLease(resource) {
    const row = this.db.prepare(`
      SELECT resource, owner_id, expires_at, checkpoint_json, created_at, updated_at
      FROM relay_leases WHERE resource = ?
    `).get(resource);

    if (!row) return null;
    return {
      resource: row.resource,
      ownerId: row.owner_id,
      expiresAt: Number(row.expires_at),
      checkpoint: decode(row.checkpoint_json),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }

  releaseLease(resource, ownerId) {
    const result = this.db.prepare(`
      DELETE FROM relay_leases WHERE resource = ? AND owner_id = ?
    `).run(resource, ownerId);
    return Number(result.changes) === 1;
  }

  pruneExpired(now = Date.now()) {
    const result = this.db.prepare(`
      DELETE FROM relay_leases WHERE expires_at <= ?
    `).run(now);
    return Number(result.changes);
  }

  close() {
    this.db.close();
  }

  #validate(resource, ownerId, ttlMs) {
    if (!resource || typeof resource !== 'string') {
      throw new TypeError('resource must be a non-empty string');
    }
    if (!ownerId || typeof ownerId !== 'string') {
      throw new TypeError('ownerId must be a non-empty string');
    }
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new TypeError('ttlMs must be a positive number');
    }
  }
}
