# Unresolved Questions, Missing Artifacts & Operational Ambiguities
**Document ID:** REP-UNR-V1-2026-10-20  
**Phase:** Phase 0 Audit Findings  
**Target Audience:** Meridian Executive Leadership, Legal Counsel, Lead DBAs

---

## 1. Missing Files & Codebase Gaps in Context ZIP

During the exhaustive inventory of the Context ZIP, the following discrepancies and missing files were identified:

### 1.1 Missing `item_map.csv`
- **Context:** Historical notes and previous Slack threads reference an audited mapping file (`item_map.csv`) purportedly used by warehouse managers to manually bridge 164 unmapped items between WMS barcodes and Portal catalog SKUs.
- **Audit Finding:** The file `item_map.csv` was **not present** anywhere in the Context ZIP archive.
- **Risk Assessment:** High risk for automatic inventory valuation on the 164 unmapped products.
- **Phase 1 Mitigation:** Phase 1 will automatically populate `analytics.dim_product_crosswalk` with the 316 confirmed Tier 1 exact matches, generate automated Tier 3 fuzzy candidates for the remaining 164 items, and export a CSV queue for Ops Lead (`EMP-006`) to sign off before promoting them to active status.

### 1.2 Omission of Bank NACHA File Specification Document
- **Context:** Payout records show that on October 12, 77 ACH payouts were rejected with code `R01 / NACHA_FIELD_ERR`. Notes suggest an alignment issue in the 94-character NACHA record layout.
- **Audit Finding:** The technical specification from Meridian's partner bank (Wells Fargo Commercial ACH Guide) was omitted from the documentation folder.
- **Required Action:** Marcus Thorne (`EMP-003`, CFO) must supply the official bank NACHA file layout specification so that the Restricted Action Service can safely construct re-submission batches.

### 1.3 Uncommitted Jarvis v0 Jupyter Notebooks
- **Context:** Reference was made to ad-hoc Python notebooks created by previous external contractors to prototype vector search.
- **Audit Finding:** Notebooks were committed without clean git history and contained hardcoded production credentials.
- **Remediation Action:** All legacy notebook credentials have been revoked in the production databases via `docs/audit/SECURITY_REMEDIATION_LOG.md`.

---

## 2. Operational & Business Ambiguities Requiring Executive Clarification

### 2.1 Inbound Card Grading Dispute Resolution SLA
- **Observation:** When an inbound submission receives a grade lower than the seller expected, tickets are generated in `seller_db.support_tickets`. There is currently no recorded policy on whether Jarvis may automatically offer credit adjustments up to a nominal threshold (e.g., $25).
- **Decision Required:** Does executive leadership want Jarvis v1 to support automated micro-concessions, or must all grading adjustments remain human-in-the-loop?
- **Architectural Default:** Jarvis v1 will treat all concessions as requiring human agent execution.

### 2.2 Northgate Hobby Credit Hold Policy
- **Observation:** Northgate Hobby has $284,279.37 in open AR, with $185,500.00 overdue by more than 60 days. WMS has 3 pending pick waves on hold.
- **Decision Required:** Should Jarvis automatically alert the warehouse to cancel waves older than 7 days, or keep shipments queued until Marcus Thorne or David Vance approves an override?
- **Architectural Default:** Shipments remain quarantined with status `CREDIT_HOLD`.

### 2.3 Formal Sign-Off on EU-US Data Processing Addendum (DPA)
- **Observation:** Meridian's Supabase analytical cluster is located in Frankfurt, Germany (`eu-central-1`), while operational fulfillment operates in the United States.
- **Decision Required:** Formal execution of the Supabase enterprise DPA and Standard Contractual Clauses (SCCs) by Legal Counsel (`EMP-020`, Hannah Abbott) prior to live replication.
