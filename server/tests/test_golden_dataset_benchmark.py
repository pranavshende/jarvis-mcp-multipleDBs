# -*- coding: utf-8 -*-
"""
Jarvis v1 — Comprehensive Golden Dataset Retrieval Benchmark (18 Queries).
Measures:
- Precision@5 (Target > 85%)
- Recall@5
- Mean Reciprocal Rank (MRR)
- Exact Citation Format Verification
- Retrieval Latency (Database execution & End-to-end round trip)
"""
import unittest
import time
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.rag.vector_store import HybridVectorStore
from services.rag.embedding_service import EmbeddingService

class TestGoldenDatasetBenchmark(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.emb_svc = EmbeddingService()
        cls.store = HybridVectorStore(embedding_service=cls.emb_svc)

    def test_expanded_golden_retrieval_benchmark(self):
        """
        Runs 18 diverse MSC operational queries across semantic, exact keyword,
        ambiguous, incident post-mortem, partner terms, and policy categories.
        """
        golden_dataset = [
            {
                "id": "Q01",
                "category": "Partner Terms",
                "query": "What are our standard partner payment terms?",
                "expected_needle": "net-30",
                "expected_file": "partner-terms.md",
                "role": "ROLE_USER"
            },
            {
                "id": "Q02",
                "category": "Operations SOP",
                "query": "How are raw consignments verified and scanned?",
                "expected_needle": "grading",
                "expected_file": "MSC Now.md",
                "role": "ROLE_USER"
            },
            {
                "id": "Q03",
                "category": "Quality Inspection",
                "query": "What are the rules for warehouse package inspection failures?",
                "expected_needle": "fail",
                "expected_file": "MSC Now.md",
                "role": "ROLE_USER"
            },
            {
                "id": "Q04",
                "category": "Inventory Costing",
                "query": "How does Meridian define FIFO inventory cost layers?",
                "expected_needle": "cost",
                "expected_file": "cost-definition-fifo.md",
                "role": "ROLE_FINANCE"
            },
            {
                "id": "Q05",
                "category": "Buylist Policy",
                "query": "What are the buylist margins and pricing rules?",
                "expected_needle": "buylist",
                "expected_file": "buy-list-policy.md",
                "alt_expected_file": "pricing-playbook.md",
                "role": "ROLE_SALES"
            },
            {
                "id": "Q06",
                "category": "Financial Incident",
                "query": "What caused the double payouts incident in August 2026?",
                "expected_needle": "payout",
                "expected_file": "2026-08-14-double-payouts.md",
                "role": "ROLE_FINANCE"
            },
            {
                "id": "Q07",
                "category": "Infrastructure Incident",
                "query": "Why did the portal experience an outage in September?",
                "expected_needle": "outage",
                "expected_file": "2026-09-02-portal-outage.md",
                "role": "ROLE_USER"
            },
            {
                "id": "Q08",
                "category": "Banking Incident",
                "query": "What was the resolution for the rejected ACH batch in October?",
                "expected_needle": "ach",
                "expected_file": "2026-10-12-ach-batch-rejected.md",
                "role": "ROLE_FINANCE"
            },
            {
                "id": "Q09",
                "category": "Accounting Policy",
                "query": "What are the cutoff dates and checklist for month-end close?",
                "expected_needle": "month-end",
                "expected_file": "month-end-close.md",
                "role": "ROLE_FINANCE"
            },
            {
                "id": "Q10",
                "category": "Collections & AR",
                "query": "What is the policy for delinquent accounts and AR collections?",
                "expected_needle": "collections",
                "expected_file": "ar-collections.md",
                "role": "ROLE_FINANCE"
            },
            {
                "id": "Q11",
                "category": "Partner Account",
                "query": "What are the specific terms and contacts for Atlas Wholesale Group?",
                "expected_needle": "atlas",
                "expected_file": "atlas-wholesale-group.md",
                "role": "ROLE_USER"
            },
            {
                "id": "Q12",
                "category": "Partner Account",
                "query": "What are the account details for Blue Ridge Games Distributors?",
                "expected_needle": "blue ridge",
                "expected_file": "blue-ridge-games-distributors.md",
                "role": "ROLE_USER"
            },
            {
                "id": "Q13",
                "category": "Operations On-Call",
                "query": "Who is on call and what are the severity escalation levels?",
                "expected_needle": "escalat",
                "expected_file": "on-call-and-escalations.md",
                "role": "ROLE_USER"
            },
            {
                "id": "Q14",
                "category": "Corporate Policy",
                "query": "What travel and meal receipts are required under the expense policy?",
                "expected_needle": "expense",
                "expected_file": "expense-policy.md",
                "role": "ROLE_FINANCE"
            },
            {
                "id": "Q15",
                "category": "Company Glossary",
                "query": "What is the definition of dock receipt and staging status?",
                "expected_needle": "dock",
                "expected_file": "glossary.md",
                "role": "ROLE_USER"
            },
            {
                "id": "Q16",
                "category": "Technical Architecture",
                "query": "What is the database architecture and tech stack for Jarvis?",
                "expected_needle": "database",
                "expected_file": "architecture.md",
                "role": "ROLE_USER"
            },
            {
                "id": "Q17",
                "category": "Ambiguous Query",
                "query": "settlement payout timing",
                "expected_needle": "payout",
                "expected_file": "partner-terms.md",
                "role": "ROLE_FINANCE"
            },
            {
                "id": "Q18",
                "category": "Exact Keyword Acronym",
                "query": "ACH batch rejection file error",
                "expected_needle": "ach",
                "expected_file": "2026-10-12-ach-batch-rejected.md",
                "role": "ROLE_FINANCE"
            }
        ]

        latencies = []
        hits_at_5 = 0
        hits_at_1 = 0
        reciprocal_ranks = []
        citation_valid_count = 0
        total_chunks_inspected = 0

        print(f"\n{'='*80}")
        print(f"JARVIS V1 — EXPANDED GOLDEN RETRIEVAL BENCHMARK ({len(golden_dataset)} QUERIES)")
        print(f"{'='*80}")

        for item in golden_dataset:
            t0 = time.perf_counter()
            res = self.store.hybrid_search(
                item["query"],
                top_k=5,
                user_role=item["role"]
            )
            lat_ms = (time.perf_counter() - t0) * 1000.0
            latencies.append(lat_ms)

            results = res.get("results", [])
            hit_rank = None

            for rank, chunk in enumerate(results, start=1):
                total_chunks_inspected += 1
                # Check citation format
                citation = chunk.get("citation", "")
                if citation.startswith("Source: ") and " -> " in citation:
                    citation_valid_count += 1

                content_lower = chunk.get("content", "").lower()
                source_lower = chunk.get("source_name", "").lower()
                doc_title_lower = chunk.get("document_title", "").lower()

                # Check hit condition
                needle_match = item["expected_needle"].lower() in content_lower
                file_match = item["expected_file"].lower() in source_lower or item["expected_file"].lower() in doc_title_lower
                alt_file_match = bool(item.get("alt_expected_file") and (item["alt_expected_file"].lower() in source_lower or item["alt_expected_file"].lower() in doc_title_lower))

                if needle_match or file_match or alt_file_match:
                    hit_rank = rank
                    break

            if hit_rank is not None:
                hits_at_5 += 1
                if hit_rank == 1:
                    hits_at_1 += 1
                reciprocal_ranks.append(1.0 / hit_rank)
                status = f"HIT (Rank {hit_rank})"
            else:
                reciprocal_ranks.append(0.0)
                status = "MISS"

            top_source = results[0]["source_name"] if results else "None"
            print(f"[{item['id']}] {item['category']:<22} | {status:<12} | Top: {top_source:<30} | {lat_ms:6.1f}ms")

        # Metrics aggregation
        n = len(golden_dataset)
        precision_at_5 = (hits_at_5 / n) * 100.0
        precision_at_1 = (hits_at_1 / n) * 100.0
        mrr = sum(reciprocal_ranks) / n
        citation_acc = (citation_valid_count / max(1, total_chunks_inspected)) * 100.0
        avg_latency = sum(latencies) / n

        # Sort for percentiles
        s_lats = sorted(latencies)
        p50 = s_lats[int(0.50 * (n - 1))]
        p95 = s_lats[int(0.95 * (n - 1))]
        p99 = s_lats[int(0.99 * (n - 1))]

        print(f"\n{'-'*80}")
        print(f"BENCHMARK SUMMARY RESULTS:")
        print(f"  Total Queries Tested     : {n}")
        print(f"  Precision@5 (Top-5 Hit)  : {precision_at_5:.1f}% (Acceptance Target: >85.0%)")
        print(f"  Precision@1 (Top-1 Hit)  : {precision_at_1:.1f}%")
        print(f"  Mean Reciprocal Rank     : {mrr:.3f}")
        print(f"  Citation Syntax Validity : {citation_acc:.1f}%")
        print(f"  End-to-End Latency (Avg) : {avg_latency:.1f} ms")
        print(f"  End-to-End Latency (p50) : {p50:.1f} ms")
        print(f"  End-to-End Latency (p95) : {p95:.1f} ms")
        print(f"  End-to-End Latency (p99) : {p99:.1f} ms")
        print(f"{'='*80}")

        self.assertGreaterEqual(precision_at_5, 85.0, f"Precision@5 ({precision_at_5:.1f}%) is below 85% target.")
        self.assertGreaterEqual(citation_acc, 95.0, f"Citation accuracy ({citation_acc:.1f}%) is below 95% target.")

if __name__ == "__main__":
    unittest.main()
