# SOP — Outbound (partner orders)

1. Orders appear in the WMS pick queue when the portal marks them `open` and allocates a warehouse.
2. Pick → pack → label (UPS for parcels, UPS Freight for pallets over 150 lb).
3. Scan out. `outbound_shipments.shipped_at` triggers the invoice in the portal.
4. SPLIT orders (stock in both warehouses) ship as two shipments; the partner gets one invoice.
5. Same-day cut-off: 15:00 local.
