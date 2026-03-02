import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, '../.env');

const CLIENT_ID = process.env.BLOGGER_CLIENT_ID!;
const CLIENT_SECRET = process.env.BLOGGER_CLIENT_SECRET!;
const REFRESH_TOKEN = process.env.BLOGGER_REFRESH_TOKEN!;

async function refreshAccessToken(): Promise<string> {
    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
        console.error(`
❌ 환경변수가 없습니다. .env에 다음을 추가해주세요:

BLOGGER_CLIENT_ID="..."
BLOGGER_CLIENT_SECRET="..."
BLOGGER_REFRESH_TOKEN="..."

📌 발급 방법:
1. https://console.cloud.google.com → OAuth 2.0 클라이언트 ID 생성
2. 아래 명령어로 인증 URL 열기:
   pnpm get-auth-url
        `);
        process.exit(1);
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token: REFRESH_TOKEN,
            grant_type: 'refresh_token',
        }),
    });

    const data = await res.json() as any;

    if (!res.ok || !data.access_token) {
        throw new Error(`토큰 갱신 실패: ${JSON.stringify(data)}`);
    }

    return data.access_token;
}

async function updateEnvToken(newToken: string) {
    let envContent = fs.readFileSync(ENV_PATH, 'utf-8');

    if (envContent.includes('BLOGGER_ACCESS_TOKEN=')) {
        envContent = envContent.replace(
            /BLOGGER_ACCESS_TOKEN="[^"]*"/,
            `BLOGGER_ACCESS_TOKEN="${newToken}"`
        );
    } else {
        envContent += `\nBLOGGER_ACCESS_TOKEN="${newToken}"`;
    }

    fs.writeFileSync(ENV_PATH, envContent);
    console.log('✅ .env의 BLOGGER_ACCESS_TOKEN이 갱신되었습니다.');
}

const newToken = await refreshAccessToken();
await updateEnvToken(newToken);
console.log(`🔑 새 토큰: ${newToken.substring(0, 30)}...`);
