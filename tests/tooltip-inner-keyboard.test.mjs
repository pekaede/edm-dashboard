import assert from "node:assert/strict";
import { it } from "node:test";
import { act, createElement as h } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";

async function setupTooltip(t) {
  const dom = await mountDOM(t);
  dom.window.innerWidth = 1024;
  dom.window.innerHeight = 768;

  const originalGetBoundingClientRect = dom.window.HTMLElement.prototype.getBoundingClientRect;
  dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
    return { top: 10, left: 10, bottom: 30, right: 30, width: 20, height: 20 };
  };

  const originalDispatch = dom.window.HTMLElement.prototype.dispatchEvent;
  dom.window.HTMLElement.prototype.dispatchEvent = function (event) {
    if (!event.bubbles) return originalDispatch.call(this, event);
    Object.defineProperty(event, "target", { value: this, configurable: true });
    let curr = this;
    while (curr) {
      originalDispatch.call(curr, event);
      if (event.cancelBubble) break;
      curr = curr.parentNode;
    }
    return !event.defaultPrevented;
  };

  t.after(() => {
    if (originalGetBoundingClientRect) {
      dom.window.HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    } else {
      delete dom.window.HTMLElement.prototype.getBoundingClientRect;
    }
    if (originalDispatch) {
      dom.window.HTMLElement.prototype.dispatchEvent = originalDispatch;
    } else {
      delete dom.window.HTMLElement.prototype.dispatchEvent;
    }
  });

  const graph = sourceGraph();
  const { Tooltip } = graph.load("components/Tooltip.tsx");

  await dom.render(
    h(
      Tooltip,
      { label: "t", anchorRole: "group", content: "c" },
      h("a", { href: "#emails/all" }, "slice link"),
    ),
  );

  const anchor = dom.container.firstChild;
  const link = descendants(dom.container, (node) => node.nodeName === "A")[0];
  const getTooltip = () =>
    descendants(dom.document.body, (node) => node.getAttribute?.("role") === "tooltip")[0];

  return { dom, anchor, link, getTooltip };
}

it("聚焦锚点内部的切片链接派发冒泡 Enter：不阻止默认行为且浮层未被打开", async (t) => {
  const { dom, link, getTooltip } = await setupTooltip(t);
  link.focus();
  assert.equal(dom.document.activeElement, link);

  const event = new Event("keydown", { bubbles: true, cancelable: true });
  event.key = "Enter";
  await act(async () => {
    link.dispatchEvent(event);
  });

  assert.equal(event.defaultPrevented, false, "链接上的 Enter 不应被 preventDefault");
  assert.equal(getTooltip(), undefined, "链接上的 Enter 不应打开浮层");
});

it("聚焦锚点内部的切片链接派发冒泡 Space：不阻止默认行为且浮层未被打开", async (t) => {
  const { dom, link, getTooltip } = await setupTooltip(t);
  link.focus();
  assert.equal(dom.document.activeElement, link);

  const event = new Event("keydown", { bubbles: true, cancelable: true });
  event.key = " ";
  await act(async () => {
    link.dispatchEvent(event);
  });

  assert.equal(event.defaultPrevented, false, "链接上的 Space 不应被 preventDefault");
  assert.equal(getTooltip(), undefined, "链接上的 Space 不应打开浮层");
});

it("聚焦锚点容器自身按 Enter：保留原有开关行为打开浮层", async (t) => {
  const { dom, anchor, getTooltip } = await setupTooltip(t);
  anchor.focus();
  assert.equal(dom.document.activeElement, anchor);

  const event = new Event("keydown", { bubbles: true, cancelable: true });
  event.key = "Enter";
  await act(async () => {
    anchor.dispatchEvent(event);
  });

  assert.equal(event.defaultPrevented, true, "锚点自身的 Enter 应被 preventDefault");
  const tooltip = getTooltip();
  assert.ok(tooltip, "聚焦锚点自身按 Enter 浮层应打开");
  assert.equal(tooltip.textContent, "c");
});
