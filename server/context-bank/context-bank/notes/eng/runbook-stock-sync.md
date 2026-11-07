# Runbook — stock-sync

- Logs: `/var/log/ops-scripts/stock-sync.log` on ops-scripts box.
- Common failure: WMS API token expired → job exits 0 after logging a warning (yes, really) and nothing is updated.
- Common failure: new portal product not in mapping sheet → skipped.
- To force a run: `python -m sync.stock --all`.
- Alert: none. (ENG-377 "alert if last_synced_at > 1h" is in backlog.)
