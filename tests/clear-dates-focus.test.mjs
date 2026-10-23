import assert from "node:assert/strict";
import { it } from "node:test";
import { act, createElement as h, Fragment } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";
import { flushPromises } from "./source-module.mjs";

const propsOf = (node) => node[Object.keys(node).find((key) => key.startsWith("__reactProps$"))];
const settle = (fn) => act(async () => { fn(); await flushPromises(); });

it("清除日期后恢复起始日期输入框焦点，并清空日期、卸载清除按钮", async (t) => {
  const dom = await mountDOM(t, "#emails/all?from=2026-09-01&to=2026-10-01");
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
  // 日期控件无需虚拟滚动布局；仅补齐真实列表挂载所需的浏览器 API。
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
    brand: "Halara", date: "2026-09-15", market: "US", theme: "price",
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
  await dom.render(h(ExtendedEmailFilter));

  const dateInputs = () => descendants(dom.container, (node) =>
    node.nodeName === "INPUT" && node.type === "date");
  const dateFromInput = dateInputs()[0];
  assert.ok(dateFromInput, "真实列表应挂载起始日期输入框");
  assert.equal(dateFromInput.value, "2026-09-01", "URL 日期应还原到起始输入框");
  assert.equal(dateInputs()[1].value, "2026-10-01");

  const clearButton = descendants(dom.container, (node) =>
    node.nodeName === "BUTTON" && node.textContent === "清除日期")[0];
  assert.ok(clearButton, "有日期筛选时应出现清除日期按钮");
  clearButton.focus();
  assert.equal(dom.document.activeElement, clearButton, "模拟键盘用户从清除按钮激活");

  await settle(() => propsOf(clearButton).onClick());
  assert.equal(dom.document.activeElement, dateFromInput, "清除后焦点应恢复到起始日期输入框");
  assert.equal(dateFromInput.value, "", "起始日期应清空");
  assert.equal(dateInputs()[1].value, "", "截止日期应清空");
  assert.equal(dom.container.contains(clearButton), false, "清除日期按钮应随日期置空卸载");
});

it("仅设单边日期时清除同样恢复起始日期输入框焦点", async (t) => {
  const dom = await mountDOM(t, "#emails/all?to=2026-10-01");
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
  dom.window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  const emails = [{
    brand: "Halara", date: "2026-09-15", market: "US", theme: "price",
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
  await dom.render(h(ExtendedEmailFilter));

  const dateFromInput = descendants(dom.container, (node) =>
    node.nodeName === "INPUT" && node.type === "date")[0];
  const clearButton = descendants(dom.container, (node) =>
    node.nodeName === "BUTTON" && node.textContent === "清除日期")[0];
  assert.ok(dateFromInput && clearButton, "单边日期下两控件均应挂载");
  clearButton.focus();
  await settle(() => propsOf(clearButton).onClick());
  assert.equal(dom.document.activeElement, dateFromInput, "单边日期清除后焦点应恢复到起始日期输入框");
  assert.equal(dateFromInput.value, "");
});
