// builds data/murubbi.db. news items are real and sourced (summaries in our own words);
// factories, orders and the gas event are SAMPLE data, marked sample = 1.
import fs from "node:fs";
import { open, SCHEMA, appendLedger, verifyChain, DB_PATH } from "./db.mjs";

fs.mkdirSync(new URL("../data/", import.meta.url), { recursive: true });
for (const f of [DB_PATH, DB_PATH + "-wal", DB_PATH + "-shm"]) if (fs.existsSync(f)) fs.rmSync(f);
const db = open();
db.exec(SCHEMA);

const zones = [
  ["gazipur", "gazipur industrial belt", "Gazipur", "Titas Gas"],
  ["ashulia", "ashulia / savar", "Dhaka", "Titas Gas"],
  ["narayanganj", "narayanganj", "Narayanganj", "Titas Gas"],
  ["chattogram", "chattogram epz", "Chattogram", "Karnaphuli Gas"],
];
for (const z of zones) db.prepare("INSERT INTO zones VALUES (?,?,?,?)").run(...z);

const factories = [
  ["BD-SAMPLE-0001", "demo knit ltd", "gazipur", "knit tees", 2400],
  ["BD-SAMPLE-0002", "sample denim ltd", "ashulia", "denim", 3100],
  ["BD-SAMPLE-0003", "sample sweaters ltd", "narayanganj", "sweaters", 1800],
  ["BD-SAMPLE-0004", "sample woven ltd", "chattogram", "woven shirts", 2700],
];
for (const f of factories) db.prepare("INSERT INTO factories (os_id, name, zone_id, product, workers, sample, claimed) VALUES (?,?,?,?,?,1,?)").run(...f, f[0] === "BD-SAMPLE-0001" ? 1 : 0);

const ids = [
  ["BD-SAMPLE-0001", "bgmea", "DEMO KNIT LIMITED"], ["BD-SAMPLE-0001", "rsc", "Demo Knit Ltd."],
  ["BD-SAMPLE-0001", "us_customs", "DEMO KNIT LTD (shipper via bank: SAMPLE BANK PLC)"],
  ["BD-SAMPLE-0002", "bgmea", "SAMPLE DENIM LIMITED"], ["BD-SAMPLE-0003", "bgmea", "SAMPLE SWEATERS LTD"], ["BD-SAMPLE-0004", "bgmea", "SAMPLE WOVEN LTD"],
];
for (const i of ids) db.prepare("INSERT INTO identifiers VALUES (?,?,?)").run(...i);
const edges = [
  ["BD-SAMPLE-0001", "located_in", "gazipur", "bgmea"], ["gazipur", "supplied_by", "Titas Gas", "petrobangla"],
  ["BD-SAMPLE-0001", "ships_to", "sample buyer (US)", "us_customs"], ["BD-SAMPLE-0002", "located_in", "ashulia", "bgmea"],
  ["BD-SAMPLE-0003", "located_in", "narayanganj", "bgmea"], ["BD-SAMPLE-0004", "located_in", "chattogram", "bgmea"],
];
for (const e of edges) db.prepare("INSERT INTO edges VALUES (?,?,?,?)").run(...e);

