#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
DEST="${1:-founder@swift.local}"

echo "== OTP request =="
REQ=$(curl -s -X POST "$BASE/v1/auth/otp/request" \
  -H 'content-type: application/json' \
  -d "{\"channel\":\"email\",\"destination\":\"$DEST\"}")
echo "$REQ"
CHALLENGE=$(echo "$REQ" | python3 -c "import sys,json; print(json.load(sys.stdin)['challengeId'])")
CODE=$(echo "$REQ" | python3 -c "import sys,json; print(json.load(sys.stdin).get('devCode',''))")
if [[ -z "$CODE" ]]; then
  echo "No devCode returned. Check server logs for OTP."
  exit 1
fi

echo "== OTP verify =="
VERIFY=$(curl -s -X POST "$BASE/v1/auth/otp/verify" \
  -H 'content-type: application/json' \
  -d "{\"challengeId\":\"$CHALLENGE\",\"code\":\"$CODE\"}")
echo "$VERIFY"

ACCESS=$(echo "$VERIFY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('session',{}).get('accessToken',''))")
USER=$(echo "$VERIFY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('user',{}).get('id',''))")

if [[ -z "$ACCESS" ]]; then
  echo "Not fully authenticated yet (maybe MFA). User=$USER"
  exit 0
fi

echo "== /v1/me =="
curl -s "$BASE/v1/me" -H "authorization: Bearer $ACCESS" | python3 -m json.tool

echo "== assign administrator (dev) =="
curl -s -X POST "$BASE/v1/dev/assign-role" \
  -H 'content-type: application/json' \
  -d "{\"userId\":\"$USER\",\"role\":\"administrator\"}" | python3 -m json.tool

echo "Re-login after role assign may be needed for /v1/admin/ping roles on same token — roles are loaded per request."
echo "== /v1/admin/ping =="
curl -s "$BASE/v1/admin/ping" -H "authorization: Bearer $ACCESS" | python3 -m json.tool

echo "M1 smoke complete."
