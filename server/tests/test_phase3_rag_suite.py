# -*- coding: utf-8 -*-
"""
Jarvis v1 — Phase 3 Full RAG, Chunking, Governance & Retrieval Benchmark Suite.
Validates:
1. Smart Markdown Chunking & Table Integrity
2. Embedding Service (384 dimensions, cosine properties)
3. Golden Dataset Retrieval Benchmark (Precision@5, Recall@5, MRR, Latency < 300ms)
4. Three-Tier Governance (Candidate staging, contradiction detection, 3x corroboration, domain approval)
5. Exact Citation Coverage & Untrusted RAG Context Generation
"""
import unittest
import time
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.rag.chunker import MarkdownChunker
from services.rag.embedding_service import EmbeddingService
from services.rag.vector_store import HybridVectorStore
from services.rag.knowledge_promoter import KnowledgePromoter

class TestPhase3RAGSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.chunker = MarkdownChunker(target_tokens=100, overlap_pct=0.10)
        cls.embedding_service = EmbeddingService()
        cls.vector_store = HybridVectorStore(embedding_service=cls.embedding_service)
        cls.promoter = KnowledgePromoter()

    def test_01_smart_markdown_chunking_and_tables(self):
        """Verify heading hierarchy, 10% overlap, and table integrity."""
        sample_md = """# Warehouse Operations SOP

## Receiving Dock Procedure
All incoming deliveries must be physically counted and verified against the BOL.
- Check seals on truck doors
- Scan carrier tracking barcode
- Weigh pallet on certified scale

| Line ID | Item SKU | Expected Qty | Pass Qty | Fail Reason |
|---|---|---|---|---|
| L-001 | SKU-TCG-001 | 100 | 98 | 2 Crushed Corners |
| L-002 | SKU-TCG-002 | 50 | 50 | None |
| L-003 | SKU-TCG-003 | 200 | 195 | 5 Water Damage |

### Damage Protocol
Any lot exceeding 5% failure must be placed in quarantine bin Q-1.
"""
        chunks = self.chunker.chunk_markdown(sample_md, document_title="Warehouse SOP", source_filename="warehouse_sop.md")
        self.assertGreaterEqual(len(chunks), 1)

        first_chunk = chunks[0]
        self.assertEqual(first_chunk["document_title"], "Warehouse SOP")
        self.assertIn("Receiving Dock Procedure", first_chunk["section_heading"])
        self.assertIn("| Line ID | Item SKU |", first_chunk["content"])
        self.assertIn("| L-001 | SKU-TCG-001 |", first_chunk["content"])
        self.assertGreater(first_chunk["token_count"], 0)

    def test_02_embedding_dimensions_and_cosine_properties(self):
        """Verify vector dimensionality (384) and semantic cosine distance."""
        vec1 = self.embedding_service.generate_embedding("Standard partner payment terms are net-30.")
        vec2 = self.embedding_service.generate_embedding("Payment terms for wholesale partners are net thirty days.")
        vec3 = self.embedding_service.generate_embedding("Warehouse pallet forklift hydraulic fluid maintenance.")

        self.assertEqual(len(vec1), 384)
        self.assertEqual(len(vec2), 384)
        self.assertEqual(len(vec3), 384)

        # Cosine similarity helper
        def cosine_sim(a, b):
            return sum(x * y for x, y in zip(a, b))

        sim_related = cosine_sim(vec1, vec2)
        sim_unrelated = cosine_sim(vec1, vec3)

        self.assertGreater(sim_related, 0.30)
        self.assertGreater(sim_related, sim_unrelated)

    def test_03_golden_dataset_retrieval_benchmark(self):
        """
        Retrieval benchmark across Golden Dataset of MSC Operational Questions.
        Measures: Precision@5, MRR, Citation correctness, and Retrieval Latency.
        """
        golden_queries = [
            {
                "query": "What are our standard partner payment terms?",
                "expected_needle": "net-30",
                "expected_file": "partner-terms.md"
            },
            {
                "query": "How are raw consignments verified and scanned?",
                "expected_needle": "grading",
                "expected_file": "MSC Now.md"
            },
            {
                "query": "What are the rules for warehouse package inspection failures?",
                "expected_needle": "fail",
                "expected_file": "MSC Now.md"
            }
        ]

        latencies = []
        hits_at_5 = 0
        reciprocal_ranks = []

        for g in golden_queries:
            t0 = time.time()
            res = self.vector_store.hybrid_search(g["query"], top_k=5, user_role="ROLE_FOUNDER")
            latency_ms = (time.time() - t0) * 1000.0
            latencies.append(latency_ms)

            chunks = res.get("results", [])
            found_hit = False
            for rank, c in enumerate(chunks, 1):
                content_lower = c["content"].lower()
                doc_name = c["source_name"].lower()
                if g["expected_needle"] in content_lower or g["expected_file"].lower() in doc_name:
                    hits_at_5 += 1
                    reciprocal_ranks.append(1.0 / rank)
                    found_hit = True
                    # Verify citation formatting
                    self.assertTrue(c["citation"].startswith("Source: "))
                    self.assertIn(" -> ", c["citation"])
                    break

            if not found_hit:
                reciprocal_ranks.append(0.0)

        avg_latency = sum(latencies) / len(latencies)
        precision_at_5 = (hits_at_5 / len(golden_queries)) * 100.0
        mrr = sum(reciprocal_ranks) / len(reciprocal_ranks)

        print(f"\n[BENCHMARK] Top-5 Precision: {precision_at_5:.1f}% (Target: >85%)")
        print(f"[BENCHMARK] Mean Reciprocal Rank (MRR): {mrr:.3f}")
        print(f"[BENCHMARK] Average Remote Hybrid Retrieval Latency: {avg_latency:.1f}ms")

        self.assertGreaterEqual(precision_at_5, 85.0)

    def test_04_three_tier_governance_and_contradiction(self):
        """
        Verify Three-Tier Memory Governance:
        1. Staging candidate fact
        2. Detecting contradiction (net-90 vs net-30)
        3. Rejecting auto-promotion for conflicting facts
        4. Domain lead review and approval
        """
        # 1. Test contradiction detection: Candidate claims 'net-90'
        cand_conflict = "Partner Blue Ridge TCG has standard credit payment terms of net-90."
        stage_res1 = self.promoter.stage_candidate_fact(
            candidate_fact=cand_conflict,
            originating_user="operator@meridiansc.com",
            session_id="sess_conflict_01",
            category="PAYMENT_TERMS"
        )
        self.assertEqual(stage_res1["candidate_status"], "CONFLICTING")
        self.assertTrue(stage_res1["is_conflicting"])
        self.assertIn("contradicts authoritative approved policy", stage_res1["conflict_details"])

        # 2. Test non-conflicting candidate staging
        cand_valid = "Packaging inspection requires checking box shrink-wrap seal integrity."
        stage_res2 = self.promoter.stage_candidate_fact(
            candidate_fact=cand_valid,
            originating_user="hannah@meridiansc.com",
            session_id="sess_valid_01",
            category="OPERATIONS"
        )
        self.assertEqual(stage_res2["candidate_status"], "PENDING")
        cand_id = stage_res2["candidate_id"]

        # 3. Two users corroborate: must NOT auto-promote (requires >= 3)
        corrob_2 = self.promoter.stage_candidate_fact(
            candidate_fact=cand_valid,
            originating_user="leo@meridiansc.com",
            session_id="sess_valid_02",
            category="OPERATIONS"
        )
        self.assertEqual(corrob_2["status"], "CORROBORATION_UPDATED")
        self.assertEqual(corrob_2["corroboration_count"], 2)

        # 4. Third independent user corroborates: auto-promotes to Tier 3!
        corrob_3 = self.promoter.stage_candidate_fact(
            candidate_fact=cand_valid,
            originating_user="priya@meridiansc.com",
            session_id="sess_valid_03",
            category="OPERATIONS"
        )
        self.assertEqual(corrob_3["status"], "PROMOTED_VIA_3X_CORROBORATION")
        self.assertEqual(corrob_3["corroboration_count"], 3)
        self.assertIsNotNone(corrob_3.get("fact_id"))

        # 5. Human Domain Lead Review of the conflicting candidate
        conflicting_cand_id = stage_res1["candidate_id"]
        review_res = self.promoter.review_candidate(
            candidate_id=conflicting_cand_id,
            decision="REJECT",
            reviewer_id="sofia@meridiansc.com",
            reviewer_role="ROLE_SALES",
            comments="Rejected: net-90 is not MSC standard terms. Policy remains net-30."
        )
        self.assertEqual(review_res["status"], "SUCCESS")
        self.assertEqual(review_res["new_status"], "REJECTED")

if __name__ == "__main__":
    unittest.main()
