# -*- coding: utf-8 -*-
import psycopg2
import os

server_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(server_dir, ".env") if os.path.exists(os.path.join(server_dir, ".env")) else os.path.join(os.path.dirname(server_dir), ".env")
env_vars = {}
with open(env_path, "r", encoding="utf-8") as f:
    for line in f:
        if "=" in line and not line.startswith("#"):
            k, v = line.strip().split("=", 1)
            env_vars[k.strip()] = v.strip().strip('"').strip("'")

conn = psycopg2.connect(env_vars["DIRECT_URL"], sslmode='require')
cur = conn.cursor()

cur.execute("SELECT item_id, upc, description FROM staging_wms.wms_items LIMIT 5;")
print("WMS Items Sample:")
for r in cur.fetchall():
    print(" ", r)

cur.execute("SELECT product_id, name, mfr_code FROM staging_portal.catalog_products LIMIT 5;")
print("\nPortal Products Sample:")
for r in cur.fetchall():
    print(" ", r)

cur.execute("SELECT seller_sku, product_name FROM staging_seller.buy_list LIMIT 5;")
print("\nSeller Buy List Sample:")
for r in cur.fetchall():
    print(" ", r)

conn.close()
