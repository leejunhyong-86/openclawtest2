import 'dotenv/config';
import { ApifyClient } from 'apify-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });

export interface Product {
    id: string;
    title: string;
    price: number;
    originalPrice?: number;
    discountRate?: number;
    imageUrl: string;
    productUrl: string;
    platform: 'coupang' | 'aliexpress';
    category?: string;
    rating?: number;
    reviewCount?: number;
}

// 쿠팡 베스트셀러 수집 (URL 방식)
// startUrls에 쿠팡 카테고리/검색/상품 URL을 넣으세요
const COUPANG_TARGET_URLS = [
    // 쿠팡 베스트셀러 카테고리 (원하는 URL로 교체 가능)
    'https://www.coupang.com/np/categories/185755', // 생활/건강 베스트
    'https://www.coupang.com/np/categories/115573', // 디지털/가전 베스트
];

async function fetchCoupangProducts(targetUrls = COUPANG_TARGET_URLS, limit = 5): Promise<Product[]> {
    console.log(`🛒 쿠팡 상품 수집 중... (${targetUrls.length}개 URL)`);

    try {
        const run = await apify.actor(process.env.APIFY_COUPANG_ACTOR_ID || 'apify/e-commerce-scraping-tool').call({
            listingUrls: targetUrls.map(url => ({ url })),
            maxProducts: limit,
            proxyConfiguration: {
                useApifyProxy: true,
                apifyProxyGroups: ['RESIDENTIAL'],
            },
        });

        const { items } = await apify.dataset(run.defaultDatasetId).listItems();
        console.log(`✅ 쿠팡 ${items.length}개 상품 수집 완료`);

        return items.map((item: any) => {
            // e-commerce-scraping-tool은 offers.price에 가격을 반환
            const price = item.offers?.price ? parseFloat(item.offers.price) : 0;

            return {
                id: `CP_${item.id || Date.now()}`,
                title: item.name || item.title || '',
                price: price,
                originalPrice: undefined, // 범용 스크래퍼에서는 기본적으로 미제공되는 경우가 많음
                discountRate: undefined,
                imageUrl: item.image || '',
                productUrl: item.url || '',
                platform: 'coupang' as const,
                category: item.category || '',
                rating: item.aggregateRating?.ratingValue || undefined,
                reviewCount: item.aggregateRating?.reviewCount || undefined,
            };
        });
    } catch (err) {
        console.error('쿠팡 수집 실패:', err);
        return [];
    }
}


// 알리익스프레스 핫딜 수집
async function fetchAliProducts(keyword = 'hot deals', limit = 5): Promise<Product[]> {
    console.log(`🌏 알리익스프레스 상품 수집 중... (키워드: ${keyword})`);

    try {
        const run = await apify.actor(process.env.APIFY_ALI_ACTOR_ID!).call({
            searchTerms: [keyword],
            maxItems: limit,
        });

        const { items } = await apify.dataset(run.defaultDatasetId).listItems();
        console.log(`✅ 알리 ${items.length}개 상품 수집 완료`);

        return items
            .filter((item: any) => item.title && item.prices?.length > 0)
            .map((item: any) => {
                const usdPrice = parseFloat(
                    (item.prices[0].discountPrice || item.prices[0].price || '0').replace(/[^0-9.]/g, '')
                );
                return {
                    id: `ALI_${item.id || Date.now()}`,
                    title: item.title || '',
                    price: Math.round(usdPrice * 1350),
                    imageUrl: item.photos?.[0] || '',
                    productUrl: item.link || '',
                    platform: 'aliexpress',
                    rating: parseFloat(item.averageStar) || undefined,
                };
            });
    } catch (err) {
        console.error('알리 수집 실패:', err);
        return [];
    }
}

async function main() {
    const coupangProducts = await fetchCoupangProducts(COUPANG_TARGET_URLS, 3);

    // 알리 Actor ID가 설정된 경우에만 수집
    const aliProducts = process.env.APIFY_ALI_ACTOR_ID && process.env.APIFY_ALI_ACTOR_ID !== 'your_aliexpress_actor_id'
        ? await fetchAliProducts('best seller', 2)
        : [];

    if (!process.env.APIFY_ALI_ACTOR_ID || process.env.APIFY_ALI_ACTOR_ID === 'your_aliexpress_actor_id') {
        console.log('ℹ️  알리익스프레스 Actor ID 미설정 - 쿠팡만 수집합니다.');
    }

    const allProducts = [...coupangProducts, ...aliProducts];

    // data 폴더 생성 후 저장
    const dataDir = path.resolve(__dirname, '../data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    const outputPath = path.join(dataDir, 'products.json');
    fs.writeFileSync(outputPath, JSON.stringify(allProducts, null, 2), 'utf-8');

    if (allProducts.length === 0) {
        console.warn('⚠️  수집된 상품이 없습니다. data/products.json에 빈 배열 저장.');
        // exit(1) 제거 — 다음 단계에서 graceful 처리
    } else {
        console.log(`\n💾 ${allProducts.length}개 상품 저장 완료: ${outputPath}`);
    }
}

main().catch(console.error);
