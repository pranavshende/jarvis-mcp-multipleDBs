# Incident — ACH batch rejected by bank (2026-10-12)

**Status:** open
**Impact:** the 2026-10-12 ACH batch was rejected (file format: bank changed their header spec). All ACH payouts in the
batch show `failed`; ACH payouts created since are `on_hold` so we don't send into a broken pipe. PayPal and wallet are
unaffected.
**Workaround:** none yet. Hannah is answering tickets with the `ach_batch_issue` macro.
**Owner:** Arjun (file format), Hannah (comms), Kenji (bank).
**Next update:** "early next week".
