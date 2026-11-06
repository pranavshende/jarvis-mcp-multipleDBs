# Member payouts — ACH batches

- ACH payouts are batched daily at 16:00 ET via our bank's file upload. Batch id `ACH-YYYYMMDD`.
- PayPal payouts are instant via API. Wallet credit is instant.
- If the bank rejects a file, every payout in the batch shows `failed` and later ones go `on_hold` until
  engineering fixes the file and Hannah re-releases. See incident `eng/incidents/2026-10-12-ach-batch-rejected.md`.
- Members are told "2–3 business days". When batches fail, tickets spike in Discord within a day.
