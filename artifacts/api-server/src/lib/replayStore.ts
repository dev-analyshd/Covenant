// ============================================================================
// Persistent Replay Prevention Store
// ============================================================================
// Stores SHA-256 hashes of proof/settlement inputs to prevent replay attacks.
// Uses a file-backed JSON store so prevention survives server restarts.
//
// Production upgrade: replace with Soroban contract nullifier table
// (CovenantRegistry already stores nullifiers on-chain; this is the API layer).
// ============================================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.resolve(__dirname, "../../.replay-store.json");
const MAX_ENTRIES = 50_000; // ~3.2 MB per set — prune beyond this

interface Store {
  proofs: string[];       // SHA-256 of proof bytes
  settlements: string[];  // SHA-256 of (settlementHash || amount || asset)
  updatedAt: string;
}

let _store: Store = { proofs: [], settlements: [], updatedAt: new Date().toISOString() };

// ── Load from disk on startup ─────────────────────────────────────────────────
(function load() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as Store;
      _store = {
        proofs:      Array.isArray(parsed.proofs)      ? parsed.proofs      : [],
        settlements: Array.isArray(parsed.settlements) ? parsed.settlements : [],
        updatedAt:   parsed.updatedAt ?? new Date().toISOString(),
      };
      logger.info({ proofCount: _store.proofs.length, settlementCount: _store.settlements.length },
        "Replay store loaded from disk");
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, "Could not load replay store — starting fresh");
  }
})();

function persist(): void {
  try {
    _store.updatedAt = new Date().toISOString();
    fs.writeFileSync(STORE_PATH, JSON.stringify(_store), "utf-8");
  } catch (err: any) {
    logger.warn({ err: err.message }, "Could not persist replay store");
  }
}

// ── Proof replay API ──────────────────────────────────────────────────────────

export function hasProof(hash: string): boolean {
  return _store.proofs.includes(hash);
}

export function recordProof(hash: string): void {
  if (!_store.proofs.includes(hash)) {
    _store.proofs.push(hash);
    if (_store.proofs.length > MAX_ENTRIES) {
      _store.proofs = _store.proofs.slice(-MAX_ENTRIES);
    }
    persist();
  }
}

// ── Settlement replay API ─────────────────────────────────────────────────────

export function hasSettlement(hash: string): boolean {
  return _store.settlements.includes(hash);
}

export function recordSettlement(hash: string): void {
  if (!_store.settlements.includes(hash)) {
    _store.settlements.push(hash);
    if (_store.settlements.length > MAX_ENTRIES) {
      _store.settlements = _store.settlements.slice(-MAX_ENTRIES);
    }
    persist();
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function replayStoreStats(): { proofCount: number; settlementCount: number; updatedAt: string } {
  return {
    proofCount:      _store.proofs.length,
    settlementCount: _store.settlements.length,
    updatedAt:       _store.updatedAt,
  };
}
