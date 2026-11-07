# Cost definition — FIFO (finance)

_Owner: Kenji Watanabe · v2 · 2026-03-31_

For the books, MSC values inventory and cost of goods sold using **FIFO** (first in, first out).

## Definition (finance)
> **Unit cost** of a sale = the cost of the oldest units of that product still in inventory at the time of sale,
> where each receipt is a **cost layer** at the price we actually paid the member for the passed units.

- A cost layer is created when inspected units are checked in. Rejected units never create a layer.
- When an order ships, layers are relieved oldest first. A single sale can span several layers.
- The cost layer export (`finance/fifo_cost_layers.csv`) shows every layer and what's left in it.
- COGS in QuickBooks = sum of relieved layers. Gross margin in the P&L uses this number.

## Why FIFO
It matches what we actually paid, it's what our CPA expects, and it's what lenders will ask for.

## What FIFO is not
- It's not "average paid". Ops' 180-day average is a different number (see `ops/sop-average-cost.md`). When prices
  move fast the two can be far apart — e.g. if we bought heavily at a high buy price and the buy list was later cut,
  the ops average comes down quickly while the FIFO layers we're still selling from stay expensive.
- It doesn't include inbound shipping labels, packaging or labour. Those sit in operating expenses.

## Write-downs
If market value falls below FIFO cost we should write inventory down at quarter end (account 5100). We have not
done a write-down in 2026 yet.
