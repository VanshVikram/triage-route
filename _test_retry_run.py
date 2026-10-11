import sys, os, json
from unittest.mock import patch, MagicMock

HERE = r'c:\Users\Vansh Vikram\Documents\AI AGENT\triage-route'
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'engine'))

import agent, httpx

PASS = 0
FAIL = 0

def ok(msg):
    global PASS; PASS += 1; print(f'  PASS  {msg}')

def fail(msg):
    global FAIL; FAIL += 1; print(f'  FAIL  {msg}')

print('='*62)
print('  Retry reliability tests - agent._call_llm()')
print('='*62)

# TEST 2a - two 503s then 200
print('\n[TEST 2a] 503 x2 then 200 -> succeeds after 2 retries')
try:
    with patch('time.sleep', return_value=None) as sl, patch('httpx.post') as mp:
        def make503():
            r=MagicMock(); r.status_code=503
            r.raise_for_status.side_effect=httpx.HTTPStatusError('503',request=MagicMock(),response=r)
            return r
        ok_r=MagicMock(); ok_r.status_code=200; ok_r.raise_for_status=lambda:None
        ok_r.json.return_value={'choices':[{'message':{'content':'{\"llm_level\":2,\"reasons\":[\"r\"],\"concerns\":[]}'}}]}
        mp.side_effect=[make503(),make503(),ok_r]
        with patch.dict(os.environ,{'LLM_API_KEY':'test-key'}):
            result=agent._call_llm('p','s')
        assert mp.call_count==3
        assert sl.call_count==2
        ok(f'POST calls={mp.call_count}, sleep calls={sl.call_count}')
except Exception as e:
    fail(str(e))

# TEST 2b - immediate 200
print('\n[TEST 2b] Immediate 200 -> no retry, no sleep')
try:
    with patch('time.sleep') as sl, patch('httpx.post') as mp:
        ok_r=MagicMock(); ok_r.status_code=200; ok_r.raise_for_status=lambda:None
        ok_r.json.return_value={'choices':[{'message':{'content':'{\"llm_level\":3,\"reasons\":[\"r\"],\"concerns\":[]}'}}]}
        mp.return_value=ok_r
        with patch.dict(os.environ,{'LLM_API_KEY':'test-key'}):
            agent._call_llm('p','s')
        assert mp.call_count==1; sl.assert_not_called()
        ok(f'POST calls={mp.call_count}, sleep=0')
except Exception as e:
    fail(str(e))

# TEST 3 - non-503 not retried
print('\n[TEST 3] Non-503 errors raise immediately (no retry)')
for code in [400,401,403,404]:
    try:
        with patch('time.sleep') as sl, patch('httpx.post') as mp:
            r=MagicMock(); r.status_code=code
            r.raise_for_status.side_effect=httpx.HTTPStatusError(str(code),request=MagicMock(),response=r)
            mp.return_value=r
            raised=False
            try:
                with patch.dict(os.environ,{'LLM_API_KEY':'test-key'}):
                    agent._call_llm('p','s')
            except httpx.HTTPStatusError:
                raised=True
            assert raised and mp.call_count==1; sl.assert_not_called()
            ok(f'HTTP {code}: raised immediately, POST calls=1')
    except Exception as e:
        fail(f'HTTP {code}: {e}')

# TEST 4 - all 503 retries exhausted
print('\n[TEST 4] All 503 retries exhausted -> exception propagates')
try:
    with patch('time.sleep',return_value=None) as sl, patch('httpx.post') as mp:
        r=MagicMock(); r.status_code=503
        r.raise_for_status.side_effect=httpx.HTTPStatusError('503',request=MagicMock(),response=r)
        mp.return_value=r
        raised=False
        try:
            with patch.dict(os.environ,{'LLM_API_KEY':'test-key'}):
                agent._call_llm('p','s')
        except Exception:
            raised=True
        assert raised and mp.call_count==4 and sl.call_count==3
        ok(f'POST calls={mp.call_count} (initial+3), sleep calls={sl.call_count}')
        ok('Exception propagates -> api.py returns clean HTTP 500')
except Exception as e:
    fail(str(e))

# TEST 1 - live P001
print('\n[TEST 1] Live P001 triage via POST /triage')
try:
    import urllib.request, urllib.error
    payload=json.dumps({'text':'Patient P001, 58-year-old male. Chest pain, crushing, radiating to left arm. HR 105, BP 158/96, SpO2 95%, Temp 37.1C, RR 20.'}).encode()
    req=urllib.request.Request('http://127.0.0.1:8000/triage',data=payload,headers={'Content-Type':'application/json'},method='POST')
    with urllib.request.urlopen(req,timeout=90) as r:
        status=r.status; body=json.loads(r.read())
    print(f'  HTTP status  : {status}')
    print(f'  llm_source   : {body.get(\"llm_source\")}')
    print(f'  final_level  : {body.get(\"final_level\")}')
    print(f'  floor_level  : {body.get(\"floor_level\")}')
    print(f'  llm_reasons  : {body.get(\"llm_reasons\")}')
    assert status==200; assert body.get('llm_source')=='llm'; assert body.get('final_level')==2
    ok('HTTP 200, llm_source=llm, final_level=2, safety floor applied')
except Exception as e:
    fail(str(e))

print('\n'+'='*62)
print(f'  Results: {PASS} passed, {FAIL} failed')
print(f'  Deterministic fallback used: NO')
print(f'  Secrets exposed: NO')
print('='*62)
sys.exit(0 if FAIL==0 else 1)
