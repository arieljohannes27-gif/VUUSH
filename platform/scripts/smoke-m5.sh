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
SHIP=$(auth "ship-m5-$SUFFIX@swift.local")
S_ACCESS=$(echo "$SHIP" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")
SAUTH="authorization: Bearer $S_ACCESS"

DISP=$(auth "disp-m5-$SUFFIX@swift.local")
D_ACCESS=$(echo "$DISP" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")
D_ID=$(echo "$DISP" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
DAUTH="authorization: Bearer $D_ACCESS"
curl -s -X POST "$BASE/v1/dev/assign-role" -H 'content-type: application/json' \
  -d "{\"userId\":\"$D_ID\",\"role\":\"dispatcher\"}" >/dev/null

DRV=$(auth "drv-m5-$SUFFIX@swift.local")
DR_ACCESS=$(echo "$DRV" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")
DR_ID=$(echo "$DRV" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
DRAUTH="authorization: Bearer $DR_ACCESS"
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

echo "== Tracking start + fresh =="
START=$(curl -s -X POST "$BASE/v1/tracking/sessions/start" -H "$DRAUTH" -H 'content-type: application/json' \
  -d "{\"jobId\":\"$JOB\"}")
SID=$(echo "$START" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['id'])")
curl -s -X POST "$BASE/v1/tracking/sessions/$SID/signals" -H "$DRAUTH" -H 'content-type: application/json' \
  -d '{"lat":-33.9249,"lng":18.4241,"accuracyM":12}' \
  | python3 -c "import sys,json; assert json.load(sys.stdin)['session']['integrityClass']=='fresh'"
curl -s "$BASE/v1/tracking/jobs/$JOB/projection" -H "$SAUTH" \
  | python3 -c "import sys,json; p=json.load(sys.stdin)['projection']; assert p['showLiveMotion'] is True"

echo "== Teleport → conflicted (no live motion) =="
curl -s -X POST "$BASE/v1/tracking/sessions/$SID/signals" -H "$DRAUTH" -H 'content-type: application/json' \
  -d '{"lat":-26.2041,"lng":28.0473}' \
  | python3 -c "import sys,json; assert json.load(sys.stdin)['session']['integrityClass']=='conflicted'"
curl -s "$BASE/v1/tracking/jobs/$JOB/projection" -H "$SAUTH" \
  | python3 -c "import sys,json; p=json.load(sys.stdin)['projection']; assert p['showLiveMotion'] is False"

echo "== Recover then lose signal =="
curl -s -X POST "$BASE/v1/tracking/sessions/$SID/signals" -H "$DRAUTH" -H 'content-type: application/json' \
  -d '{"lat":-33.925,"lng":18.4245}' >/dev/null
if date -u -v-200S +"%Y-%m-%dT%H:%M:%SZ" >/dev/null 2>&1; then
  OLD=$(date -u -v-200S +"%Y-%m-%dT%H:%M:%SZ")
else
  OLD=$(date -u -d '200 seconds ago' +"%Y-%m-%dT%H:%M:%SZ")
fi
curl -s -X POST "$BASE/v1/dev/tracking/ping" -H 'content-type: application/json' \
  -d "{\"sessionId\":\"$SID\",\"actorUserId\":\"$DR_ID\",\"lat\":-33.9251,\"lng\":18.4246,\"recordedAt\":\"$OLD\"}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['session']['status']=='lost', d"
TASKS=$(curl -s "$BASE/v1/dispatch/lost-signal-tasks" -H "$DAUTH")
echo "$TASKS" | python3 -c "import sys,json; t=json.load(sys.stdin)['tasks']; assert len(t)>=1, t"
TID=$(echo "$TASKS" | python3 -c "import sys,json; print(json.load(sys.stdin)['tasks'][0]['id'])")
curl -s -X POST "$BASE/v1/dispatch/lost-signal-tasks/$TID/ack" -H "$DAUTH" \
  | python3 -c "import sys,json; assert json.load(sys.stdin)['task']['status']=='acked'"

echo "== Board positions =="
curl -s "$BASE/v1/dispatch/board-positions" -H "$DAUTH" | python3 -m json.tool

echo "M5 smoke complete."
