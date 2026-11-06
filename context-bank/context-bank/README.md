# MSC context bank

Export of Meridian Supply Chain's systems and knowledge, prepared for the system design exercise.

**Snapshot time:** 2026-10-20 13:30 UTC (09:30 Eastern). Treat **today as Tuesday 20 October 2026.**
Database rows cover roughly the 90 days before the snapshot.

## What's here

| Folder | What it is |
|---|---|
| `databases/` | `pg_dump` exports of the three app databases (`seller_db.sql`, `wms_db.sql`, `portal_db.sql`) and the same tables as CSV under `databases/csv/` |
| `finance/` | QuickBooks-side exports: FIFO cost layers, monthly P&L (closed months), AR aging, expenses, chart of accounts; `restricted/` payroll |
| `api/` | OpenAPI specs for the seller API and the WMS API |
| `notes/` | The company notes folder: SOPs, policies, meeting notes, reports, partner accounts, incident write-ups, and **MSC Now** |
| `session_logs/` | 30 days of exported AI session logs for 8 teammates (JSONL, one file per person per day) |
| `jarvis_v0/` | The first version of Jarvis: README, config, memory dump, usage events, cost stats, feedback |
| `exports/` | Linear issues and GitHub pull requests (last 90 days) |

## Loading the databases
```bash
createdb seller_db && psql seller_db < databases/seller_db.sql
createdb wms_db    && psql wms_db    < databases/wms_db.sql
createdb portal_db && psql portal_db < databases/portal_db.sql
```
No Postgres? The CSVs are the same data. They load into SQLite, DuckDB or pandas.

## Things to know
- Warehouses: East (EWR1) runs on America/New_York, West (ONT1) on America/Los_Angeles. Database timestamps are UTC.
- The three databases were built separately and do not share keys.
- This is an export of real working material. It is not tidy. Some documents are out of date or disagree with each
  other or with the data.
