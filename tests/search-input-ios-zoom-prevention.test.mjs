import assert from "node:assert/strict";
import { it } from "node:test";
import { act, createElement as h, Fragment } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { mountedClock, sourceGraph } from "./mounted-source.mjs";
import { flushPromises } from "./source-module.mjs";

const settle = (fn) => act(async () => { fn(); await flushPromises(); });

async function mountFilter(t, language) {
  const dom = await mountDOM(t, "#emails/all");
  // 挂载宿主未实现 classList，仅补充基于真实 class 属性的精确 token 查询。
  const createElement = dom.document.createElement;
  dom.document.createElement = (name) => {
    const element = createElement(name);
    Object.defineProperty(element, "classList", {
      get: () => ({
        contains: (token) => (element.getAttribute("class") ?? "").split(/\s+/).includes(token),
      }),
    });
    return element;
  };
  const clock = mountedClock();
  Object.assign(dom.window, clock.globals, {
    scrollY: 0,
    localStorage: globalThis.sessionStorage,
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  // 搜索区只在有邮件时渲染，给两封最小样本。
  const emails = [0, 1].map((index) => ({
    brand: "Halara", date: "2026-10-01", market: "US", theme: "price",
    keywords: ["coat"], subject: `Coat offer ${index}`, preheader: "",
    url: `https://example.test/email/${index}`, day_seq: index, source_index: index,
  }));
  const graph = sourceGraph({
    globals: { ...clock.globals },
    overrides: {
      "site-data.tsx": {
        useSiteEmails: () => ({ emails, status: "ready", total: emails.length, meta: {
          windowStart: "2026-07-01", windowEnd: "2026-10-01", range: "test", market: "all",
        } }),
        useSiteSelection: () => ({ market: null, setMarket() {} }),
      },
      "components/ui/select.tsx": {
        Select: ({ children, value, onValueChange }) => h("div", {
          "data-select": value, onChange: (event) => onValueChange(event.target.value),
        }, children),
        SelectTrigger: ({ children, ...props }) => h("button", props, children),
        SelectContent: ({ children }) => h(Fragment, null, children),
        SelectItem: () => null,
        SelectValue: ({ children }) => h("span", null, children),
      },
    },
  });
  const locale = graph.load("i18n/index.tsx");
  await locale.default.changeLanguage(language);
  const { ExtendedEmailFilter } = graph.load("components/ExtendedEmailFilter.tsx");
  await dom.render(h(ExtendedEmailFilter));
  await settle(() => {});
  return { dom };
}

// 中英文搜索框均应保留 16px 字号类，防止 iOS Safari 聚焦时自动放大。
// 循环以 zh 收尾：i18n 单例为进程全局（npm test 用 --test-isolation=none），
// 本文件字母序在 seo.test.mjs 之前，若以英文收尾会污染其"中文预渲染"断言
// （custom-date-group-semantics.test.mjs 与 kpi-error-retry.test.mjs 均以 zh 测试收尾，同例）。
for (const language of ["en", "zh"]) {
  it(`邮件搜索框防止 iOS Safari 聚焦自动放大（${language}）`, async (t) => {
    const { dom } = await mountFilter(t, language);
    const inputs = descendants(dom.container, (node) =>
      node.nodeName === "INPUT" && node.getAttribute("id")?.endsWith("-search"));
    assert.equal(inputs.length, 1, "应挂载唯一 id 以 -search 结尾的搜索输入框");
    assert.ok(inputs[0].classList.contains("text-base"), "搜索框应使用 text-base（16px）");
    assert.equal(inputs[0].classList.contains("text-sm"), false, "搜索框不应包含 text-sm 精确 token");
  });
}
