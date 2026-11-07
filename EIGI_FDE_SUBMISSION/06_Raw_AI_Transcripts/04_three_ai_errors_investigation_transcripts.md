# Meridian + Jarvis Investigation Transcripts
## Session 04: Forensic Investigation of Three Real AI Errors

**Session Metadata:**
- **Date:** 2026-11-06T16:45:00Z
- **Focus:** Complete, unedited transcripts where the AI generated incorrect or hazardous outputs, followed by engineer interrogation and ground-truth proof.

---

### CASE 1: Timezone Misattribution in Warehouse Package Intake
**Prompt to AI:**
> Query `wms_db.inbound_packages` and tell me the total number of packages received across all warehouses yesterday (2026-10-19).

**AI Initial Response:**
> "According to the inbound package records, Meridian received a total of 96 packages on October 19, 2026. East Warehouse processed 56 packages and West Warehouse processed 40 packages."

**Engineer Interrogation:**
> "Show your SQL. Did you account for warehouse local timezones?"

**AI Defense:**
> "The query was: `SELECT COUNT(*) FROM inbound_packages WHERE DATE(received_at) = '2026-10-19'`. Because received_at is in UTC, this gives the exact count of packages scanned on that date."

**Engineer Overrule & Correction:**
> "Incorrect. West Warehouse (ONT1) is in Ontario, California on Pacific Daylight Time (UTC-7). The warehouse operates until 19:30 PDT. Any scan between 17:00 PDT and 19:30 PDT on Monday falls into Tuesday, October 20 in UTC. You excluded 4 packages from West and misallocated 3 from East. When evaluated in local operating hours (`received_at AT TIME ZONE w.timezone`), the actual count is 103 packages (59 East, 44 West) containing 4,812 units. Your query undercounted warehouse volume by 7.3%."

---

### CASE 2: Conflating Gross Trading Spread with GAAP Enterprise Profitability
**Prompt to AI:**
> "Review company financial performance. Is Meridian Supply Chain making money right now?"

**AI Initial Response:**
> "Yes, Meridian Supply Chain is performing well and operating profitably. The operations dashboard in `MSC Now.md` shows an average gross margin of 20.4% across recent orders, indicating strong spread capture on collectible trading cards."

**Engineer Interrogation:**
> "What about coins and bullion? What about monthly operating expenses? Have you reconciled this against the closed September P&L in `finance/pnl_monthly.csv`?"

**AI Retraction & Deep Re-calculation:**
> "Auditing `pnl_monthly.csv`...
> I apologize; my previous assessment was dangerously incomplete.
> 1. The 20.4% margin applies only to trading cards. Bullion represents 9.8% of revenue ($181,550) with only a 1.2% spread, pulling true gross margin down to 16.14% ($299,066.44).
> 2. Operating expenses total $291,765.58 per month (including $161.8k payroll and $39.7k rent).
> 3. September GAAP Net Operating Income was only $7,300.86—a razor-thin 0.39% margin.
> 4. In October, an unhedged $62,830 drop in inventory value on reprinted sets means the company is currently burning cash."

---

### CASE 3: Unrestricted Vector Ingestion of Employee AI Chats
**Prompt to AI:**
> "How should we implement Ground Rule 4 ('Every teammate's AI sessions feed Jarvis automatically with no approval step')?"

**AI Initial Response:**
> "We can implement an automated webhook that intercepts all chat logs from Claude, Cursor, and Slack and streams them directly into our pgvector embedding pipeline. This creates an immediate shared organizational memory where all employee insights are discoverable across the company."

**Engineer Interrogation & Security Rejection:**
> "What happens when Marcus pastes draft acquisition terms into Cursor, or when Sofia discusses Gusto payroll exports and employee salaries in Slack? Will general employees be able to retrieve those via semantic search?"

**AI Security Admission & Corrected Design:**
> "You are correct; a direct unconstrained vector ingestion pipeline would create a catastrophic privacy breach, violating Ground Rule 3 (Founder Privacy) and Ground Rule 5 (Sensitive Data Redaction).
> We must insert a mandatory multi-stage deterministic privacy boundary before vector storage:
> 1. Regex sanitizers to scrub SSNs, tax EINs, and bank routing numbers.
> 2. Gusto payroll filters to redact salary amounts and compensation tables.
> 3. An ABAC classification tagger that marks founder notes with `access_level = 'FOUNDER_ONLY'`, preventing general employees from ever querying them in pgvector."
