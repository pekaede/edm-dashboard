import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement as h } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";
import { flushPromises } from "./source-module.mjs";

function mockData() {
  const weeks = [
    { id: "w1", label: "W1", range: "10-01 – 10-07", start: "2026-10-01", end: "2026-10-07" },
    { id: "w2", label: "W2", range: "10-08 – 10-14", start: "2026-10-08", end: "2026-10-14" },
    { id: "w3", label: "W3", range: "10-15 – 10-21", start: "2026-10-15", end: "2026-10-21" },
  ];
  return {
    window: { start: "2026-10-01", end: "2026-10-21" },
    weeks,
    brands: [{ name: "Halara", weekly: [3, 7, 12], total: 22 }],
    weekTotals: [3, 7, 12],
    grandTotal: 22,
    total: 22,
  };
}

function siteDataOverrides() {
  return {
    useSiteThreeWeekData: () => ({
      status: "ready",
      total: 22,
      error: null,
      retry() {},
      meta: { market: "US", total: 22 },
      data: mockData(),
    }),
    useSiteSelection: () => ({ market: null, setMarket() {} }),
  };
}

async function mountCampaignOverview(t, language) {
  const dom = await mountDOM(t);
  const graph = sourceGraph({ overrides: { "site-data.tsx": siteDataOverrides() } });
  const locale = graph.load("i18n/index.tsx");
  await locale.default.changeLanguage(language);
  const { CampaignOverview } = graph.load("components/CampaignOverview.tsx");
  await dom.render(h(CampaignOverview, { onSelectBrand() {} }));
  await act(async () => {
    await flushPromises();
  });
  return { dom, locale };
}

function legendContainer(dom, label) {
  const containers = descendants(
    dom.container,
    (node) => node.nodeName === "DIV" && node.getAttribute("aria-label") === label,
  );
  assert.equal(containers.length, 1, `应挂载唯一带 aria-label="${label}" 的图例容器`);
  return containers[0];
}

test("热力图图例容器带 role=group，aria-label 不被忽略", async (t) => {
  const { dom, locale } = await mountCampaignOverview(t, "zh");
  const label = locale.translate("campaignLegendAriaLabel");
  assert.ok(label && label.length > 0, "字典应提供图例 aria-label");
  const container = legendContainer(dom, label);
  assert.equal(container.getAttribute("role"), "group", "通用 div 容器应补 role=group");
  const swatches = descendants(container, (node) => node.getAttribute("aria-hidden") === "true");
  assert.ok(swatches.length >= 6, "图例色块应 aria-hidden（装饰性），数量不少于色阶数");
});

test("英文下图例容器同样带 role=group", async (t) => {
  const { dom, locale } = await mountCampaignOverview(t, "en");
  const label = locale.translate("campaignLegendAriaLabel");
  const container = legendContainer(dom, label);
  assert.equal(container.getAttribute("role"), "group");
  assert.notEqual(label, "", "英文字典应提供对应标签");
});
