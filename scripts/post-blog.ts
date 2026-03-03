import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { BlogDraft } from './generate-blog.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, '../.env');

const BLOGGER_API = 'https://www.googleapis.com/blogger/v3';
const BLOG_ID = process.env.BLOGGER_BLOG_ID!;

// .env에서 최신 토큰을 실시간으로 읽어오는 함수
function getAccessToken(): string {
    const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    const match = envContent.match(/BLOGGER_ACCESS_TOKEN="([^"]+)"/);
    return match ? match[1] : process.env.BLOGGER_ACCESS_TOKEN!;
}

// refresh_token으로 새 access_token 발급
async function refreshToken(): Promise<string> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.BLOGGER_CLIENT_ID!,
            client_secret: process.env.BLOGGER_CLIENT_SECRET!,
            refresh_token: process.env.BLOGGER_REFRESH_TOKEN!,
            grant_type: 'refresh_token',
        }),
    });
    const data = await res.json() as any;
    if (!res.ok || !data.access_token) throw new Error(`토큰 갱신 실패: ${JSON.stringify(data)}`);

    // .env에 새 토큰 저장
    let envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    envContent = envContent.replace(/BLOGGER_ACCESS_TOKEN="[^"]*"/, `BLOGGER_ACCESS_TOKEN="${data.access_token}"`);
    fs.writeFileSync(ENV_PATH, envContent);
    console.log('🔄 Blogger access token 자동 갱신 완료');
    return data.access_token;
}

export async function postToBlogger(draft: BlogDraft): Promise<string> {
    // 어필리에이트 링크 자리 교체
    const finalContent = draft.affiliateLink
        ? draft.content.replace('{{AFFILIATE_LINK}}', draft.affiliateLink)
        : draft.content.replace('{{AFFILIATE_LINK}}', draft.product.productUrl);

    // HTML 변환 (줄바꿈 → <p> 태그)
    const htmlContent = finalContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `<p>${line}</p>`)
        .join('\n');

    // 썸네일 이미지 추가
    const contentWithImage = draft.imageUrl
        ? `<p style="text-align:center"><img src="${draft.imageUrl}" alt="${draft.title}" style="max-width:100%;border-radius:8px"/></p>\n${htmlContent}`
        : htmlContent;

    // 라벨(태그) 설정
    const labels = draft.product.platform === 'coupang'
        ? ['쿠팡', '어필리에이트', '추천상품', '최저가']
        : ['알리익스프레스', '해외직구', '추천상품', '핫딜'];

    const body = { title: draft.title, content: contentWithImage, labels };

    // 포스팅 시도 (401이면 토큰 갱신 후 재시도)
    for (let attempt = 0; attempt < 2; attempt++) {
        const token = attempt === 0 ? getAccessToken() : await refreshToken();

        const response = await fetch(`${BLOGGER_API}/blogs/${BLOG_ID}/posts`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const result = await response.json() as any;

        if (response.ok && result.url) {
            console.log(`✅ Blogger 포스팅 성공: ${result.url}`);
            return result.url;
        }

        if (response.status === 401 && attempt === 0) {
            console.log('⚠️ 토큰 만료 감지, 자동 갱신 후 재시도...');
            continue; // 갱신 후 재시도
        }

        throw new Error(`Blogger 포스팅 실패: ${JSON.stringify(result)}`);
    }

    throw new Error('Blogger 포스팅 실패: 재시도 한도 초과');
}


// 승인된 초안 포스팅
async function main() {
    const approvedPath = path.resolve(__dirname, '../data/approved-drafts.json');
    if (!fs.existsSync(approvedPath)) {
        console.log('📭 승인된 초안이 없습니다. 텔레그램에서 승인 후 실행하세요.');
        return;
    }

    const approvedDrafts: BlogDraft[] = JSON.parse(fs.readFileSync(approvedPath, 'utf-8'));
    if (approvedDrafts.length === 0) {
        console.log('📭 승인된 초안이 없습니다.');
        return;
    }

    console.log(`🚀 ${approvedDrafts.length}개의 승인된 초안을 Blogger에 포스팅합니다...\n`);

    const results: { title: string; url: string }[] = [];
    for (const draft of approvedDrafts) {
        try {
            const url = await postToBlogger(draft);
            results.push({ title: draft.title, url });
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (err) {
            console.error(`❌ 포스팅 실패: ${draft.title}`, err);
        }
    }

    // 결과 로그 저장
    const logPath = path.resolve(__dirname, '../data/posted-log.json');
    let log = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf-8')) : [];
    log = [...log, ...results.map(r => ({ ...r, postedAt: new Date().toISOString() }))];
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2));

    // 승인 큐 초기화
    fs.writeFileSync(approvedPath, JSON.stringify([], null, 2));

    console.log(`\n🎉 완료! 총 ${results.length}개 글이 Blogger에 게시되었습니다.`);
    results.forEach(r => console.log(`  - ${r.title}: ${r.url}`));
}

main().catch(console.error);
