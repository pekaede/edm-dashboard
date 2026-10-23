import assert from "node:assert/strict";
import { it } from "node:test";
import { act, createElement as h } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { mountedClock, sourceGraph } from "./mounted-source.mjs";
import { flushPromises } from "./source-module.mjs";

// 周频率视图底部的"各周日期范围"图例容器：普通 div 只带 aria-label 会被读屏器忽略，
// 须补 role="group"（与 CampaignOverview 图例/CalendarView/ThemeDistribution 图例惯例一致）。
const propsOf = (node) => node[Object.keys(node).find((key) => key.startsWith("__reactProps$"))];

async function settle(callback = () => {}) {
  await act(async () => { await callback(); await flushPromises(); });
}

async function mountComparison(t, language) {
  const dom = await mountDOM(t);
  // 测试宿主的 select 元素没有 options 集合，React 受控 select 挂载时读 node.options.length 会抛错；
  // 此处补一个最小只读实现（与真实 HTMLOptionsCollection 的只读遍历语义一致），不碰生产代码。
  const createElement = dom.document.createElement;
  dom.document.createElement = (name) => {
    const element = createElement(name);
    if (element.nodeName === "SELECT") {
      Object.defineProperty(element, "options", {
        get() { return this.childNodes.filter((child) => child.nodeName === "OPTION"); },
      });
    }
    return element;
  };
  const clock = mountedClock();
  let networkRequests = 0;
  const graph = sourceGraph({
    env: { VITE_EDM_DATA_SOURCE: "json" },
    globals: { ...clock.globals, fetch() { networkRequests += 1; throw new Error("JSON 模式不应联网"); } },
  });
  const locale = graph.load("i18n/index.tsx");
  await locale.default.changeLanguage(language);
  const { MarketComparison } = graph.load("components/MarketComparison.tsx");
  await dom.render(h(MarketComparison));
  await settle();
  assert.equal(networkRequests, 0, "JSON 模式不得联网");
  return { dom, locale };
}

async function openFrequencyView(dom, locale) {
  const tabs = descendants(dom.container,
    (node) => node.nodeName === "BUTTON" && node.getAttribute("role") === "tab");
  const freqTab = tabs.find((tab) => tab.textContent === locale.translate("mcViewFreq"));
  assert.ok(freqTab, "应存在周频率视图标签页");
  await settle(() => propsOf(freqTab).onClick());
}

function weeksLegend(dom, label) {
  // 周图例容器在周频率视图内只渲染一次（位于各市场区段之后、视图根容器内）。
  const nodes = descendants(dom.container,
    (node) => node.nodeName === "DIV" && node.getAttribute("aria-label") === label);
  assert.equal(nodes.length, 1, `应挂载唯一带 aria-label="${label}" 的周图例容器`);
  return nodes[0];
}

function assertLegendSemantics(container) {
  assert.equal(container.getAttribute("role"), "group", "通用 div 图例容器应补 role=group");
  const focusable = descendants(container, (node) =>
    ["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"].includes(node.nodeName) ||
    (node.getAttribute("tabindex") ?? node.getAttribute("tabIndex")) !== null);
  assert.equal(focusable.length, 0, "图例容器内不得有可聚焦后代");
}

it("周频率图例容器带 role=group，aria-label 不被忽略", async (t) => {
  const { dom, locale } = await mountComparison(t, "zh");
  await openFrequencyView(dom, locale);
  const label = locale.translate("mcWeeksAria");
  assert.ok(label && label.length > 0, "字典应提供周图例 aria-label");
  assertLegendSemantics(weeksLegend(dom, label));
});

it("英文下周频率图例容器同样带 role=group", async (t) => {
  const { dom, locale } = await mountComparison(t, "en");
  await openFrequencyView(dom, locale);
  const label = locale.translate("mcWeeksAria");
  assert.notEqual(label, "", "英文字典应提供对应标签");
  assertLegendSemantics(weeksLegend(dom, label));
});
