# -*- coding: utf-8 -*-
"""
Deploy staging tables to Supabase from the three SQL dumps.
"""
import os
import re
import psycopg2

# Read DIRECT_URL from server/.env
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
conn = psycopg2.connect(direct_url, sslmode='require')
cur = conn.cursor()

db_configs = [
    ("seller_db", "staging_seller"),
    ("wms_db", "staging_wms"),
    ("portal_db", "staging_portal")
]

print("=" * 70)
print("DEPLOYING STAGING TABLES TO SUPABASE")
print("=" * 70)

for db_name, schema in db_configs:
    sql_file = os.path.join(r"d:\eigi.ai\context-bank\context-bank\databases", f"{db_name}.sql")
    with open(sql_file, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Extract all CREATE TABLE statements
    # Match CREATE TABLE public.<table_name> ( ... );
    create_tables = re.findall(r'CREATE TABLE public\.(\w+)\s*\((.*?)\);', content, re.DOTALL)
    print(f"\n[{db_name.upper()} -> {schema}] Found {len(create_tables)} tables:")
    
    for tbl_name, tbl_body in create_tables:
        # Drop if exists in staging schema and recreate
        drop_sql = f"DROP TABLE IF EXISTS {schema}.{tbl_name} CASCADE;"
        create_sql = f"CREATE TABLE IF NOT EXISTS {schema}.{tbl_name} ({tbl_body});"
        
        # Replace any public. sequences or types if referenced
        create_sql = re.sub(r'public\.', f'{schema}.', create_sql)
        
        try:
            cur.execute(drop_sql)
            cur.execute(create_sql)
            conn.commit()
            print(f"  [OK] Created table: {schema}.{tbl_name}")
        except Exception as e:
            print(f"  [ERROR] Failed to create {schema}.{tbl_name}: {e}")
            conn.rollback()

conn.close()
print("\n" + "=" * 70)
print("STAGING TABLES DEPLOYMENT COMPLETE")
print("=" * 70)
