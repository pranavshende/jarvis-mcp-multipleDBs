# Incident — duplicate PayPal payouts (2026-08-14)

**Impact:** 31 members paid twice for the same submission, $18,412 total. $16,980 recovered by 2026-08-29.
**Cause:** retry logic in the PayPal payout worker didn't check for an existing successful payout after a timeout.
**Fix:** idempotency key on payout id (seller-site PR #1184).
**Follow-ups:** recovery tickets (Hannah), add `payout_notes` on affected members (done).
