# -*- coding: utf-8 -*-
"""
Knowledge Base & RAG REST API Endpoints.
Provides hybrid search (dense + sparse RRF + reranking), context generation with citations,
source management, three-tier memory governance (candidate approval/rejection), and stats.
"""
from flask import Blueprint, jsonify, request
from services.rag.vector_store import HybridVectorStore
from services.rag.ingestion_pipeline import IngestionPipeline
from services.rag.knowledge_promoter import KnowledgePromoter
from services.db_pool import get_db_connection
import psycopg2.extras
import logging

logger = logging.getLogger("jarvis.routes.knowledge")
knowledge_bp = Blueprint("knowledge", __name__)

vector_store = HybridVectorStore()
promoter = KnowledgePromoter()
ingestion_pipeline = IngestionPipeline()

# ----------------------------------------------------------------------------
# 1. Hybrid Search & RAG Context Retrieval
# ----------------------------------------------------------------------------

@knowledge_bp.route("/api/knowledge/search", methods=["POST"])
def search_knowledge():
    """
    Executes hybrid search (dense pgvector + sparse tsvector + RRF + cross-encoder reranking).
    Accepts: { query, top_k, user_role, sensitivity_filter }
    """
    data = request.get_json() or {}
    query = data.get("query", "").strip()
    if not query:
        return jsonify({"success": False, "error": "Query parameter is required"}), 400

    top_k = int(data.get("top_k", 5))
    user_role = data.get("user_role", "ROLE_FOUNDER")
    sens_filter = data.get("sensitivity_filter")

    try:
        search_res = vector_store.hybrid_search(
            query=query,
            top_k=top_k,
            user_role=user_role,
            sensitivity_filter=sens_filter
        )
        return jsonify({"success": True, **search_res})
    except Exception as ex:
        logger.error(f"Search failed: {ex}", exc_info=True)
        return jsonify({"success": False, "error": str(ex)}), 500

