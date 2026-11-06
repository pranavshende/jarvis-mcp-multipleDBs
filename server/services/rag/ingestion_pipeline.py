# -*- coding: utf-8 -*-
"""
Multi-Source Knowledge Ingestion Pipeline.
Coordinates file discovery, content hashing, deterministic sanitization,
structural Markdown chunking, embedding generation, and high-performance bulk persistence.
Supports static company documentation (notes/), opted-in session logs (session_logs/),
and historical memory facts (memory.jsonl).
"""
import os
import json
import hashlib
import logging
from pathlib import Path
from datetime import datetime, timezone
import psycopg2.extras

from services.db_pool import get_db_connection
from services.rag.sanitizer import DocumentSanitizer
from services.rag.chunker import MarkdownChunker
from services.rag.embedding_service import EmbeddingService

logger = logging.getLogger("jarvis.rag.ingestion")

class IngestionPipeline:
    def __init__(self, sanitizer=None, chunker=None, embedding_service=None):
        self.sanitizer = sanitizer or DocumentSanitizer()
        self.chunker = chunker or MarkdownChunker()
        self.embedding_service = embedding_service or EmbeddingService()

    def _compute_hash(self, text):
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def ingest_markdown_file(self, file_path, owner="company", version="v1.0", conn=None):
        """
        Ingests a single Markdown document:
        1. Reads raw content
        2. Checks founder-private isolation
        3. Sanitizes PII and sensitive data
        4. Chunks semantically
        5. Generates embeddings
        6. Persists to jarvis_memory.knowledge_sources and bulk inserts document_chunks
        """
        path = Path(file_path).resolve()
        if not path.exists():
            raise FileNotFoundError(f"Source file not found: {file_path}")

        raw_text = path.read_text(encoding="utf-8", errors="replace")
        content_hash = self._compute_hash(raw_text)
        filename = path.name
        rel_path = str(path).replace("\\", "/")

        # Derive title from filename or first H1
        doc_title = filename.replace(".md", "").replace("_", " ").replace("-", " ").title()
        for line in raw_text.splitlines():
            if line.startswith("# "):
                doc_title = line.replace("# ", "").strip()
                break

        def _process(db_conn):
            with db_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, content_hash, ingestion_status 
                    FROM jarvis_memory.knowledge_sources
                    WHERE source_path = %(path)s;
                """, {"path": rel_path})
                existing = cur.fetchone()

                if existing and existing["content_hash"] == content_hash and existing["ingestion_status"] in ("INDEXED", "QUARANTINED"):
                    return {
                        "status": "SKIPPED_UNCHANGED",
                        "source_id": str(existing["id"]),
                        "filename": filename
                    }

                # 1. Sanitize
                sanitize_res = self.sanitizer.sanitize_text(raw_text, source_path=rel_path)
                is_quarantined = sanitize_res["is_quarantined"]
                sanitized_content = sanitize_res["sanitized_text"]

                # Sensitivity determination
                sensitivity = "INTERNAL"
                if "founder_private" in rel_path.lower():
                    sensitivity = "RESTRICTED_FOUNDER"
                elif any(k in rel_path.lower() for k in ["finance", "hr", "tax", "compensation"]):
                    sensitivity = "CONFIDENTIAL"

                # 2. Persist Source Entry
                cur.execute("""
                    INSERT INTO jarvis_memory.knowledge_sources (
                        source_name, source_type, source_path, document_title,
                        owner, content_hash, document_version, sensitivity_level,
                        ingestion_status, approval_status, last_ingested_at, error_message
                    ) VALUES (
                        %(name)s, 'MARKDOWN_DOC', %(path)s, %(title)s,
                        %(owner)s, %(hash)s, %(ver)s, %(sens)s,
                        %(status)s, 'APPROVED', NOW(), %(err)s
                    )
                    ON CONFLICT (source_path) DO UPDATE SET
                        content_hash = EXCLUDED.content_hash,
                        document_title = EXCLUDED.document_title,
                        document_version = EXCLUDED.document_version,
                        sensitivity_level = EXCLUDED.sensitivity_level,
                        ingestion_status = EXCLUDED.ingestion_status,
                        last_ingested_at = NOW(),
                        error_message = EXCLUDED.error_message,
                        updated_at = NOW()
                    RETURNING id;
                """, {
                    "name": filename,
                    "path": rel_path,
                    "title": doc_title,
                    "owner": owner,
                    "hash": content_hash,
                    "ver": version,
                    "sens": sensitivity,
                    "status": "QUARANTINED" if is_quarantined else "INDEXED",
                    "err": sanitize_res["quarantine_reason"]
                })
                source_id = str(cur.fetchone()["id"])

                # If quarantined, purge any old chunks and stop
                if is_quarantined:
                    cur.execute("DELETE FROM jarvis_memory.document_chunks WHERE source_id = %(sid)s;", {"sid": source_id})
                    db_conn.commit()
                    return {
                        "status": "QUARANTINED",
                        "source_id": source_id,
                        "filename": filename,
                        "reason": sanitize_res["quarantine_reason"]
                    }

                # 3. Chunk Document
                chunks = self.chunker.chunk_markdown(sanitized_content, document_title=doc_title, source_filename=filename)
                
                # Delete existing chunks for this source to reprocess
                cur.execute("DELETE FROM jarvis_memory.document_chunks WHERE source_id = %(sid)s;", {"sid": source_id})

                # 4. Generate Embeddings & Bulk Insert Chunks
                if chunks:
                    chunk_texts = [c["content"] for c in chunks]
                    embeddings = self.embedding_service.generate_embeddings_batch(chunk_texts)

                    chunk_rows = []
                    for idx, chunk in enumerate(chunks):
                        vec = embeddings[idx]
                        vec_str = f"[{','.join(str(x) for x in vec)}]"
                        chunk_rows.append((
                            source_id,
                            chunk["chunk_index"],
                            chunk["section_heading"],
                            chunk["section_path"],
                            chunk["content"],
                            chunk["content_hash"],
                            vec_str,
                            chunk["token_count"],
                            version,
                            json.dumps(chunk["metadata"])
                        ))

                    psycopg2.extras.execute_values(
                        cur,
                        """
                        INSERT INTO jarvis_memory.document_chunks (
                            source_id, chunk_index, section_heading, section_path,
                            content, content_hash, embedding, token_count,
                            document_version, metadata
                        ) VALUES %s;
                        """,
                        chunk_rows,
                        template="(%s, %s, %s, %s, %s, %s, %s::vector, %s, %s, %s::jsonb)"
                    )

                db_conn.commit()
                return {
                    "status": "INDEXED",
                    "source_id": source_id,
                    "filename": filename,
                    "chunks_count": len(chunks)
                }

        if conn:
            return _process(conn)
        else:
            with get_db_connection(read_only=False) as single_conn:
                return _process(single_conn)

    def ingest_notes_directory(self, notes_dir="notes", max_docs=None):
        """
        Recursively scans notes directory and indexes all Markdown files using a shared connection.
        """
        base_path = Path(notes_dir).resolve()
        if not base_path.exists():
            alt_path = Path("context-bank/context-bank/notes").resolve()
            if alt_path.exists():
                base_path = alt_path
            else:
                raise FileNotFoundError(f"Notes directory not found at {notes_dir} or {alt_path}")

        md_files = list(base_path.rglob("*.md"))
        if max_docs:
            md_files = md_files[:max_docs]

        indexed_count = 0
        quarantined_count = 0
        skipped_count = 0
        failed_count = 0
        total_chunks = 0

        with get_db_connection(read_only=False) as conn:
            for f in md_files:
                try:
                    res = self.ingest_markdown_file(f, conn=conn)
                    st = res.get("status")
                    if st == "INDEXED":
                        indexed_count += 1
                        total_chunks += res.get("chunks_count", 0)
                    elif st == "QUARANTINED":
                        quarantined_count += 1
                    elif st == "SKIPPED_UNCHANGED":
                        skipped_count += 1
                except Exception as e:
                    logger.error(f"Failed to ingest note {f.name}: {e}")
                    failed_count += 1

        return {
            "total_files": len(md_files),
            "indexed": indexed_count,
            "quarantined": quarantined_count,
            "skipped": skipped_count,
            "failed": failed_count,
            "total_chunks_indexed": total_chunks
        }

    def ingest_opted_in_session_logs(self, session_logs_dir="session_logs", promoter=None, max_files=None):
        """
        Parses opted-in session logs from session_logs/ directory.
        Strict Privacy: Never stores raw conversational logs in document_chunks.
        Stages extracted candidate facts into jarvis_memory.session_candidates for human review.
        """
        from services.rag.knowledge_promoter import KnowledgePromoter
        promoter = promoter or KnowledgePromoter()

        base_path = Path(session_logs_dir).resolve()
        if not base_path.exists():
            alt_path = Path("context-bank/context-bank/session_logs").resolve()
            if alt_path.exists():
                base_path = alt_path
            else:
                raise FileNotFoundError(f"Session logs directory not found at {session_logs_dir}")

        OPTED_IN_USERS = {"arjun", "dana", "hannah", "kenji", "leo", "marcus", "priya", "sofia"}

        jsonl_files = list(base_path.rglob("*.jsonl"))
        if max_files:
            jsonl_files = jsonl_files[:max_files]

        candidates_staged = 0
        contradictions_found = 0
        sessions_processed = 0

        for f in jsonl_files:
            # Check user folder is in opted-in list
            user_folder = f.parent.name.lower()
            if user_folder not in OPTED_IN_USERS:
                continue

            try:
                lines = f.read_text(encoding="utf-8", errors="replace").splitlines()
                sessions_processed += 1

                for line in lines:
                    if not line.strip():
                        continue
                    try:
                        evt = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    # Only inspect assistant or user_prompt events containing facts
                    if evt.get("event") in ("assistant", "user_prompt"):
                        content = evt.get("content", "")
                        user = evt.get("user", f"{user_folder}@meridiansc.com")
                        sess_id = evt.get("session_id", f"sess_{user_folder}")

                        # Identify potential policy / operational assertions
                        lower = content.lower()
                        if any(k in lower for k in ["standard", "terms", "policy", "requires", "valid for", "rule"]):
                            # Sanitize before candidate staging
                            san_res = self.sanitizer.sanitize_text(content)
                            clean_fact = san_res["sanitized_text"]
                            if len(clean_fact) > 20 and len(clean_fact) < 300:
                                res = promoter.stage_candidate_fact(
                                    candidate_fact=clean_fact,
                                    originating_user=user,
                                    session_id=sess_id,
                                    category="GENERAL_POLICY"
                                )
                                candidates_staged += 1
                                if res.get("is_conflicting"):
                                    contradictions_found += 1
            except Exception as ex:
                logger.error(f"Error processing session log {f.name}: {ex}")

        return {
            "sessions_processed": sessions_processed,
            "candidates_staged": candidates_staged,
            "contradictions_found": contradictions_found
        }
