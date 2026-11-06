import urllib.request
import json
import sys

def query(q, sess):
    req = urllib.request.Request(
        'http://127.0.0.1:4000/api/query',
        data=json.dumps({'query': q, 'sessionId': sess}).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Authorization': 'Bearer msc_mcp_founder_sec_7a8f9b1c2d3e4f5a6b7c8d9e0f1a2b3c'},
        method='POST'
    )
    with urllib.request.urlopen(req, timeout=35) as r:
        return json.loads(r.read().decode('utf-8'))

sess = 'multiturn_eval_test'
print('--- Turn 1: Initial Mention ---')
r1 = query('What are Northgate Hobby Distributors credit terms and who is their account manager?', sess)
print('Intent:', r1.get('nluAnalysis', {}).get('intent'))
print('Entities:', r1.get('entities'))
print('Route:', r1.get('route'))
print('Response Preview:\n', r1.get('response', '')[:250])

print('\n--- Turn 2: Follow-up with Anaphoric Pronoun ("they") ---')
r2 = query('What is their overdue balance and why are they on credit hold?', sess)
print('Resolved Query:', r2.get('nluAnalysis', {}).get('resolvedQuery'))
print('Pronouns Resolved:', r2.get('nluAnalysis', {}).get('pronounsResolved'))
print('Entities:', r2.get('entities'))
print('Route:', r2.get('route'))
print('Response Preview:\n', r2.get('response', '')[:250])

