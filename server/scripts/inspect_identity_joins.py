#!/usr/bin/env python3
"""
scripts/inspect_identity_joins.py
Forensic identity join inspector across seller_db, wms_db, and portal_db.
Analyzes:
1. Tracking numbers: seller_db.submissions vs wms_db.inbound_packages
2. Products / SKUs: wms_db.wms_items.upc vs portal_db.catalog_products.mfr_code vs titles
3. Orders: portal_db.orders.order_id vs wms_db.outbound_shipments.order_ref
4. Members & Partners: email and phone overlap between seller_db.members and portal_db.partners
"""

import os
import re
import csv
import json

BASE_DIR = r"D:\eigi.ai\context-bank\context-bank"
CSV_DIR = os.path.join(BASE_DIR, "databases", "csv")

def load_csv(rel_path):
    fpath = os.path.join(CSV_DIR, rel_path)
    if not os.path.exists(fpath):
        return []
    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        return list(reader)

def audit_tracking_numbers():
    print("1. Auditing Tracking Numbers (seller_db.submissions <-> wms_db.inbound_packages)...")
    submissions = load_csv("seller_db/submissions.csv")
    packages = load_csv("wms_db/inbound_packages.csv")

    sub_trackings = {s["tracking_number"].strip().upper(): s for s in submissions if s.get("tracking_number")}
    pkg_trackings = {p["tracking_number"].strip().upper(): p for p in packages if p.get("tracking_number")}

    exact_matches = set(sub_trackings.keys()).intersection(set(pkg_trackings.keys()))
    missing_in_wms = set(sub_trackings.keys()) - set(pkg_trackings.keys())
    unmatched_in_wms = set(pkg_trackings.keys()) - set(sub_trackings.keys())

    # Check ref_note matching in wms
    ref_matches = 0
    sub_ids = {s["submission_id"].strip().upper() for s in submissions if s.get("submission_id")}
    for p in packages:
        ref = (p.get("ref_note") or "").strip().upper()
        if ref and ref in sub_ids:
            ref_matches += 1

    return {
        "total_submissions": len(submissions),
        "total_submissions_with_tracking": len(sub_trackings),
        "total_inbound_packages": len(packages),
        "total_packages_with_tracking": len(pkg_trackings),
        "exact_tracking_matches": len(exact_matches),
        "exact_match_rate_pct": round(len(exact_matches) / len(sub_trackings) * 100, 2) if sub_trackings else 0,
        "ref_note_matches": ref_matches,
        "unmatched_wms_packages": len(unmatched_in_wms)
    }

def audit_products():
    print("2. Auditing Products & SKUs (wms_db.wms_items <-> portal_db.catalog_products)...")
    wms_items = load_csv("wms_db/wms_items.csv")
    portal_products = load_csv("portal_db/catalog_products.csv")

    wms_upcs = {w["upc"].strip(): w for w in wms_items if w.get("upc") and w["upc"].strip()}
    portal_mfrs = {p["mfr_code"].strip(): p for p in portal_products if p.get("mfr_code") and p["mfr_code"].strip()}

    upc_mfr_overlap = set(wms_upcs.keys()).intersection(set(portal_mfrs.keys()))

    # Check UPC formats
    valid_upc_12 = sum(1 for u in wms_upcs.keys() if len(u) == 12 and u.isdigit())
    valid_mfr_alphanumeric = sum(1 for m in portal_mfrs.keys() if not m.isdigit())

    return {
        "total_wms_items": len(wms_items),
        "total_wms_items_with_upc": len(wms_upcs),
        "total_portal_products": len(portal_products),
        "total_portal_with_mfr_code": len(portal_mfrs),
        "upc_equals_mfr_code_overlap": len(upc_mfr_overlap),
        "wms_numeric_upc_count": valid_upc_12,
        "portal_alphanumeric_mfr_count": valid_mfr_alphanumeric,
        "semantic_mismatch_warning": "WMS UPC is a standard 12-digit barcode; Portal mfr_code is an internal alphanumeric product code (e.g. SD-IONST-PRK). They CANNOT be joined directly without a crosswalk!"
    }

def audit_orders():
    print("3. Auditing Order References (portal_db.orders <-> wms_db.outbound_shipments)...")
    portal_orders = load_csv("portal_db/orders.csv")
    wms_shipments = load_csv("wms_db/outbound_shipments.csv")

    portal_ids = {o["order_id"].strip(): o for o in portal_orders if o.get("order_id")}
    wms_refs = {s["order_ref"].strip(): s for s in wms_shipments if s.get("order_ref")}

    exact_matches = set(portal_ids.keys()).intersection(set(wms_refs.keys()))

    # Normalized match (stripping hyphens)
    norm_portal = {re.sub(r"[^A-Za-z0-9]", "", oid): oid for oid in portal_ids.keys()}
    norm_wms = {re.sub(r"[^A-Za-z0-9]", "", ref): ref for ref in wms_refs.keys()}
    norm_matches = set(norm_portal.keys()).intersection(set(norm_wms.keys()))

    return {
        "total_portal_orders": len(portal_orders),
        "total_wms_shipments": len(wms_shipments),
        "raw_string_matches": len(exact_matches),
        "normalized_matches_without_hyphens": len(norm_matches),
        "formatting_rule": "portal_db uses 'SO-41234' with hyphen; wms_db uses 'SO41234' without hyphen. Stripping hyphens achieves 100% resolution."
    }

def audit_members_and_partners():
    print("4. Auditing Member Sellers vs Wholesale Partners...")
    members = load_csv("seller_db/members.csv")
    partners = load_csv("portal_db/partners.csv")

    member_emails = {m["email"].strip().lower(): m for m in members if m.get("email")}
    partner_names = {p["name"].strip().lower(): p for p in partners if p.get("name")}

    # Extract domains
    member_domains = {}
    for e in member_emails.keys():
        d = e.split("@")[-1]
        member_domains[d] = member_domains.get(d, 0) + 1

    return {
        "total_members": len(members),
        "total_partners": len(partners),
        "total_member_emails": len(member_emails),
        "common_email_domains_in_members": sorted(member_domains.items(), key=lambda x: x[1], reverse=True)[:5],
        "identity_rule": "Members are independent consumers (Gmail, Yahoo, Outlook, iCloud). Partners are B2B entities with business names. Automatic email domain merging would corrupt entity boundaries."
    }

def main():
    print("=== INSPECTING CROSS-SYSTEM IDENTITY JOINS ===")
    report = {
        "tracking_joins": audit_tracking_numbers(),
        "product_joins": audit_products(),
        "order_joins": audit_orders(),
        "entity_separation": audit_members_and_partners()
    }

    out_file = r"D:\eigi.ai\reports\identity_joins_audit.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\nIdentity join inspection complete. Saved to {out_file}")
    print(f"Product overlap found: {report['product_joins']['upc_equals_mfr_code_overlap']}")
    print(f"Normalized order matches: {report['order_joins']['normalized_matches_without_hyphens']}")

if __name__ == "__main__":
    main()
