# -*- coding: utf-8 -*-
import sys
sys.path.append(r"d:\eigi.ai\server")
from services.reconciliation.reconciliation_engine import run_reconciliation

res = run_reconciliation()
print(f"Reconciliation Result: {res['targets_matched']}/{res['total_targets_checked']} matched")
print(f"Total Batch Duration: {res['total_batch_duration_seconds']}s (SLA Met: {res['sla_met']})")
for d in res['details']:
    print(f"  - {d['source_table']} -> {d['destination_table']}: {d['status']} (src: {d['source_count']}, dst: {d['destination_count']})")
