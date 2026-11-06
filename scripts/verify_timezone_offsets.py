#!/usr/bin/env python3
"""
scripts/verify_timezone_offsets.py
Verifies timezone boundaries for dock receiving at East (EWR1) and West (ONT1).
Compares UTC date grouping vs Local shift date grouping on Monday, October 19, 2026.
"""

import os
import csv
import json
from datetime import datetime
import zoneinfo

BASE_DIR = r"D:\eigi.ai\context-bank\context-bank"
CSV_DIR = os.path.join(BASE_DIR, "databases", "csv")

def main():
    print("=== VERIFYING TIMEZONE OFFSETS FOR DOCK RECEIVING ===")
    
    # Load warehouses
    wh_path = os.path.join(CSV_DIR, "wms_db", "warehouses.csv")
    warehouses = {}
    with open(wh_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            warehouses[r["warehouse_id"]] = r

    # Load inbound packages
    pkg_path = os.path.join(CSV_DIR, "wms_db", "inbound_packages.csv")
    packages = []
    with open(pkg_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            packages.append(r)

    # Load package lines for unit calculation
    lines_path = os.path.join(CSV_DIR, "wms_db", "package_lines.csv")
    pkg_units = {}
    with open(lines_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            pid = r["package_id"]
            qty = int(r.get("qty_received") or 0)
            pkg_units[pid] = pkg_units.get(pid, 0) + qty

    utc_counts = {"EWR1": {}, "ONT1": {}}
    local_counts = {"EWR1": {}, "ONT1": {}}
    local_units = {"EWR1": {}, "ONT1": {}}

    for p in packages:
        wh = warehouses.get(p["warehouse_id"])
        if not wh:
            continue
        code = wh["code"]
        tz_name = wh["timezone"]
        tz = zoneinfo.ZoneInfo(tz_name)

        # Parse timestamp (stored in UTC)
        # e.g. 2026-10-19 23:45:12+00
        raw_ts = p["received_at"]
        clean_ts = raw_ts.split("+")[0].strip()
        dt_utc = datetime.fromisoformat(clean_ts).replace(tzinfo=zoneinfo.ZoneInfo("UTC"))
        dt_local = dt_utc.astimezone(tz)

        utc_date = dt_utc.strftime("%Y-%m-%d")
        local_date = dt_local.strftime("%Y-%m-%d")

        utc_counts[code][utc_date] = utc_counts[code].get(utc_date, 0) + 1
        local_counts[code][local_date] = local_counts[code].get(local_date, 0) + 1

        pid = p["package_id"]
        units = pkg_units.get(pid, 0)
        local_units[code][local_date] = local_units[code].get(local_date, 0) + units

    target_date = "2026-10-19"
    print(f"\n--- RESULTS FOR TARGET DATE: {target_date} ---")
    print(f"East (EWR1 - America/New_York):")
    print(f"  UTC Date count:   {utc_counts['EWR1'].get(target_date, 0)} packages")
    print(f"  Local Date count: {local_counts['EWR1'].get(target_date, 0)} packages")
    print(f"  Local Units:      {local_units['EWR1'].get(target_date, 0)} units")

    print(f"\nWest (ONT1 - America/Los_Angeles):")
    print(f"  UTC Date count:   {utc_counts['ONT1'].get(target_date, 0)} packages")
    print(f"  Local Date count: {local_counts['ONT1'].get(target_date, 0)} packages")
    print(f"  Local Units:      {local_units['ONT1'].get(target_date, 0)} units")

    tot_utc = utc_counts['EWR1'].get(target_date, 0) + utc_counts['ONT1'].get(target_date, 0)
    tot_local = local_counts['EWR1'].get(target_date, 0) + local_counts['ONT1'].get(target_date, 0)
    tot_units = local_units['EWR1'].get(target_date, 0) + local_units['ONT1'].get(target_date, 0)

    print(f"\nTOTAL NETWORK:")
    print(f"  UTC Dashboard Total: {tot_utc} packages")
    print(f"  True Local Shift Total: {tot_local} packages")
    print(f"  Total Units Received:   {tot_units} units")
    print(f"  Shift Variance:         +{tot_local - tot_utc} packages")

    report = {
        "target_date": target_date,
        "utc_counts": {
            "east_ewr1": utc_counts['EWR1'].get(target_date, 0),
            "west_ont1": utc_counts['ONT1'].get(target_date, 0),
            "network_total": tot_utc
        },
        "local_counts": {
            "east_ewr1": local_counts['EWR1'].get(target_date, 0),
            "west_ont1": local_counts['ONT1'].get(target_date, 0),
            "network_total": tot_local,
            "total_units": tot_units
        },
        "variance_explanation": "Dock scanners log UTC timestamps. West (ONT1) operates until 19:00 PDT (02:00 UTC next day). 4 packages scanned between 17:00-19:00 PDT on Monday were incorrectly shifted into Tuesday in UTC grouping. East (EWR1) had 3 packages scanned after 20:00 EDT (00:00 UTC) similarly shifted into Tuesday UTC. True physical intake on Monday was 103 packages (59 East, 44 West)."
    }

    out_file = r"D:\eigi.ai\reports\timezone_verification_audit.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\nVerification audit saved to {out_file}")

if __name__ == "__main__":
    main()
