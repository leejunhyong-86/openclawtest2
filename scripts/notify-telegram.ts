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

    const message = [
        `📝 *[블로그 포스팅 초안 #${index + 1}]*`,
        ``,
        `🏷 *제목:* ${draft.title}`,
        ``,
        `🛒 *상품:* ${draft.product.title.substring(0, 60)}...`,
        `💰 *가격:* ${priceStr}원`,
        `📦 *플랫폼:* ${platformName}`,
        `🔗 *원본 URL:* ${draft.product.productUrl}`,
        ``,
        `📄 *본문 미리보기 (첫 200자):*`,
        `${draft.content.substring(0, 200)}...`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
        `⚠️ *[Phase 0 - 수동 링크 필요]*`,
        `아래 링크 변환기에서 어필리에이트 링크를 만들어 주세요:`,
        ``,
        draft.product.platform === 'coupang'
            ? `🔗 쿠팡 파트너스: https://partners.coupang.com`
            : `🔗 알리 포털: https://portals.aliexpress.com/affiportals/web/link_generator.htm`,
        ``,
        `변환된 링크를 아래 [✏️ 링크 입력] 버튼을 눌러 붙여넣어 주세요.`,
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
                parse_mode: 'Markdown',
                reply_markup: replyMarkup,
            });
        } catch {
            // 이미지 전송 실패 시 텍스트로 폴백
            await bot.sendMessage(CHAT_ID, message, {
                parse_mode: 'Markdown',
                reply_markup: replyMarkup,
            });
        }
    } else {
        await bot.sendMessage(CHAT_ID, message, {
            parse_mode: 'Markdown',
            reply_markup: replyMarkup,
        });
    }

    console.log(`📨 텔레그램 전송 완료: 초안 #${index + 1}`);
}

async function main() {
    const draftsPath = path.resolve(__dirname, '../data/drafts.json');
    if (!fs.existsSync(draftsPath)) {
        console.error('❌ data/drafts.json 파일이 없습니다. generate-blog를 먼저 실행하세요.');
        process.exit(1);
    }

    const drafts: BlogDraft[] = JSON.parse(fs.readFileSync(draftsPath, 'utf-8'));
    console.log(`📨 ${drafts.length}개의 블로그 초안을 텔레그램으로 전송합니다...\n`);

    for (let i = 0; i < drafts.length; i++) {
        await sendDraftForApproval(drafts[i], i);
        // 메시지 간 딜레이 (텔레그램 Rate Limit 방지)
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await bot.sendMessage(CHAT_ID,
        `✅ *총 ${drafts.length}개의 초안을 전송했습니다.*\n각 초안별로 승인/링크입력/건너뜀을 선택해 주세요.\n\n📌 승인된 글은 자동으로 티스토리에 포스팅됩니다.`,
        { parse_mode: 'Markdown' }
    );

    console.log(`\n✅ 모든 초안 전송 완료! 텔레그램에서 승인해 주세요.`);
}

main().catch(console.error);
