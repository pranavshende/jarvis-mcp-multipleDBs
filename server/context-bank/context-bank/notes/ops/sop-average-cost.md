# SOP — Average cost (ops)

_Owner: Priya Raman · v2 · 2026-02-17_

Ops uses **average paid** to decide whether we can afford to quote a partner at a given price and to watch margin
day to day.

## Definition (ops)
> **Avg paid (180d)** = the average of the buy-list price for a product over the trailing 180 days.

It's refreshed nightly into `wms_db.wms_items.avg_paid_180d`. It's a simple average of the weekly buy-list price
(each week counts once), so it doesn't depend on how many units we happened to buy that week. That makes it stable
and easy to reason about.

## How we use it
- **Quote floor:** never quote a partner below avg paid × 1.08 without Sam or Priya's OK.
- **Daily margin check:** (partner price − avg paid) ÷ partner price. Ops dashboard target: 18–22% for TCG and
  sports. Bullion is tracked separately (target 4–8%).

## Why not finance's number?
Finance uses FIFO (see `finance/cost-definition-fifo.md`). FIFO is right for the books but it's lumpy and only
updates after month-end close, which is too late for quoting. Ops and finance agreed in February that both numbers
exist for different purposes.
