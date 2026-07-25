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

echo "== Customer books + opens case =="
CUST=$(auth "cust-m8a-$SUFFIX@swift.local")
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

CASE=$(curl -s -X POST "$BASE/v1/support/cases" -H "$CAUTH" -H 'content-type: application/json' \
  -d "{\"subject\":\"Late delivery\",\"message\":\"Still waiting\",\"jobId\":\"$JOB\"}")
CID=$(echo "$CASE" | python3 -c "import sys,json; print(json.load(sys.stdin)['case']['caseId'])")
echo "$CASE" | python3 -c "import sys,json; assert json.load(sys.stdin)['case']['publicCode'].startswith('SU-')"

echo "== Agent desk =="
AGENT=$(auth "agent-m8a-$SUFFIX@swift.local")
A_ID=$(echo "$AGENT" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
# first login as customer then assign role; re-auth after MFA reset if needed
curl -s -X POST "$BASE/v1/dev/assign-role" -H 'content-type: application/json' \
  -d "{\"userId\":\"$A_ID\",\"role\":\"support_agent\"}" >/dev/null
curl -s -X POST "$BASE/v1/dev/reset-mfa" -H 'content-type: application/json' \
  -d "{\"email\":\"agent-m8a-$SUFFIX@swift.local\"}" >/dev/null
AGENT=$(auth "agent-m8a-$SUFFIX@swift.local")
# enroll MFA if required
STATUS=$(echo "$AGENT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")
if [ "$STATUS" = "mfa_enroll_required" ] || [ "$STATUS" = "mfa_required" ]; then
  MFA_TOKEN=$(echo "$AGENT" | python3 -c "import sys,json; print(json.load(sys.stdin)['mfa']['mfaToken'])")
  SECRET=$(echo "$AGENT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('totpSecret') or '')")
  if [ -z "$SECRET" ]; then
    echo "missing totp secret after reset" >&2
    exit 1
  fi
  CODE=$(python3 - <<PY
import hmac, struct, time, base64, hashlib
secret=base64.b32decode("$SECRET" + "=" * ((8 - len("$SECRET") % 8) % 8))
counter=int(time.time())//30
msg=struct.pack(">Q", counter)
digest=hmac.new(secret, msg, hashlib.sha1).digest()
o=digest[-1]&0xf
code=((digest[o]&0x7f)<<24|(digest[o+1]&0xff)<<16|(digest[o+2]&0xff)<<8|(digest[o+3]&0xff))%1000000
print(f"{code:06d}")
PY
)
  AGENT=$(curl -s -X POST "$BASE/v1/auth/mfa/verify" -H 'content-type: application/json' \
    -d "{\"mfaToken\":\"$MFA_TOKEN\",\"code\":\"$CODE\"}")
fi
AAUTH="authorization: Bearer $(echo "$AGENT" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")"

curl -s "$BASE/v1/support/desk/cases" -H "$AAUTH" \
  | python3 -c "import sys,json; assert any(c['id']=='$CID' for c in json.load(sys.stdin)['cases'])"

curl -s -X POST "$BASE/v1/support/cases/$CID/messages" -H "$AAUTH" -H 'content-type: application/json' \
  -d '{"body":"We are checking with the driver."}' >/dev/null

curl -s -X POST "$BASE/v1/support/desk/cases/$CID/escalate" -H "$AAUTH" -H 'content-type: application/json' \
  -d '{"reasonCode":"support_escalation","note":"Need ops"}' \
  | python3 -c "import sys,json; assert json.load(sys.stdin)['case']['status']=='escalated'"

curl -s -X POST "$BASE/v1/support/desk/cases/$CID/refund" -H "$AAUTH" -H 'content-type: application/json' \
  -d '{"reasonCode":"support_goodwill"}' >/dev/null

curl -s -X POST "$BASE/v1/support/desk/cases/$CID/resolve" -H "$AAUTH" -H 'content-type: application/json' \
  -d '{"note":"Refunded and closed"}' \
  | python3 -c "import sys,json; assert json.load(sys.stdin)['case']['status']=='resolved'"

echo "OK smoke:m8a"
