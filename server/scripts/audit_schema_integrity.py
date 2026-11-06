#!/usr/bin/env python3
"""
scripts/audit_schema_integrity.py
Forensic schema inspector for Meridian Supply Chain databases.
Analyzes SQL dumps and CSV datasets across seller_db, wms_db, and portal_db.
"""

import os
import re
import csv
import json

BASE_DIR = r"D:\eigi.ai\context-bank\context-bank"
DB_DIR = os.path.join(BASE_DIR, "databases")
CSV_DIR = os.path.join(DB_DIR, "csv")

DATABASES = ["seller_db", "wms_db", "portal_db"]

def parse_sql_tables(sql_file_path):
    """Extract CREATE TABLE statements, columns, constraints, and data types from pg_dump SQL."""
    tables = {}
    if not os.path.exists(sql_file_path):
        return tables

    with open(sql_file_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # Find CREATE TABLE
    matches = re.findall(r"CREATE TABLE (?:public\.)?(\w+)\s*\((.*?)\);", content, re.DOTALL)
    for table_name, body in matches:
        cols = []
        pks = []
        fks = []
        lines = [l.strip() for l in body.split("\n") if l.strip()]
        for line in lines:
            if line.startswith("CONSTRAINT") and "PRIMARY KEY" in line:
                pk_match = re.search(r"PRIMARY KEY \((.*?)\)", line)
                if pk_match:
                    pks = [c.strip().strip('"') for c in pk_match.group(1).split(",")]
            elif line.startswith("CONSTRAINT") and "FOREIGN KEY" in line:
                fk_match = re.search(r"FOREIGN KEY \((.*?)\) REFERENCES (?:public\.)?(\w+)\s*\((.*?)\)", line)
                if fk_match:
                    fks.append({
                        "column": fk_match.group(1).strip().strip('"'),
                        "ref_table": fk_match.group(2).strip(),
                        "ref_column": fk_match.group(3).strip().strip('"')
                    })
            elif not line.startswith("CONSTRAINT"):
                parts = line.split()
                if parts:
                    col_name = parts[0].strip('"').rstrip(",")
                    col_type = " ".join(parts[1:]).rstrip(",")
                    is_not_null = "NOT NULL" in col_type
                    cols.append({
                        "name": col_name,
                        "type": col_type.replace("NOT NULL", "").strip(),
                        "nullable": not is_not_null
                    })
        tables[table_name] = {
            "columns": cols,
            "primary_keys": pks,
            "foreign_keys": fks
        }
    return tables

def audit_csv_files(csv_base_dir):
    """Inspect CSV row counts, column names, null counts, and file sizes."""
    csv_stats = {}
    for db in DATABASES:
        db_csv_dir = os.path.join(csv_base_dir, db)
        if not os.path.exists(db_csv_dir):
            continue
        csv_stats[db] = {}
        for fname in os.listdir(db_csv_dir):
            if fname.endswith(".csv"):
                tname = fname.replace(".csv", "")
                fpath = os.path.join(db_csv_dir, fname)
                fsize = os.path.getsize(fpath)
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    reader = csv.reader(f)
                    try:
                        header = next(reader)
                        row_count = 0
                        null_counts = {col: 0 for col in header}
                        for row in reader:
                            row_count += 1
                            for idx, val in enumerate(row):
                                if idx < len(header) and (val is None or val == "" or val == "NULL"):
                                    null_counts[header[idx]] += 1
                        csv_stats[db][tname] = {
                            "file_size_bytes": fsize,
                            "row_count": row_count,
                            "columns": header,
                            "null_counts": null_counts
                        }
                    except StopIteration:
                        csv_stats[db][tname] = {
                            "file_size_bytes": fsize,
                            "row_count": 0,
                            "columns": [],
                            "null_counts": {}
                        }
    return csv_stats

def main():
    print("=== STARTING DATABASE SCHEMA INTEGRITY AUDIT ===")
    results = {}
    for db in DATABASES:
        sql_file = os.path.join(DB_DIR, f"{db}.sql")
        print(f"Parsing SQL dump: {sql_file}...")
        tables = parse_sql_tables(sql_file)
        results[db] = {"sql_tables": tables}
        print(f"  Found {len(tables)} tables in {db}.sql")

    print("\nAuditing CSV tables...")
    csv_stats = audit_csv_files(CSV_DIR)
    for db in DATABASES:
        results[db]["csv_stats"] = csv_stats.get(db, {})
        print(f"  Audited {len(results[db]['csv_stats'])} CSV tables for {db}")

    out_file = r"D:\eigi.ai\reports\schema_audit_raw.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\nAudit complete. Raw schema data saved to {out_file}")

if __name__ == "__main__":
    main()
