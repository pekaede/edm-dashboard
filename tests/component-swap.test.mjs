import assert from "node:assert/strict";
import { it } from "node:test";
import { act, createElement as h, Fragment } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";
import { flushPromises } from "./source-module.mjs";

it("内容分析品牌多选切换至无选中品牌的样本时回落全部，切回仍保留选择", async (t) => {
  const dom = await mountDOM(t);
  const emails = [
    { brand: "Zara", market: "US", date: "2026-10-01", source_index: 0 },
    { brand: "Halara", market: "US", date: "2026-10-01", source_index: 1 },
    { brand: "Temu", market: "FR", date: "2026-10-01", source_index: 2 },
    { brand: "SHEIN", market: "FR", date: "2026-10-01", source_index: 3 },
  ].map((email) => ({ ...email, day_seq: 0, theme: "price", keywords: [], subject: "subject" }));
  const graph = sourceGraph({ overrides: {
    "email-data.ts": {
      EXTENDED_EMAIL_META: { windowStart: "2026-07-01", windowEnd: "2026-10-21" },
      getEmailMarket: (email) => email.market,
      useExtendedEmails: () => ({ status: "ready", error: null, emails, meta: { dataSource: "supabase" } }),
    },
    "email-content-analysis-data.ts": { useEmailContentAnalysis: () => ({ status: "ready", rows: [], error: null }) },
    // 宿主无 portal/焦点 API，仅展开 Popover 内容；筛选状态和 Button 均为生产实现。
    "components/ui/popover.tsx": {
      Popover: ({ children }) => h(Fragment, null, children),
      PopoverTrigger: ({ children }) => children,
      PopoverContent: ({ children }) => h("div", null, children),
    },
  } });
  const { ContentAnalysis } = graph.load("components/ContentAnalysis.tsx");
  const { translate } = graph.load("i18n/index.tsx");
  const render = (site) => dom.render(h(ContentAnalysis, { site, window: { start: "2026-10-01", end: "2026-10-21" } }));
  const buttons = () => descendants(dom.container, (node) => node.nodeName === "BUTTON");
  const brand = (name) => buttons().find((node) => node.getAttribute("role") === "checkbox" && node.textContent === name);
  const click = (node) => act(async () => {
    node[Object.keys(node).find((key) => key.startsWith("__reactProps$"))].onClick();
    await flushPromises();
  });
  await render("US");
  await click(brand("Zara"));
  assert.equal(brand("Zara").getAttribute("aria-checked"), "true");
  assert.ok(dom.container.textContent.includes(translate("caMetaSampleBrand", { n: 1 })));
  await render("FR");
  assert.equal(brand("Zara"), undefined);
  assert.ok(dom.container.textContent.includes(translate("caMetaSampleAll", { n: 2 })), "选中品牌不在新样本时使用全部样本");
  await render("US");
  assert.equal(brand("Zara").getAttribute("aria-checked"), "true");
  assert.ok(dom.container.textContent.includes(translate("caMetaSampleBrand", { n: 1 })));
  await click(buttons().find((node) => node.textContent === translate("caAllBrands") && node.getAttribute("aria-pressed") !== null));
  assert.equal(brand("Zara").getAttribute("aria-checked"), "false");
  assert.ok(dom.container.textContent.includes(translate("caMetaSampleAll", { n: 2 })));
});
