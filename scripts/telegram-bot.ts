import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { postToBlogger } from './post-blog.ts';
import type { BlogDraft } from './generate-blog.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!;

console.log('🤖 텔레그램 승인 봇 시작... (Ctrl+C로 종료)');

// 링크 입력 대기 상태
const pendingLinkInput: Map<number, number> = new Map();

bot.on('callback_query', async (query) => {
    const data = query.data || '';
    const chatId = query.message?.chat.id!;

    const draftsPath = path.resolve(__dirname, '../data/drafts.json');
    const drafts: BlogDraft[] = fs.existsSync(draftsPath)
        ? JSON.parse(fs.readFileSync(draftsPath, 'utf-8'))
        : [];

    // ✅ 링크 없이 바로 포스팅
    if (data.startsWith('approve_no_link_')) {
        const idx = parseInt(data.replace('approve_no_link_', ''));
        const draft = drafts[idx];
        if (!draft) return;

        await bot.answerCallbackQuery(query.id, { text: '🚀 Blogger 포스팅 중...' });
        await bot.sendMessage(chatId, `⏳ *"${draft.title}"* Blogger에 포스팅 중...`, { parse_mode: 'Markdown' });

        try {
            const url = await postToBlogger(draft);
            await bot.sendMessage(chatId,
                `✅ *포스팅 완료!*\n\n📝 제목: ${draft.title}\n🔗 URL: ${url}`,
                { parse_mode: 'Markdown' }
            );
        } catch (err) {
            await bot.sendMessage(chatId, `❌ 포스팅 실패: ${err}`);
        }
    }

    // ✏️ 어필리에이트 링크 입력
    else if (data.startsWith('input_link_')) {
        const idx = parseInt(data.replace('input_link_', ''));
        pendingLinkInput.set(chatId, idx);

        await bot.answerCallbackQuery(query.id, { text: '링크를 입력해 주세요' });

        const draft = drafts[idx];
        const platform = draft?.product.platform === 'coupang' ? '쿠팡' : '알리';
        const converterUrl = draft?.product.platform === 'coupang'
            ? 'https://partners.coupang.com'
            : 'https://portals.aliexpress.com/affiportals/web/link_generator.htm';

        await bot.sendMessage(chatId,
            `🔗 *${platform} 어필리에이트 링크를 붙여넣어 주세요:*\n\n` +
            `📌 링크 변환기: ${converterUrl}\n\n` +
            `원본 URL: \`${draft?.product.productUrl}\`\n\n` +
            `변환된 링크를 그대로 붙여넣으세요 👇`,
            { parse_mode: 'Markdown' }
        );
    }

    // ❌ 건너뜀
    else if (data.startsWith('reject_')) {
        const idx = parseInt(data.replace('reject_', ''));
        await bot.answerCallbackQuery(query.id, { text: '⏭️ 건너뜀' });
        await bot.sendMessage(chatId, `❌ 초안 #${idx + 1}을 건너뛰었습니다.`);
    }
});

// 링크 입력 메시지 처리
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';

    if (pendingLinkInput.has(chatId) && text.startsWith('http')) {
        const idx = pendingLinkInput.get(chatId)!;
        pendingLinkInput.delete(chatId);

        const draftsPath = path.resolve(__dirname, '../data/drafts.json');
        const drafts: BlogDraft[] = JSON.parse(fs.readFileSync(draftsPath, 'utf-8'));
        const draft = drafts[idx];
        if (!draft) return;

        draft.affiliateLink = text;

        await bot.sendMessage(chatId,
            `🔗 링크 연결 완료!\n⏳ *"${draft.title}"* Blogger에 포스팅 중...`,
            { parse_mode: 'Markdown' }
        );

        try {
            const url = await postToBlogger(draft);
            await bot.sendMessage(chatId,
                `✅ *포스팅 완료!*\n\n📝 제목: ${draft.title}\n🔗 URL: ${url}`,
                { parse_mode: 'Markdown' }
            );
        } catch (err) {
            await bot.sendMessage(chatId, `❌ 포스팅 실패: ${err}`);
        }
    }
});
