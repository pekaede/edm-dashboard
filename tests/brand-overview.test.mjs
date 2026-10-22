import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSourceModule } from './source-module.mjs';
import { parseHash, buildHash } from '../src/url-state.ts';

const fields = ['source', 'company_name', 'tracked_site_url', 'source_page_url', 'latest_activity_date', 'sending_provider', 'notes', 'captured_at', 'emails_archived', 'total_ads', 'new_ads_30d', 'unique_copy_30d', 'new_ads_90d', 'new_copy_90d', 'avg_ad_live_days', 'video_share_pct', 'emoji_use_pct', 'landing_pages_tracked', 'new_emails_sent_30d', 'avg_email_scoring_pct', 'avg_subject_length', 'avg_email_size_kb', 'avg_spam_score', 'top_keywords', 'email_top_keywords'];
const row = { ...Object.fromEntries(fields.map((key) => [key, null])), brand: 'Example', market: 'US' };
const load = (fetch) => loadSourceModule('supabase.ts', {
  imports: { './data-window': { LIVE_WINDOW: {} } },
  env: { VITE_SUPABASE_URL: 'https://example.supabase.co/', VITE_SUPABASE_PUBLISHABLE_KEY: 'test-key' },
  globals: { fetch },
});

test('品牌概览允许 NULL、零值与关键词数组，拒绝无效行', () => {
  const { isBrandOverviewRow } = load();
  assert.equal(isBrandOverviewRow(row), true);
  assert.equal(isBrandOverviewRow({ ...row, total_ads: 0, top_keywords: ['sale'] }), true);
  for (const invalid of [null, { ...row, brand: '' }, { ...row, total_ads: NaN }, { ...row, total_ads: '12' }, { ...row, top_keywords: [1] }]) {
    assert.equal(isBrandOverviewRow(invalid), false);
  }
});

test('品牌概览一次请求正确端点和认证，拒绝 HTTP 错误与无效响应', async () => {
  const { fetchBrandOverview } = load(async (url, options) => {
    assert.equal(url.href, 'https://example.supabase.co/rest/v1/brand_overview?select=*&order=brand%2Cmarket');
    assert.equal(options.headers.apikey, 'test-key');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    return Response.json([row]);
  });
  assert.deepEqual(await fetchBrandOverview(), [row]);
  await assert.rejects(load(async () => new Response('', { status: 403 })).fetchBrandOverview(), /403/);
  await assert.rejects(load(async () => Response.json([{}])).fetchBrandOverview(), /格式无效/);
  assert.deepEqual(await load(async () => Response.json([])).fetchBrandOverview(), []);
});

test('品牌概览 URL 可往返，保留市场', () => {
  const state = parseHash('#brands/UK');
  assert.equal(state.view, 'brands');
  assert.equal(state.market, 'UK');
  assert.deepEqual(parseHash(buildHash(state)), state);
});
