#!/bin/sh
# Screenshots the open widget with BASELINE_REF's committed bundle (default: main)
# and with the working tree's bundle, and fails if any pair differs. Guards the
# promise that installs using no new configuration render exactly as before.
set -u
# CHROME=/path/to/chrome overrides the macOS default.
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
   for hostile in 0 1; do
    if [ "$hostile" = 1 ]; then tag="$display-$size-hostile"; label="$display $size hostile"; else tag="$display-$size"; label="$display $size"; fi
    for which in baseline current; do
      if [ "$which" = baseline ]; then bundle=.baseline.min.js; else bundle=../build/notify-me-wl.min.js; fi
      shot="$OUT/$tag-$which.png"
      rm -f "$shot"
      "$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size="$size" \
        --virtual-time-budget=3000 --screenshot="$OUT/$tag-$which.png" \
        "http://127.0.0.1:$PORT/harness/visual.html?display=$display&bundle=$bundle&hostile=$hostile" >/dev/null 2>&1
      if [ ! -s "$shot" ]; then
        echo "ERROR: no screenshot produced: $shot"
        status=1
      fi
    done
    if [ ! -s "$OUT/$tag-baseline.png" ] || [ ! -s "$OUT/$tag-current.png" ]; then
      echo "FAIL $label (missing screenshot)"
      status=1
    elif cmp -s "$OUT/$tag-baseline.png" "$OUT/$tag-current.png"; then
      echo "same $label"
    else
      echo "DIFF $label (see harness/.visual/)"
      status=1
    fi
   done
  done
done
exit $status
