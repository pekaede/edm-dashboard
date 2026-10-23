import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { act, createElement as h, useState } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";
import { flushPromises } from "./source-module.mjs";

// 锁定主题在数据变化后残留：pin 住某主题后切到该主题 0 收录的数据集，图例按钮卸载
// 但 data-highlighted 仍指向旧主题，其余分段永久淡化且无可见清除入口。
// 修复：数据就绪时自动清理不在可见主题集中的 pin/preview（与 Escape 清除语义一致）。

function mk(brand, theme, i) {
  return {
    date: "2026-10-05", brand, theme, keywords: [], market: "US", day_seq: 1, source_index: i,
  };
}

// fixtureA：Zara 有 price×3、new×2；fixtureB：price 消失（仅 new×2）；
// fixtureC：price 仍在（price×1、new×2）。
function fixture(kind) {
  const emails = [];
  let i = 0;
  const push = (brand, theme, n) => { for (let k = 0; k < n; k++) emails.push(mk(brand, theme, i++)); };
  if (kind === "A") { push("Zara", "price", 3); push("Zara", "new", 2); }
  if (kind === "B") { push("Zara", "new", 2); }
  if (kind === "C") { push("Zara", "price", 1); push("Zara", "new", 2); }
  return emails;
}

let currentEmails = fixture("A");
let bumpRender = null;

function stubChartEnv(dom, t, size = 300) {
  const rect = { width: size, height: size, top: 0, left: 0, right: size, bottom: size, x: 0, y: 0, toJSON() { return {}; } };
  const origCreate = dom.document.createElement.bind(dom.document);
  const patched = (name) => {
    const el = origCreate(name);
    el.getBoundingClientRect = () => rect;
    return el;
  };
  dom.document.createElement = patched;
  dom.document.createElementNS = patched;
  dom.window.matchMedia = () => ({
    matches: false, media: "", addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  });
  class ResizeObserverStub {
    constructor(callback) { this.callback = callback; }
    observe(target) { this.callback([{ target, contentRect: rect }]); }
    unobserve() {}
    disconnect() {}
  }
  dom.window.ResizeObserver = ResizeObserverStub;
  const previous = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
  globalThis.ResizeObserver = ResizeObserverStub;
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "ResizeObserver", previous);
    else delete globalThis.ResizeObserver;
  });
}

async function mountBtb(t) {
  currentEmails = fixture("A");
  const dom = await mountDOM(t);
  stubChartEnv(dom, t);
  const graph = sourceGraph({
    overrides: {
      "email-data.ts": {
        EXTENDED_EMAIL_META: { windowStart: "2026-07-20", windowEnd: "2026-10-20" },
        getEmailMarket: (email) => (email.market ?? "US").trim().toUpperCase() || "US",
        matchesMarket: (email, market) => market === null || email.market === market,
        useExtendedEmails: () => ({
          status: "ready", error: null, emails: currentEmails, total: currentEmails.length,
          retry: () => {}, meta: { dataSource: "supabase" },
        }),
      },
    },
  });
  const i18n = graph.load("i18n/index.tsx");
  await i18n.default.changeLanguage("zh");
  const site = graph.load("site-data.tsx");
  const dashboard = graph.load("components/dashboard.ts");
  const { BrandThemeBreakdown } = graph.load("components/BrandThemeBreakdown.tsx");

  function Harness() {
    const [, setTick] = useState(0);
    bumpRender = () => setTick((n) => n + 1);
    return h(site.SiteProvider, null, h(Inner));
  }
  function Inner() {
    return h(BrandThemeBreakdown, { onSelectBrand: () => {} });
  }
  await dom.render(h(Harness));
  await flushPromises();
  const priceLabel = i18n.translate(dashboard.themeLabelKeyOf("price"));
  return { dom, translate: i18n.translate, priceLabel };
}

const propsOf = (node) => node[Object.keys(node).find((key) => key.startsWith("__reactProps$"))];
const scopeOf = (container) =>
  descendants(container, (n) => (n.getAttribute("class") ?? "").split(" ").includes("btb-scope"))[0];
function legendButtons(container, translate) {
  const legend = descendants(
    container,
    (n) => n.getAttribute("role") === "group" && n.getAttribute("aria-label") === translate("btbLegendAria"),
  )[0];
  assert.ok(legend, "应存在主题图例 group");
  return descendants(legend, (n) => n.nodeName === "BUTTON");
}
async function pinTheme(container, translate, label) {
  const button = legendButtons(container, translate).find((b) => b.textContent.includes(label));
  assert.ok(button, `图例中应有主题按钮：${label}`);
  await act(() => { propsOf(button).onClick(); });
  await flushPromises();
}
async function swapEmails(kind) {
  currentEmails = fixture(kind);
  await act(() => { bumpRender(); });
  await flushPromises();
}

describe("品牌主题堆叠条：锁定主题在数据变化后残留应自动清理", () => {
  it("pin 住的主题在新数据中 0 收录时自动清除高亮", async (t) => {
    const { dom, translate, priceLabel } = await mountBtb(t);
    const container = dom.container;
    await pinTheme(container, translate, priceLabel);
    assert.equal(scopeOf(container).getAttribute("data-highlighted"), "price", "pin 后应高亮 price");

    await swapEmails("B");
    assert.equal(
      scopeOf(container).getAttribute("data-highlighted"), null,
      "price 在新数据中 0 收录（图例按钮已卸载），pin 应被自动清除",
    );
    // 图例中确实不再有 price 按钮（前提成立）。
    assert.ok(
      !legendButtons(container, translate).some((b) => b.textContent.includes(priceLabel)),
      "新数据下图例不应再有 price 按钮",
    );
  });

  it("pin 住的主题在新数据中仍可见时保留高亮（无误删）", async (t) => {
    const { dom, translate, priceLabel } = await mountBtb(t);
    const container = dom.container;
    await pinTheme(container, translate, priceLabel);
    assert.equal(scopeOf(container).getAttribute("data-highlighted"), "price");

    await swapEmails("C");
    assert.equal(
      scopeOf(container).getAttribute("data-highlighted"), "price",
      "price 在新数据中仍有收录，pin 不应被清除",
    );
  });

  it("未 pin 时数据变化不产生高亮（无误触发）", async (t) => {
    const { dom } = await mountBtb(t);
    const container = dom.container;
    assert.equal(scopeOf(container).getAttribute("data-highlighted"), null);
    await swapEmails("B");
    assert.equal(scopeOf(container).getAttribute("data-highlighted"), null);
  });
});
