#!/bin/sh
# Runs the widget self-test pages in headless Chrome and fails on any FAIL line.
# Override the browser with CHROME=/path/to/chrome.
# Pages are served over a local HTTP server rather than file:// so history.replaceState
# (used to vary ?variant=) behaves as on a real storefront.
set -u
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${SELFTEST_PORT:-8765}"
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1
status=0
for page in index.html harness/triggers.html harness/optins.html harness/config.html harness/config-fallback.html harness/config-invalid.html harness/copy.html harness/summary.html; do
  out="$("$CHROME" --headless=new --disable-gpu \
    --virtual-time-budget=5000 --dump-dom "http://127.0.0.1:$PORT/$page?selfTest=1" 2>/dev/null \
    | sed -n '/<pre id="selftest-result">/,/<\/pre>/p' \
    | sed -e 's/<[^>]*>//g' -e 's/&amp;/\&/g' -e 's/&quot;/"/g' -e 's/&lt;/</g' -e 's/&gt;/>/g')"
  echo "== $page"
  echo "$out"
  echo "$out" | grep -q '^SELFTEST PASS' || status=1
done
exit $status