@knowledge_bp.route("/api/knowledge/retrieve", methods=["POST"])
def retrieve_rag_context():
    """
    Generates sanitized, authorized RAG context with exact citations for LLM prompting.
    Accepts: { query, max_tokens, user_role }
    """
    data = request.get_json() or {}
    query = data.get("query", "").strip()
    if not query:
        return jsonify({"success": False, "error": "Query parameter is required"}), 400

    user_role = data.get("user_role", "ROLE_FOUNDER")
    top_k = int(data.get("top_k", 5))

    try:
        search_res = vector_store.hybrid_search(query=query, top_k=top_k, user_role=user_role)
        results = search_res.get("results", [])

        if not results or results[0].get("rerank_score", 0.0) < 0.15:
            return jsonify({
                "success": True,
                "found_context": False,
                "context_text": "I could not find a verified company source for this information.",
                "citations": []
            })

        context_blocks = []
        citations = []
        total_tokens = 0

        for r in results:
            citation = r.get("citation", f"Source: {r.get('source_name', 'Unknown')}")
            citations.append(citation)
            block = f"[{citation}]\n{r['content']}\n"
            context_blocks.append(block)
            total_tokens += r.get("token_count", len(r["content"]) // 4)

        full_context = "\n---\n".join(context_blocks)
        return jsonify({
            "success": True,
            "found_context": True,
            "context_text": full_context,
            "estimated_tokens": total_tokens,
            "citations": citations,
            "chunks": results
        })
    except Exception as ex:
        logger.error(f"RAG context retrieval failed: {ex}", exc_info=True)
        return jsonify({"success": False, "error": str(ex)}), 500

# ----------------------------------------------------------------------------
# 2. Source Management Endpoints
# ----------------------------------------------------------------------------

@knowledge_bp.route("/api/knowledge/sources", methods=["GET"])
def list_sources():
    """
    Lists registered knowledge sources with filtering and pagination.
    """
    status = request.args.get("status")
    source_type = request.args.get("source_type")
    limit = int(request.args.get("limit", 50))
    offset = int(request.args.get("offset", 0))

    with get_db_connection(read_only=True) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            clauses = []
            params = {"limit": limit, "offset": offset}
            if status:
                clauses.append("ingestion_status = %(status)s")
                params["status"] = status
            if source_type:
                clauses.append("source_type = %(type)s")
                params["type"] = source_type

            where_sql = ("WHERE " + " AND ".join(clauses)) if clauses else ""
            cur.execute(f"""
                SELECT 
                    id, source_name, source_type, source_path, document_title,
                    owner, document_version, sensitivity_level, ingestion_status,
                    approval_status, last_ingested_at, created_at, error_message,
                    (SELECT COUNT(*) FROM jarvis_memory.document_chunks WHERE source_id = s.id) as chunk_count
                FROM jarvis_memory.knowledge_sources s
                {where_sql}
                ORDER BY created_at DESC
                LIMIT %(limit)s OFFSET %(offset)s;
            """, params)
            sources = [dict(r) for r in cur.fetchall()]

            cur.execute(f"SELECT COUNT(*) FROM jarvis_memory.knowledge_sources {where_sql};", params)
            total = cur.fetchone()["count"]

    return jsonify({"success": True, "total": total, "sources": sources})

@knowledge_bp.route("/api/knowledge/sources/<source_id>", methods=["GET"])
def get_source_details(source_id):
    """
    Retrieves source details and its indexed chunks.
    """
    with get_db_connection(read_only=True) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM jarvis_memory.knowledge_sources WHERE id = %(id)s;", {"id": source_id})
            src = cur.fetchone()
            if not src:
                return jsonify({"success": False, "error": "Source not found"}), 404

            cur.execute("""
                SELECT id, chunk_index, section_heading, section_path, content, token_count
                FROM jarvis_memory.document_chunks
                WHERE source_id = %(id)s
                ORDER BY chunk_index ASC;
            """, {"id": source_id})
            chunks = [dict(c) for c in cur.fetchall()]

    return jsonify({"success": True, "source": dict(src), "chunks": chunks})

@knowledge_bp.route("/api/knowledge/sources/ingest", methods=["POST"])
def trigger_ingestion():
    """
    Triggers re-ingestion of documentation from notes directory or a single path.
    """
    data = request.get_json() or {}
    path = data.get("path", "notes")
    try:
        summary = ingestion_pipeline.ingest_notes_directory(notes_dir=path)
        return jsonify({"success": True, "summary": summary})
    except Exception as ex:
        return jsonify({"success": False, "error": str(ex)}), 500

# ----------------------------------------------------------------------------
# 3. Candidate Fact Governance Endpoints (Tier 2)
# ----------------------------------------------------------------------------

@knowledge_bp.route("/api/knowledge/candidates", methods=["GET"])
def list_candidates():
    """
    Lists Tier 2 staged candidate facts awaiting domain lead review.
    """
    status = request.args.get("status")
    limit = int(request.args.get("limit", 50))

    with get_db_connection(read_only=True) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            where_sql = "WHERE status = %(status)s" if status else ""
            cur.execute(f"""
                SELECT * FROM jarvis_memory.session_candidates
                {where_sql}
                ORDER BY created_at DESC
                LIMIT %(limit)s;
            """, {"status": status, "limit": limit})
            candidates = [dict(r) for r in cur.fetchall()]

    return jsonify({"success": True, "count": len(candidates), "candidates": candidates})

@knowledge_bp.route("/api/knowledge/candidates/<candidate_id>/approve", methods=["POST"])
def approve_candidate(candidate_id):
    """
    Approves candidate fact and promotes it into Tier 3 global memory.
    """
    data = request.get_json() or {}
    reviewer_id = data.get("reviewer_id", "EMP-001 (Founder)")
    reviewer_role = data.get("reviewer_role", "ROLE_FOUNDER")
    comments = data.get("comments", "Approved via Knowledge Base UI")

    try:
        res = promoter.review_candidate(
            candidate_id=candidate_id,
            decision="APPROVE",
            reviewer_id=reviewer_id,
            reviewer_role=reviewer_role,
            comments=comments
        )
        return jsonify({"success": True, "result": res})
    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 400
    except Exception as ex:
        return jsonify({"success": False, "error": str(ex)}), 500

@knowledge_bp.route("/api/knowledge/candidates/<candidate_id>/reject", methods=["POST"])
def reject_candidate(candidate_id):
    """
    Rejects candidate fact and records audit log.
    """
    data = request.get_json() or {}
    reviewer_id = data.get("reviewer_id", "EMP-001 (Founder)")
    reviewer_role = data.get("reviewer_role", "ROLE_FOUNDER")
    comments = data.get("comments", "Rejected via Knowledge Base UI")

    try:
        res = promoter.review_candidate(
            candidate_id=candidate_id,
            decision="REJECT",
            reviewer_id=reviewer_id,
            reviewer_role=reviewer_role,
            comments=comments
        )
        return jsonify({"success": True, "result": res})
    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 400
    except Exception as ex:
        return jsonify({"success": False, "error": str(ex)}), 500

# ----------------------------------------------------------------------------
# 4. Global Memory Endpoints (Tier 3)
# ----------------------------------------------------------------------------

@knowledge_bp.route("/api/knowledge/memory", methods=["GET"])
def list_global_memory():
    """
    Lists Tier 3 approved global company memory facts.
    """
    category = request.args.get("category")
    limit = int(request.args.get("limit", 100))

    with get_db_connection(read_only=True) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            where_sql = "WHERE category = %(cat)s" if category else ""
            cur.execute(f"""
                SELECT * FROM jarvis_memory.memory_facts
                {where_sql}
                ORDER BY approved_at DESC
                LIMIT %(limit)s;
            """, {"cat": category, "limit": limit})
            facts = [dict(r) for r in cur.fetchall()]

    return jsonify({"success": True, "count": len(facts), "facts": facts})

# ----------------------------------------------------------------------------
# 5. Knowledge Base Overview Stats
# ----------------------------------------------------------------------------

@knowledge_bp.route("/api/knowledge/stats", methods=["GET"])
def get_knowledge_stats():
    """
    Returns high-level statistics for the Knowledge Base Dashboard.
    """
    with get_db_connection(read_only=True) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    COUNT(*) as total_sources,
                    COUNT(*) FILTER (WHERE ingestion_status = 'INDEXED') as indexed_sources,
                    COUNT(*) FILTER (WHERE ingestion_status = 'QUARANTINED') as quarantined_sources,
                    COUNT(*) FILTER (WHERE ingestion_status = 'FAILED') as failed_sources,
                    MAX(last_ingested_at) as last_ingested_at
                FROM jarvis_memory.knowledge_sources;
            """)
            src_stats = cur.fetchone()

            cur.execute("SELECT COUNT(*) as total_chunks, COALESCE(SUM(token_count), 0) as total_tokens FROM jarvis_memory.document_chunks;")
            chunk_stats = cur.fetchone()

            cur.execute("SELECT COUNT(*) as approved_facts FROM jarvis_memory.memory_facts WHERE approval_status = 'APPROVED';")
            fact_stats = cur.fetchone()

            cur.execute("""
                SELECT 
                    COUNT(*) as total_candidates,
                    COUNT(*) FILTER (WHERE status = 'PENDING') as pending_candidates,
                    COUNT(*) FILTER (WHERE status = 'CONFLICTING') as conflicting_candidates,
                    COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected_candidates
                FROM jarvis_memory.session_candidates;
            """)
            cand_stats = cur.fetchone()

    return jsonify({
        "success": True,
        "stats": {
            "total_sources": src_stats["total_sources"] if src_stats else 0,
            "indexed_sources": src_stats["indexed_sources"] if src_stats else 0,
            "quarantined_sources": src_stats["quarantined_sources"] if src_stats else 0,
            "failed_sources": src_stats["failed_sources"] if src_stats else 0,
            "last_ingested_at": src_stats["last_ingested_at"].isoformat() if src_stats and src_stats["last_ingested_at"] else None,
            "total_chunks": chunk_stats["total_chunks"] if chunk_stats else 0,
            "total_tokens": chunk_stats["total_tokens"] if chunk_stats else 0,
            "approved_facts": fact_stats["approved_facts"] if fact_stats else 0,
            "pending_candidates": cand_stats["pending_candidates"] if cand_stats else 0,
            "conflicting_candidates": cand_stats["conflicting_candidates"] if cand_stats else 0,
            "rejected_candidates": cand_stats["rejected_candidates"] if cand_stats else 0
        }
    })
