import assert from "node:assert/strict";
import { it } from "node:test";
import { act, createElement as h, Fragment } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";
import { flushPromises } from "./source-module.mjs";

const PAGE_SIZE = 50;
const propsOf = (node) => node[Object.keys(node).find((key) => key.startsWith("__reactProps$"))];
const settle = (fn) => act(async () => { fn(); await flushPromises(); });

async function mountEmailList(t, count) {
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
  // 沿用搜索清空测试的真实列表挂载；焦点用例不依赖虚拟滚动布局。
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
  const emails = Array.from({ length: count }, (_, index) => ({
    brand: "Halara", date: "2026-10-01", market: "US", theme: "price",
    keywords: ["coat"], subject: `Coat offer ${index}`, preheader: "",
    url: `https://example.test/email/${index}`, day_seq: index, source_index: index,
  }));
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
  const flushFrames = async () => {
    for (let attempt = 0; frames.size && attempt < 100; attempt++) {
      const batch = [...frames];
      await settle(() => {
        batch.forEach(([id, callback]) => { if (frames.delete(id)) callback(); });
      });
    }
    assert.equal(frames.size, 0, "动画帧应在有限次数内执行完毕");
  };
  await dom.render(h(ExtendedEmailFilter));
  await flushFrames();
  return {
    ...dom,
    loadMoreButtons: (remaining) => descendants(dom.container, (node) =>
      node.nodeName === "BUTTON" && node.textContent === translate("efLoadMore", { n: remaining })),
    allLoaded: () => descendants(dom.container, (node) =>
      node.nodeName === "P" && node.textContent.includes(translate("efLoadedAll"))),
    click: async (button) => {
      await settle(() => propsOf(button).onClick());
      // 先让 React 提交并挂载完成态，再执行生产代码注册的动画帧。
      await flushFrames();
    },
  };
}

function assertCompleted(f, button) {
  const paragraphs = f.allLoaded();
  assert.equal(paragraphs.length, 1, "完成态段落应包含 efLoadedAll 的真实翻译");
  assert.equal(f.container.contains(button), false, "最后一次加载后原按钮应已卸载");
  assert.equal(descendants(f.container, (node) =>
    node.nodeName === "BUTTON" && node.getAttribute("aria-controls") !== null).length, 0,
  "完成后不应再有加载更多按钮");
  assert.ok(f.document.activeElement === paragraphs[0], "最后一次加载后焦点应移到已挂载的完成态段落");
  assert.equal(paragraphs[0].getAttribute("tabindex"), "-1", "完成态可程序聚焦，但不进入 Tab 序列");
}

for (const count of [PAGE_SIZE + 3, PAGE_SIZE * 2]) {
  it(`${count} 条记录点击一次加载完成后，焦点移到完成态段落并卸载按钮`, async (t) => {
    const f = await mountEmailList(t, count);
    const button = f.loadMoreButtons(count - PAGE_SIZE)[0];
    assert.ok(button, "初始只加载一页，应显示加载更多按钮");
    assert.equal(f.allLoaded().length, 0);
    button.focus();
    assert.equal(f.document.activeElement, button, "模拟键盘用户从加载更多按钮激活");

    await f.click(button);
    assertCompleted(f, button);
  });
}

it("超过两页时首次加载保留按钮焦点，第二次完成后使用最新判定聚焦完成态", async (t) => {
  const count = PAGE_SIZE * 2 + 3;
  const f = await mountEmailList(t, count);
  const button = f.loadMoreButtons(count - PAGE_SIZE)[0];
  assert.ok(button, "初始应显示加载更多按钮");
  button.focus();

  await f.click(button);
  assert.equal(f.loadMoreButtons(count - PAGE_SIZE * 2)[0], button, "仍有剩余时应保留同一个按钮");
  assert.equal(f.document.activeElement, button, "未完成时焦点应仍在加载更多按钮上");
  assert.equal(f.allLoaded().length, 0, "仍有剩余时不应挂载完成态");

  await f.click(button);
  assertCompleted(f, button);
});
