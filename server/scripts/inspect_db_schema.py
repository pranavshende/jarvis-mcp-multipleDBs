import sys
sys.path.insert(0, 'd:/eigi.ai/server')
from services.db_pool import get_db_connection
import psycopg2.extras

with get_db_connection(read_only=True) as conn:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'analytics' AND table_name = 'fact_invoices'
            ORDER BY ordinal_position;
        """)
        print("FACT_INVOICES COLUMNS:")
        for r in cur.fetchall():
            print(f"  {r['column_name']} ({r['data_type']})")

        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'analytics' AND table_name = 'fact_cost_layers'
            ORDER BY ordinal_position;
        """)
        print("\nFACT_COST_LAYERS COLUMNS:")
        for r in cur.fetchall():
            print(f"  {r['column_name']} ({r['data_type']})")

        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'jarvis_system' AND table_name = 'department_budgets'
            ORDER BY ordinal_position;
        """)
        print("\nDEPARTMENT_BUDGETS COLUMNS:")
        for r in cur.fetchall():
            print(f"  {r['column_name']} ({r['data_type']})")
