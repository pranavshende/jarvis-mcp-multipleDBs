# SOP — Daily receiving report

_Owner: Mei Tanaka · v2 · 2026-03-03_

Every morning by 10:00 ET, Mei posts yesterday's receiving numbers in #ops.

## How to pull it
1. Open WMS → Dashboards → **Receiving by day**.
2. Read the row for yesterday's date for each warehouse. The dashboard groups by `received_at::date`.
3. Post: `Yesterday: East <n> pkgs / West <n> pkgs / Total <n>. Inspection backlog: <n>.`

## SQL (if the dashboard is down)
```sql
select w.code, received_at::date as day, count(*) as packages
from inbound_packages p join warehouses w using (warehouse_id)
where received_at::date = current_date - 1
group by 1, 2;
```

## Notes
- The dashboard is in UTC, like everything in the WMS. Nobody has complained so we haven't changed it.
- West's numbers sometimes look low on Mondays and high on Tuesdays. Probably shift timing.
- Units are not in this report. If someone asks for units, run the package_lines query in the data dictionary.
