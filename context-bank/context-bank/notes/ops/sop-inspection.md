# SOP — Inspection

_Owner: Priya Raman · v3 · 2026-05-12_

1. Pull packages from the inspection rack oldest first.
2. Inspect each unit: shrink wrap, factory seals, corners, weight (TCG boxes: weigh against the reference sheet).
3. Record `qty_passed` / `qty_failed` per line and a `fail_reason` from the list:
   - Damaged corner / crushed box
   - Resealed / shrink tampered
   - Wrong item (not on slip)
   - Water damage
   - Opened
4. When every line in a package is inspected the package flips to `checked_in` (or `rejected` if nothing passed)
   and passed units are added to stock.
5. Payout is created automatically when **all** packages of a submission are checked in.

## Resealed product
Resealed boxes are the big risk. If you see more than two resealed units from the same sender in a week, post in
#ops with the sender name and submission numbers and tag Hannah. Do **not** message the member directly.

## Targets
- East: inspect within 24h of receipt.
- West: inspect within 36h of receipt (smaller team).
- Normal fail rate is 2–4% of units. Above 8% in a week, tell Priya.
