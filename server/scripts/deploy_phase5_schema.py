# -*- coding: utf-8 -*-
"""
Apply Phase 5 database migration: jarvis_system.semantic_cache, evaluation_runs, dlq_audit_log, department_budgets
"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(r"d:\eigi.ai\server\.env")
direct_url = os.getenv("DIRECT_URL")

if not direct_url:
    raise ValueError("DIRECT_URL not found in server/.env")

print(f"Connecting to Supabase PostgreSQL...")
conn = psycopg2.connect(direct_url, sslmode='require')
conn.autocommit = True
cur = conn.cursor()

migration_path = r"d:\eigi.ai\server\database\migrations\005_jarvis_phase5_optimization.sql"
with open(migration_path, "r", encoding="utf-8") as f:
    sql = f.read()

print(f"Executing migration: {migration_path}")
cur.execute(sql)
print("Migration 005 applied successfully!")

cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'jarvis_system';")
tables = [r[0] for r in cur.fetchall()]
print(f"Verified tables in 'jarvis_system': {tables}")

cur.execute("SELECT department, monthly_spend_limit_usd, current_usd_spend FROM jarvis_system.department_budgets;")
budgets = cur.fetchall()
print(f"Seeded department budgets:")
for b in budgets:
    print(f"  - {b[0]}: ${b[1]} limit, current: ${b[2]}")

cur.close()
conn.close()
