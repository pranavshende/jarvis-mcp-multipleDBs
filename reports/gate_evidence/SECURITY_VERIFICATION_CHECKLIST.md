# Security Remediation Execution & Verification Protocol
**Document ID:** EV-SEC-V1-2026-10-20  
**Gating Prerequisite:** Phase 1 Entrance Gate (Condition COND-01)  
**Assigned Operators:** Lead Database Administrator & Chief Technology Officer  
**Verification Method:** Controlled Sandbox / Read Replica Execution followed by Staging DBA Sign-Off

---

## 1. Controlled Execution Protocol

Prior to connecting any Phase 1 synchronization worker to production database instances, the Lead DBA must execute the remediation scripts defined in `docs/audit/SECURITY_REMEDIATION_LOG.md` and complete this verification protocol.

```
+-------------------------------------------------------------------------+
|                  DBA Controlled Remediation Workflow                    |
|                                                                         |
|  1. Capture Snapshot   2. Execute SQL      3. Run Verification Tests    |
|  [pg_dump metadata] -> [Revoke & Create] -> [Negative Privilege Tests]  |
|                                                     |                   |
|  5. Archive Evidence   4. DBA Cryptographic Sign-Off<                   |
|  [Log Hash Stored]  <- [Signed Attestation Recorded]                    |
+-------------------------------------------------------------------------+
```

---

## 2. Automated Privilege Verification Queries

The DBA must execute the following automated verification suite against each production instance (`seller_db`, `wms_db`, `portal_db`) and log the output:

### Test 1: Verify `jarvis_svc` Login is Disabled
```sql
SELECT rolname, rolcanlogin, rolsuper, rolinherit, rolconnlimit 
FROM pg_roles 
WHERE rolname = 'jarvis_svc';
```
- **Expected Result:**
  - `rolcanlogin`: `false`
  - `rolsuper`: `false`
  - `rolconnlimit`: `0` or inactive.

### Test 2: Verify `jarvis_svc` Table Grants Have Been Revoked
```sql
SELECT grantee, table_schema, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE grantee = 'jarvis_svc';
```
- **Expected Result:** **0 rows returned.**

### Test 3: Verify `jarvis_analytics_ro` is Read-Only
Execute a mutating statement under the `jarvis_analytics_ro` context:
```sql
SET ROLE jarvis_analytics_ro;
INSERT INTO public.submissions (id, status) VALUES (999999, 'test');
```
- **Expected Result:** `ERROR: permission denied for table submissions` (State: `42501`).
```sql
UPDATE public.catalog_products SET mfr_code = 'HACK' WHERE id = 1;
```
- **Expected Result:** `ERROR: permission denied for table catalog_products` (State: `42501`).
```sql
RESET ROLE;
```

### Test 4: Verify PII and Banking Column Inaccessibility
Execute a direct query on excluded PII tables under `jarvis_analytics_ro`:
```sql
SET ROLE jarvis_analytics_ro;
SELECT routing_number, bank_account_number FROM public.payout_methods;
```
- **Expected Result:** `ERROR: permission denied for table payout_methods` (State: `42501`).
```sql
SELECT tax_id_ssn FROM public.members;
```
- **Expected Result:** `ERROR: permission denied for table members` (State: `42501`).
```sql
RESET ROLE;
```

---

## 3. DBA Sign-Off & Execution Attestation

| Target Database | Execution Date | Executing DBA | Log Hash (SHA-256) | Verification Status |
| :--- | :---: | :---: | :---: | :---: |
| `seller_db_replica` | [PENDING EXEC] | Elena Rostova (CTO) | [PENDING_HASH] | AWAITING EXECUTION |
| `wms_db_replica` | [PENDING EXEC] | Lead DBA | [PENDING_HASH] | AWAITING EXECUTION |
| `portal_db_replica` | [PENDING EXEC] | Lead DBA | [PENDING_HASH] | AWAITING EXECUTION |
