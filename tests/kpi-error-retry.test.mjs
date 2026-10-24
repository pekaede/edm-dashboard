import assert from "node:assert/strict";
import { it } from "node:test";
import { act, createElement as h } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { mountedClock, sourceGraph } from "./mounted-source.mjs";
import { flushPromises } from "./source-module.mjs";

const settle = (fn) => act(async () => { fn(); await flushPromises(); });
const propsOf = (node) => node[Object.keys(node).find((key) => key.startsWith("__reactProps$"))];

// S14：KpiGrid 错误分支此前只渲染 kpiErrorStatus 被动文本，retry 已取到却未使用。
// 修复后错误态段落内应有复用 kpiRetry 键的重试按钮，点击调用 retry。
async function mountKpi(t, language, siteEmails) {
  const dom = await mountDOM(t, "#dashboard");
  const clock = mountedClock();
  Object.assign(dom.window, clock.globals, {
    localStorage: globalThis.sessionStorage,
  });
  const graph = sourceGraph({
    globals: { ...clock.globals },
    overrides: {
      "site-data.tsx": {
        useSiteEmails: () => siteEmails,
        useSiteSelection: () => ({ market: null, setMarket() {} }),
      },
    },
  });
  const locale = graph.load("i18n/index.tsx");
  await locale.default.changeLanguage(language);
  const { KpiGrid } = graph.load("components/KpiGrid.tsx");
  await dom.render(h(KpiGrid));
  await settle(() => {});
  return { dom };
}

function retryButton(dom, label) {
  return descendants(
    dom.container,
    (node) => node.nodeName === "BUTTON" && node.textContent === label,
  )[0];
}

function errorStatus(dom) {
  return descendants(
    dom.container,
    (node) => node.nodeName === "P" && node.getAttribute("role") === "status",
  )[0];
}

for (const [language, label] of [["zh", "重新拉取"], ["en", "Retry"]]) {
  it(`错误态段落内有重试按钮（${language}：${label}）`, async (t) => {
    let calls = 0;
    const { dom } = await mountKpi(t, language, {
      emails: [], status: "error", total: 0, meta: { market: "all" }, retry: () => { calls += 1; },
    });
    const status = errorStatus(dom);
    assert.ok(status, "错误态应渲染 role=status 段落");
    const button = retryButton(dom, label);
    assert.ok(button, `错误态段落内应有文案为“${label}”的重试按钮`);
    assert.equal(button.getAttribute("type"), "button");
    assert.ok(status.contains(button), "重试按钮应在错误态段落内");
    assert.equal(calls, 0, "挂载时不应调用 retry");
  });
}

it("点击重试按钮调用 retry 且仅一次", async (t) => {
  let calls = 0;
  const { dom } = await mountKpi(t, "zh", {
    emails: [], status: "error", total: 0, meta: { market: "all" }, retry: () => { calls += 1; },
  });
  const button = retryButton(dom, "重新拉取");
  assert.ok(button, "错误态应有重试按钮");
  await settle(() => propsOf(button).onClick());
  assert.equal(calls, 1, "点击一次应调用 retry 一次");
});

it("加载态不渲染重试按钮（回归）", async (t) => {
  const { dom } = await mountKpi(t, "zh", {
    emails: [], status: "loading", total: 0, meta: { market: "all" }, retry: () => {},
  });
  assert.equal(
    descendants(dom.container, (node) => node.nodeName === "BUTTON").length,
    0,
    "加载态不应出现任何按钮",
  );
  assert.equal(errorStatus(dom), undefined, "加载态不应渲染错误态段落");
});
