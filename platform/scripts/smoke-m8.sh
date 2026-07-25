#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
SUFFIX=$(date +%s)
DEST="${1:-payer-m8-$SUFFIX@swift.local}"
DRIVER_DEST="${2:-driver-m8-$SUFFIX@swift.local}"

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

echo "== Auth payer =="
PAYER=$(auth "$DEST")
ACCESS=$(echo "$PAYER" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['accessToken'])")
PAYER_ID=$(echo "$PAYER" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
AUTH="authorization: Bearer $ACCESS"

echo "== Auth driver =="
DRIVER=$(auth "$DRIVER_DEST")
DRIVER_ID=$(echo "$DRIVER" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")

echo "== Promote payer to finance_officer + administrator =="
curl -s -X POST "$BASE/v1/dev/assign-role" -H 'content-type: application/json' \
  -d "{\"userId\":\"$PAYER_ID\",\"role\":\"finance_officer\"}" | python3 -m json.tool >/dev/null
curl -s -X POST "$BASE/v1/dev/assign-role" -H 'content-type: application/json' \
  -d "{\"userId\":\"$PAYER_ID\",\"role\":\"administrator\"}" | python3 -m json.tool >/dev/null

echo "== Book + quote =="
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

echo "== Decline path (tok_fail) =="
FAIL_JOB_CREATE=$(curl -s -X POST "$BASE/v1/jobs" -H "$AUTH" -H 'content-type: application/json' -d '{
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
FAIL_JOB=$(echo "$FAIL_JOB_CREATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['job']['id'])")
curl -s -X POST "$BASE/v1/jobs/$FAIL_JOB/quote" -H "$AUTH" >/dev/null
DECLINE=$(curl -s -X POST "$BASE/v1/jobs/$FAIL_JOB/confirm" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"methodRef":"tok_fail"}')
echo "$DECLINE" | python3 -m json.tool
echo "$DECLINE" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('error')=='card_declined_stub', d"

echo "== Confirm with capture =="
CONFIRM=$(curl -s -X POST "$BASE/v1/jobs/$JOB/confirm" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"methodRef":"tok_dev"}')
echo "$CONFIRM" | python3 -m json.tool
echo "$CONFIRM" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['job']['paymentStatus']=='captured'; assert d['payment']['status']=='captured'"
# Harden: local RC stays on stub factory (Paystack is opt-in via env)
echo "$CONFIRM" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['payment']['provider']=='dev_stub', d['payment']"

PROVIDER_PAYMENT_ID=$(echo "$CONFIRM" | python3 -c "import sys,json; print(json.load(sys.stdin)['payment']['providerPaymentId'])")
QUOTE_TOTAL=$(echo "$CONFIRM" | python3 -c "import sys,json; print(json.load(sys.stdin)['quote']['totalCents'])")
EARN_EXPECTED=$(python3 -c "print(round(int('$QUOTE_TOTAL') * 0.75))")

echo "== List payments =="
curl -s "$BASE/v1/jobs/$JOB/payments" -H "$AUTH" | python3 -m json.tool

echo "== Webhook idempotency =="
WH1=$(curl -s -X POST "$BASE/v1/payments/webhooks/dev_stub" -H 'content-type: application/json' \
  -d "{\"eventId\":\"smoke_evt_1\",\"type\":\"payment.updated\",\"providerPaymentId\":\"$PROVIDER_PAYMENT_ID\",\"status\":\"captured\"}")
WH2=$(curl -s -X POST "$BASE/v1/payments/webhooks/dev_stub" -H 'content-type: application/json' \
  -d "{\"eventId\":\"smoke_evt_1\",\"type\":\"payment.updated\",\"providerPaymentId\":\"$PROVIDER_PAYMENT_ID\",\"status\":\"captured\"}")
echo "$WH1" | python3 -m json.tool
echo "$WH2" | python3 -m json.tool
echo "$WH2" | python3 -c "import sys,json; assert json.load(sys.stdin).get('duplicate') is True"

echo "== Assign driver + payout batch =="
curl -s -X POST "$BASE/v1/finance/earnings/$JOB/assign-driver" -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"driverUserId\":\"$DRIVER_ID\"}" | python3 -m json.tool
BATCH=$(curl -s -X POST "$BASE/v1/finance/payout-batches" -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"driverUserId\":\"$DRIVER_ID\"}")
echo "$BATCH" | python3 -m json.tool
BATCH_ID=$(echo "$BATCH" | python3 -c "import sys,json; print(json.load(sys.stdin)['batch']['id'])")
echo "$BATCH" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['item'].get('providerTransferId') in (None, ''), d"
EXEC=$(curl -s -X POST "$BASE/v1/finance/payout-batches/$BATCH_ID/execute" -H "$AUTH")
echo "$EXEC" | python3 -m json.tool
echo "$EXEC" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['batch']['status']=='executed', d"

echo "== Freeze earnings on second job (no payout expected) =="
JOB2_CREATE=$(curl -s -X POST "$BASE/v1/jobs" -H "$AUTH" -H 'content-type: application/json' -d '{
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
JOB2=$(echo "$JOB2_CREATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['job']['id'])")
curl -s -X POST "$BASE/v1/jobs/$JOB2/quote" -H "$AUTH" >/dev/null
curl -s -X POST "$BASE/v1/jobs/$JOB2/confirm" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"methodRef":"tok_dev"}' >/dev/null
curl -s -X POST "$BASE/v1/finance/earnings/$JOB2/assign-driver" -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"driverUserId\":\"$DRIVER_ID\"}" >/dev/null
curl -s -X POST "$BASE/v1/finance/earnings/$JOB2/freeze" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"reason":"incident_hold"}' | python3 -m json.tool
FROZEN=$(curl -s -X POST "$BASE/v1/finance/payout-batches" -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"driverUserId\":\"$DRIVER_ID\"}")
echo "$FROZEN" | python3 -m json.tool
echo "$FROZEN" | python3 -c "import sys,json; assert json.load(sys.stdin).get('error')=='no_payable_earnings'"

echo "== Harden H3: finance read APIs =="
EARNINGS=$(curl -s "$BASE/v1/finance/earnings?status=pending" -H "$AUTH")
echo "$EARNINGS" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'earnings' in d, d"
BATCHES=$(curl -s "$BASE/v1/finance/payout-batches" -H "$AUTH")
echo "$BATCHES" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'batches' in d and len(d['batches'])>=1, d"
MONEY=$(curl -s "$BASE/v1/finance/jobs/$JOB/money" -H "$AUTH")
echo "$MONEY" | python3 -m json.tool
echo "$MONEY" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['job']['id']=='$JOB'; assert len(d['payments'])>=1; e=d['earnings'][0]; assert e['amountCents']==$EARN_EXPECTED, (e['amountCents'], $EARN_EXPECTED)"

echo "== Harden H4: incident hold auto-freezes earnings =="
JOB3_CREATE=$(curl -s -X POST "$BASE/v1/jobs" -H "$AUTH" -H 'content-type: application/json' -d '{
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
JOB3=$(echo "$JOB3_CREATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['job']['id'])")
curl -s -X POST "$BASE/v1/jobs/$JOB3/quote" -H "$AUTH" >/dev/null
curl -s -X POST "$BASE/v1/jobs/$JOB3/confirm" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"methodRef":"tok_dev"}' >/dev/null
curl -s -X POST "$BASE/v1/finance/earnings/$JOB3/assign-driver" -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"driverUserId\":\"$DRIVER_ID\"}" >/dev/null
HOLD=$(curl -s -X POST "$BASE/v1/dispatch/jobs/$JOB3/holds" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"holdType":"INCIDENT_HOLD","reasonCode":"emergency_threat"}')
echo "$HOLD" | python3 -m json.tool
HOLD_ID=$(echo "$HOLD" | python3 -c "import sys,json; print(json.load(sys.stdin)['hold']['id'])")
MONEY3=$(curl -s "$BASE/v1/finance/jobs/$JOB3/money" -H "$AUTH")
echo "$MONEY3" | python3 -c "import sys,json; d=json.load(sys.stdin); e=d['earnings'][0]; assert e['frozen'] is True, e; assert e['freezeReason']=='incident_security', e"
curl -s -X POST "$BASE/v1/dispatch/holds/$HOLD_ID/release" -H "$AUTH" | python3 -m json.tool >/dev/null
MONEY3B=$(curl -s "$BASE/v1/finance/jobs/$JOB3/money" -H "$AUTH")
echo "$MONEY3B" | python3 -c "import sys,json; d=json.load(sys.stdin); e=d['earnings'][0]; assert e['frozen'] is False, e"

if [[ "${PAYSTACK_SMOKE:-}" == "1" ]]; then
  echo "== Optional Paystack sandbox smoke =="
  echo "Set PSP_PROVIDER=paystack + keys, then exercise initialize / webhook manually."
  echo "Automated Paystack charge is skipped in CI (requires live sandbox card / AUTH_)."
else
  echo "== Paystack sandbox smoke skipped (set PAYSTACK_SMOKE=1 to note path) =="
fi

echo "M8 smoke complete (Harden H1–H5 stub path)."
