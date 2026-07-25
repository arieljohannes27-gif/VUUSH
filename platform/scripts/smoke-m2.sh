#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
SUFFIX=$(date +%s)

auth() {
  local dest="$1"
  local req challenge code verify
  req=$(curl -s -X POST "$BASE/v1/auth/otp/request" -H 'content-type: application/json' \
    -d "{\"channel\":\"email\",\"destination\":\"$dest\"}")
  challenge=$(echo "$req" | python3 -c "import sys,json; print(json.load(sys.stdin)['challengeId'])")
  code=$(echo "$req" | python3 -c "import sys,json; print(json.load(sys.stdin)['devCode'])")
  verify=$(curl -s -X POST "$BASE/v1/auth/otp/verify" -H 'content-type: application/json' \
    -d "{\"challengeId\":\"$challenge\",\"code\":\"$code\"}")
  echo "$verify"
}

echo "== Customer auth =="
CUST=$(auth "cust-m2-$SUFFIX@swift.local")
CAUTH="authorization: Bearer $(echo "$CUST" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")"

echo "== Book → quote → confirm =="
CREATE=$(curl -s -X POST "$BASE/v1/jobs" -H "$CAUTH" -H 'content-type: application/json' -d '{
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
JOB=$(echo "$CREATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['job']['id'])")
curl -s -X POST "$BASE/v1/jobs/$JOB/quote" -H "$CAUTH" >/dev/null
curl -s -X POST "$BASE/v1/jobs/$JOB/confirm" -H "$CAUTH" -H 'content-type: application/json' \
  -d '{"methodRef":"tok_dev"}' \
  | python3 -c "import sys,json; assert json.load(sys.stdin)['job']['state'] in ('CONFIRMED','SCHEDULED')"

echo "== List + track projection =="
curl -s "$BASE/v1/jobs" -H "$CAUTH" \
  | python3 -c "import sys,json; assert any(j['id']=='$JOB' for j in json.load(sys.stdin)['jobs'])"
curl -s "$BASE/v1/tracking/jobs/$JOB/projection" -H "$CAUTH" \
  | python3 -c "import sys,json; p=json.load(sys.stdin)['projection']; assert 'customerMessage' in p"

echo "== Mutation + support =="
curl -s -X POST "$BASE/v1/jobs/$JOB/mutations" -H "$CAUTH" -H 'content-type: application/json' \
  -d '{"dropoffAddress":"12 Beach Road, Sea Point","dropoffZoneCode":"CPT-ATL"}' \
  | python3 -c "import sys,json; assert json.load(sys.stdin)['status']=='pending'"
curl -s -X POST "$BASE/v1/support/cases" -H "$CAUTH" -H 'content-type: application/json' \
  -d "{\"subject\":\"Where is my parcel?\",\"message\":\"Need an update\",\"jobId\":\"$JOB\"}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin)['case']; assert d['status']=='open'; assert d.get('publicCode') or d.get('caseId')"

echo "OK smoke:m2"
