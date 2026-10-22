import assert from "node:assert/strict";
import { it } from "node:test";
import { act, createElement as h, Fragment } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";
import { flushPromises } from "./source-module.mjs";

const propsOf = (node) => node[Object.keys(node).find((key) => key.startsWith("__reactProps$"))];
const settle = (fn) => act(async () => { fn(); await flushPromises(); });

it("零结果空态重置后恢复搜索输入框焦点，并清空搜索值、卸载空态", async (t) => {
  const dom = await mountDOM(t, "#emails/all");
  const frames = new Map();
  let frame = 0;
  const raf = (callback) => { frames.set(++frame, callback); return frame; };
  const caf = (id) => frames.delete(id);
  dom.window.requestAnimationFrame = raf;
  dom.window.cancelAnimationFrame = caf;
  dom.window.setTimeout = setTimeout;
  dom.window.clearTimeout = clearTimeout;
  dom.window.scrollY = 0;
  dom.window.localStorage = globalThis.sessionStorage;
  // 沿用搜索清空测试的真实列表挂载，仅补齐所需浏览器 API。
  dom.window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  const nativeCreate = dom.document.createElement;
  dom.document.createElement = (tag) => {
    const node = nativeCreate(tag);
    node.scrollTop = 0;
    node.scrollLeft = 0;
    node.scrollTo = ({ top, left }) => {
      if (top !== undefined) node.scrollTop = top;
      if (left !== undefined) node.scrollLeft = left;
    };
    return node;
  };
  const emails = [{
    brand: "Halara", date: "2026-10-01", market: "US", theme: "price",
    keywords: ["coat"], subject: "Coat offer", preheader: "", url: "https://example.test/email",
    day_seq: 0, source_index: 0,
  }];
  const graph = sourceGraph({
    globals: { requestAnimationFrame: raf, cancelAnimationFrame: caf },
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
  const { ExtendedEmailFilter } = graph.load("components/ExtendedEmailFilter.tsx");
  const { translate } = graph.load("i18n/index.tsx");
  await dom.render(h(ExtendedEmailFilter));

  const input = descendants(dom.container, (node) =>
    node.nodeName === "INPUT" && node.type === "search")[0];
  const resetButtons = () => descendants(dom.container, (node) =>
    node.nodeName === "BUTTON" && node.textContent === translate("efResetFilterSearch"));
  const tables = () => descendants(dom.container, (node) => node.getAttribute("data-email-table") !== null);
  assert.ok(input, "真实列表应挂载搜索输入框");
  assert.equal(tables()[0]?.getAttribute("data-filtered-rows"), "1", "初始列表应包含一封邮件");
  assert.equal(resetButtons().length, 0, "初始列表不应显示空态重置按钮");

  input.focus();
  await settle(() => propsOf(input).onChange({ target: { value: "no-matching-email" } }));
  assert.equal(input.value, "no-matching-email", "搜索框应保留无匹配的搜索词");
  assert.equal(tables().length, 0, "零结果时邮件表格应已卸载");
  assert.equal(resetButtons().length, 1, "零结果空态应显示重置筛选和搜索按钮");
  const resetButton = resetButtons()[0];
  resetButton.focus();
  assert.equal(dom.document.activeElement, resetButton, "模拟键盘用户从空态重置按钮激活");

  await settle(() => propsOf(resetButton).onClick());
  assert.equal(dom.document.activeElement, input, "重置后焦点应恢复到原搜索输入框");
  assert.equal(input.value, "", "重置后搜索值应已清空");
  assert.equal(resetButtons().length, 0, "重置后空态按钮应不存在");
  assert.equal(dom.container.contains(resetButton), false, "原空态重置按钮应已卸载");
  assert.equal(tables()[0]?.getAttribute("data-filtered-rows"), "1", "重置后应恢复邮件列表");
});
