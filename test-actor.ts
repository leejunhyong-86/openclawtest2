import 'dotenv/config';
import { ApifyClient } from 'apify-client';

const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });

async function testActor() {
    console.log('Running test with apify/e-commerce-scraping-tool...');
    try {
        const run = await apify.actor('apify/e-commerce-scraping-tool').call({
            listingUrls: [{ url: 'https://www.coupang.com/np/categories/185755' }],
            maxProducts: 2,
            proxyConfiguration: {
                useApifyProxy: true,
                apifyProxyGroups: ['RESIDENTIAL'],  // 🏠 가정집 IP 사용
            },
        });

        const { items } = await apify.dataset(run.defaultDatasetId).listItems();
        console.log('Items found:', items.length);
        console.log('Sample item:', JSON.stringify(items[0], null, 2));
    } catch (e) {
        console.error(e);
    }
}

testActor();
