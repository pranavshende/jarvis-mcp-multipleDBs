# -*- coding: utf-8 -*-
"""
Initialize schemas and deploy canonical crosswalk to Supabase PostgreSQL.
"""
import os
import psycopg2

# Read from server/.env
server_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(server_dir, ".env") if os.path.exists(os.path.join(server_dir, ".env")) else os.path.join(os.path.dirname(server_dir), ".env")
env_vars = {}
with open(env_path, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env_vars[k.strip()] = v.strip().strip('"').strip("'")

direct_url = env_vars.get("DIRECT_URL")

print("Initializing Supabase Database Schemas...")
conn = psycopg2.connect(direct_url, sslmode='require')
cur = conn.cursor()

# 1. Create Namespaces / Schemas
schemas = ["analytics", "staging_seller", "staging_wms", "staging_portal", "app", "vector"]
for schema in schemas:
    cur.execute(f"CREATE SCHEMA IF NOT EXISTS {schema};")
    print(f"  [OK] Schema created/verified: '{schema}'")

# 2. Deploy contracts/canonical_crosswalk.sql
crosswalk_path = os.path.join(r"d:\eigi.ai", "contracts", "canonical_crosswalk.sql")
with open(crosswalk_path, "r", encoding="utf-8") as f:
    crosswalk_sql = f.read()

cur.execute(crosswalk_sql)
print("  [OK] Successfully deployed 'contracts/canonical_crosswalk.sql'!")

# 3. Verify deployed table and facility rows
cur.execute("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'analytics';")
tables = cur.fetchall()
print(f"  [OK] Tables in 'analytics' schema: {[t[1] for t in tables]}")

cur.execute("SELECT facility_code, facility_name, state, iana_timezone FROM analytics.dim_facilities;")
facilities = cur.fetchall()
print("  [OK] Deployed Facilities:")
for fac in facilities:
    print(f"      - {fac[0]}: {fac[1]} ({fac[2]}) -> Timezone: {fac[3]}")

conn.commit()
conn.close()
print("\n[SUCCESS] Supabase unified single-database environment initialized!")
