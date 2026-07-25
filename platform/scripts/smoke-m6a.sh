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
SHIP=$(auth "ship-m6a-$SUFFIX@swift.local")
SAUTH="authorization: Bearer $(echo "$SHIP" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")"

DISP=$(auth "disp-m6a-$SUFFIX@swift.local")
D_ID=$(echo "$DISP" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
DAUTH="authorization: Bearer $(echo "$DISP" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")"
curl -s -X POST "$BASE/v1/dev/assign-role" -H 'content-type: application/json' \
  -d "{\"userId\":\"$D_ID\",\"role\":\"dispatcher\"}" >/dev/null

DRV=$(auth "drv-m6a-$SUFFIX@swift.local")
DR_ID=$(echo "$DRV" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
DRAUTH="authorization: Bearer $(echo "$DRV" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")"
curl -s -X POST "$BASE/v1/dev/ensure-driver" -H 'content-type: application/json' \
  -d "{\"userId\":\"$DR_ID\",\"vehicleClass\":\"car\",\"homeZoneCode\":\"CPT-CBD\"}" >/dev/null
curl -s -X POST "$BASE/v1/drivers/me/duty" -H "$DRAUTH" -H 'content-type: application/json' \
  -d '{"onDuty":true}' >/dev/null

echo "== Book → pay → assign =="
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
curl -s -X POST "$BASE/v1/dispatch/jobs/$JOB/assign" -H "$DAUTH" -H 'content-type: application/json' \
  -d "{\"driverUserId\":\"$DR_ID\"}" >/dev/null

echo "== Pickup without proof must fail =="
curl -s -X POST "$BASE/v1/jobs/$JOB/execution/en-route-pickup" -H "$DRAUTH" >/dev/null
curl -s -X POST "$BASE/v1/jobs/$JOB/execution/arrive-pickup" -H "$DRAUTH" >/dev/null
curl -s -X POST "$BASE/v1/jobs/$JOB/execution/pickup" -H "$DRAUTH" \
  | python3 -c "import sys,json; assert json.load(sys.stdin).get('error')=='pickup_proof_required'"

echo "== Pickup with proof =="
curl -s -X POST "$BASE/v1/jobs/$JOB/proofs" -H "$DRAUTH" -H 'content-type: application/json' \
  -d '{"kind":"pickup_photo","textContent":"parcel-at-door","contentType":"text/plain"}' >/dev/null
curl -s -X POST "$BASE/v1/jobs/$JOB/execution/pickup" -H "$DRAUTH" \
  | python3 -c "import sys,json; assert json.load(sys.stdin)['job']['state']=='IN_TRANSIT'"

echo "== Deliver without proof must fail =="
curl -s -X POST "$BASE/v1/jobs/$JOB/execution/arrive-dropoff" -H "$DRAUTH" >/dev/null
curl -s -X POST "$BASE/v1/jobs/$JOB/execution/deliver" -H "$DRAUTH" -H 'content-type: application/json' \
  -d '{"lat":-33.916,"lng":18.388}' \
  | python3 -c "import sys,json; assert json.load(sys.stdin).get('error')=='delivery_proof_required'"

echo "== Deliver far from dropoff must fail =="
curl -s -X POST "$BASE/v1/jobs/$JOB/proofs" -H "$DRAUTH" -H 'content-type: application/json' \
  -d '{"kind":"dropoff_signature","textContent":"Ada signed"}' >/dev/null
curl -s -X POST "$BASE/v1/jobs/$JOB/execution/deliver" -H "$DRAUTH" -H 'content-type: application/json' \
  -d '{"lat":-26.2041,"lng":28.0473}' \
  | python3 -c "import sys,json; assert json.load(sys.stdin).get('error')=='outside_dropoff_geofence'"

echo "== Deliver near dropoff with POD + GPS =="
curl -s -X POST "$BASE/v1/jobs/$JOB/execution/deliver" -H "$DRAUTH" -H 'content-type: application/json' \
  -d '{"lat":-33.916,"lng":18.388}' \
  | python3 -c "import sys,json; assert json.load(sys.stdin)['job']['state']=='DELIVERED'"

echo "== Proofs listed =="
curl -s "$BASE/v1/jobs/$JOB/proofs" -H "$DRAUTH" \
  | python3 -c "import sys,json; p=json.load(sys.stdin)['proofs']; assert len(p)>=2"

echo "M6a smoke complete."
