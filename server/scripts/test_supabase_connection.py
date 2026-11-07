# -*- coding: utf-8 -*-
"""
Healthcheck script to test Supabase PostgreSQL connectivity.
"""
import os
import psycopg2
from urllib.parse import urlparse

# Read from server/.env or root .env
server_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(server_dir, ".env") if os.path.exists(os.path.join(server_dir, ".env")) else os.path.join(os.path.dirname(server_dir), ".env")
env_vars = {}
if os.path.exists(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env_vars[k.strip()] = v.strip().strip('"').strip("'")

direct_url = env_vars.get("DIRECT_URL")
pooled_url = env_vars.get("DATABASE_URL")

print("=" * 70)
print("SUPABASE CONNECTIVITY & INFRASTRUCTURE HEALTHCHECK")
print("=" * 70)

# Test 1: DIRECT_URL (Port 5432 - Session Mode / DDL)
print("\n[TEST 1] Connecting to DIRECT_URL (Port 5432 - Session Mode)...")
try:
    conn = psycopg2.connect(direct_url, sslmode='require', connect_timeout=10)
    cur = conn.cursor()
    cur.execute("SELECT version();")
    db_version = cur.fetchone()[0]
    print(f"  --> Connection SUCCESSFUL!")
    print(f"  --> PostgreSQL Engine: {db_version}")
    
    # Check server timezone & extensions
    cur.execute("SHOW timezone;")
    print(f"  --> Server Default Timezone: {cur.fetchone()[0]}")
    
    cur.execute("SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'uuid-ossp', 'pg_trgm');")
    exts = cur.fetchall()
    print("  --> Active Target Extensions:")
    active_ext_names = [e[0] for e in exts]
    for ext in exts:
        print(f"      - {ext[0]}: version {ext[1]}")
    
    # Check if vector extension needs to be enabled
    if 'vector' not in active_ext_names:
        print("  --> 'vector' extension not yet enabled. Attempting: CREATE EXTENSION IF NOT EXISTS vector;")
        try:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            conn.commit()
            print("      [SUCCESS] Enabled 'vector' extension!")
        except Exception as e:
            print(f"      [WARN] Could not enable vector automatically: {e}")
            conn.rollback()

    if 'uuid-ossp' not in active_ext_names:
        try:
            cur.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
            conn.commit()
            print('      [SUCCESS] Enabled "uuid-ossp" extension!')
        except Exception as e:
            conn.rollback()

    conn.close()
except Exception as e:
    print(f"  --> DIRECT_URL connection FAILED: {e}")

# Test 2: DATABASE_URL (Port 6543 - Transaction Pooler / Supavisor)
print("\n[TEST 2] Connecting to DATABASE_URL (Port 6543 - Transaction Pooler)...")
try:
    # psycopg2 doesn't use pgbouncer query param natively, strip it if present for psycopg2 connection
    clean_pooled_url = pooled_url.split("?")[0] if pooled_url else ""
    conn = psycopg2.connect(clean_pooled_url, sslmode='require', connect_timeout=10)
    cur = conn.cursor()
    cur.execute("SELECT 1;")
    print(f"  --> Transaction Pooler SUCCESSFUL (Returned: {cur.fetchone()[0]})")
    conn.close()
except Exception as e:
    print(f"  --> DATABASE_URL connection FAILED: {e}")

print("\n" + "=" * 70)
