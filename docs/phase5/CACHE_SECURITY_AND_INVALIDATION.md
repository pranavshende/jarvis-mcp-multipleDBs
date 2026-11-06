# Jarvis v1 — Cache Security, Invalidation & Cross-Role Isolation
**Phase 5: Evaluation, Reliability & Optimization**  
**Author:** Enterprise Security & Information Assurance Lead  
**Date:** 2026-11-06  

---

## 1. Zero-Trust Cache Security Model

Caching in an enterprise intelligence platform introduces significant security risks if authorization boundaries are not enforced at lookup time. A cache hit must **never bypass access control**.

Jarvis v1 enforces three non-negotiable security rules:

1. **Identity-Bound Keys**: Cache keys are derived exclusively from the authenticated `UserContext` resolved by the Fastify Gateway from verified bearer tokens. The client cannot forge roles or scopes to hijack a cached entry.
2. **Double-Check on Cache Hit**: When an entry is retrieved from cache, the cache manager explicitly validates:
   ```typescript
   const roleMatches = entry.roleScope === user.role || user.role === 'ROLE_FOUNDER' || user.role === 'ROLE_ADMIN';
   const scopesValid = entry.allowedScopes.every((s) => user.allowedScopes.includes(s));
   const userMatches = !entry.userId || entry.userId === user.userId;
   if (!roleMatches || !scopesValid || !userMatches) {
     return { hit: false }; // Deny hit immediately
   }
   ```
3. **No Credential Caching**: Access tokens, raw SQL write strings, and private founder documents are strictly quarantined from the cache.

---

## 2. Cross-Role Isolation Verification

The cache isolation matrix was tested across conflicting operational roles:

| Scenario Tested | Role A (Cached) | Role B (Requester) | Expected Result | Actual Outcome | Status |
|---|---|---|---|---|---|
| **EWR1 Package Intake Count** | `ROLE_WAREHOUSE` | `ROLE_SALES` | Cache MISS | Cache MISS (0.00ms) | **PASS** |
| **Overdue Accounts Receivable** | `ROLE_FINANCE` | `ROLE_WAREHOUSE` | Cache MISS / Scope Block | Cache MISS (0.00ms) | **PASS** |
| **Sales Commission Tier** | `ROLE_SALES` (User 1) | `ROLE_SALES` (User 2) | Cache MISS (User Partition) | Cache MISS (0.00ms) | **PASS** |
| **Revoked Scopes** | `read:financials` active | `read:financials` revoked | Cache MISS | Cache MISS (0.00ms) | **PASS** |

---

## 3. Dynamic Cache Invalidation Protocols

### A. Watermark-Based Invalidation (ETL Synchronization)
When the nightly reconciliation engine (`services/reconciliation/reconciliation_engine.py`) or the 15-minute incremental sync finishes:
1. It records the completion timestamp into `analytics.reconciliation_log`.
2. The Gateway advances its local watermark:
   ```typescript
   CompositeCache.advanceETLWatermark(newWatermarkTimestamp);
   ```
3. All financial metric cache entries (`FINANCIAL_METRIC`) are purged immediately from L1 and L2.
4. Any historical keys referencing the old watermark are permanently orphaned and purged by TTL.

### B. Administrative Flush Endpoints
Privileged administrators (`ROLE_ADMIN`, `ROLE_FOUNDER`) can selectively flush cache partitions:
- `POST /api/admin/cache/invalidate` with `{"scope": "FINANCIAL_ONLY"}`
- `POST /api/admin/cache/invalidate` with `{"scope": "ROLE", "targetValue": "ROLE_SALES"}`
- `POST /api/admin/cache/invalidate` with `{"scope": "ALL"}`

Audit logs record the admin ID, scope, cleared count, and timestamp in `jarvis_system.audit_logs`.

