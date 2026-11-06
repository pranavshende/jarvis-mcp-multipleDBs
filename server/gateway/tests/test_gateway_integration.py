import urllib.request
import urllib.error
import json
import time

BASE_URL = "http://127.0.0.1:4000"

FOUNDER_TOKEN = "msc_mcp_founder_sec_7a8f9b1c2d3e4f5a6b7c8d9e0f1a2b3c"
FINANCE_TOKEN = "msc_mcp_finance_sec_1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e"
SALES_TOKEN = "msc_mcp_sales_sec_9f8e7d6c5b4a3b2c1d0e9f8a7b6c5d4e"
WAREHOUSE_TOKEN = "msc_mcp_warehouse_sec_4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d"

def call_api(path, method="GET", body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(f"{BASE_URL}{path}", data=data, headers=headers, method=method)
    
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req) as res:
            lat = (time.perf_counter() - t0) * 1000.0
            return res.status, json.loads(res.read().decode()), lat
    except urllib.error.HTTPError as e:
        lat = (time.perf_counter() - t0) * 1000.0
        try:
            err_body = json.loads(e.read().decode())
        except:
            err_body = {}
        return e.code, err_body, lat

print("=== 1. Testing Intent Router (POST /api/query) ===")
# Path A: Metric Route
status, res, lat = call_api("/api/query", "POST", {"query": "What is our current partner AR aging breakdown?"}, FOUNDER_TOKEN)
print(f"Path A (Metric): HTTP {status} ({lat:.1f}ms) -> Route: {res.get('route')}")
assert res.get('route') == 'METRIC'

# Path B: Knowledge Route
status, res, lat = call_api("/api/query", "POST", {"query": "What are our approved partner payment terms and credit rules?"}, FOUNDER_TOKEN)
print(f"Path B (Knowledge): HTTP {status} ({lat:.1f}ms) -> Route: {res.get('route')}")
assert res.get('route') == 'KNOWLEDGE'

# Path C: Dual Synthesis Route
status, res, lat = call_api("/api/query", "POST", {"query": "What are our partner AR aging balances and what payment terms SOPs apply to them?"}, FOUNDER_TOKEN)
print(f"Path C (Dual): HTTP {status} ({lat:.1f}ms) -> Route: {res.get('route')}")
assert res.get('route') == 'DUAL_SYNTHESIS'

print("\n=== 2. Testing Direct Tool Invocations ===")
# execute_metric
status, res, lat = call_api("/api/tools/get_business_metric", "POST", {"metric_id": "DAILY_PACKAGES_RECEIVED"}, FOUNDER_TOKEN)
print(f"get_business_metric: HTTP {status} ({lat:.1f}ms) -> isError: {res.get('isError', False)}")

# search_company_knowledge
status, res, lat = call_api("/api/tools/search_company_knowledge", "POST", {"query": "payment terms", "top_k": 2}, FOUNDER_TOKEN)
print(f"search_company_knowledge: HTTP {status} ({lat:.1f}ms) -> isError: {res.get('isError', False)}")

# get_active_alerts
status, res, lat = call_api("/api/tools/get_active_alerts", "POST", {"status": "ACTIVE"}, FOUNDER_TOKEN)
print(f"get_active_alerts: HTTP {status} ({lat:.1f}ms) -> isError: {res.get('isError', False)}")

# propose_business_action
status, res, lat = call_api("/api/tools/propose_business_action", "POST", {
    "action_type": "SET_PARTNER_CREDIT_HOLD",
    "payload": {"partner_id": "PARTNER-TEST-01"},
    "reason": "Test credit hold via gateway"
}, FOUNDER_TOKEN)
print(f"propose_business_action: HTTP {status} ({lat:.1f}ms) -> isError: {res.get('isError', False)}")
if res.get('content'):
    print("   Proposal Output:", res['content'][0]['text'][:120])

print("\n=== 3. Testing RBAC Permission Matrix ===")
# Warehouse associate trying to access AR Aging -> DENIED!
status, res, lat = call_api("/api/tools/get_partner_ar_aging", "POST", {}, WAREHOUSE_TOKEN)
print(f"Warehouse user -> get_partner_ar_aging: HTTP {status} -> isError: {res.get('isError')}")
assert res.get('isError') == True
print(f"   Rejection Reason: {res['content'][0]['text']}")

# Sales associate trying to confirm an action -> DENIED!
status, res, lat = call_api("/api/tools/confirm_business_action", "POST", {
    "action_id": "00000000-0000-0000-0000-000000000000",
    "confirmation_token": "CONFIRM"
}, SALES_TOKEN)
print(f"Sales user -> confirm_business_action: HTTP {status} -> isError: {res.get('isError')}")
assert res.get('isError') == True
print(f"   Rejection Reason: {res['content'][0]['text']}")

# Finance user accessing get_partner_ar_aging -> ALLOWED!
status, res, lat = call_api("/api/tools/get_partner_ar_aging", "POST", {}, FINANCE_TOKEN)
print(f"Finance user -> get_partner_ar_aging: HTTP {status} -> isError: {res.get('isError', False)}")
assert res.get('isError', False) == False

print("\nALL GATEWAY INTEGRATION CHECKS PASSED PERFECTLY!")
