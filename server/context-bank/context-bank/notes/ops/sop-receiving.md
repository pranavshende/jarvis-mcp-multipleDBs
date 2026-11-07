# SOP — Receiving (both warehouses)

_Owner: Priya Raman · v4 · 2026-06-30 · applies to EWR1 and ONT1_

## Purpose
Get every inbound package scanned, matched to a submission and staged for inspection the same day.

## Steps
1. **Scan the carrier label** at the dock station. This creates an `inbound_packages` row with `received_at` set to
   the scan time. (The scanner app stores time in UTC. The dashboard converts nothing.)
2. Enter the **sender name** as written on the label and, if the packing slip has one, the **submission number** in
   `ref_note`. If there's no slip, write the Discord handle if you can find it. If nothing, leave blank — support
   will match it later by tracking number.
3. Count the products against the slip and enter each line (`package_lines`) with **qty expected** (from slip) and
   **qty received** (what's actually in the box).
4. Move the package to the inspection rack. Status stays `received` until inspection starts.

## Counting
- One label = one package. A member's submission can come in two or three boxes; each box is its own package.
- When we say "we received 140 today" in #ops we mean **packages**. When finance asks how much came in, they want
  **units**. Please say which one you mean.

## Daily numbers
The receiving count in the daily report comes straight from the WMS dashboard. See
`ops/sop-daily-receiving-report.md`.

## Don'ts
- Don't open sealed product at the dock.
- Don't scan the same label twice (it creates a duplicate package; tell Mei to merge it).
- Don't receive packages addressed to the other warehouse — re-label and ship across.
