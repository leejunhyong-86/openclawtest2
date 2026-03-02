# 어필리에이트 마케팅 자동화 시스템

Apify로 상품 수집 → Gemini Pro로 블로그 초안 생성 → 텔레그램 승인 → **Blogger 자동 포스팅**

## 빠른 시작

```bash
cp .env.example .env   # 환경변수 설정
pnpm install           # 의존성 설치
pnpm start             # 수집 + 초안생성 + 텔레그램 전송
pnpm bot               # 승인봇 상시 실행 (맥미니에서)
```

## Phase 0 워크플로우 (API 없이 시작)

1. `pnpm start` 또는 GitHub Actions가 매일 오전 8시 자동 실행
2. 텔레그램으로 블로그 초안 + 상품 원본 URL 수신
3. 쿠팡/알리 링크 변환기에서 어필리에이트 링크 생성
4. 텔레그램 [✏️ 링크 입력] → 링크 붙여넣기
5. Blogger에 자동 포스팅! ✅

## Blogger API 설정 방법

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 → **Blogger API v3** 활성화
3. 사용자 인증 정보 → OAuth 2.0 클라이언트 ID 생성
4. Access Token 발급 → `BLOGGER_ACCESS_TOKEN`에 입력
5. 내 블로그 설정 → URL에서 Blog ID 확인 → `BLOGGER_BLOG_ID`에 입력

## GitHub Actions Secrets 등록

| 변수명 | 설명 |
|---|---|
| `APIFY_API_KEY` | Apify API 키 |
| `APIFY_COUPANG_ACTOR_ID` | 쿠팡 스크래퍼 Actor ID |
| `GEMINI_API_KEY` | Google Gemini API 키 |
| `TELEGRAM_BOT_TOKEN` | 텔레그램 봇 토큰 |
| `TELEGRAM_CHAT_ID` | 텔레그램 채팅 ID |
| `BLOGGER_BLOG_ID` | Blogger 블로그 ID |
| `BLOGGER_ACCESS_TOKEN` | Blogger OAuth Access Token |
