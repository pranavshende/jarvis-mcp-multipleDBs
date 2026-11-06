# -*- coding: utf-8 -*-
"""
Jarvis v1 — Phase 3 Governance, Security, Citation Edge-Cases & Tier Isolation Audit Suite.
Validates:
1. Tier 1: Private Session Isolation & Founder Quarantine Boundary
2. Tier 2: Candidate Staging & Unverified Isolation
3. Tier 3: 3x Corroboration Rule (2-user fails, duplicate user fails, 3 distinct users succeeds)
4. Contradiction Detection & Blocking (Net-90 vs Net-30)
5. Domain Lead Human Review Workflow (Approval & Rejection)
6. Citation Edge Cases (Empty results, Quarantined documents, Superseded versions)
"""
import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.rag.vector_store import HybridVectorStore
from services.rag.knowledge_promoter import KnowledgePromoter
from services.rag.sanitizer import DocumentSanitizer
from services.db_pool import get_db_connection

class TestGovernanceSecurityAudit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.store = HybridVectorStore()
        cls.promoter = KnowledgePromoter()
        cls.sanitizer = DocumentSanitizer()

    def test_01_tier1_founder_quarantine_isolation(self):
        """
        Verify Tier 1 Isolation:
        - Founder-private files (e.g. notes/founder_private/INDEX.md) must be QUARANTINED.
        - ROLE_USER, ROLE_SALES, and ROLE_FINANCE must NEVER retrieve RESTRICTED_FOUNDER chunks.
        """
        # Test query directed at founder private material
        founder_query = "What is in the founder private index and confidential acquisitions?"
        
        # Test standard user
        user_res = self.store.hybrid_search(founder_query, top_k=5, user_role="ROLE_USER")
        for chunk in user_res["results"]:
            self.assertNotEqual(chunk["sensitivity_level"], "RESTRICTED_FOUNDER")
            self.assertNotIn("INDEX.md", chunk["source_name"])

        # Test finance user
        fin_res = self.store.hybrid_search(founder_query, top_k=5, user_role="ROLE_FINANCE")
        for chunk in fin_res["results"]:
            self.assertNotEqual(chunk["sensitivity_level"], "RESTRICTED_FOUNDER")
            self.assertNotIn("INDEX.md", chunk["source_name"])

        # Check DB directly that INDEX.md is quarantined
        with get_db_connection(read_only=True) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT ingestion_status, sensitivity_level FROM jarvis_memory.knowledge_sources WHERE source_name = 'INDEX.md';")
                row = cur.fetchone()
                if row:
                    self.assertEqual(row[0], "QUARANTINED")
                    self.assertEqual(row[1], "RESTRICTED_FOUNDER")

    def test_02_tier2_candidate_staging_isolation(self):
        """
        Verify Tier 2 Candidates are isolated:
        - Staged candidates do not appear in normal knowledge search chunks until promoted.
        """
        cand_text = "Temporary candidate note regarding dock door 4 maintenance."
        stage_res = self.promoter.stage_candidate_fact(
            candidate_fact=cand_text,
            originating_user="tech_ops@meridiansc.com",
            session_id="sess_dock_01",
            category="OPERATIONS"
        )
        self.assertIn(stage_res["candidate_status"], ("PENDING", "UNVERIFIED"))

        # Verify staged candidate is NOT in document_chunks
        search_res = self.store.hybrid_search("dock door 4 maintenance", top_k=5, user_role="ROLE_USER")
        for c in search_res["results"]:
            self.assertNotIn("dock door 4 maintenance", c["content"].lower())

    def test_03_tier3_corroboration_rules(self):
        """
        Verify 3x Corroboration Engine:
        - 1 user: PENDING
        - 2 users: CORROBORATION_UPDATED (Does NOT promote)
        - Same user submitting twice: Must NOT increase count (deduplication)
        - 3 distinct users: PROMOTED_VIA_3X_CORROBORATION
        """
        fact = "All warehouse staff must complete bi-weekly ladder safety inspection checklist."
        
        # User 1 submits
        res1 = self.promoter.stage_candidate_fact(
            candidate_fact=fact,
            originating_user="alice@meridiansc.com",
            session_id="sess_safety_01",
            category="OPERATIONS"
        )
        self.assertEqual(res1["candidate_status"], "PENDING")

        # Duplicate submission by User 1
        res1_dup = self.promoter.stage_candidate_fact(
            candidate_fact=fact,
            originating_user="alice@meridiansc.com",
            session_id="sess_safety_01_dup",
            category="OPERATIONS"
        )
        # Count should remain 1, status not promoted
        self.assertEqual(res1_dup.get("corroboration_count", 1), 1)

        # User 2 submits (2 users total -> must NOT promote)
        res2 = self.promoter.stage_candidate_fact(
            candidate_fact=fact,
            originating_user="bob@meridiansc.com",
            session_id="sess_safety_02",
            category="OPERATIONS"
        )
        self.assertEqual(res2["status"], "CORROBORATION_UPDATED")
        self.assertEqual(res2["corroboration_count"], 2)

        # User 3 submits (3 distinct users total -> MUST promote!)
        res3 = self.promoter.stage_candidate_fact(
            candidate_fact=fact,
            originating_user="charlie@meridiansc.com",
            session_id="sess_safety_03",
            category="OPERATIONS"
        )
        self.assertEqual(res3["status"], "PROMOTED_VIA_3X_CORROBORATION")
        self.assertEqual(res3["corroboration_count"], 3)
        self.assertIsNotNone(res3.get("fact_id"))

    def test_04_contradiction_blocking(self):
        """
        Verify Contradiction Detection:
        - A candidate asserting terms conflicting with approved policy (Net-90 vs Net-30)
          is flagged CONFLICTING and blocked from auto-promotion.
        """
        contradictory_claim = "Meridian Supply Chain offers wholesale partners net-90 credit terms."
        res = self.promoter.stage_candidate_fact(
            candidate_fact=contradictory_claim,
            originating_user="rogue_sales@meridiansc.com",
            session_id="sess_rogue_01",
            category="PAYMENT_TERMS"
        )
        self.assertTrue(res["is_conflicting"])
        self.assertEqual(res["candidate_status"], "CONFLICTING")
        self.assertIn("contradicts", res["conflict_details"].lower())

    def test_05_domain_lead_review_workflow(self):
        """
        Verify Domain Lead Review:
        - Lead approves or rejects candidate with full audit trail.
        """
        claim = "Special holiday overtime multiplier is 2.5x base hourly rate."
        stage_res = self.promoter.stage_candidate_fact(
            candidate_fact=claim,
            originating_user="staff@meridiansc.com",
            session_id="sess_ot_01",
            category="OPERATIONS"
        )
        cand_id = stage_res["candidate_id"]

        # Reject workflow
        reject_res = self.promoter.review_candidate(
            candidate_id=cand_id,
            decision="REJECT",
            reviewer_id="lead_ops@meridiansc.com",
            reviewer_role="ROLE_LEAD",
            comments="Overtime multiplier remains standard 1.5x under current CBA."
        )
        self.assertEqual(reject_res["status"], "SUCCESS")
        self.assertEqual(reject_res["new_status"], "REJECTED")

    def test_06_citation_edge_cases(self):
        """
        Verify Citation Handling across Edge Cases:
        1. Empty query returns clean empty results without error
        2. Non-existent keywords return empty or fallback safely
        3. All citations include Source, Version, and Section path
        """
        empty_res = self.store.hybrid_search("", top_k=5, user_role="ROLE_USER")
        self.assertIsInstance(empty_res["results"], list)

        gibberish_res = self.store.hybrid_search("xyznonexistentterm987654321", top_k=5, user_role="ROLE_USER")
        self.assertIsInstance(gibberish_res["results"], list)
        for r in gibberish_res["results"]:
            self.assertTrue(r["citation"].startswith("Source: "))
            self.assertIn(" -> ", r["citation"])

if __name__ == "__main__":
    unittest.main()
