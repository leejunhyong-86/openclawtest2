#!/bin/bash

export PATH=/usr/local/bin:/opt/homebrew/bin:$PATH
cd /Users/leejunhyong/antigravity/openclawtest2

echo "=======================================" >> cron.log
echo "[$$(date)] 🚀 블로그 자동 포스팅 스케줄러 시작" >> cron.log

/usr/local/bin/pnpm run start >> cron.log 2>&1

if [ $$? -eq 0 ]; then
  echo "[$$(date)] ✅ 완료! 텔레그램을 확인하세요." >> cron.log
else
  echo "[$$(date)] ❌ 에러 발생. 로그를 확인하세요." >> cron.log
fi
