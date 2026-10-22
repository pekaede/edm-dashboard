import assert from "node:assert/strict";
import { it } from "node:test";
import { act, createElement as h } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";
import { flushPromises } from "./source-module.mjs";

const propsOf = (node) => node[Object.keys(node).find((key) => key.startsWith("__reactProps$"))];
const settle = (fn) => act(async () => { fn(); await flushPromises(); });

it("日历搜索空态清除后恢复原输入框焦点，并清空搜索值、卸载空态", async (t) => {
  const dom = await mountDOM(t);
  const emails = [{
    brand: "Halara", date: "2026-10-01", market: "US", theme: "price",
    keywords: ["coat"], subject: "Coat offer", preheader: "", url: "https://example.test/email",
    day_seq: 0, source_index: 0,
  }];
  const graph = sourceGraph({
    overrides: {
      "site-data.tsx": {
        useSiteEmails: () => ({ emails, status: "ready", total: emails.length, meta: {
          windowStart: "2026-07-01", windowEnd: "2026-10-01", range: "test", market: "all",
          total: emails.length, brandCount: 1,
        } }),
        useSiteSelection: () => ({ market: null, setMarket() {} }),
      },
    },
  });
  const { CalendarView } = graph.load("components/CalendarView.tsx");
  const { translate } = graph.load("i18n/index.tsx");
  await dom.render(h(CalendarView));

  const searchInputs = () => descendants(dom.container, (node) =>
    node.nodeName === "INPUT" && node.type === "search");
  const clearButtons = () => descendants(dom.container, (node) =>
    node.nodeName === "BUTTON" && node.textContent === translate("calClearSearch"));
  const emptyStates = () => descendants(dom.container, (node) => node.getAttribute("role") === "status");
  const input = searchInputs()[0];
  assert.ok(input, "日历应挂载搜索输入框");
  assert.equal(emptyStates().length, 0, "初始日历不应显示空态");
  assert.equal(clearButtons().length, 0, "初始日历不应显示清除搜索按钮");

  input.focus();
  await settle(() => propsOf(input).onChange({ target: { value: "no-matching-email" } }));
  assert.equal(input.value, "no-matching-email", "搜索框应保留无匹配的搜索词");
  assert.equal(searchInputs()[0], input, "出现空态时搜索输入框应保持同一 DOM 节点");
  assert.equal(emptyStates().length, 1, "无匹配搜索应显示空态");
  assert.equal(clearButtons().length, 1, "空态应显示清除搜索按钮");
  const emptyState = emptyStates()[0];
  const clearButton = clearButtons()[0];
  clearButton.focus();
  assert.equal(dom.document.activeElement, clearButton, "模拟键盘用户从空态清除按钮激活");

  await settle(() => propsOf(clearButton).onClick());
  assert.equal(dom.document.activeElement, input, "清除后焦点应恢复到原日历搜索输入框");
  assert.equal(searchInputs()[0], input, "清除后搜索输入框应保持同一 DOM 节点");
  assert.equal(input.value, "", "清除后搜索值应已清空");
  assert.equal(emptyStates().length, 0, "清除后空态应不存在");
  assert.equal(clearButtons().length, 0, "清除后空态清除按钮应不存在");
  assert.equal(dom.container.contains(emptyState), false, "原搜索空态应已卸载");
  assert.equal(dom.container.contains(clearButton), false, "原清除按钮应已卸载");
});
