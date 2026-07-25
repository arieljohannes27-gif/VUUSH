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
  local email="$2"
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

echo "== Admin auth =="
EMAIL="admin-m8b-$SUFFIX@swift.local"
RAW=$(auth "$EMAIL")
UID_VAL=$(echo "$RAW" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
curl -s -X POST "$BASE/v1/dev/assign-role" -H 'content-type: application/json' \
  -d "{\"userId\":\"$UID_VAL\",\"role\":\"administrator\"}" >/dev/null
curl -s -X POST "$BASE/v1/dev/reset-mfa" -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\"}" >/dev/null
RAW=$(auth "$EMAIL")
RAW=$(finish_mfa "$RAW" "$EMAIL")
AUTH="authorization: Bearer $(echo "$RAW" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")"

echo "== Home + catalogue =="
curl -s "$BASE/v1/admin/home" -H "$AUTH" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'zonesActive' in d and d['flags']>=1"

curl -s "$BASE/v1/admin/flags" -H "$AUTH" \
  | python3 -c "import sys,json; assert any(f['key']=='booking_enabled' for f in json.load(sys.stdin)['flags'])"

ZONE_CODE="CPT-M8B-$SUFFIX"
curl -s -X POST "$BASE/v1/admin/zones" -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"code\":\"$ZONE_CODE\",\"name\":\"Smoke Zone\",\"city\":\"Cape Town\",\"active\":true,\"reasonCode\":\"smoke_create\"}" \
  | python3 -c "import sys,json; assert json.load(sys.stdin)['zone']['code']"

curl -s -X PATCH "$BASE/v1/admin/flags/booking_enabled" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"enabled":false,"reasonCode":"smoke_flag"}' \
  | python3 -c "import sys,json; assert json.load(sys.stdin)['flag']['enabled'] is False"

echo "== Flag blocks booking confirm =="
CUST=$(auth "cust-m8b-$SUFFIX@swift.local")
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
BLOCK=$(curl -s -X POST "$BASE/v1/jobs/$JOB/confirm" -H "$CAUTH" -H 'content-type: application/json' \
  -d '{"methodRef":"tok_dev"}')
echo "$BLOCK" | python3 -c "import sys,json; assert json.load(sys.stdin).get('error')=='booking_disabled'"

curl -s -X PATCH "$BASE/v1/admin/flags/booking_enabled" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"enabled":true,"reasonCode":"smoke_restore"}' >/dev/null

curl -s "$BASE/v1/admin/audit?q=FLAG_UPDATED" -H "$AUTH" \
  | python3 -c "import sys,json; assert len(json.load(sys.stdin)['events'])>=1"

echo "OK smoke:m8b"
