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

echo "== Auth =="
SHIP=$(auth "ship-m6-$SUFFIX@swift.local")
SAUTH="authorization: Bearer $(echo "$SHIP" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")"

DISP=$(auth "disp-m6-$SUFFIX@swift.local")
D_ID=$(echo "$DISP" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
DAUTH="authorization: Bearer $(echo "$DISP" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")"
curl -s -X POST "$BASE/v1/dev/assign-role" -H 'content-type: application/json' \
  -d "{\"userId\":\"$D_ID\",\"role\":\"dispatcher\"}" >/dev/null

DRV=$(auth "drv-m6-$SUFFIX@swift.local")
DR_ID=$(echo "$DRV" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
DRAUTH="authorization: Bearer $(echo "$DRV" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")"
curl -s -X POST "$BASE/v1/dev/ensure-driver" -H 'content-type: application/json' \
  -d "{\"userId\":\"$DR_ID\",\"vehicleClass\":\"car\",\"homeZoneCode\":\"CPT-CBD\"}" >/dev/null

echo "== Driver home + duty =="
curl -s "$BASE/v1/drivers/me" -H "$DRAUTH" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['profile'] is not None; assert d['job'] is None"
curl -s -X POST "$BASE/v1/drivers/me/duty" -H "$DRAUTH" -H 'content-type: application/json' \
  -d '{"onDuty":true}' \
  | python3 -c "import sys,json; assert json.load(sys.stdin)['profile']['onDuty'] is True"

echo "== Book → pay → assign (require accept) =="
CREATE=$(curl -s -X POST "$BASE/v1/jobs" -H "$SAUTH" -H 'content-type: application/json' -d '{
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
curl -s -X POST "$BASE/v1/jobs/$JOB/quote" -H "$SAUTH" >/dev/null
curl -s -X POST "$BASE/v1/jobs/$JOB/confirm" -H "$SAUTH" -H 'content-type: application/json' \
  -d '{"methodRef":"tok_dev"}' >/dev/null
ASSIGN=$(curl -s -X POST "$BASE/v1/dispatch/jobs/$JOB/assign" -H "$DAUTH" -H 'content-type: application/json' \
  -d "{\"driverUserId\":\"$DR_ID\",\"requireAccept\":true}")
AID=$(echo "$ASSIGN" | python3 -c "import sys,json; print(json.load(sys.stdin)['assignment']['id'])")

echo "== Driver sees offer, accepts =="
curl -s "$BASE/v1/drivers/me" -H "$DRAUTH" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['assignment']['status']=='offered'; assert d['job']['id']"
curl -s -X POST "$BASE/v1/dispatch/assignments/$AID/accept" -H "$DRAUTH" -H 'content-type: application/json' \
  -d '{}' \
  | python3 -c "import sys,json; assert json.load(sys.stdin)['assignment']['status']=='active'"

echo "== Pickup → deliver via driver path =="
curl -s -X POST "$BASE/v1/jobs/$JOB/execution/en-route-pickup" -H "$DRAUTH" >/dev/null
curl -s -X POST "$BASE/v1/jobs/$JOB/execution/arrive-pickup" -H "$DRAUTH" >/dev/null
curl -s -X POST "$BASE/v1/jobs/$JOB/proofs" -H "$DRAUTH" -H 'content-type: application/json' \
  -d '{"kind":"pickup_photo","textContent":"parcel-ok","contentType":"text/plain"}' >/dev/null
curl -s -X POST "$BASE/v1/jobs/$JOB/execution/pickup" -H "$DRAUTH" \
  | python3 -c "import sys,json; assert json.load(sys.stdin)['job']['state']=='IN_TRANSIT'"
curl -s -X POST "$BASE/v1/jobs/$JOB/execution/arrive-dropoff" -H "$DRAUTH" >/dev/null
curl -s -X POST "$BASE/v1/jobs/$JOB/proofs" -H "$DRAUTH" -H 'content-type: application/json' \
  -d '{"kind":"dropoff_signature","textContent":"Ada signed","contentType":"text/plain"}' >/dev/null
curl -s -X POST "$BASE/v1/jobs/$JOB/execution/deliver" -H "$DRAUTH" -H 'content-type: application/json' \
  -d '{"lat":-33.916,"lng":18.388}' \
  | python3 -c "import sys,json; assert json.load(sys.stdin)['job']['state']=='DELIVERED'"

echo "== Earnings + emergency stub =="
curl -s "$BASE/v1/drivers/me/earnings" -H "$DRAUTH" \
  | python3 -c "import sys,json; assert isinstance(json.load(sys.stdin)['earnings'], list)"

# Second job for emergency freeze
CREATE2=$(curl -s -X POST "$BASE/v1/jobs" -H "$SAUTH" -H 'content-type: application/json' -d '{
  "serviceTypeCode": "standard",
  "packageClass": "small",
  "pickupAddress": "2 Long Street, Cape Town",
  "pickupZoneCode": "CPT-CBD",
  "pickupLat": -33.9249,
  "pickupLng": 18.4241,
  "dropoffAddress": "51 Main Road, Sea Point",
  "dropoffZoneCode": "CPT-ATL",
  "dropoffLat": -33.916,
  "dropoffLng": 18.388,
  "recipientName": "Bob",
  "recipientPhone": "+27000000001",
  "prohibitedGoodsDeclared": true,
  "containsProhibitedGoods": false
}')
JOB2=$(echo "$CREATE2" | python3 -c "import sys,json; print(json.load(sys.stdin)['job']['id'])")
curl -s -X POST "$BASE/v1/jobs/$JOB2/quote" -H "$SAUTH" >/dev/null
curl -s -X POST "$BASE/v1/jobs/$JOB2/confirm" -H "$SAUTH" -H 'content-type: application/json' \
  -d '{"methodRef":"tok_dev"}' >/dev/null
curl -s -X POST "$BASE/v1/dispatch/jobs/$JOB2/assign" -H "$DAUTH" -H 'content-type: application/json' \
  -d "{\"driverUserId\":\"$DR_ID\"}" >/dev/null
curl -s -X POST "$BASE/v1/drivers/me/emergency" -H "$DRAUTH" -H 'content-type: application/json' \
  -d '{"category":"medical","lat":-33.92,"lng":18.42}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['category']=='medical'; assert d['hold'] is not None"

echo "OK smoke:m6"
