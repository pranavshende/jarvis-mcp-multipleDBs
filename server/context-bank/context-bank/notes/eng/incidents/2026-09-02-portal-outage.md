# Incident — partner portal down 47 minutes (2026-09-02)

**Impact:** partners couldn't check out 14:05–14:52 ET. ~9 orders delayed, 2 partners complained.
**Cause:** Postgres connection pool exhausted by a long-running report query run by hand against prod.
**Fix:** reports moved to a read replica... (ENG-391, not done yet). In the meantime: don't run big queries on prod
during US business hours.
