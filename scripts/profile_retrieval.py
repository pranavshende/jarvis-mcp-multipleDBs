import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "server"))

from services.db_pool import get_db_connection
from services.rag.embedding_service import EmbeddingService
from services.rag.vector_store import HybridVectorStore
import psycopg2.extras

emb_svc = EmbeddingService()
store = HybridVectorStore(embedding_service=emb_svc)

query = "What are our standard partner payment terms?"

print("=== 1. Detailed Query Plan (EXPLAIN ANALYZE) on Supabase ===")
q_vec = emb_svc.generate_embedding(query)
vec_str = f"[{','.join(str(x) for x in q_vec)}]"
allowed_sens = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED_FOUNDER"]

with get_db_connection(read_only=True) as conn:
    with conn.cursor() as cur:
        # Check dense search query plan
        dense_sql = """
            EXPLAIN (ANALYZE, BUFFERS)
            SELECT c.id, c.content, (1 - (c.embedding <=> %(q_vec)s::vector)) as cosine_similarity
            FROM jarvis_memory.document_chunks c
            JOIN jarvis_memory.knowledge_sources s ON c.source_id = s.id
            WHERE c.embedding IS NOT NULL AND s.sensitivity_level = ANY(%(sens_levels)s)
            ORDER BY c.embedding <=> %(q_vec)s::vector ASC
            LIMIT 20;
        """
        cur.execute(dense_sql, {"q_vec": vec_str, "sens_levels": allowed_sens})
        print("DENSE SEARCH PLAN:")
        for r in cur.fetchall():
            print("  ", r[0])

        # Check sparse search query plan
        sparse_sql = """
            EXPLAIN (ANALYZE, BUFFERS)
            SELECT c.id, c.content, ts_rank_cd(c.search_vector, plainto_tsquery('english', %(query)s)) as text_rank
            FROM jarvis_memory.document_chunks c
            JOIN jarvis_memory.knowledge_sources s ON c.source_id = s.id
            WHERE c.search_vector @@ plainto_tsquery('english', %(query)s) AND s.sensitivity_level = ANY(%(sens_levels)s)
            ORDER BY text_rank DESC
            LIMIT 20;
        """
        cur.execute(sparse_sql, {"query": "payment terms", "sens_levels": allowed_sens})
        print("\nSPARSE SEARCH PLAN:")
        for r in cur.fetchall():
            print("  ", r[0])

print("\n=== 2. Granular Step-by-Step Latency Breakdown ===")
runs = 10
timings = {
    "t_auth_filter": [],
    "t_preprocessing": [],
    "t_embedding": [],
    "t_db_conn_acquire": [],
    "t_db_dense_query": [],
    "t_db_sparse_query": [],
    "t_rrf_fusion": [],
    "t_rerank": [],
    "t_total_retrieval": []
}

for _ in range(runs):
    t_start = time.perf_counter()

    # Step 1: Authorization filtering
    t0 = time.perf_counter()
    user_role = "ROLE_FOUNDER"
    allowed = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED_FOUNDER"]
    t_auth = (time.perf_counter() - t0) * 1000.0

    # Step 2: Preprocessing
    t0 = time.perf_counter()
    clean_q = query.strip()
    clean_query = "".join([c if c.isalnum() or c.isspace() else " " for c in clean_q]).strip()
    t_prep = (time.perf_counter() - t0) * 1000.0

    # Step 3: Embedding generation
    t0 = time.perf_counter()
    vec = emb_svc.generate_embedding(clean_q)
    v_str = f"[{','.join(str(x) for x in vec)}]"
    t_emb = (time.perf_counter() - t0) * 1000.0

    # Step 4: DB Connection acquire
    t0 = time.perf_counter()
    conn_ctx = get_db_connection(read_only=True)
    conn = conn_ctx.__enter__()
    t_conn = (time.perf_counter() - t0) * 1000.0

    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Step 5: Dense query
        t0 = time.perf_counter()
        cur.execute("""
            SELECT c.id as chunk_id, c.source_id, c.chunk_index, c.section_heading,
                   c.section_path, c.content, c.token_count, c.document_version,
                   s.source_name, s.document_title, s.source_path, s.sensitivity_level,
                   s.approval_status, (1 - (c.embedding <=> %(q_vec)s::vector)) as cosine_similarity
            FROM jarvis_memory.document_chunks c
            JOIN jarvis_memory.knowledge_sources s ON c.source_id = s.id
            WHERE c.embedding IS NOT NULL AND s.sensitivity_level = ANY(%(sens_levels)s)
            ORDER BY c.embedding <=> %(q_vec)s::vector ASC
            LIMIT 20;
        """, {"q_vec": v_str, "sens_levels": allowed})
        dense_rows = [dict(r) for r in cur.fetchall()]
        t_dense = (time.perf_counter() - t0) * 1000.0

        # Step 6: Sparse query
        t0 = time.perf_counter()
        cur.execute("""
            SELECT c.id as chunk_id, c.source_id, c.chunk_index, c.section_heading,
                   c.section_path, c.content, c.token_count, c.document_version,
                   s.source_name, s.document_title, s.source_path, s.sensitivity_level,
                   s.approval_status, ts_rank_cd(c.search_vector, plainto_tsquery('english', %(query)s)) as text_rank
            FROM jarvis_memory.document_chunks c
            JOIN jarvis_memory.knowledge_sources s ON c.source_id = s.id
            WHERE c.search_vector @@ plainto_tsquery('english', %(query)s) AND s.sensitivity_level = ANY(%(sens_levels)s)
            ORDER BY text_rank DESC
            LIMIT 20;
        """, {"query": clean_query, "sens_levels": allowed})
        sparse_rows = [dict(r) for r in cur.fetchall()]
        t_sparse = (time.perf_counter() - t0) * 1000.0

        cur.close()
    finally:
        conn_ctx.__exit__(None, None, None)

    # Step 7: RRF fusion
    t0 = time.perf_counter()
    merged = store._reciprocal_rank_fusion(dense_rows, sparse_rows, k=60)
    t_rrf = (time.perf_counter() - t0) * 1000.0

    # Step 8: Reranking
    t0 = time.perf_counter()
    top_chunks = store._cross_encoder_rerank(clean_q, merged, top_k=5)
    t_rerank = (time.perf_counter() - t0) * 1000.0

    t_total = (time.perf_counter() - t_start) * 1000.0

    timings["t_auth_filter"].append(t_auth)
    timings["t_preprocessing"].append(t_prep)
    timings["t_embedding"].append(t_emb)
    timings["t_db_conn_acquire"].append(t_conn)
    timings["t_db_dense_query"].append(t_dense)
    timings["t_db_sparse_query"].append(t_sparse)
    timings["t_rrf_fusion"].append(t_rrf)
    timings["t_rerank"].append(t_rerank)
    timings["t_total_retrieval"].append(t_total)

def p_stat(arr, p):
    s = sorted(arr)
    k = (len(s) - 1) * p
    f = int(k)
    c = min(f + 1, len(s) - 1)
    d = k - f
    return round(s[f] * (1 - d) + s[c] * d, 2)

print("\nPerformance Profile across 10 Runs (milliseconds):")
for name, arr in timings.items():
    print(f"  {name:<22}: avg={sum(arr)/len(arr):6.2f}ms | p50={p_stat(arr, 0.5):6.2f}ms | p95={p_stat(arr, 0.95):6.2f}ms | p99={p_stat(arr, 0.99):6.2f}ms")
