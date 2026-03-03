#!/bin/bash

# 환경 설정
export PATH=/usr/local/bin:/opt/homebrew/bin:/usr/bin:$PATH
cd /Users/leejunhyong/antigravity/openclawtest2

LOG_FILE="$(pwd)/cron.log"
DRAFTS_FILE="$(pwd)/data/drafts.json"
REFILL_THRESHOLD=10  # 미전송 초안이 이 수 이하면 새로 수집

echo "" >> "$LOG_FILE"
echo "=======================================" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚀 스케줄러 시작" >> "$LOG_FILE"

# 미전송 초안 수 확인
if [ -f "$DRAFTS_FILE" ]; then
    UNSENT=$(node -e "
        const d = JSON.parse(require('fs').readFileSync('$DRAFTS_FILE','utf-8'));
        console.log(d.filter(x=>!x.sent).length);
    " 2>/dev/null)
else
    UNSENT=0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📦 미전송 초안: ${UNSENT}개" >> "$LOG_FILE"

# 미전송 초안이 부족하면 새로 수집 및 생성
if [ "${UNSENT:-0}" -le "$REFILL_THRESHOLD" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📥 초안 풀 보충 시작..." >> "$LOG_FILE"
    /usr/local/bin/pnpm tsx scripts/fetch-products.ts >> "$LOG_FILE" 2>&1
    /usr/local/bin/pnpm tsx scripts/generate-blog.ts >> "$LOG_FILE" 2>&1
fi

# 매일 3개 초안 텔레그램 전송
/usr/local/bin/pnpm tsx scripts/notify-telegram.ts >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 완료! 텔레그램을 확인하세요." >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ 에러 발생. 위 로그를 확인하세요." >> "$LOG_FILE"
fi
