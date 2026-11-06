# -*- coding: utf-8 -*-
"""
Verification Script for Jarvis v1 Phase 0 Deliverables
Checks existence, non-emptiness, and integrity of all Phase 0 files.
"""
import os
import sys

base_dir = r"d:\eigi.ai"

required_files = [
    # Core Project Docs
    "project_docs/PHASE_WISE_IMPLEMENTATION.md",
    "project_docs/ARCHITECTURE.md",
    "project_docs/AI_PROMPTS.md",
    "project_docs/PERMISSIONS.md",
    "README.md",
    
    # Audit Documentation (docs/audit/)
    "docs/audit/DATA_DICTIONARY_V1.md",
    "docs/audit/SCHEMA_RELATIONSHIP_REPORT.md",
    "docs/audit/SECURITY_REMEDIATION_LOG.md",
    "docs/audit/SECURITY_THREAT_MODEL.md",
    "docs/audit/ACCESS_CONTROL_MATRIX.md",
    "docs/audit/METRICS_DICTIONARY.md",
    "docs/audit/IDENTITY_RESOLUTION_SPEC.md",
    "docs/audit/DATA_GOVERNANCE_REVIEW.md",
    
    # System Contracts (contracts/)
    "contracts/canonical_crosswalk.sql",
    "contracts/tools.schema.json",
    "contracts/README.md",
    
    # Evaluation (eval/)
    "eval/baseline_eval.json",
    
    # Forensic Scripts (scripts/)
    "scripts/audit_schema_integrity.py",
    "scripts/inspect_identity_joins.py",
    "scripts/verify_timezone_offsets.py",
    
    # Audit Reports (reports/)
    "reports/CONTEXT_INVENTORY.md",
    "reports/PHASE_0_SUMMARY.md",
    "reports/UNRESOLVED_QUESTIONS.md",
    "reports/PHASE_1_READINESS.md",
    "reports/schema_audit_raw.json",
    "reports/identity_joins_audit.json",
    "reports/timezone_verification_audit.json",
    
    # Working Demonstration (jarvis-mvp/)
    "jarvis-mvp/server.js",
    "jarvis-mvp/public/index.html",
    "jarvis-mvp/README.md"
]

print("=" * 80)
print("JARVIS V1 — PHASE 0 DELIVERABLES VERIFICATION REPORT")
print("=" * 80)

all_passed = True
checked_count = 0

print(f"{'Status':<8} | {'File Size (KB)':<14} | {'Path'}")
print("-" * 80)

for rel_path in required_files:
    full_path = os.path.join(base_dir, rel_path.replace("/", os.sep))
    checked_count += 1
    if not os.path.exists(full_path):
        print(f"{'MISSING':<8} | {'0.00 KB':<14} | {rel_path}")
        all_passed = False
        continue
    
    size_bytes = os.path.getsize(full_path)
    size_kb = size_bytes / 1024.0
    
    if size_bytes == 0:
        print(f"{'EMPTY':<8} | {'0.00 KB':<14} | {rel_path}")
        all_passed = False
        continue
        
    # Check for placeholder markers
    with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
        has_placeholder = any(p in content for p in ["TODO_PLACEHOLDER", "INSERT_HERE", "REPLACE_ME_LATER"])
        if has_placeholder:
            print(f"{'WARN':<8} | {f'{size_kb:.2f} KB':<14} | {rel_path} (Contains placeholders)")
            all_passed = False
            continue

    print(f"{'OK':<8} | {f'{size_kb:.2f} KB':<14} | {rel_path}")

print("-" * 80)
print(f"Total Files Checked: {checked_count}")
if all_passed:
    print("RESULT: ALL PHASE 0 DELIVERABLES ARE PRESENT, NON-EMPTY & VALIDATED (100% PASS)")
else:
    print("RESULT: SOME DELIVERABLES FAILED VERIFICATION")
print("=" * 80)
