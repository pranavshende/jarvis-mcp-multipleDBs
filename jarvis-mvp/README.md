# Jarvis v1 — Working MVP Demonstration (Zero-Cost Local Architecture)
**Interactive Proof-of-Concept for Meridian Supply Chain (MSC)**

> **Demo URL**: [http://localhost:3000](http://localhost:3000)  
> **Total Expenditure Required**: **₹0.00 / $0.00**  
> **Deployment**: 100% Localhost / Open-Source Stack  

---

## 1. Executive Summary

This working MVP demonstrates the core business value of **Jarvis v1** to Meridian Supply Chain leadership without incurring cloud hosting fees or third-party API subscription costs.

It operates on **real, empirical Meridian Supply Chain business data** extracted from the context repository (`seller_db`, `wms_db`, `portal_db`, QuickBooks exports, and company notes), showcasing:
1. **Executive BI Dashboard**: Real-time KPIs for Revenue, Gross & Net Profit, Blocked Member Payouts, Outstanding AR, and Local vs. UTC Dock Receiving.
2. **Jarvis AI Chat Interface**: Ground-truth answers to the 4 critical founder questions with pre-compiled SQL queries, evidence tables, and markdown citations.
3. **Proactive Alert Center**: Live operational risk cards with interactive action buttons (`[Enforce Credit Hold]`, `[Re-Batch & Release]`).
4. **Restricted Action Service**: Human-confirmed action execution with unique idempotency keys and immutable audit logging.
5. **Company Knowledge RAG**: Searchable SOPs and policy guidelines.
6. **Admin & Governance Panel**: 25 teammates mapped to RBAC tiers, memory candidate staging/promotion gate, and real-time audit ledger.

---

## 2. Zero-Cost Demonstration Technology Stack

| Layer | Demonstration Stack (Tomorrow) | Production Architecture (Future Roadmap) | Cost for Demo |
|---|---|---|---|
| **Frontend UI** | Modern Responsive Dashboard (HTML5, Tailwind CSS, FontAwesome) | React + Vite + Tailwind CSS | **₹0** |
| **Backend API** | Node.js + Express / Fastify REST Gateway | Fastify Modular Monolith | **₹0** |
| **Database** | In-Memory Relational Engine / Local SQLite / Supabase Free | Supabase Managed PostgreSQL 16 (EU Central) | **₹0** |
| **Vector Memory** | In-Memory pgvector simulator with keyword indexing | Supabase `pgvector` HNSW index | **₹0** |
| **Background Jobs** | Built-in Event Scheduler | BullMQ on Redis 7 | **₹0** |
| **Authentication** | Built-in RBAC Role Context (`ROLE_FOUNDER`) | JWT + Per-User Bearer Tokens + Slack Auth | **₹0** |
| **Protocol** | Web REST + Streamable HTTP endpoints | Official MCP SDK (stdio + Streamable HTTP) | **₹0** |

---

## 3. How to Run the Demonstration

### Step 1: Start the Local Server
```powershell
cd d:\eigi.ai\jarvis-mvp
node server.js
```

### Step 2: Open in Your Browser
Navigate to:
```
http://localhost:3000
```

---

## 4. Key Demonstration Scenarios for Tomorrow's Presentation

### Scenario 1: The Three Founder Questions (Jarvis AI Chat Tab)
Click the quick-prompt pills in the **Jarvis AI Chat** tab to showcase:
1. *"How many packages did the warehouse receive yesterday?"*
   - Explains that while the legacy UTC dashboard shows **96 packages**, local shift operations physically checked in **103 packages** (59 East, 44 West), with 4,812 units handled.
2. *"Am I really making money right now?"*
   - Reconciles the ~20% Ops card spread against Kenji's closed September GAAP Net Profit of **$7,300.86 (0.39% margin)**, accounting for bullion dilution and $292k in fixed monthly Opex.
3. *"What should I worry about today?"*
   - Surfaces the 3 real existential crises: the 77 blocked ACH payouts ($173.3k), Northgate's $284k credit breach, and $204k in falling reprint inventory.
4. *"Which partner has exceeded their credit limit?"*
   - Pinpoints Northgate Hobby Distributors ($284,279.37 open balance vs $250k limit; $185.5k past due).

### Scenario 2: Proactive Alert Center & Human-Confirmed Action
1. Switch to the **Proactive Alert Center** tab.
2. Review the `P1 High` Alert: **Partner Credit Limit Breach: Northgate Hobby Distributors**.
3. Click **`[Enforce Credit Hold]`**.
4. An interactive modal dialog opens displaying the action parameters, financial context, and a unique **Idempotency Key** (`idemp_...`).
5. Click **`[Confirm & Execute]`**.
6. The alert status immediately updates to `RESOLVED_CREDIT_HOLD_ENFORCED`, and the action is immutably logged to the **Action Audit Ledger**!

### Scenario 3: Memory Governance & Anti-Poisoning Gate
1. Switch to the **Admin & Governance** tab.
2. View the **Staged Memory Candidates** list:
   - Notice candidate `cand_001` (*"Gold partners get net-90 terms"*): Automatically flagged as **`CONTRADICTED`** by `notes/sales/partner-terms.md`, preventing memory poisoning!
   - Review candidate `cand_002` (*Free freight over $2,500*): Click **`[Approve]`** to promote to company memory.

---

## 5. What to Tell the Company Tomorrow Regarding Financials

> *"Jarvis is engineered to be financially responsible and cost-efficient. We developed and validated this entire working demonstration using open-source technologies, local infrastructure, and zero paid subscriptions. For production, costs will scale predictably based on actual LLM token consumption and managed hosting. We will introduce paid infrastructure only as actual business volume and security compliance justify it."*
