// murubbi data layer: SQLite (node:sqlite, no native deps). the ledger is append-only and hash-chained.
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.MURUBBI_DB || path.join(here, "..", "data", "murubbi.db");

export function open() {
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  return db;
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS zones (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, district TEXT NOT NULL, gas_distributor TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS factories (
  os_id TEXT PRIMARY KEY, name TEXT NOT NULL, zone_id TEXT NOT NULL REFERENCES zones(id),
  product TEXT, workers INTEGER, sample INTEGER NOT NULL DEFAULT 0, claimed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS identifiers (            -- the factory graph: one factory, many names in many sources
  os_id TEXT NOT NULL REFERENCES factories(os_id), source TEXT NOT NULL, value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS edges (                  -- graph edges: ships_to, located_in, supplied_by, mentioned_in
  src TEXT NOT NULL, rel TEXT NOT NULL, dst TEXT NOT NULL, source TEXT
);
CREATE TABLE IF NOT EXISTS news (                   -- retrieval corpus: real, sourced headlines (our own summaries)
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, summary TEXT NOT NULL, url TEXT NOT NULL, published TEXT,
  label_type TEXT, label_shock INTEGER, embedding TEXT
);
CREATE TABLE IF NOT EXISTS events (                 -- shocks mapped to zones
  id INTEGER PRIMARY KEY, zone_id TEXT REFERENCES zones(id), type TEXT NOT NULL, severity INTEGER NOT NULL,
  starts TEXT NOT NULL, days INTEGER, note TEXT NOT NULL, source TEXT NOT NULL, sample INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS orders (
  po TEXT PRIMARY KEY, os_id TEXT NOT NULL REFERENCES factories(os_id), buyer TEXT NOT NULL,
  product TEXT, stage TEXT NOT NULL, promised TEXT NOT NULL, sample INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS ledger (                 -- append-only. four clocks: promised, forecast, shipped, verified
  seq INTEGER PRIMARY KEY, po TEXT NOT NULL REFERENCES orders(po), clock TEXT NOT NULL
    CHECK (clock IN ('promised','forecast','plan','shipped','verified')),
  value TEXT NOT NULL, by_who TEXT NOT NULL, note TEXT, at TEXT NOT NULL, prev_hash TEXT NOT NULL, hash TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS ledger_no_update BEFORE UPDATE ON ledger BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
CREATE TRIGGER IF NOT EXISTS ledger_no_delete BEFORE DELETE ON ledger BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
`;

const sha = (s) => createHash("sha256").update(s).digest("hex");

export function appendLedger(db, { po, clock, value, by_who, note = "", at = new Date().toISOString() }) {
  const last = db.prepare("SELECT hash FROM ledger ORDER BY seq DESC LIMIT 1").get();
  const prev = last ? last.hash : "genesis";
  const hash = sha([prev, po, clock, value, by_who, note, at].join("|"));
  db.prepare("INSERT INTO ledger (po, clock, value, by_who, note, at, prev_hash, hash) VALUES (?,?,?,?,?,?,?,?)")
    .run(po, clock, value, by_who, note, at, prev, hash);
  return { po, clock, value, by_who, at, hash };
}

export function verifyChain(db) {
  let prev = "genesis";
  for (const r of db.prepare("SELECT * FROM ledger ORDER BY seq").all()) {
    const h = sha([prev, r.po, r.clock, r.value, r.by_who, r.note, r.at].join("|"));
    if (r.prev_hash !== prev || r.hash !== h) return { ok: false, broken_at: r.seq };
    prev = r.hash;
  }
  return { ok: true };
}

// trust score: published method. counts the response, never the shock.
// on time vs original date (±2 days) · how early they warned · how fast they recovered.
// weights are private: set MURUBBI_SCORE_WEIGHTS (json) locally. the default below is equal weighting.
const W = JSON.parse(process.env.MURUBBI_SCORE_WEIGHTS || '{"onTime":0.34,"warn":0.33,"recover":0.33}');
export const SCORE_METHOD = {
  scale: "0–100",
  parts: [
    { name: "on time vs the original ex-factory date (±2 days)" },
    { name: "how early the factory warned the buyer (days before the promised date)" },
    { name: "how fast it recovered (days between the warning and an approved plan)" },
  ],
  never_counts: ["the shock itself (gas, power, flood)", "protests", "workers"],
  status: "weights are private and set after validation calls",
};

const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

export function trustScore(db, os_id) {
  const pos = db.prepare("SELECT po, promised FROM orders WHERE os_id = ?").all(os_id);
  const rows = [];
  for (const o of pos) {
    const l = db.prepare("SELECT clock, value, at FROM ledger WHERE po = ? ORDER BY seq").all(o.po);
    const shipped = l.find((r) => r.clock === "shipped");
    const verified = l.find((r) => r.clock === "verified");
    if (!shipped || !verified) continue;                     // only verified shipments count
    const forecast = l.find((r) => r.clock === "forecast");
    const plan = l.find((r) => r.clock === "plan");
    const late = Math.max(0, days(o.promised, shipped.value) - 2);
    const warnedDays = forecast ? Math.max(0, days(forecast.at, o.promised)) : 0;
    const recoverDays = forecast && plan ? Math.max(0, days(forecast.at, plan.at)) : null;
    rows.push({ po: o.po, late, warnedDays, recoverDays });
  }
  if (!rows.length) return { os_id, score: null, reason: "no verified shipments yet" };
  const onTime = rows.filter((r) => r.late === 0).length / rows.length;
  const warn = rows.reduce((a, r) => a + (r.late === 0 ? 1 : Math.min(1, r.warnedDays / 21)), 0) / rows.length;
  const rec = rows.reduce((a, r) => a + (r.late === 0 ? 1 : r.recoverDays == null ? 0 : Math.max(0, 1 - r.recoverDays / 7)), 0) / rows.length;
  const score = Math.round(100 * (W.onTime * onTime + W.warn * warn + W.recover * rec));
  return {
    os_id, score, shipments_counted: rows.length,
    parts: { on_time_pct: Math.round(onTime * 100), warning_quality_pct: Math.round(warn * 100), recovery_quality_pct: Math.round(rec * 100) },
    rows, method: SCORE_METHOD,
  };
}
