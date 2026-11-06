# Jarvis v1 — Role-Based Access Control (RBAC) & Tool Permission Matrix

## 1. Approved Role Taxonomy
Reconciled with Meridian Supply Chain governance:
- `ROLE_FOUNDER`: Unrestricted access across all operational, financial, and strategic data.
- `ROLE_ADMIN`: Gateway control plane, token provisioning, rotation, and audit logs.
- `ROLE_FINANCE`: Financial metrics, FIFO valuation, AR aging bucket details, payout approval.
- `ROLE_SALES`: Buylist margins, partner credit limits, partner account details.
- `ROLE_WAREHOUSE`: Receiving metrics, inspection failure logs, quarantine tagging.
- `ROLE_OPERATIONS`: Cross-facility transfers, fulfillment cycle times, warehouse health.
- `ROLE_EMPLOYEE` / `ROLE_USER`: General company knowledge, SOPs, glossary, public policies.

---

## 2. Server-Side Tool Permission Matrix

| Tool Name | Allowed Roles | Required Scopes | Confirmation Required | Classification |
|---|---|---|---|---|
| `get_business_metric` | FOUNDER, ADMIN, FINANCE, SALES, OPERATIONS | `read:metrics` | No | READ |
| `get_partner_ar_aging` | FOUNDER, ADMIN, FINANCE | `read:metrics`, `read:finance` | No | READ |
| `get_inventory_valuation` | FOUNDER, ADMIN, FINANCE, OPERATIONS | `read:metrics`, `read:inventory` | No | READ |
| `get_dock_receiving_summary` | FOUNDER, ADMIN, OPERATIONS, WAREHOUSE | `read:metrics`, `read:receiving` | No | READ |
| `search_company_knowledge` | ALL ROLES | `read:knowledge` | No | READ |
| `retrieve_company_context` | ALL ROLES | `read:knowledge` | No | READ |
| `stage_knowledge_candidate` | ALL ROLES EXCEPT WAREHOUSE | `write:knowledge_candidate` | No | MUTATION |
| `propose_business_action` | FOUNDER, ADMIN, FINANCE, SALES, OPERATIONS | `propose:actions` | **Yes (Generates Token)** | MUTATION |
| `confirm_business_action` | FOUNDER, ADMIN, FINANCE, OPERATIONS | `confirm:actions` | **Yes (Requires Phrase)** | MUTATION |
| `get_active_alerts` | FOUNDER, ADMIN, FINANCE, OPERATIONS, WAREHOUSE | `read:alerts` | No | READ |
| `admin_manage_tokens` | FOUNDER, ADMIN | `admin:tokens` | No | ADMIN |

---

## 3. Mandatory Enforcement Boundary
- All authorization decisions are evaluated server-side in `gateway/src/auth/rbac.ts`.
- Frontends and MCP clients cannot manipulate permissions or elevate roles.
- Unauthorized attempts return an MCP JSON-RPC error: `Access Denied: Role '<role>' is not authorized to execute tool '<tool>'` and are logged in `jarvis_system.audit_logs`.
