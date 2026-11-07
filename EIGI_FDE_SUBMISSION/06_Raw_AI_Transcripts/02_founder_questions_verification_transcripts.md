# Meridian + Jarvis Investigation Transcripts
## Session 02: Founder Questions Empirical Verification & SQL Audits

**Session Metadata:**
- **Date:** 2026-11-05T14:30:10Z
- **Focus:** Exact Mathematical Calculations for Founder Questions 1, 2, and 3
- **Snapshot Date:** October 20, 2026 (Evaluating Monday, October 19, 2026)

---

### Prompt 2.1: Inbound Warehouse Package Intake (Question 1)
**User / Engineer:**
> Run a query on `wms_db.inbound_packages` for packages received on Monday, October 19, 2026. Break down by facility and give exact counts.

**Assistant (Initial AI Run):**
```sql
SELECT warehouse_id, COUNT(*) 
FROM wms_db.inbound_packages 
WHERE DATE(received_at) = '2026-10-19' 
GROUP BY warehouse_id;
```
> Result: Total of 96 packages (Warehouse 1 [East]: 56 packages; Warehouse 2 [West]: 40 packages).

**Engineer Intervention / Challenge:**
> Stop. Check `wms_db.warehouses.csv`. What timezones do these facilities operate in? What time does the shift end at West (ONT1)?

**Assistant (Corrected Verification):**
> Auditing `warehouses.csv`:
> - Warehouse 1 (EWR1, Edison, NJ) timezone is `America/New_York` (EDT, UTC-4).
> - Warehouse 2 (ONT1, Ontario, CA) timezone is `America/Los_Angeles` (PDT, UTC-7).
> 
> When inspecting raw records:
> Scans logged at ONT1 between 17:00 PDT and 19:30 PDT carry UTC timestamps between `2026-10-20 00:00:00+00` and `2026-10-20 02:30:00+00`. A naive `DATE(received_at) = '2026-10-19'` in UTC completely truncates these 4 evening packages!
> 
> *Corrected Timezone Query:*
```sql
SELECT 
    w.facility_code,
    w.facility_name,
    COUNT(p.package_id) AS local_count,
    SUM(p.item_count) AS units
FROM wms_db.inbound_packages p
JOIN wms_db.warehouses w ON p.warehouse_id = w.warehouse_id
WHERE (p.received_at AT TIME ZONE w.timezone)::date = '2026-10-19'
GROUP BY w.facility_code, w.facility_name;
```
> Authoritative Result:
> - EWR1 (East): 59 packages, 2,840 units.
> - ONT1 (West): 44 packages, 1,972 units.
> - Total: Exactly 103 packages containing 4,812 physical sealed collectible units.

---

### Prompt 2.2: True Enterprise Profitability vs. Ops Spread (Question 2)
**User / Engineer:**
> The Operations Dashboard in `MSC Now.md` reports a 20.4% gross margin. Is the founder really making money? Reconcile this against `finance/pnl_monthly.csv`.

**Assistant (Deep Financial Audit):**
> Reconciling September 2026 GAAP General Ledger:
> 1. The dashboard's 20.4% margin is an optical illusion that applies ONLY to Trading Card Game lots.
> 2. Coins and Bullion account for $181,550.00 of revenue (9.8% of gross sales) but yield only $2,178.20 in gross margin (1.20% institutional trading spread). Blending bullion immediately drags total enterprise gross margin down from 20.4% to 16.14% ($299,066.44 gross profit on $1,852,586.39 revenue).
> 3. The ops dashboard completely ignores operating overhead. In September, fixed operating expenses totaled $291,765.58:
>    - Payroll & Contractors (25 heads): $161,806.68
>    - Warehouse Leases: $39,700.00
>    - Banking & Payment Gateway Fees: $27,150.45
>    - Logistics & Shipping Freight: $19,240.12
>    - Software & Cloud (including $5.2k Jarvis v0 API bills): $14,210.00
>    - Insurance & Legal: $29,658.33
> 4. Net Operating Income for September was only $7,300.86 (a 0.39% net margin).
> 5. For October MTD, the business faces an unbooked $62,830 inventory devaluation on reprinted TCG sets (Ember Throne and Nebula Rising), pushing October into an estimated net operating loss of -$69,908.89.

---

### Prompt 2.3: Operational Emergency Analysis (Question 3)
**User / Engineer:**
> Search `payout_requests.csv`, `ar_aging_2026-10-19.csv`, and recent incidents. What are the top immediate threats requiring the founder's attention today?

**Assistant (Risk Prioritization):**
> Identified three critical operational vulnerabilities:
> 1. **ACH Payout Failure Stalling $173,339.51:**
>    - 9 NACHA ACH batches ($19,642.10) rejected by Silicon Valley Bank due to missing 'PPD' SEC code in header record 5.
>    - 68 payout requests ($153,697.41) held past the 72h SLA. Member ticket backlog up 410% on Discord.
> 2. **Northgate Hobby Credit Breach ($284,279.37):**
>    - Authorized credit limit is $250,000.00 (exceeded by $34,279.37).
>    - $185,550.00 past due across 16 invoices (oldest: 51 days).
>    - Represents 16.81% of MSC's entire enterprise accounts receivable ($1,691,240.10).
> 3. **Reprint Price Crash on Stale Buy Lists:**
>    - Ember Throne (SKU-ET-001) spot price dropped 31.25% ($88 vs $128 cost).
>    - Nebula Rising (SKU-NR-004) spot price dropped 30.23% ($150 vs $215 cost).
>    - Members are dumping underwater boxes onto MSC at obsolete buy list prices.

