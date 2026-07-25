#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
DEST="${1:-booker-m3-$(date +%s)@swift.local}"

echo "== Auth =="
REQ=$(curl -s -X POST "$BASE/v1/auth/otp/request" -H 'content-type: application/json' \
  -d "{\"channel\":\"email\",\"destination\":\"$DEST\"}")
CHALLENGE=$(echo "$REQ" | python3 -c "import sys,json; print(json.load(sys.stdin)['challengeId'])")
CODE=$(echo "$REQ" | python3 -c "import sys,json; print(json.load(sys.stdin)['devCode'])")
VERIFY=$(curl -s -X POST "$BASE/v1/auth/otp/verify" -H 'content-type: application/json' \
  -d "{\"challengeId\":\"$CHALLENGE\",\"code\":\"$CODE\"}")
ACCESS=$(echo "$VERIFY" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")
AUTH="authorization: Bearer $ACCESS"

echo "== Catalog =="
curl -s "$BASE/v1/catalog" | python3 -m json.tool | head -n 40

echo "== Create draft =="
CREATE=$(curl -s -X POST "$BASE/v1/jobs" -H "$AUTH" -H 'content-type: application/json' -d '{
  "serviceTypeCode": "standard",
  "packageClass": "small",
  "pickupAddress": "1 Long Street, Cape Town",
  "pickupZoneCode": "CPT-CBD",
  "pickupLat": -33.9249,
  "pickupLng": 18.4241,
  "dropoffAddress": "50 Main Road, Sea Point",
  "dropoffZoneCode": "CPT-ATL",
  "dropoffLat": -33.916,
  "dropoffLng": 18.388,
  "recipientName": "Ada",
  "recipientPhone": "+27000000000",
  "prohibitedGoodsDeclared": true,
  "containsProhibitedGoods": false
}')
echo "$CREATE" | python3 -m json.tool
JOB=$(echo "$CREATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['job']['id'])")

echo "== Quote =="
QUOTE=$(curl -s -X POST "$BASE/v1/jobs/$JOB/quote" -H "$AUTH")
echo "$QUOTE" | python3 -m json.tool

echo "== Confirm =="
CONFIRM=$(curl -s -X POST "$BASE/v1/jobs/$JOB/confirm" -H "$AUTH")
echo "$CONFIRM" | python3 -m json.tool

echo "== Illegal confirm again (expect error) =="
curl -s -X POST "$BASE/v1/jobs/$JOB/confirm" -H "$AUTH" | python3 -m json.tool

echo "M3 smoke complete."
