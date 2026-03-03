#!/bin/bash

# 환경 설정
export PATH=/usr/local/bin:/opt/homebrew/bin:/usr/bin:$PATH
cd /Users/leejunhyong/antigravity/openclawtest2

LOG_FILE="$(pwd)/cron.log"

echo "" >> "$LOG_FILE"
echo "=======================================" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚀 블로그 자동 포스팅 시작" >> "$LOG_FILE"

# 전체 파이프라인 실행: 상품 수집 → 블로그 초안 생성 → 텔레그램 전송
/usr/local/bin/pnpm run start >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 완료! 텔레그램을 확인하세요." >> "$LOG_FILE"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ 에러 발생. 위 로그를 확인하세요." >> "$LOG_FILE"
fi
