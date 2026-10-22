import assert from "node:assert/strict";
import { it } from "node:test";
import { act, createElement as h, Fragment } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";
import { flushPromises } from "./source-module.mjs";

const propsOf = (node) => node[Object.keys(node).find((key) => key.startsWith("__reactProps$"))];
const settle = (fn) => act(async () => { fn(); await flushPromises(); });

it("清空邮件搜索后恢复输入框焦点，并清空输入值、卸载清空按钮", async (t) => {
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
  // 搜索控件无需虚拟滚动布局；仅补齐真实列表挂载所需的浏览器 API。
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
  await dom.render(h(ExtendedEmailFilter));

  const input = descendants(dom.container, (node) =>
    node.nodeName === "INPUT" && node.type === "search")[0];
  assert.ok(input, "真实列表应挂载搜索输入框");
  const clearButtons = () => descendants(input.parentNode, (node) => node.nodeName === "BUTTON");
  assert.equal(clearButtons().length, 0);

  await settle(() => propsOf(input).onChange({ target: { value: "coat" } }));
  assert.equal(input.value, "coat");
  assert.equal(clearButtons().length, 1, "输入搜索词后应出现清空按钮");
  const clearButton = clearButtons()[0];
  assert.ok(clearButton.getAttribute("aria-label"));
  clearButton.focus();
  assert.equal(dom.document.activeElement, clearButton, "模拟键盘用户从清空按钮激活");

  await settle(() => propsOf(clearButton).onClick());
  assert.equal(dom.document.activeElement, input, "清空后焦点应恢复到原搜索输入框");
  assert.equal(input.value, "");
  assert.equal(clearButtons().length, 0, "清空按钮应已卸载");
  assert.equal(dom.container.contains(clearButton), false);
});
