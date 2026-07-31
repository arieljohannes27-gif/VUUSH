#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
SUFFIX=$(date +%s)
DEST="${1:-finance-smoke-$SUFFIX@vuush.local}"
SUPPORT_DEST="${2:-support-smoke-$SUFFIX@vuush.local}"

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

echo "== Auth finance admin =="
FIN=$(auth "$DEST")
USER_ID=$(echo "$FIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
curl -s -X POST "$BASE/v1/dev/assign-role" -H 'content-type: application/json' \
  -d "{\"userId\":\"$USER_ID\",\"role\":\"finance_officer\"}" >/dev/null
curl -s -X POST "$BASE/v1/dev/assign-role" -H 'content-type: application/json' \
  -d "{\"userId\":\"$USER_ID\",\"role\":\"administrator\"}" >/dev/null
curl -s -X POST "$BASE/v1/dev/reset-mfa" -H 'content-type: application/json' \
  -d "{\"email\":\"$DEST\"}" >/dev/null
FIN=$(auth "$DEST")
FIN=$(finish_mfa "$FIN")
ACCESS=$(echo "$FIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")
AUTH="authorization: Bearer $ACCESS"

echo "== Finance home =="
HOME=$(curl -s "$BASE/v1/finance/home" -H "$AUTH")
echo "$HOME" | python3 -m json.tool
echo "$HOME" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'needsYou' in d, d; assert d['thresholdCents']>=1; assert d['companyIncome']['amountCents']==35000000, d; assert len(d['companyIncome']['supports'])==3, d"

echo "== Book + pay =="
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
JOB=$(echo "$CREATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['job']['id'])")
curl -s -X POST "$BASE/v1/jobs/$JOB/quote" -H "$AUTH" >/dev/null
CONFIRM=$(curl -s -X POST "$BASE/v1/jobs/$JOB/confirm" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"methodRef":"tok_dev"}')
AMOUNT=$(echo "$CONFIRM" | python3 -c "import sys,json; print(json.load(sys.stdin)['payment']['amountCents'])")

echo "== Payments list =="
curl -s "$BASE/v1/finance/payments" -H "$AUTH" | python3 -c "import sys,json; d=json.load(sys.stdin); assert len(d['payments'])>=1, d"

echo "== Lower threshold + Support large refund → finance queue =="
curl -s -X PATCH "$BASE/v1/admin/pricing-params/finance_credit_approve_above_cents" \
  -H "$AUTH" -H 'content-type: application/json' \
  -d '{"valueJson":{"cents":100},"reasonCode":"smoke_threshold"}' >/dev/null

SUP=$(auth "$SUPPORT_DEST")
SUP_ID=$(echo "$SUP" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
curl -s -X POST "$BASE/v1/dev/assign-role" -H 'content-type: application/json' \
  -d "{\"userId\":\"$SUP_ID\",\"role\":\"support_agent\"}" >/dev/null
curl -s -X POST "$BASE/v1/dev/reset-mfa" -H 'content-type: application/json' \
  -d "{\"email\":\"$SUPPORT_DEST\"}" >/dev/null
SUP=$(auth "$SUPPORT_DEST")
SUP=$(finish_mfa "$SUP")
SUP_ACCESS=$(echo "$SUP" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")
SUP_AUTH="authorization: Bearer $SUP_ACCESS"

REFUND=$(curl -s -X POST "$BASE/v1/jobs/$JOB/refunds" -H "$SUP_AUTH" -H 'content-type: application/json' \
  -d "{\"amountCents\":$AMOUNT,\"reasonCode\":\"smoke_credit\"}")
echo "$REFUND" | python3 -m json.tool
echo "$REFUND" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('status')=='needs_finance_approval', d"
ADJ=$(echo "$REFUND" | python3 -c "import sys,json; print(json.load(sys.stdin)['adjustmentId'])")

echo "== Approve adjustment =="
curl -s -X POST "$BASE/v1/finance/adjustments/$ADJ/approve" -H "$AUTH" -H 'content-type: application/json' -d '{}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('adjustment',{}).get('status')=='approved' or d.get('refund'), d"

echo "== Reconcile create + waive =="
ITEM=$(curl -s -X POST "$BASE/v1/finance/reconcile" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"source":"smoke","amountCents":123,"externalRef":"smoke-ref"}')
ITEM_ID=$(echo "$ITEM" | python3 -c "import sys,json; print(json.load(sys.stdin)['item']['id'])")
curl -s -X POST "$BASE/v1/finance/reconcile/$ITEM_ID/waive" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"notes":"smoke"}' | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['item']['status']=='waived'"

echo "== Credit note =="
curl -s -X POST "$BASE/v1/finance/credit-notes" -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"amountCents\":500,\"reasonCode\":\"smoke\",\"jobId\":\"$JOB\"}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['creditNote']['id']"

echo "== Export zip =="
FROM=$(python3 -c "from datetime import datetime,timedelta,timezone; print((datetime.now(timezone.utc)-timedelta(days=1)).isoformat())")
TO=$(python3 -c "from datetime import datetime,timezone; print(datetime.now(timezone.utc).isoformat())")
curl -s -X POST "$BASE/v1/finance/exports" -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"from\":\"$FROM\",\"to\":\"$TO\",\"datasets\":[\"payments\",\"earnings\"]}" \
  -o /tmp/vuush-finance-smoke.zip
python3 -c "import pathlib; b=pathlib.Path('/tmp/vuush-finance-smoke.zip').read_bytes(); assert b[:2]==b'PK', b[:20]; print('zip_ok', len(b))"

echo "== Audit pack =="
PACK=$(curl -s -X POST "$BASE/v1/admin/audit-packs" -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"from\":\"$FROM\",\"to\":\"$TO\"}")
PACK_ID=$(echo "$PACK" | python3 -c "import sys,json; print(json.load(sys.stdin)['pack']['id'])")
curl -s "$BASE/v1/admin/audit-packs/$PACK_ID/download" -H "$AUTH" -o /tmp/vuush-audit-smoke.zip
python3 -c "import pathlib; b=pathlib.Path('/tmp/vuush-audit-smoke.zip').read_bytes(); assert b[:2]==b'PK'; print('audit_zip_ok', len(b))"

echo "OK smoke:finance"
