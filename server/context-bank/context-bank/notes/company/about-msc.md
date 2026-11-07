# About Meridian Supply Chain

_Owner: Sam Okafor · Last reviewed: 2026-09-02_

Meridian Supply Chain ("MSC", "Meridian") buys sealed collectibles from independent sellers and resells them in bulk
to businesses. We started in 2021 as a Discord buy group run out of Sam's apartment in Hoboken and incorporated in
March 2021. Today we are 25 people (18 employees, 7 contractors) across two warehouses and a handful of remote roles.

## What we buy
- **Trading card games (TCG)** — sealed booster boxes, cases, bundles, elite trainer boxes. Biggest category by units.
- **Sports cards** — hobby boxes, jumbo boxes, cases and retail displays.
- **Coins & bullion** — silver tubes and monster boxes, gold coins, bars. Thin margin, high ticket, steady.

We only buy **sealed** product. Opened, resealed or damaged product is rejected at inspection.

## How money flows
1. **Members** (individual sellers, ~6,000 accounts) pick items from our **buy list** at a fixed pre-quote price,
   print a prepaid label and ship to the nearest warehouse.
2. The warehouse **receives** the package, **inspects** each unit and **checks in** what passes.
3. We pay the member for passed units (ACH, PayPal, or wallet credit that can be cashed out later).
4. **Partners** (~400 hobby shops, distributors, live sellers, online stores) buy in bulk through the
   **partners portal**: catalog → quote → order → invoice → payment.
5. We make money on the spread between the buy-list price and the partner price, minus everything it costs to run
   the place.

## Where things live
| What | System | Database |
|---|---|---|
| Members, buy list, submissions, payouts, support tickets | Seller site | `seller_db` |
| Packages, inspection, stock, outbound shipments | WMS | `wms_db` |
| Catalog, quotes, orders, invoices, partner messages, market prices | Partners portal | `portal_db` |
| Books, bills, payroll | QuickBooks Online + Gusto | — |

The three apps were built at different times by different people (seller site 2021, WMS 2023, portal 2024) and
**do not share IDs**. Each has its own product key and its own idea of a "customer". See
`eng/data-dictionary.md` for what we know about joining them.

## Warehouses
- **East — Edison, NJ (EWR1).** Bigger of the two. Receiving 9:00–21:00 Eastern, Mon–Sat.
- **West — Ontario, CA (ONT1).** Opened June 2023. Receiving 7:00–19:00 Pacific, Mon–Sat.

## Public market page
We publish a free market page with median sealed prices per set and the **MSC Sealed Index** (base 100 =
2026-07-22). Partners use it to sanity-check our quotes; members use it to decide whether to sell to us or hold.
