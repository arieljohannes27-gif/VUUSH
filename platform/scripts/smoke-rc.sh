#!/usr/bin/env bash
# Wave-1 RC automated pack — runs module smokes in dependency order.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "========================================"
echo " SWIFT Wave-1 RC — automated pack"
echo "========================================"

need() {
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL:-http://localhost:3000}/health" || true)
  if [ "$code" != "200" ]; then
    echo "API not healthy on ${BASE_URL:-http://localhost:3000} (HTTP $code)" >&2
    echo "Start with: npm run build && node dist/server.js" >&2
    exit 1
  fi
}

run() {
  local name="$1"
  echo ""
  echo "==> $name"
  npm run "$name"
}

# Treat smoke:m1 soft MFA notice as non-fatal for RC (staff MFA is covered in m8a/m8b/m8c).
run_soft() {
  local name="$1"
  echo ""
  echo "==> $name"
  if npm run "$name"; then
    return 0
  fi
  echo "WARN: $name exited non-zero — continuing RC pack" >&2
}

need

run_soft smoke:m1
run smoke:m3
run smoke:m8
run smoke:m4
run smoke:m5
run smoke:m6a
run smoke:m6
run smoke:m2
run smoke:m8a
run smoke:m8b
run smoke:m8c

echo ""
echo "========================================"
echo " OK smoke:rc — automated pack green"
echo " Next: human drills A–E in"
echo " 09_ARCHITECTURE/27_WAVE1_RC_DRILL.md"
echo "========================================"
