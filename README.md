# Jarvis v1 — Enterprise AI Intelligence Platform for Meridian Supply Chain (MSC)

[![Architecture](https://img.shields.io/badge/Architecture-Fastify%20%2B%20Flask%20%2B%20Supabase-blue.svg)](project_docs/ARCHITECTURE.md)
[![Security Standard](https://img.shields.io/badge/Security-Zero--Trust%20%7C%20PromptGuard-green.svg)](docs/testing/SECURITY_AUDIT_REPORT.md)
[![Evaluation Pass Rate](https://img.shields.io/badge/AI%20Quality-96.0%25%20(48%2F50)-brightgreen.svg)](docs/testing/AI_QUALITY_REPORT.md)
[![Production Readiness](https://img.shields.io/badge/Status-Ready%20With%20Conditions-yellow.svg)](docs/testing/FINAL_PRODUCTION_READINESS_REPORT.md)

---

## 1. Problem Statement & Proposed Solution

### The Problem
Meridian Supply Chain operates across multiple disconnected business systems, including seller management, warehouse management, wholesale partner operations, finance, and inventory. Because operational data, company knowledge, and workflows are fragmented, employees spend significant time searching for information, reconciling data manually, identifying business risks, and coordinating actions across different platforms. There is no unified intelligence layer that provides a reliable, real-time view of business operations.

### The Proposed Solution — Jarvis AI
Build **Jarvis**, an AI-powered Enterprise Intelligence Platform that connects existing business systems into a centralized intelligence layer, enabling employees to:
- **Interact with company data** through natural language.
- **Retrieve verified organizational knowledge** with strict source document citations.
- **Analyze business performance** via deterministic SQL calculations against a unified star schema (no hallucinated metrics).
- **Detect operational anomalies** and receive actionable recommendations (blocked payouts, credit limit breaches, inventory devaluation).
- **Execute controlled business actions** through role-based access control (RBAC), explicit human confirmation tokens, and immutable audit trails.

### In Simple Terms
- **Problem:** Business information and operations are scattered across disconnected systems, making decision-making slow, manual, and inefficient.
- **Solution:** Jarvis unifies access to business intelligence, company knowledge, and operational workflows through a secure, AI-powered conversational platform.

---

## 2. Project Architecture & Live Topology

```text
React Frontend (:3001)
        |
        v
Fastify Gateway (:4000) [MCP, RBAC, Model Router, Semantic Cache, DLQ]
        |
        +------ Flask Backend (:5000) [Deterministic Metrics, Knowledge RAG, Actions]
        |
        +------ Supabase PostgreSQL (:6543) [Star Schema, pgvector, Action Audit Ledger]
        |
        +------ Redis / BullMQ (:6379) [DLQ & Distributed Workers]
        |
        +------ AI Providers [Gemini 2.5 Flash / Pro, Multi-tier Fallback]
```

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

### Launch the Integrated Services:
```bash
# 1. Start Fastify Gateway (Port 4000)
cd gateway
npm start

# 2. Start Flask Backend (Port 5000)
cd server
python app.py

# 3. Start React Admin Dashboard (Port 3001)
cd client
npm run preview -- --port 3001 --host 0.0.0.0
# Open http://localhost:3001 in your browser
```

### Run Certified Verification & Test Suites:
```bash
# Complete API Suite (60 Endpoints)
python scripts/test_phase2_complete_apis.py

# End-to-End Business Workflows (8 Core Operational Workflows)
python scripts/test_phase9_business_workflows.py

# 50-Scenario Golden Evaluation Runner (CI Quality Gate)
cd gateway && npx tsx ../eval/ci_runner.ts
```

---

## 5. Security & Governance Principles

1. **Zero Production Write Access:** The Jarvis orchestrator and MCP server connect to production database read replicas with `default_transaction_read_only = 'on'`.
2. **Hard-Excluded Banking PII:** Consumer bank routing numbers, account numbers, and SSNs are completely excluded from the analytics replica.
3. **Data Sovereignty:** The analytics database is hosted in Supabase EU Central (`eu-central-1`, Frankfurt) under strict Standard Contractual Clauses (SCCs).
4. **Restricted Action Service:** Mutating actions require two-party human approval via interactive Slack modals before signed webhooks execute.
