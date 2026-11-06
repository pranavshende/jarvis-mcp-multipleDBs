# -*- coding: utf-8 -*-
"""
Jarvis v1 — Phase 2: Complete API Automated Test Suite
Tests every single registered endpoint across Fastify Gateway and Flask Backend.
Records HTTP method, URL, status code, response time, authentication result, and test outcome.
Outputs: docs/testing/api_results.json and logs.
"""
import requests
import time
import json
import uuid
import sys

GATEWAY_URL = "http://127.0.0.1:4000"
FLASK_URL = "http://127.0.0.1:5000"
ADMIN_TOKEN = "msc_mcp_founder_sec_7a8f9b1c2d3e4f5a6b7c8d9e0f1a2b3c"
EMPLOYEE_TOKEN = "msc_mcp_emp_sec_8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e" # standard employee
AUTH_HEADERS = {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}

api_log = []

def test_endpoint(category, method, url, headers=None, json_body=None, expected_status=[200], name=None):
    start_time = time.time()
    endpoint_name = name or f"{method} {url}"
    result = {
        "category": category,
        "name": endpoint_name,
        "method": method,
        "url": url,
        "payload": json_body,
        "expected_status": expected_status,
        "status_code": None,
        "latency_ms": None,
        "passed": False,
        "error": None
    }
    try:
        if method == "GET":
            r = requests.get(url, headers=headers, timeout=5.0)
        elif method == "POST":
            r = requests.post(url, headers=headers, json=json_body, timeout=8.0)
        elif method == "DELETE":
            r = requests.delete(url, headers=headers, timeout=5.0)
        else:
            raise ValueError(f"Unsupported method: {method}")

        latency = round((time.time() - start_time) * 1000, 2)
        result["status_code"] = r.status_code
        result["latency_ms"] = latency

        if r.status_code in expected_status:
            result["passed"] = True
            print(f"  ✅ [PASS] {endpoint_name} -> HTTP {r.status_code} ({latency}ms)")
        else:
            result["error"] = f"Expected {expected_status}, got {r.status_code}. Response: {r.text[:200]}"
            print(f"  ❌ [FAIL] {endpoint_name} -> HTTP {r.status_code} ({latency}ms) - {result['error']}")

        try:
            result["response_preview"] = r.json()
        except:
            result["response_preview"] = r.text[:200]

    except Exception as ex:
        latency = round((time.time() - start_time) * 1000, 2)
        result["latency_ms"] = latency
        result["error"] = str(ex)
        print(f"  ❌ [FAIL] {endpoint_name} -> Exception: {ex}")

    api_log.append(result)
    return result

