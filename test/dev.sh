#!/bin/bash
# Chạy Worker thật (workerd) + D1 cục bộ để test. Dùng: bash test/dev.sh start|stop  (PERSIST=thư mục lưu D1)
DIR="$(cd "$(dirname "$0")" && pwd)"
WR="${WRANGLER:-/tmp/claude-0/-home-claude/2c28eb33-5af1-55c1-9ee2-5fa2e7bcef5e/scratchpad/tools/node_modules/.bin/wrangler}"
PERSIST="${PERSIST:-/tmp/claude-0/-home-claude/2c28eb33-5af1-55c1-9ee2-5fa2e7bcef5e/scratchpad/d1-test}"
PORT="${PORT:-8787}"
if [ "$1" = "stop" ]; then pkill -f "wrangler dev" ; pkill -f workerd ; exit 0; fi
pkill -f "wrangler dev" ; pkill -f workerd ; sleep 1
rm -rf "$PERSIST"; mkdir -p "$PERSIST"
cd "$DIR" && nohup "$WR" dev --config wrangler.test.toml --port "$PORT" --local --persist-to "$PERSIST" \
  --var MIGRATE_KEY:khoa-chuyen-du-lieu-test-123 --var ALLOWED_ORIGINS:http://localhost:8000 > "$PERSIST/../dev.log" 2>&1 &
for i in $(seq 1 40); do curl -s "localhost:$PORT/" >/dev/null && echo "READY" && exit 0; sleep 1; done
echo "KHONG_KHOI_DONG_DUOC"; tail -30 "$PERSIST/../dev.log"; exit 1
