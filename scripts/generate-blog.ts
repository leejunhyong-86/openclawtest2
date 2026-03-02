import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Product } from './fetch-products.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface BlogDraft {
    product: Product;
    title: string;
    content: string;
    affiliateLink: string; // Phase 0: 수동 입력 예정
    imageUrl: string;
    generatedAt: string;
}

export async function generateBlogDraft(product: Product): Promise<BlogDraft> {
    const platformName = product.platform === 'coupang' ? '쿠팡' : '알리익스프레스';
    const priceStr = product.price.toLocaleString('ko-KR');
    const originalPriceStr = product.originalPrice?.toLocaleString('ko-KR');

    const prompt = `
당신은 한국의 전문 어필리에이트 블로거입니다.
아래 상품 정보를 바탕으로 **SEO 최적화된 한국어 블로그 포스팅**을 작성해 주세요.

[상품 정보]
- 상품명: ${product.title}
- 판매가: ${priceStr}원
${originalPriceStr ? `- 정가: ${originalPriceStr}원 (${product.discountRate}% 할인)` : ''}
- 플랫폼: ${platformName}
${product.rating ? `- 평점: ${product.rating}점` : ''}
${product.reviewCount ? `- 리뷰 수: ${product.reviewCount.toLocaleString()}개` : ''}

[작성 조건]
1. 제목(title)은 클릭률을 높이는 매력적인 한국어 제목 (50자 이내)
2. 본문은 1,200~1,500자 분량으로 작성
3. 구성: 도입부(공감) → 상품 소개 → 주요 특징 3가지 → 가격 및 구매 팁 → 마무리
4. SEO를 위해 상품 관련 핵심 키워드를 자연스럽게 3~5회 포함
5. 마지막에 "[상품 구매하기]" 링크가 들어갈 자리 표시: {{AFFILIATE_LINK}}
6. 친근하고 신뢰감 있는 톤으로 작성 (지나치게 광고 같은 느낌은 피할 것)

[출력 형식] 아래 형식을 정확히 지켜서 출력하세요:
TITLE: (제목)
---
CONTENT:
(본문 전체)
`;

    // 환경변수에서 모델 설정 로드 (primary → fallback 순서로 시도)
    const primaryModel = process.env.GEMINI_MODEL_PRIMARY || 'gemini-3.1-pro-preview';
    const fallbackModel = process.env.GEMINI_MODEL_FALLBACK || 'gemini-2.5-pro-preview-03-25';
    const modelsToTry = [primaryModel, fallbackModel];

    const maxRetries = 3;
    let response;

    for (const model of modelsToTry) {
        let attempt = 0;
        let success = false;
        while (attempt < maxRetries) {
            try {
                console.log(`🤖 모델 시도: ${model} (시도 ${attempt + 1}/${maxRetries})`);
                response = await ai.models.generateContent({
                    model,
                    contents: prompt,
                    // @ts-ignore
                    requestOptions: { timeout: 120000 },
                });
                success = true;
                break;
            } catch (err) {
                attempt++;
                const waitSec = attempt * 15;
                console.warn(`⚠️ ${model} 호출 실패 (시도 ${attempt}/${maxRetries}), ${waitSec}초 후 재시도...`);
                if (attempt >= maxRetries) break;
                await new Promise(res => setTimeout(res, waitSec * 1000));
            }
        }
        if (success) break;
        console.warn(`⚠️ ${model} 실패. ${model === primaryModel ? `Fallback(${fallbackModel})으로 전환합니다.` : '모든 모델 실패.'}`);
    }

    if (!response) throw new Error('❌ 모든 Gemini 모델 호출 실패');


    const raw = response!.text || '';

    const titleMatch = raw.match(/TITLE:\s*(.+)/);
    const contentMatch = raw.match(/CONTENT:\n([\s\S]+)/);

    const title = titleMatch?.[1]?.trim() || product.title;
    const content = contentMatch?.[1]?.trim() || raw;

    console.log(`✍️  블로그 초안 생성 완료: "${title}"`);

    return {
        product,
        title,
        content,
        affiliateLink: '', // Phase 0: 텔레그램에서 수동 입력 받음
        imageUrl: product.imageUrl,
        generatedAt: new Date().toISOString(),
    };
}

async function main() {
    const dataPath = path.resolve(__dirname, '../data/products.json');
    if (!fs.existsSync(dataPath)) {
        console.error('❌ data/products.json 파일이 없습니다. fetch-products를 먼저 실행하세요.');
        process.exit(1);
    }

    const products: Product[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    console.log(`📝 ${products.length}개 상품의 블로그 초안을 생성합니다...\n`);

    const drafts: BlogDraft[] = [];
    for (const product of products) {
        const draft = await generateBlogDraft(product);
        drafts.push(draft);
    }

    const outputPath = path.resolve(__dirname, '../data/drafts.json');
    fs.writeFileSync(outputPath, JSON.stringify(drafts, null, 2), 'utf-8');
    console.log(`\n💾 블로그 초안 ${drafts.length}개 저장 완료: ${outputPath}`);
}

main().catch(console.error);
