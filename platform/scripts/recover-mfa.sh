#!/usr/bin/env bash
# Recover staff authenticator setup key (email OTP proof).
set -euo pipefail
API="${API:-https://vuush-production.up.railway.app}"

printf "Login email: "
read -r EMAIL
EMAIL="$(echo "$EMAIL" | tr '[:upper:]' '[:lower:]' | xargs)"

echo "Sending email code…"
RESP="$(curl -sS -X POST "$API/v1/auth/otp/request" \
  -H 'content-type: application/json' \
  -d "{\"channel\":\"email\",\"destination\":\"$EMAIL\"}")"

CHALLENGE="$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d.get('challengeId',''))" "$RESP")"
if [ -z "$CHALLENGE" ]; then
  echo "Could not send code. Response: $RESP"
  exit 1
fi
echo "Code sent. Check your inbox."

printf "Paste the code from your EMAIL: "
read -r CODE

REC="$(curl -sS -X POST "$API/v1/auth/mfa/recover" \
  -H 'content-type: application/json' \
  -d "{\"challengeId\":\"$CHALLENGE\",\"code\":\"$CODE\"}")"

python3 -c "
import json,sys
d=json.loads(sys.argv[1])
if d.get('totpSecret'):
  print()
  print('=== COPY THIS KEY INTO GOOGLE AUTHENTICATOR ===')
  print(d['totpSecret'])
  print('==============================================')
  print('Phone: Google Authenticator → + → Enter a setup key → paste')
  print('Then open Dispatch and use the 6-digit app code.')
else:
  print('Failed:', d)
" "$REC"
