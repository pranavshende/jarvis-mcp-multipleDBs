# Meridian + Jarvis Investigation Transcripts
## Session 01: Context Bank Inventory, Schema Inspection & Entity Mapping

**Session Metadata:**
- **Date:** 2026-11-05T09:14:22Z
- **Models Used:** Gemini 2.5 Pro (CLI), Claude Code (Subagent)
- **Target Repository:** `server/context-bank/context-bank/` (362 files, ~2.1M tokens)

---

### Prompt 1.1: Context Repository Inventory
**User / Engineer:**
> Execute a comprehensive, recursive inspection of the entire context pack at `server/context-bank/context-bank/`. Do not stop at README.md. Inventory all PostgreSQL dumps, CSVs, JSON, YAML, Markdown SOPs, financial exports, and chat logs. Group each file by relative path, domain, date, source system, and sensitivity.

**Assistant (Gemini 2.5 Pro):**
> Scanning directory tree... Identified 362 files across 9 primary domains:
> 1. `databases/`: PostgreSQL SQL dumps and CSV exports for `seller_db`, `wms_db`, and `portal_db`.
> 2. `finance/`: QuickBooks Online monthly P&L exports (`pnl_monthly.csv`), AR aging (`ar_aging_2026-10-19.csv`), FIFO inventory cost layers (`fifo_cost_layers.csv`).
> 3. `notes/`: Company strategy, operational state (`MSC Now.md`), and Founder private journals.
> 4. `sops/`: Operational SOPs across warehouse receiving, grading, shipping, credit evaluation, and cashouts.
> 5. `incidents/`: Outage logs, bank ACH transmission failure tickets, and dock bottleneck reports.
> 6. `jarvis_v0/`: Prototype Slack bot configuration, prompt templates, memory dumps (`memory.jsonl`), and token usage logs.
> 7. `chat_logs/`: 30-day transcripts from Slack, Discord member tickets, and engineering Linear tickets.
> 
> *Key Initial Insight:* The three databases do not share unified primary keys. Each system uses independent integer sequences or UUIDs.

---

### Prompt 1.2: Schema Audit & Foreign Key Discovery
**User / Engineer:**
> Cross-reference `seller_db`, `wms_db`, and `portal_db` DDL schemas. Can we execute direct foreign key joins between a member payout request in `seller_db`, a package check-in in `wms_db`, and a wholesale order in `portal_db`?

**Assistant (Claude Code):**
> No direct SQL joins are possible without intermediate entity resolution:
> - `seller_db.payout_requests` joins to `seller_db.submissions` on `submission_id`, referencing `member_id`.
> - `wms_db.inbound_packages` contains `package_id` and `tracking_number`, but has no `member_id` foreign key.
> - `portal_db.orders` contains `order_id` and `partner_id`, completely isolated from member data.
> 
> *Resolution Strategy:* A canonical crosswalk table (`dim_crosswalk_entities`) must be established linking `tracking_number` (present on seller submission labels and WMS inbound scans) and `email_domain` / `tax_id` (present on portal accounts and member profiles).

---

### Prompt 1.3: Authoritative Snapshot Validation
**User / Engineer:**
> Verify the exact authoritative snapshot timestamp in the context pack. What date should be treated as 'yesterday' when answering founder questions?

**Assistant (Gemini 2.5 Pro):**
> Checking `README.md` and repository manifest:
> - The context pack states: **Tuesday, October 20, 2026, 13:30 UTC**.
> - Therefore, the operating date for 'yesterday' is **Monday, October 19, 2026**.
> - Critical instruction: Do not use the submission deadline date (November 7, 2026) as the operational data baseline. All analysis must be anchored to October 19–20, 2026.

