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

finish_mfa() {
  local payload="$1"
  local status
  status=$(echo "$payload" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")
  if [ "$status" != "mfa_enroll_required" ] && [ "$status" != "mfa_required" ]; then
    echo "$payload"
    return
  fi
  local mfa_token secret code
  mfa_token=$(echo "$payload" | python3 -c "import sys,json; print(json.load(sys.stdin)['mfa']['mfaToken'])")
  secret=$(echo "$payload" | python3 -c "import sys,json; print(json.load(sys.stdin).get('totpSecret') or '')")
  if [ -z "$secret" ]; then
    echo "missing totp secret" >&2
    exit 1
  fi
  code=$(python3 - <<PY
import hmac, struct, time, base64, hashlib
secret=base64.b32decode("$secret" + "=" * ((8 - len("$secret") % 8) % 8))
counter=int(time.time())//30
msg=struct.pack(">Q", counter)
digest=hmac.new(secret, msg, hashlib.sha1).digest()
o=digest[-1]&0xf
code=((digest[o]&0x7f)<<24|(digest[o+1]&0xff)<<16|(digest[o+2]&0xff)<<8|(digest[o+3]&0xff))%1000000
print(f"{code:06d}")
PY
)
  curl -s -X POST "$BASE/v1/auth/mfa/verify" -H 'content-type: application/json' \
    -d "{\"mfaToken\":\"$mfa_token\",\"code\":\"$code\"}"
}

echo "== Auth actors =="
DISP_EMAIL="disp-m4-$SUFFIX@swift.local"
DISPATCHER=$(auth "$DISP_EMAIL")
D_ID=$(echo "$DISPATCHER" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
curl -s -X POST "$BASE/v1/dev/assign-role" -H 'content-type: application/json' \
  -d "{\"userId\":\"$D_ID\",\"role\":\"dispatcher\"}" >/dev/null
curl -s -X POST "$BASE/v1/dev/reset-mfa" -H 'content-type: application/json' \
  -d "{\"email\":\"$DISP_EMAIL\"}" >/dev/null
DISPATCHER=$(auth "$DISP_EMAIL")
DISPATCHER=$(finish_mfa "$DISPATCHER")
D_ACCESS=$(echo "$DISPATCHER" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")
DAUTH="authorization: Bearer $D_ACCESS"

SHIPPER=$(auth "shipper-m4-$SUFFIX@swift.local")
S_ACCESS=$(echo "$SHIPPER" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")
SAUTH="authorization: Bearer $S_ACCESS"

DRIVER1=$(auth "driver1-m4-$SUFFIX@swift.local")
DR1_ID=$(echo "$DRIVER1" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
DR1_ACCESS=$(echo "$DRIVER1" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")
DR1AUTH="authorization: Bearer $DR1_ACCESS"

DRIVER2=$(auth "driver2-m4-$SUFFIX@swift.local")
DR2_ID=$(echo "$DRIVER2" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
DR2_ACCESS=$(echo "$DRIVER2" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")
DR2AUTH="authorization: Bearer $DR2_ACCESS"

echo "== Ensure drivers + on duty =="
curl -s -X POST "$BASE/v1/dev/ensure-driver" -H 'content-type: application/json' \
  -d "{\"userId\":\"$DR1_ID\",\"vehicleClass\":\"car\",\"homeZoneCode\":\"CPT-CBD\"}" | python3 -m json.tool
curl -s -X POST "$BASE/v1/dev/ensure-driver" -H 'content-type: application/json' \
  -d "{\"userId\":\"$DR2_ID\",\"vehicleClass\":\"van\",\"homeZoneCode\":\"CPT-ATL\"}" | python3 -m json.tool
curl -s -X POST "$BASE/v1/drivers/me/duty" -H "$DR1AUTH" -H 'content-type: application/json' \
  -d '{"onDuty":true}' | python3 -m json.tool
curl -s -X POST "$BASE/v1/drivers/me/duty" -H "$DR2AUTH" -H 'content-type: application/json' \
  -d '{"onDuty":true}' | python3 -m json.tool

echo "== Book → quote → confirm =="
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
CONFIRM=$(curl -s -X POST "$BASE/v1/jobs/$JOB/confirm" -H "$SAUTH" -H 'content-type: application/json' \
  -d '{"methodRef":"tok_dev"}')
echo "$CONFIRM" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['job']['state']=='CONFIRMED'"

echo "== Queue + eligible =="
curl -s "$BASE/v1/dispatch/queue" -H "$DAUTH" | python3 -c "import sys,json; q=json.load(sys.stdin)['queue']; assert any(x['job']['id']=='$JOB' for x in q)"
curl -s "$BASE/v1/dispatch/jobs/$JOB/eligible-drivers" -H "$DAUTH" | python3 -m json.tool

echo "== Hold blocks assign =="
HOLD=$(curl -s -X POST "$BASE/v1/dispatch/jobs/$JOB/holds" -H "$DAUTH" -H 'content-type: application/json' \
  -d '{"holdType":"DISPATCH_HOLD","reasonCode":"capacity_check"}')
HOLD_ID=$(echo "$HOLD" | python3 -c "import sys,json; print(json.load(sys.stdin)['hold']['id'])")
BLOCKED=$(curl -s -X POST "$BASE/v1/dispatch/jobs/$JOB/assign" -H "$DAUTH" -H 'content-type: application/json' \
  -d "{\"driverUserId\":\"$DR1_ID\"}")
echo "$BLOCKED" | python3 -c "import sys,json; assert json.load(sys.stdin).get('error')=='job_on_hold'"
curl -s -X POST "$BASE/v1/dispatch/holds/$HOLD_ID/release" -H "$DAUTH" >/dev/null

echo "== Direct assign =="
ASSIGN=$(curl -s -X POST "$BASE/v1/dispatch/jobs/$JOB/assign" -H "$DAUTH" -H 'content-type: application/json' \
  -d "{\"driverUserId\":\"$DR1_ID\"}")
echo "$ASSIGN" | python3 -m json.tool
echo "$ASSIGN" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['assignment']['status']=='active'"

DETAIL=$(curl -s "$BASE/v1/dispatch/jobs/$JOB" -H "$DAUTH")
echo "$DETAIL" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['job']['state']=='ASSIGNED'"

echo "== Reassign with reason =="
RE=$(curl -s -X POST "$BASE/v1/dispatch/jobs/$JOB/reassign" -H "$DAUTH" -H 'content-type: application/json' \
  -d "{\"driverUserId\":\"$DR2_ID\",\"reasonCode\":\"fairness_rebalance\"}")
echo "$RE" | python3 -m json.tool
echo "$RE" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['assignment']['mode']=='reassign'; assert d['assignment']['driverUserId']=='$DR2_ID'"

echo "== Backup path =="
# new job for backup after assign
CREATE2=$(curl -s -X POST "$BASE/v1/jobs" -H "$SAUTH" -H 'content-type: application/json' -d '{
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
JOB2=$(echo "$CREATE2" | python3 -c "import sys,json; print(json.load(sys.stdin)['job']['id'])")
curl -s -X POST "$BASE/v1/jobs/$JOB2/quote" -H "$SAUTH" >/dev/null
curl -s -X POST "$BASE/v1/jobs/$JOB2/confirm" -H "$SAUTH" -H 'content-type: application/json' \
  -d '{"methodRef":"tok_dev"}' >/dev/null
curl -s -X POST "$BASE/v1/dispatch/jobs/$JOB2/assign" -H "$DAUTH" -H 'content-type: application/json' \
  -d "{\"driverUserId\":\"$DR1_ID\"}" >/dev/null
BACKUP=$(curl -s -X POST "$BASE/v1/dispatch/jobs/$JOB2/backup" -H "$DAUTH" -H 'content-type: application/json' \
  -d "{\"driverUserId\":\"$DR2_ID\",\"reasonCode\":\"driver_no_show\",\"custodyHandoffRequired\":false}")
echo "$BACKUP" | python3 -m json.tool
echo "$BACKUP" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['assignment']['mode']=='backup'; assert d['assignment']['status']=='active'"

echo "== Offer + accept =="
CREATE3=$(curl -s -X POST "$BASE/v1/jobs" -H "$SAUTH" -H 'content-type: application/json' -d '{
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
JOB3=$(echo "$CREATE3" | python3 -c "import sys,json; print(json.load(sys.stdin)['job']['id'])")
curl -s -X POST "$BASE/v1/jobs/$JOB3/quote" -H "$SAUTH" >/dev/null
curl -s -X POST "$BASE/v1/jobs/$JOB3/confirm" -H "$SAUTH" -H 'content-type: application/json' \
  -d '{"methodRef":"tok_dev"}' >/dev/null
OFFER=$(curl -s -X POST "$BASE/v1/dispatch/jobs/$JOB3/assign" -H "$DAUTH" -H 'content-type: application/json' \
  -d "{\"driverUserId\":\"$DR1_ID\",\"requireAccept\":true}")
AID=$(echo "$OFFER" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['assignment']['status']=='offered'; print(d['assignment']['id'])")
ACCEPT=$(curl -s -X POST "$BASE/v1/dispatch/assignments/$AID/accept" -H "$DR1AUTH")
echo "$ACCEPT" | python3 -c "import sys,json; assert json.load(sys.stdin)['assignment']['status']=='active'"

echo "M4 smoke complete."
