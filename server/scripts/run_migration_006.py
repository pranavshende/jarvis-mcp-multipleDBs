import os
import psycopg2
import dotenv

dotenv.load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
url = os.environ.get('DIRECT_URL') or os.environ.get('DATABASE_URL')
conn = psycopg2.connect(url)
cur = conn.cursor()

migration_file = os.path.join(os.path.dirname(__file__), '..', 'database', 'migrations', '006_jarvis_chat_and_auth.sql')
with open(migration_file, 'r', encoding='utf-8') as f:
    sql = f.read()

cur.execute(sql)
conn.commit()
print("✅ Migration 006 applied successfully!")

# Verify tables exist
cur.execute("""
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name IN ('users', 'conversations', 'messages');
""")
tables = cur.fetchall()
print(f"Created tables in public: {tables}")

cur.close()
conn.close()

