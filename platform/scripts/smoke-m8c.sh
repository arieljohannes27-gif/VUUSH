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

echo "== Book + assign driver =="
CUST=$(auth "cust-m8c-$SUFFIX@swift.local")
CAUTH="authorization: Bearer $(echo "$CUST" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")"
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
  -d '{"methodRef":"tok_dev"}' >/dev/null

DRV_EMAIL="drv-m8c-$SUFFIX@swift.local"
DRV=$(auth "$DRV_EMAIL")
DRV_ID=$(echo "$DRV" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
curl -s -X POST "$BASE/v1/dev/ensure-driver" -H 'content-type: application/json' \
  -d "{\"userId\":\"$DRV_ID\",\"vehicleClass\":\"car\",\"homeZoneCode\":\"CPT-CBD\"}" >/dev/null
DAUTH="authorization: Bearer $(echo "$DRV" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")"
curl -s -X POST "$BASE/v1/drivers/me/duty" -H "$DAUTH" -H 'content-type: application/json' \
  -d '{"onDuty":true}' >/dev/null

DISP_EMAIL="disp-m8c-$SUFFIX@swift.local"
DISP=$(auth "$DISP_EMAIL")
DISP_ID=$(echo "$DISP" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
curl -s -X POST "$BASE/v1/dev/assign-role" -H 'content-type: application/json' \
  -d "{\"userId\":\"$DISP_ID\",\"role\":\"dispatcher\"}" >/dev/null
curl -s -X POST "$BASE/v1/dev/reset-mfa" -H 'content-type: application/json' \
  -d "{\"email\":\"$DISP_EMAIL\"}" >/dev/null
DISP=$(auth "$DISP_EMAIL")
DISP=$(finish_mfa "$DISP")
SAUTH="authorization: Bearer $(echo "$DISP" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")"

curl -s -X POST "$BASE/v1/dispatch/jobs/$JOB/assign" -H "$SAUTH" -H 'content-type: application/json' \
  -d "{\"driverUserId\":\"$DRV_ID\",\"requireAccept\":false}" >/dev/null

echo "== WC-01 medical emergency =="
EM=$(curl -s -X POST "$BASE/v1/drivers/me/emergency" -H "$DAUTH" -H 'content-type: application/json' \
  -d '{"category":"medical","note":"Chest pain","lat":-33.92,"lng":18.42}')
INC=$(echo "$EM" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['incident']['playbook']=='WC-01'; assert d['incident']['nonPunitive'] is True; print(d['incident']['id'])")

curl -s "$BASE/v1/dispatch/incidents" -H "$SAUTH" \
  | python3 -c "import sys,json; assert any(i['id']=='$INC' for i in json.load(sys.stdin)['incidents'])"

curl -s -X POST "$BASE/v1/dispatch/incidents/$INC/acknowledge" -H "$SAUTH" -H 'content-type: application/json' -d '{}' \
  | python3 -c "import sys,json; assert json.load(sys.stdin)['incident']['status']=='acknowledged'"

PROJ=$(curl -s "$BASE/v1/tracking/jobs/$JOB/projection" -H "$CAUTH")
echo "$PROJ" | python3 -c "import sys,json; d=json.load(sys.stdin)['projection']; assert d.get('incidentPause'); assert 'medical' in d['incidentPause']['message'].lower() or 'paused' in d['customerMessage'].lower()"

curl -s -X POST "$BASE/v1/dispatch/incidents/$INC/resolve" -H "$SAUTH" -H 'content-type: application/json' \
  -d '{"resolutionCode":"medical_cleared","releaseHold":true}' \
  | python3 -c "import sys,json; assert json.load(sys.stdin)['incident']['status']=='resolved'"

echo "== WC-02 threat path =="
# new job for threat
CREATE2=$(curl -s -X POST "$BASE/v1/jobs" -H "$CAUTH" -H 'content-type: application/json' -d '{
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
curl -s -X POST "$BASE/v1/jobs/$JOB2/quote" -H "$CAUTH" >/dev/null
curl -s -X POST "$BASE/v1/jobs/$JOB2/confirm" -H "$CAUTH" -H 'content-type: application/json' \
  -d '{"methodRef":"tok_dev"}' >/dev/null
curl -s -X POST "$BASE/v1/dispatch/jobs/$JOB2/assign" -H "$SAUTH" -H 'content-type: application/json' \
  -d "{\"driverUserId\":\"$DRV_ID\",\"requireAccept\":false}" >/dev/null

EM2=$(curl -s -X POST "$BASE/v1/drivers/me/emergency" -H "$DAUTH" -H 'content-type: application/json' \
  -d '{"category":"threat","note":"Suspicious package"}')
INC2=$(echo "$EM2" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['incident']['playbook']=='WC-02'; assert d['incident']['doNotNormalReturn'] is True; print(d['incident']['id'])")

PROJ2=$(curl -s "$BASE/v1/tracking/jobs/$JOB2/projection" -H "$CAUTH")
echo "$PROJ2" | python3 -c "import sys,json; d=json.load(sys.stdin)['projection']['incidentPause']; assert d['categoryBucket']=='safety'; assert 'explosive' not in d['message'].lower()"

# bad release should fail
BAD=$(curl -s -X POST "$BASE/v1/dispatch/incidents/$INC2/resolve" -H "$SAUTH" -H 'content-type: application/json' \
  -d '{"resolutionCode":"medical_cleared","releaseHold":true}')
echo "$BAD" | python3 -c "import sys,json; assert json.load(sys.stdin).get('error')=='threat_hold_release_blocked'"

curl -s -X POST "$BASE/v1/dispatch/incidents/$INC2/resolve" -H "$SAUTH" -H 'content-type: application/json' \
  -d '{"resolutionCode":"external_emergency_handled","releaseHold":true}' \
  | python3 -c "import sys,json; assert json.load(sys.stdin)['incident']['status']=='resolved'"

echo "OK smoke:m8c"