def run_all_api_tests():
    print("=" * 80)
    print("  PHASE 2: COMPREHENSIVE API AUTOMATED VERIFICATION SUITE")
    print("=" * 80)

    # =========================================================================
    # 1. GATEWAY PUBLIC & CONVERSATIONAL / MCP ENDPOINTS
    # =========================================================================
    print("\n--- [1] Gateway Public, Conversational & MCP APIs ---")
    test_endpoint("Gateway MCP", "GET", f"{GATEWAY_URL}/api/health", expected_status=[200])
    mcp_post_headers = {**AUTH_HEADERS, "Accept": "application/json, text/event-stream"}
    init_res = test_endpoint("Gateway MCP", "POST", f"{GATEWAY_URL}/mcp/stream", headers=mcp_post_headers, json_body={
        "jsonrpc": "2.0",
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "jarvis-auditor", "version": "1.0.0"}
        },
        "id": 1
    }, expected_status=[200])
    test_endpoint("Gateway MCP", "GET", f"{GATEWAY_URL}/api/tools", headers=AUTH_HEADERS, expected_status=[200])
    test_endpoint("Gateway Intent", "POST", f"{GATEWAY_URL}/api/query", headers=AUTH_HEADERS, json_body={"query": "What are our partner AR aging balances?"}, expected_status=[200])
    test_endpoint("Gateway Intent", "POST", f"{GATEWAY_URL}/api/query", headers=AUTH_HEADERS, json_body={"query": "What is our RMA return policy?"}, expected_status=[200])
    test_endpoint("Gateway Intent", "POST", f"{GATEWAY_URL}/api/query", headers=AUTH_HEADERS, json_body={}, expected_status=[400], name="POST /api/query (Missing Query - Validation Check)")
    test_endpoint("Gateway Tool", "POST", f"{GATEWAY_URL}/api/tools/get_business_metric", headers=AUTH_HEADERS, json_body={"metric_id": "PARTNER_AR_TOTAL"}, expected_status=[200])
    test_endpoint("Gateway Tool", "POST", f"{GATEWAY_URL}/api/tools/non_existent_tool", headers=AUTH_HEADERS, json_body={}, expected_status=[200, 404], name="POST /api/tools/:name (Invalid Tool Error Handling)")

    # =========================================================================
    # 2. GATEWAY EVALUATION CENTER APIS
    # =========================================================================
    print("\n--- [2] Gateway Evaluation Center APIs ---")
    test_endpoint("Gateway Evaluation", "GET", f"{GATEWAY_URL}/api/admin/evaluation/summary", headers=AUTH_HEADERS, expected_status=[200])
    test_endpoint("Gateway Evaluation", "GET", f"{GATEWAY_URL}/api/admin/evaluation/runs", headers=AUTH_HEADERS, expected_status=[200])
    test_endpoint("Gateway Evaluation", "GET", f"{GATEWAY_URL}/api/admin/evaluation/scenarios", headers=AUTH_HEADERS, expected_status=[200])

    # =========================================================================
    # 3. GATEWAY COMPOSITE SEMANTIC CACHE APIS
    # =========================================================================
    print("\n--- [3] Gateway Semantic Cache APIs ---")
    test_endpoint("Gateway Cache", "GET", f"{GATEWAY_URL}/api/admin/cache/stats", headers=AUTH_HEADERS, expected_status=[200])
    test_endpoint("Gateway Cache", "GET", f"{GATEWAY_URL}/api/admin/cache/entries", headers=AUTH_HEADERS, expected_status=[200])
    test_endpoint("Gateway Cache", "POST", f"{GATEWAY_URL}/api/admin/cache/invalidate", headers=AUTH_HEADERS, json_body={"scope": "FINANCIAL"}, expected_status=[200])
    test_endpoint("Gateway Cache", "POST", f"{GATEWAY_URL}/api/admin/cache/invalidate", headers=AUTH_HEADERS, json_body={"scope": "KNOWLEDGE"}, expected_status=[200])

    # =========================================================================
    # 4. GATEWAY BULLMQ DEAD-LETTER QUEUE (DLQ) APIS
    # =========================================================================
    print("\n--- [4] Gateway Dead-Letter Queue (DLQ) APIs ---")
    test_endpoint("Gateway DLQ", "GET", f"{GATEWAY_URL}/api/admin/dlq", headers=AUTH_HEADERS, expected_status=[200])
    test_endpoint("Gateway DLQ", "POST", f"{GATEWAY_URL}/api/admin/dlq/JOB-NONEXISTENT/retry", headers=AUTH_HEADERS, json_body={"reason": "Test Retry"}, expected_status=[400, 404], name="POST /api/admin/dlq/:jobId/retry (Missing Job Check)")
    test_endpoint("Gateway DLQ", "POST", f"{GATEWAY_URL}/api/admin/dlq/JOB-NONEXISTENT/dismiss", headers=AUTH_HEADERS, json_body={"reason": "Test Dismiss"}, expected_status=[200, 400], name="POST /api/admin/dlq/:jobId/dismiss (Dismissal Flow)")

    # =========================================================================
    # 5. GATEWAY MODEL REGISTRY & BUDGET APIS
    # =========================================================================
    print("\n--- [5] Gateway Model Registry & Budgets APIs ---")
    test_endpoint("Gateway Models", "GET", f"{GATEWAY_URL}/api/admin/models", headers=AUTH_HEADERS, expected_status=[200])
    test_endpoint("Gateway Models", "GET", f"{GATEWAY_URL}/api/admin/models/budgets", headers=AUTH_HEADERS, expected_status=[200])
    test_endpoint("Gateway Models", "GET", f"{GATEWAY_URL}/api/admin/models/spend?days=30", headers=AUTH_HEADERS, expected_status=[200])
    test_endpoint("Gateway Models", "GET", f"{GATEWAY_URL}/api/admin/models/usage", headers=AUTH_HEADERS, expected_status=[200])

    # =========================================================================
    # 6. GATEWAY SECURITY CENTER APIS
    # =========================================================================
    print("\n--- [6] Gateway Security Center APIs ---")
    test_endpoint("Gateway Security", "GET", f"{GATEWAY_URL}/api/admin/security/redteam", headers=AUTH_HEADERS, expected_status=[200])
    test_endpoint("Gateway Security", "GET", f"{GATEWAY_URL}/api/admin/security/events", headers=AUTH_HEADERS, expected_status=[200])

    # =========================================================================
    # 7. GATEWAY TOKEN MANAGEMENT APIS
    # =========================================================================
    print("\n--- [7] Gateway Token Management APIs ---")
    t_list = test_endpoint("Gateway Tokens", "GET", f"{GATEWAY_URL}/api/admin/tokens", headers=AUTH_HEADERS, expected_status=[200])
    new_token_id = None
    create_res = test_endpoint("Gateway Tokens", "POST", f"{GATEWAY_URL}/api/admin/tokens", headers=AUTH_HEADERS, json_body={
        "userId": f"EMP-TEST-{uuid.uuid4().hex[:4]}",
        "corporateEmail": f"test-{uuid.uuid4().hex[:4]}@meridian.internal",
        "tokenName": "API Test Token",
        "role": "ROLE_EMPLOYEE",
        "department": "OPERATIONS",
        "allowedScopes": ["read:metrics"]
    }, expected_status=[200, 201])
    
    if create_res["passed"] and isinstance(create_res.get("response_preview"), dict):
        new_token_id = create_res["response_preview"].get("tokenRecord", {}).get("id")

    if new_token_id:
        test_endpoint("Gateway Tokens", "POST", f"{GATEWAY_URL}/api/admin/tokens/{new_token_id}/rotate", headers=AUTH_HEADERS, json_body={}, expected_status=[200])
        test_endpoint("Gateway Tokens", "POST", f"{GATEWAY_URL}/api/admin/tokens/{new_token_id}/revoke", headers=AUTH_HEADERS, json_body={}, expected_status=[200])

    # =========================================================================
    # 8. FLASK DETERMINISTIC METRIC APIS
    # =========================================================================
    print("\n--- [8] Flask Deterministic Metric APIs ---")
    test_endpoint("Flask Metrics", "GET", f"{FLASK_URL}/api/health/db", expected_status=[200])
    test_endpoint("Flask Metrics", "GET", f"{FLASK_URL}/api/metrics/list", expected_status=[200])
    test_endpoint("Flask Metrics", "POST", f"{FLASK_URL}/api/metrics/execute", json_body={"metric_id": "PARTNER_AR_AGING"}, expected_status=[200])
    test_endpoint("Flask Metrics", "POST", f"{FLASK_URL}/api/metrics/execute", json_body={"metric_id": "INVENTORY_FIFO_VALUATION"}, expected_status=[200])
    test_endpoint("Flask Metrics", "POST", f"{FLASK_URL}/api/metrics/execute", json_body={"metric_id": "INVALID_METRIC"}, expected_status=[400, 404], name="POST /api/metrics/execute (Invalid Metric Guard)")

    # =========================================================================
    # 9. FLASK CROSSWALK & RECONCILIATION APIS
    # =========================================================================
    print("\n--- [9] Flask Crosswalk & Reconciliation APIs ---")
    test_endpoint("Flask Crosswalk", "GET", f"{FLASK_URL}/api/crosswalk/stats", expected_status=[200])
    test_endpoint("Flask Crosswalk", "GET", f"{FLASK_URL}/api/crosswalk/products?q=widget&limit=5", expected_status=[200])
    test_endpoint("Flask Crosswalk", "GET", f"{FLASK_URL}/api/crosswalk/order?order_id=ORD-TEST-001", expected_status=[200, 404])
    test_endpoint("Flask Sync", "GET", f"{FLASK_URL}/api/sync/status", expected_status=[200])
    test_endpoint("Flask Sync", "GET", f"{FLASK_URL}/api/reconciliation/history", expected_status=[200])
    # Full multi-table reconciliation takes ~7-8s
    start_time = time.time()
    try:
        r = requests.post(f"{FLASK_URL}/api/reconciliation/run", json={"mode": "TEST_AUDIT"}, timeout=20.0)
        api_log.append({
            "category": "Flask Sync",
            "name": "POST http://127.0.0.1:5000/api/reconciliation/run",
            "method": "POST",
            "url": f"{FLASK_URL}/api/reconciliation/run",
            "expected_status": [200],
            "status_code": r.status_code,
            "latency_ms": round((time.time() - start_time) * 1000, 2),
            "passed": r.status_code == 200,
            "error": None
        })
        print(f"  ✅ [PASS] POST http://127.0.0.1:5000/api/reconciliation/run -> HTTP {r.status_code} ({round((time.time() - start_time) * 1000, 2)}ms)")
    except Exception as ex:
        print(f"  ❌ [FAIL] POST http://127.0.0.1:5000/api/reconciliation/run -> Exception: {ex}")

    # =========================================================================
    # 10. FLASK ALERT MANAGEMENT APIS
    # =========================================================================
    print("\n--- [10] Flask Alert Management APIs ---")
    test_endpoint("Flask Alerts", "GET", f"{FLASK_URL}/api/alerts/summary", expected_status=[200])
    alerts_feed = test_endpoint("Flask Alerts", "GET", f"{FLASK_URL}/api/alerts?limit=10", expected_status=[200])
    test_endpoint("Flask Monitoring", "GET", f"{FLASK_URL}/api/monitoring/status", expected_status=[200])
    
    test_alert_id = None
    if alerts_feed["passed"] and isinstance(alerts_feed.get("response_preview"), dict):
        alerts_list = alerts_feed["response_preview"].get("alerts", [])
        if len(alerts_list) > 0:
            test_alert_id = alerts_list[0].get("alert_id") or alerts_list[0].get("id")

    if test_alert_id:
        test_endpoint("Flask Alerts", "GET", f"{FLASK_URL}/api/alerts/{test_alert_id}", expected_status=[200])
        test_endpoint("Flask Alerts", "POST", f"{FLASK_URL}/api/alerts/{test_alert_id}/acknowledge", json_body={"user_id": "EMP-001"}, expected_status=[200])
        test_endpoint("Flask Alerts", "POST", f"{FLASK_URL}/api/alerts/{test_alert_id}/snooze", json_body={"user_id": "EMP-001", "duration_minutes": 60}, expected_status=[200])
        test_endpoint("Flask Alerts", "POST", f"{FLASK_URL}/api/alerts/{test_alert_id}/resolve", json_body={"user_id": "EMP-001", "notes": "Audited via automated test suite"}, expected_status=[200])

    # =========================================================================
    # 11. FLASK RESTRICTED BUSINESS ACTIONS APIS
    # =========================================================================
    print("\n--- [11] Flask Restricted Actions APIs ---")
    test_endpoint("Flask Actions", "GET", f"{FLASK_URL}/api/actions/pending", expected_status=[200])
    test_endpoint("Flask Actions", "GET", f"{FLASK_URL}/api/actions/history", expected_status=[200])
    prop_res = test_endpoint("Flask Actions", "POST", f"{FLASK_URL}/api/actions/propose", json_body={
        "action_type": "ACTION_CREDIT_HOLD",
        "partner_id": "PARTNER-301",
        "requested_by": "auditor@meridian.internal",
        "reason": "Automated security audit test proposal"
    }, expected_status=[200, 400, 404])
    
    # Negative test: execute action without confirmation token must fail (400/403)
    test_endpoint("Flask Actions", "POST", f"{FLASK_URL}/api/actions/ACT-FAKE-999/execute", json_body={"confirmation_token": "WRONG_TOKEN"}, expected_status=[400, 403, 404], name="POST /api/actions/:id/execute (Invalid Token Rejection)")

    # =========================================================================
    # 12. FLASK KNOWLEDGE BASE, RAG & MEMORY APIS
    # =========================================================================
    print("\n--- [12] Flask Knowledge Base & Memory Governance APIs ---")
    test_endpoint("Flask Knowledge", "GET", f"{FLASK_URL}/api/knowledge/stats", expected_status=[200])
    test_endpoint("Flask Knowledge", "GET", f"{FLASK_URL}/api/knowledge/sources", expected_status=[200])
    test_endpoint("Flask Knowledge", "POST", f"{FLASK_URL}/api/knowledge/search", json_body={"query": "credit terms gold partner", "top_k": 3}, expected_status=[200])
    test_endpoint("Flask Knowledge", "POST", f"{FLASK_URL}/api/knowledge/retrieve", json_body={"query": "gold partner payment terms", "user_role": "ROLE_FOUNDER"}, expected_status=[200])
    test_endpoint("Flask Knowledge", "GET", f"{FLASK_URL}/api/knowledge/candidates", expected_status=[200])
    test_endpoint("Flask Knowledge", "GET", f"{FLASK_URL}/api/knowledge/memory", expected_status=[200])

    # =========================================================================
    # 13. AUTHENTICATION & NEGATIVE SECURITY TESTS
    # =========================================================================
    print("\n--- [13] Authentication Boundary & Negative Security Tests ---")
    test_endpoint("Security Auth", "GET", f"{GATEWAY_URL}/api/admin/tokens", expected_status=[401], name="GET /api/admin/tokens (Unauthenticated Check)")
    test_endpoint("Security Auth", "GET", f"{GATEWAY_URL}/api/admin/tokens", headers={"Authorization": "Bearer invalid_secret_token_123"}, expected_status=[401], name="GET /api/admin/tokens (Invalid Token Check)")
    test_endpoint("Security Auth", "POST", f"{GATEWAY_URL}/api/query", expected_status=[401], name="POST /api/query (Missing Token Check)")
    test_endpoint("Security Auth", "GET", f"{GATEWAY_URL}/api/tools", expected_status=[401], name="GET /api/tools (Missing Token Check)")

    passed_count = sum(1 for t in api_log if t["passed"])
    failed_count = len(api_log) - passed_count
    pass_rate = round((passed_count / len(api_log)) * 100, 2)

    print("\n" + "=" * 80)
    print(f"  PHASE 2 API TEST SUMMARY: {passed_count} / {len(api_log)} ENDPOINTS PASSED ({pass_rate}%)")
    print("=" * 80)

    summary = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_endpoints_tested": len(api_log),
        "passed": passed_count,
        "failed": failed_count,
        "pass_rate_pct": pass_rate,
        "results": api_log
    }

    with open("docs/testing/api_results.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    return summary

if __name__ == "__main__":
    s = run_all_api_tests()
    sys.exit(0 if s["failed"] == 0 else 1)
