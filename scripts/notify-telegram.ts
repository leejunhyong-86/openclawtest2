import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { BlogDraft } from './generate-blog.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false });
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!;

// 초안을 텔레그램으로 전송하고 사용자 응답을 대기
export async function sendDraftForApproval(draft: BlogDraft, index: number): Promise<void> {
    const platformName = draft.product.platform === 'coupang' ? '쿠팡' : '알리';
    const priceStr = draft.product.price.toLocaleString('ko-KR');

    // 특수문자 이스케이프 (Markdown 없이 일반 텍스트 사용)
    const safeTitle = draft.title.replace(/[*_`[\]()]/g, ' ');
    const safeProductTitle = draft.product.title.substring(0, 60).replace(/[*_`[\]()]/g, ' ');
    const safePreview = draft.content.substring(0, 200).replace(/[*_`[\]()]/g, ' ');

    const message = [
        `📝 [블로그 포스팅 초안 #${index + 1}]`,
        ``,
        `🏷 제목: ${safeTitle}`,
        ``,
        `🛒 상품: ${safeProductTitle}...`,
        `💰 가격: ${priceStr}원`,
        `📦 플랫폼: ${platformName}`,
        `🔗 원본 URL: ${draft.product.productUrl}`,
        ``,
        `📄 본문 미리보기:`,
        `${safePreview}...`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
        draft.product.platform === 'coupang'
            ? `🔗 쿠팡 파트너스: https://partners.coupang.com`
            : `🔗 알리 포털: https://portals.aliexpress.com/affiportals/web/link_generator.htm`,
        ``,
        `변환된 링크를 아래 버튼을 눌러 붙여넣어 주세요.`,
    ].join('\n');

    const replyMarkup = {
        inline_keyboard: [
            [
                { text: '✅ 링크 없이 바로 포스팅', callback_data: `approve_no_link_${index}` },
                { text: '✏️ 링크 입력 후 포스팅', callback_data: `input_link_${index}` },
            ],
            [
                { text: '❌ 이 글 건너뜀', callback_data: `reject_${index}` },
            ],
        ],
    };

    // 실제 이미지가 있고 placeholder가 아닌 경우에만 sendPhoto 시도
    const isRealImage = draft.imageUrl &&
        !draft.imageUrl.includes('placeholder') &&
        !draft.imageUrl.includes('via.placeholder');

    if (isRealImage) {
        try {
            await bot.sendPhoto(CHAT_ID, draft.imageUrl, {
                caption: message.substring(0, 1024),
                reply_markup: replyMarkup,
            });
        } catch {
            await bot.sendMessage(CHAT_ID, message, { reply_markup: replyMarkup });
        }
    } else {
        await bot.sendMessage(CHAT_ID, message, { reply_markup: replyMarkup });
    }

    console.log(`📨 텔레그램 전송 완료: 초안 #${index + 1}`);
}

async function main() {
    const DAILY_SEND_LIMIT = 3; // 하루 전송 개수

    const draftsPath = path.resolve(__dirname, '../data/drafts.json');
    if (!fs.existsSync(draftsPath)) {
        console.error('❌ data/drafts.json 파일이 없습니다. generate-blog를 먼저 실행하세요.');
        process.exit(1);
    }

    const drafts: BlogDraft[] = JSON.parse(fs.readFileSync(draftsPath, 'utf-8'));

    // 아직 전송 안 된 초안만 필터링
    const unsentDrafts = drafts.filter(d => !d.sent);
    const toSend = unsentDrafts.slice(0, DAILY_SEND_LIMIT);

    console.log(`📨 미전송 초안 ${unsentDrafts.length}개 중 ${toSend.length}개를 텔레그램으로 전송합니다...\n`);

    if (toSend.length === 0) {
        await bot.sendMessage(CHAT_ID, '📭 오늘 전송할 새 초안이 없습니다. 초안 풀을 다시 채워주세요.');
        return;
    }

    for (let i = 0; i < toSend.length; i++) {
        // 전체 배열에서 해당 draft의 실제 인덱스 사용 (버튼 콜백용)
        const realIndex = drafts.findIndex(d => d.id === toSend[i].id);
        await sendDraftForApproval(toSend[i], realIndex);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // sent 마킹
        drafts[realIndex].sent = true;
    }

    // drafts.json 업데이트 (sent 상태 저장)
    fs.writeFileSync(draftsPath, JSON.stringify(drafts, null, 2), 'utf-8');

    const remaining = drafts.filter(d => !d.sent).length;
    await bot.sendMessage(CHAT_ID,
        `✅ *총 ${toSend.length}개의 초안을 전송했습니다.*\n각 초안별로 승인/링크입력/건너뜀을 선택해 주세요.\n\n📌 승인된 글은 자동으로 Blogger에 포스팅됩니다.\n📦 남은 초안: *${remaining}개* (약 ${Math.ceil(remaining / DAILY_SEND_LIMIT)}일치)`,
        { parse_mode: 'Markdown' }
    );

    console.log(`\n✅ 전송 완료! 남은 미전송 초안: ${remaining}개`);
}

main().catch(console.error);
