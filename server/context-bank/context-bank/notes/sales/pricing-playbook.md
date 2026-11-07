# Pricing playbook

_Owner: Zoe Adams (pricing) · Sofia (sales)_

## Buy side (what we pay members)
- Weekly update every Monday ~11:00 ET. Target buy price ≈ market × 0.80 for TCG, 0.79 sports, ~0.96 bullion.
- 2026-07-13: base ratios raised from 0.76 → 0.80 (TCG) and 0.75 → 0.79 (sports), bullion 0.95 → 0.958, to win
  supply back from other buyers. Sam approved.
- **Supply pushes:** when a set is hot and we're short, Sam can approve raising the buy ratio for a few weeks.
  Last one: Ember Throne and Nebula Rising, Aug 20 → Sep 23, ratio 0.865.
- Big drops: if a reprint or restock is announced, cut the buy list same day.

## Sell side (what partners pay)
- Quote ≈ market × 0.955 (TCG), 0.945 (sports), 1.02 (bullion), minus tier discount.
- Floor: avg paid (180d) × 1.08 — see ops SOP.
- If we're long on a falling set, clear it: price at market × 0.94 and push to distributors.

## Market data
Market prices are scraped nightly into `portal_db.market_prices` (median box price per set) and
`portal_db.price_index`. The index is what we publish.
