import assert from "node:assert/strict";
import { it } from "node:test";
import { act, createElement as h } from "react";
import { mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";
import { flushPromises } from "./source-module.mjs";

// use-url-sync 的滚动监听：preserveScroll: true 实例须挂载 window scroll
// 监听器（邮件列表滚动恢复的依赖）；preserveScroll: false 实例（如 App.tsx
// 的 URL 同步实例）不做滚动恢复，监听器必须门控掉——其 handler 只写本实例
// refs 与共享 Map，该实例侧无任何消费者，属无意义的重复监听。
async function settle(callback = () => {}) {
  await act(async () => { await callback(); await flushPromises(); });
}

function trackScrollListeners(dom) {
  const added = [];
  const add = dom.window.addEventListener.bind(dom.window);
  const remove = dom.window.removeEventListener.bind(dom.window);
  dom.window.addEventListener = (type, listener, opts) => {
    if (type === "scroll") added.push(listener);
    return add(type, listener, opts);
  };
  dom.window.removeEventListener = (type, listener, opts) => {
    if (type === "scroll") {
      const index = added.indexOf(listener);
      if (index >= 0) added.splice(index, 1);
    }
    return remove(type, listener, opts);
  };
  return added;
}

async function mountProbe(t, options) {
  const dom = await mountDOM(t);
  const scrollListeners = trackScrollListeners(dom);
  const graph = sourceGraph({});
  const urlSync = graph.load("use-url-sync.ts");
  function Probe() {
    urlSync.default(options);
    return null;
  }
  await dom.render(h(Probe));
  await settle();
  return { dom, scrollListeners };
}

it("preserveScroll: false 时不安装 window scroll 监听", async (t) => {
  const { scrollListeners } = await mountProbe(t, { preserveScroll: false });
  assert.equal(scrollListeners.length, 0, "preserveScroll:false 实例不得注册 scroll 监听");
});

it("默认（preserveScroll: true）时安装唯一 scroll 监听，卸载时移除", async (t) => {
  const { dom, scrollListeners } = await mountProbe(t, {});
  assert.equal(scrollListeners.length, 1, "邮件列表实例须恰好注册 1 个 scroll 监听");
  await act(async () => { dom.root.unmount(); await flushPromises(); });
  assert.equal(scrollListeners.length, 0, "卸载后监听器应被移除");
});