// real, sourced headlines (see RESEARCH_NOTES.md). label_* = our hand labels, used by eval-triage.mjs
const news = [
  ["Industrial gas deficit cripples apparel supply", "Garment output is down 25–40% and dyeing up to 60% as industrial gas supply falls short in the main factory belts.", "https://www.dhakatribune.com/business/417030/industrial-gas-deficit-cripples-apparel-supply", "2026", "gas", 1],
  ["BGMEA seeks government action as RMG production dips", "Factory owners ask the government to fix gas supply after production drops across knit and dyeing units.", "https://en.ittefaq.com.bd/16122/bgmea-seeks-govt-action-as-rmg-production-dips", "2026", "gas", 1],
  ["Energy crisis pushes apparel orders abroad", "Knit buyers shift up to a third of orders out of Bangladesh; four EU buyers cut SS27 orders by 15–35% because of energy-driven delays.", "https://tob.news/energy-crisis-pushes-apparel-orders-abroad/", "2026-09-15", "gas", 1],
  ["Wage protests disrupt 529 garment factories", "Wage protests disrupted 529 garment factories on 1 November as the government formed a pay board.", "https://www.maritimegateway.com/wage-protests-disrupt-529-bangladesh-garment-factories-as-government-forms-pay-board/", "2026-11-01", "unrest", 1],
  ["Garment factories disrupted as protests continue for a third day", "Protests over wages kept factories in the industrial belts disrupted for a third straight day; brands postponed sourcing visits.", "https://aljazeera.com/news/2026/11/2/bangladesh-garment-factories-disrupted-as-protests-continue-for-third-day", "2026-11-02", "unrest", 1],
  ["When cargo stops moving", "Container dwell time at Chattogram port is above 11 days; one day less dwell would lift exports by about 7.4%.", "https://thefinancialexpress.com.bd/views/when-cargo-stops-moving", "2026", "port", 1],
  ["Prolonged lead time forces RMG work orders to shift", "Bangladesh's order-to-ship lead time of 60–95 days, against about 32 for China, is pushing buyers to move work orders.", "https://www.dhakatribune.com/business/419205/prolonged-lead-time-forces-rmg-work-orders-to", "2026-09-06", "other", 0],
  ["400+ garment factories closed in three years", "More than 400 garment factories have shut down over the last three years.", "https://www.tbsnews.net/node/1532431", "2026", "other", 0],
  ["Inditex policy changes could shift orders from Bangladesh", "Inditex, which sources about $2.5bn a year from Bangladesh, warned that policy changes raise cost and lead time.", "https://bjournal.net/inditex-policy-changes-shift-orders-from-bangladesh/", "2026-10", "other", 0],
  ["US again imposes 10% tariff on Bangladesh", "A 10% Section 301 duty applies to Bangladeshi goods from 24 July 2026, about 25.6% all-in on garments.", "https://www.thedailystar.net/news/bangladesh/diplomacy/news/us-again-imposes-10-tariff-bangladesh-4231701", "2026-07", "other", 0],
  ["Bangladesh Bank unveils trade finance framework beyond LCs", "A new framework allows open-account exports and reverse factoring against approved invoices.", "https://thereport.live/business/bangladesh-bank-unveils-new-trade-finance-framework-beyond-traditional-lcs/40434", "2026-06-11", "other", 0],
  ["USTR misses textile quota target", "The planned US-cotton quota will need an entry-level audit trail that most apparel supply chains don't have yet.", "https://shopappy.com/trade/tariffs-customs/ustr-misses-textile-quota-target", "2026-10", "other", 0],
];
for (const n of news) db.prepare("INSERT INTO news (title, summary, url, published, label_type, label_shock) VALUES (?,?,?,?,?,?)").run(...n);

// SAMPLE shock + orders + ledger (the demo story: po 4471)
db.prepare("INSERT INTO events (zone_id, type, severity, starts, days, note, source, sample) VALUES (?,?,?,?,?,?,?,1)")
  .run("gazipur", "gas", 4, "2026-11-20", 6, "sample: gas pressure low in the gazipur belt, dyeing at ~40%", "sample (modelled on petrobangla daily report)");
const orders = [
  ["4471", "BD-SAMPLE-0001", "sample buyer (US)", "knit tees", "dyeing", "2026-12-12"],
  ["4502", "BD-SAMPLE-0001", "sample buyer (EU)", "polos", "sewing", "2026-12-20"],
  ["3990", "BD-SAMPLE-0001", "sample buyer (US)", "knit tees", "shipped", "2026-09-30"],
  ["5120", "BD-SAMPLE-0002", "sample buyer (EU)", "denim", "washing", "2026-12-05"],
];
for (const o of orders) db.prepare("INSERT INTO orders (po, os_id, buyer, product, stage, promised) VALUES (?,?,?,?,?,?)").run(...o);
appendLedger(db, { po: "3990", clock: "promised", value: "2026-09-30", by_who: "factory + buyer po", at: "2026-07-20T09:00:00Z" });
appendLedger(db, { po: "3990", clock: "shipped", value: "2026-09-29", by_who: "factory", at: "2026-09-29T18:00:00Z" });
appendLedger(db, { po: "3990", clock: "verified", value: "buyer receipt + us customs match", by_who: "buyer + customs", at: "2026-10-20T10:00:00Z" });
appendLedger(db, { po: "4471", clock: "promised", value: "2026-12-12", by_who: "factory + buyer po", at: "2026-10-01T09:00:00Z" });
appendLedger(db, { po: "4502", clock: "promised", value: "2026-12-20", by_who: "factory + buyer po", at: "2026-10-10T09:00:00Z" });
appendLedger(db, { po: "5120", clock: "promised", value: "2026-12-05", by_who: "factory + buyer po", at: "2026-10-05T09:00:00Z" });

console.log("seeded", DB_PATH, { zones: zones.length, factories: factories.length, news: news.length, orders: orders.length, chain: verifyChain(db) });
