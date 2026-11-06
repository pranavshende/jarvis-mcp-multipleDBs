# Jarvis v1 — Enterprise AI Intelligence Platform for Meridian Supply Chain (MSC)

[![Architecture](https://img.shields.io/badge/Architecture-12--Layer%20Intelligence-blue.svg)](project_docs/ARCHITECTURE.md)
[![Security Standard](https://img.shields.io/badge/Security-STRIDE%20%7C%20Zero--Privilege-green.svg)](docs/audit/SECURITY_THREAT_MODEL.md)
[![Data Sovereignty](https://img.shields.io/badge/Sovereignty-Supabase%20EU%20Central-orange.svg)](docs/audit/DATA_GOVERNANCE_REVIEW.md)
[![Phase 0 Status](https://img.shields.io/badge/Phase%200-Audit%20Complete-brightgreen.svg)](reports/PHASE_0_SUMMARY.md)
[![Phase 1 Readiness](https://img.shields.io/badge/Phase%201%20Readiness-Ready%20with%20Conditions-yellow.svg)](reports/PHASE_1_READINESS.md)

---

## 1. Project Overview

**Jarvis v1** is a unified, deterministic AI intelligence and operations layer built specifically for **Meridian Supply Chain (MSC)**.

Meridian operates high-volume multi-facility physical supply chains, specialized in collectible trading cards, gaming merchandise, and bullion. The company's technology infrastructure was historically fragmented across three independent operational databases (`seller_db`, `wms_db`, `portal_db`), manual QuickBooks accounting exports, and disjointed communication channels.

Jarvis v1 sits **above** the operational systems as an intelligent control plane:
- **Deterministic SQL Calculations:** Critical financial, inventory, and operational metrics are computed strictly by parameterized SQL against an analytics replica in Supabase (`eu-central-1`). The LLM never invents numbers.
- **RAG for Company Memory:** SOPs, policy guidelines, and verified executive decisions are indexed in `pgvector` with hybrid BM25 search.
- **Proactive Anomaly Alerts:** Background rules workers continuously flag blocked payouts, partner credit limit breaches, and market inventory devaluation.
- **Zero-Write Security & Dual Authorization:** The AI has zero write access to production databases. Mutating actions require explicit, multi-factor dual-party human approval.

---

## 2. Repository Structure

```
d:\eigi.ai├── README.md                    # Master Project Guide & Quickstart
├── project_docs/                          # Enterprise Specifications
│   ├── PHASE_WISE_IMPLEMENTATION.md       # 7-Phase Implementation Roadmap
│   ├── ARCHITECTURE.md                    # 12-Layer System Architecture & Diagrams
│   ├── AI_PROMPTS.md                      # 20 Production Prompts & Guardrails
│   └── PERMISSIONS.md                     # RBAC, RLS, and Access Governance
├── docs/
│   └── audit/                             # Phase 0 Audit & Security Specifications
│       ├── DATA_DICTIONARY_V1.md          # Full 35-Table Schema & Replication Boundaries
│       ├── SCHEMA_RELATIONSHIP_REPORT.md  # Cross-Database Joins & Normalization
│       ├── SECURITY_REMEDIATION_LOG.md# Deprecation of jarvis_svc & Read-Only DDL
│       ├── SECURITY_THREAT_MODEL.md       # STRIDE & OWASP LLM Attack Vectors
│       ├── ACCESS_CONTROL_MATRIX.md       # 8 Roles & 25 Employee Mapping
│       ├── METRICS_DICTIONARY.md          # Deterministic SQL Definitions & Timezones
│       ├── IDENTITY_RESOLUTION_SPEC.md# Canonical Product & Entity Resolution
│       └── DATA_GOVERNANCE_REVIEW.md      # GDPR & US-EU Cross-Border Sovereignty
├── contracts/                             # Strongly-Typed System Contracts
│   ├── canonical_crosswalk.sql            # Supabase DDL for Unified Crosswalk Table
│   ├── tools.schema.json                  # Draft-07 JSON Schema for all MCP Tools
│   └── README.md                          # Contract Validation & Transport Guide
├── eval/                                  # Evaluation & Verification Harness
│   └── baseline_eval.json                 # 10 Ground-Truth Test Scenarios
├── reports/                               # Executive Reports & Audit Logs
│   ├── CONTEXT_INVENTORY.md               # 362-File Context Pack Inventory
│   ├── PHASE_0_SUMMARY.md                 # Comprehensive Audit & Findings Summary
│   ├── UNRESOLVED_QUESTIONS.md            # Ambiguities, Missing Files & Action Items
│   ├── PHASE_1_READINESS.md               # Readiness Assessment (READY WITH CONDITIONS)
│   ├── schema_audit_raw.json              # Introspected Database Schema Dump
│   ├── identity_joins_audit.json          # Forensic Join Matching Analysis
│   └── timezone_verification_audit.json   # Local vs UTC Timezone Comparison
├── scripts/                               # Forensic Audit & Verification Scripts
│   ├── audit_schema_integrity.py          # Database Schema Introspector
│   ├── inspect_identity_joins.py          # Cross-System Join & Crosswalk Analyzer
│   └── verify_timezone_offsets.py         # Facility Local vs UTC Offset Calculator
└── jarvis-mvp/                            # Working Demonstration Prototype (Port 3000)
    ├── server.js                          # Fastify/Express Mock Server
    ├── public/index.html                  # Interactive Operations Dashboard UI
    └── README.md                          # Demonstration Guide
```

---

## 3. Verified Ground Truth: The Three Founder Questions

| Question | Legacy Jarvis v0 (Faulty) | Jarvis v1 Verified Ground Truth | Root Cause / Explanation |
| :--- | :--- | :--- | :--- |
| **"How many packages did we receive yesterday?"** *(Oct 19, 2026)* | **96 packages** | **103 packages (4,812 units)**<br>• East (PA): 59 pkgs, 2,740 units<br>• West (NV): 44 pkgs, 2,072 units | Legacy query evaluated in naive UTC. 7 packages scanned between 8:00 PM and midnight EDT/PDT were misattributed to Oct 20. |
| **"Are we making money this month?"** | Hallucinated positive margin / Confused cash with accrual | **September GAAP Net Profit: $7,300.86 (0.39% margin)** on $1.85M Revenue.<br>**October: Unclosed mid-month** | Bullion trading mix (~10% mix, 1.2% margin) and high carrying costs on devaluing inventory compressed margin. October is mid-cycle. |
| **"What operational problems should I worry about today?"** | Missed banking errors; ignored partner debt | **1. $173,339.51 in 77 Blocked ACH Payouts** (Oct 12 NACHA formatting error).<br>**2. Northgate Hobby Credit Breach** ($284.3k open AR, $185.5k overdue >60d).<br>**3. $204,382.18 Trapped Inventory Loss** (Ember Throne & Nebula Rising sets dropped 31-32%). | Critical anomalies detected across banking integration, wholesale credit limits, and spot market pricing. |

---

## 4. How to Inspect & Verify Phase 0 Artifacts

### Run Audit Verification Scripts:
```bash
# 1. Verify schema integrity across the 3 databases
python scripts/audit_schema_integrity.py

# 2. Verify identity crosswalk and order normalization
python scripts/inspect_identity_joins.py

# 3. Verify facility local timezone aggregations vs UTC
python scripts/verify_timezone_offsets.py
```

### Launch the MVP Demonstration:
```bash
cd jarvis-mvp
npm start
# Open http://localhost:3000 in your browser
```

---

## 5. Security & Governance Principles

1. **Zero Production Write Access:** The Jarvis orchestrator and MCP server connect to production database read replicas with `default_transaction_read_only = 'on'`.
2. **Hard-Excluded Banking PII:** Consumer bank routing numbers, account numbers, and SSNs are completely excluded from the analytics replica.
3. **Data Sovereignty:** The analytics database is hosted in Supabase EU Central (`eu-central-1`, Frankfurt) under strict Standard Contractual Clauses (SCCs).
4. **Restricted Action Service:** Mutating actions require two-party human approval via interactive Slack modals before signed webhooks execute.
