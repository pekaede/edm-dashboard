import assert from "node:assert/strict";
import { it } from "node:test";
import { act, createElement as h, Fragment } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { mountedClock, sourceGraph } from "./mounted-source.mjs";
import { flushPromises } from "./source-module.mjs";

const settle = (fn) => act(async () => { fn(); await flushPromises(); });

async function mountFilter(t, language) {
  const dom = await mountDOM(t, "#emails/all");
  const clock = mountedClock();
  const frames = new Map();
  let frame = 0;
  const raf = (callback) => { frames.set(++frame, callback); return frame; };
  const caf = (id) => frames.delete(id);
  Object.assign(dom.window, clock.globals, {
    requestAnimationFrame: raf,
    cancelAnimationFrame: caf,
    localStorage: globalThis.sessionStorage,
  });
  dom.window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  const emails = [{
    brand: "Halara", date: "2026-10-01", market: "US", theme: "price",
    keywords: ["coat"], subject: "Coat offer", preheader: "",
    url: "https://example.test/email", day_seq: 0, source_index: 0,
  }];
  const graph = sourceGraph({
    globals: { ...clock.globals, requestAnimationFrame: raf, cancelAnimationFrame: caf },
    overrides: {
      "site-data.tsx": {
        useSiteEmails: () => ({ emails, status: "ready", total: emails.length, meta: {
          windowStart: "2026-07-01", windowEnd: "2026-10-01", range: "test", market: "all",
        } }),
        useSiteSelection: () => ({ market: null, setMarket() {} }),
      },
      "components/ui/select.tsx": {
        Select: ({ children, value }) => h("div", { "data-select": value }, children),
        SelectTrigger: ({ children, ...props }) => h("button", props, children),
        SelectContent: ({ children }) => h(Fragment, null, children),
        SelectItem: ({ children, value }) => h("div", { "data-select-item": value }, children),
        SelectValue: ({ children }) => h("span", null, children),
      },
    },
  });
  const locale = graph.load("i18n/index.tsx");
  await locale.default.changeLanguage(language);
  const { ExtendedEmailFilter } = graph.load("components/ExtendedEmailFilter.tsx");
  await dom.render(h(ExtendedEmailFilter));
  await settle(() => {});
  return { dom, locale };
}

function selectByLabel(dom, label) {
  const select = descendants(dom.container, (node) =>
    node.nodeName === "BUTTON" && node.getAttribute("aria-label") === label)[0];
  assert.ok(select, `应挂载 aria-label="${label}" 的筛选器`);
  return select.parentNode;
}

for (const [language, expected] of [["zh", { theme: "全部主题", brand: "全部", themeAria: "按邮件主题筛选", brandAria: "按邮件品牌筛选" }], ["en", { theme: "All Themes", brand: "All", themeAria: "Filter emails by theme", brandAria: "Filter emails by brand" }]]) {
  it(`主题筛选“全部”使用主题文案，品牌筛选保持原文案（${language}）`, async (t) => {
    const { dom } = await mountFilter(t, language);
    const themeSelect = selectByLabel(dom, expected.themeAria);
    const brandSelect = selectByLabel(dom, expected.brandAria);
    assert.equal(
      descendants(themeSelect, (node) => node.nodeName === "BUTTON")[0].textContent,
      expected.theme,
      "主题筛选未选中时的回退标签应使用主题文案",
    );
    assert.equal(
      descendants(themeSelect, (node) => node.getAttribute("data-select-item") === "__all__")[0].textContent,
      expected.theme,
      "主题筛选的 all 选项应使用 tdAllThemes",
    );
    assert.equal(
      descendants(brandSelect, (node) => node.getAttribute("data-select-item") === "all")[0].textContent,
      expected.brand,
      "品牌筛选的 all 选项应使用 calAllBrands",
    );
  });
}
