#!/bin/sh
# Screenshots the open widget with BASELINE_REF's committed bundle (default: main)
# and with the working tree's bundle, and fails if any pair differs. Guards the
# promise that installs using no new configuration render exactly as before.
set -u
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${VISUAL_PORT:-8766}"
REF="${BASELINE_REF:-main}"
OUT="$ROOT/harness/.visual"
mkdir -p "$OUT"
git -C "$ROOT" show "$REF:build/notify-me-wl.min.js" > "$ROOT/harness/.baseline.min.js" || exit 1
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
# Wait for our own server (not a stale process already on the port) to answer.
ready=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if kill -0 $SERVER 2>/dev/null && curl -sf -o /dev/null "http://127.0.0.1:$PORT/harness/visual.html"; then ready=1; break; fi
  sleep 0.5
done
if [ "$ready" != 1 ]; then echo "ERROR: http server on port $PORT did not start (port in use?)"; exit 1; fi
status=0
for size in 1024,768 400,800; do
  for display in modal panel; do
    for which in baseline current; do
      if [ "$which" = baseline ]; then bundle=.baseline.min.js; else bundle=../build/notify-me-wl.min.js; fi
      shot="$OUT/$display-$size-$which.png"
      rm -f "$shot"
      "$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size="$size" \
        --virtual-time-budget=3000 --screenshot="$OUT/$display-$size-$which.png" \
        "http://127.0.0.1:$PORT/harness/visual.html?display=$display&bundle=$bundle" >/dev/null 2>&1
      if [ ! -s "$shot" ]; then
        echo "ERROR: no screenshot produced: $shot"
        status=1
      fi
    done
    if [ ! -s "$OUT/$display-$size-baseline.png" ] || [ ! -s "$OUT/$display-$size-current.png" ]; then
      echo "FAIL $display $size (missing screenshot)"
      status=1
    elif cmp -s "$OUT/$display-$size-baseline.png" "$OUT/$display-$size-current.png"; then
      echo "same $display $size"
    else
      echo "DIFF $display $size (see harness/.visual/)"
      status=1
    fi
  done
done
exit $status
