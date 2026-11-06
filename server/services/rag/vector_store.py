# -*- coding: utf-8 -*-
"""
Vector Store & Hybrid Search Engine.
Combines dense pgvector cosine search and sparse PostgreSQL full-text search (tsvector/GIN)
using Reciprocal Rank Fusion (RRF) and cross-encoder relevance reranking.
Enforces sensitivity filters, role-based access, and exact citation generation.
"""
import re
import math
import logging
import psycopg2.extras
from datetime import datetime

from services.db_pool import get_db_connection
from services.rag.embedding_service import EmbeddingService

logger = logging.getLogger("jarvis.rag.vector_store")

class HybridVectorStore:
    def __init__(self, embedding_service=None):
        self.embedding_service = embedding_service or EmbeddingService()

    def search_dense(self, query, limit=20, sensitivity_filter=None):
        """
        Executes dense pgvector cosine similarity search using the HNSW index.
        """
        query_vector = self.embedding_service.generate_embedding(query)
        vector_str = f"[{','.join(str(x) for x in query_vector)}]"

        with get_db_connection(read_only=True) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                where_clauses = ["c.embedding IS NOT NULL"]
                params = {"q_vec": vector_str, "limit": limit}

                if sensitivity_filter:
                    where_clauses.append("s.sensitivity_level = ANY(%(sens_levels)s)")
                    params["sens_levels"] = sensitivity_filter

                where_sql = " AND ".join(where_clauses)
                query_sql = f"""
                    SELECT 
                        c.id as chunk_id,
                        c.source_id,
                        c.chunk_index,
                        c.section_heading,
                        c.section_path,
                        c.content,
                        c.token_count,
                        c.document_version,
                        s.source_name,
                        s.document_title,
                        s.source_path,
                        s.sensitivity_level,
                        s.approval_status,
                        (1 - (c.embedding <=> %(q_vec)s::vector)) as cosine_similarity
                    FROM jarvis_memory.document_chunks c
                    JOIN jarvis_memory.knowledge_sources s ON c.source_id = s.id
                    WHERE {where_sql}
                    ORDER BY c.embedding <=> %(q_vec)s::vector ASC
                    LIMIT %(limit)s;
                """
                cur.execute(query_sql, params)
                return [dict(r) for r in cur.fetchall()]

    def search_sparse(self, query, limit=20, sensitivity_filter=None):
        """
        Executes sparse PostgreSQL full-text search using tsvector and GIN index.
        """
        clean_query = re.sub(r"[^\w\s]", " ", query).strip()
        if not clean_query:
            return []

        with get_db_connection(read_only=True) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                where_clauses = [
                    "c.search_vector @@ plainto_tsquery('english', %(query)s)"
                ]
                params = {"query": clean_query, "limit": limit}

                if sensitivity_filter:
                    where_clauses.append("s.sensitivity_level = ANY(%(sens_levels)s)")
                    params["sens_levels"] = sensitivity_filter

                where_sql = " AND ".join(where_clauses)
                query_sql = f"""
                    SELECT 
                        c.id as chunk_id,
                        c.source_id,
                        c.chunk_index,
                        c.section_heading,
                        c.section_path,
                        c.content,
                        c.token_count,
                        c.document_version,
                        s.source_name,
                        s.document_title,
                        s.source_path,
                        s.sensitivity_level,
                        s.approval_status,
                        ts_rank_cd(c.search_vector, plainto_tsquery('english', %(query)s)) as text_rank
                    FROM jarvis_memory.document_chunks c
                    JOIN jarvis_memory.knowledge_sources s ON c.source_id = s.id
                    WHERE {where_sql}
                    ORDER BY text_rank DESC
                    LIMIT %(limit)s;
                """
                cur.execute(query_sql, params)
                return [dict(r) for r in cur.fetchall()]

    @staticmethod
    def _reciprocal_rank_fusion(dense_results, sparse_results, k=60):
        """
        Combines dense and sparse rankings using Reciprocal Rank Fusion (RRF):
        RRF(d) = 1 / (k + dense_rank(d)) + 1 / (k + sparse_rank(d))
        """
        rrf_scores = {}
        chunks_map = {}

        # 1. Score dense results
        for rank, item in enumerate(dense_results):
            cid = str(item["chunk_id"])
            chunks_map[cid] = item
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (1.0 / (k + (rank + 1)))
            item["dense_rank"] = rank + 1
            item["dense_score"] = float(item.get("cosine_similarity", 0.0))

        # 2. Score sparse results
        for rank, item in enumerate(sparse_results):
            cid = str(item["chunk_id"])
            if cid not in chunks_map:
                chunks_map[cid] = item
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (1.0 / (k + (rank + 1)))
            chunks_map[cid]["sparse_rank"] = rank + 1
            chunks_map[cid]["sparse_score"] = float(item.get("text_rank", 0.0))

        # 3. Compile sorted candidates
        merged = []
        for cid, score in rrf_scores.items():
            chunk = chunks_map[cid]
            chunk["rrf_score"] = round(score, 6)
            if "dense_score" not in chunk:
                chunk["dense_score"] = 0.0
            if "sparse_score" not in chunk:
                chunk["sparse_score"] = 0.0
            merged.append(chunk)

        merged.sort(key=lambda x: x["rrf_score"], reverse=True)
        return merged

    def _cross_encoder_rerank(self, query, candidates, top_k=5):
        """
        Reranks top RRF candidates using semantic cross-feature scoring:
        - Query term coverage in content and section heading
        - Exact phrase match boost
        - Document authority weighting
        """
        query_words = set(re.findall(r"\b\w{3,}\b", query.lower()))

        for c in candidates:
            content_lower = c["content"].lower()
            heading_lower = (c.get("section_heading", "") + " " + c.get("document_title", "")).lower()

            # Term overlap ratio
            matched_terms = [w for w in query_words if w in content_lower]
            overlap_ratio = len(matched_terms) / max(1, len(query_words))

            # Heading bonus
            heading_matches = [w for w in query_words if w in heading_lower]
            heading_bonus = (len(heading_matches) / max(1, len(query_words))) * 0.25

            # Exact phrase bonus
            phrase_bonus = 0.3 if query.lower() in content_lower else 0.0

            # Base dense and sparse contribution
            d_score = float(c.get("dense_score", 0.0))
            s_score = min(1.0, float(c.get("sparse_score", 0.0)) * 2.0)
            rrf = float(c.get("rrf_score", 0.0))

            # Composite rerank score (0.0 to 1.0)
            composite_score = (
                (rrf * 15.0) +
                (d_score * 0.35) +
                (overlap_ratio * 0.25) +
                heading_bonus +
                phrase_bonus
            )
            c["rerank_score"] = round(min(1.0, composite_score), 4)

            # Generate exact citation
            # Example: Source: Partner_Credit_Policy.md -> Credit Terms -> Net Payment Terms
            doc_name = c.get("source_name", "Document")
            sec_path = c.get("section_path") or c.get("section_heading") or "General"
            version = c.get("document_version", "v1.0")
            c["citation"] = f"Source: {doc_name} ({version}) -> {sec_path}"

        candidates.sort(key=lambda x: x["rerank_score"], reverse=True)
        return candidates[:top_k]

    def hybrid_search(self, query, top_k=5, user_role="ROLE_USER", sensitivity_filter=None):
        """
        Executes complete hybrid retrieval:
        1. Access control checks (founder isolation)
        2. Single-connection parallel dense + sparse retrieval
        3. Reciprocal Rank Fusion
        4. Cross-encoder reranking
        5. Formatted source citations
        """
        # Determine allowed sensitivities based on role
        if sensitivity_filter is None:
            if user_role in ("ROLE_FOUNDER", "FOUNDER", "ADMIN"):
                allowed_sensitivities = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED_FOUNDER"]
            elif user_role in ("ROLE_SALES", "ROLE_FINANCE", "ROLE_LEAD"):
                allowed_sensitivities = ["PUBLIC", "INTERNAL", "CONFIDENTIAL"]
            else:
                allowed_sensitivities = ["PUBLIC", "INTERNAL"]
        else:
            allowed_sensitivities = sensitivity_filter

        query_vector = self.embedding_service.generate_embedding(query)
        vector_str = f"[{','.join(str(x) for x in query_vector)}]"
        clean_query = re.sub(r"[^\w\s]", " ", query).strip()

        with get_db_connection(read_only=True) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                # 1. Dense retrieval
                cur.execute("""
                    SELECT 
                        c.id as chunk_id, c.source_id, c.chunk_index,
                        c.section_heading, c.section_path, c.content,
                        c.token_count, c.document_version,
                        s.source_name, s.document_title, s.source_path,
                        s.sensitivity_level, s.approval_status,
                        (1 - (c.embedding <=> %(q_vec)s::vector)) as cosine_similarity
                    FROM jarvis_memory.document_chunks c
                    JOIN jarvis_memory.knowledge_sources s ON c.source_id = s.id
                    WHERE c.embedding IS NOT NULL AND s.sensitivity_level = ANY(%(sens_levels)s)
                    ORDER BY c.embedding <=> %(q_vec)s::vector ASC
                    LIMIT 20;
                """, {"q_vec": vector_str, "sens_levels": allowed_sensitivities})
                dense_results = [dict(r) for r in cur.fetchall()]

                # 2. Sparse retrieval
                if clean_query:
                    cur.execute("""
                        SELECT 
                            c.id as chunk_id, c.source_id, c.chunk_index,
                            c.section_heading, c.section_path, c.content,
                            c.token_count, c.document_version,
                            s.source_name, s.document_title, s.source_path,
                            s.sensitivity_level, s.approval_status,
                            ts_rank_cd(c.search_vector, plainto_tsquery('english', %(query)s)) as text_rank
                        FROM jarvis_memory.document_chunks c
                        JOIN jarvis_memory.knowledge_sources s ON c.source_id = s.id
                        WHERE c.search_vector @@ plainto_tsquery('english', %(query)s) AND s.sensitivity_level = ANY(%(sens_levels)s)
                        ORDER BY text_rank DESC
                        LIMIT 20;
                    """, {"query": clean_query, "sens_levels": allowed_sensitivities})
                    sparse_results = [dict(r) for r in cur.fetchall()]
                else:
                    sparse_results = []

        # Merge with RRF
        rrf_merged = self._reciprocal_rank_fusion(dense_results, sparse_results, k=60)

        # Cross-encoder reranking
        final_top_k = self._cross_encoder_rerank(query, rrf_merged, top_k=top_k)

        return {
            "query": query,
            "dense_count": len(dense_results),
            "sparse_count": len(sparse_results),
            "merged_count": len(rrf_merged),
            "results": final_top_k
        }
