import assert from "node:assert/strict";
import { it } from "node:test";
import { act, createElement as h } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";

async function mountLanguageToggle(t) {
  const dom = await mountDOM(t);
  const graph = sourceGraph();
  const i18n = graph.load("i18n/index.tsx");
  const { LanguageToggle } = graph.load("i18n/LanguageToggle.tsx");
  const render = () => dom.render(h(LanguageToggle));
  await render();
  return { dom, i18n, render };
}

function checkButtons(dom, locale) {
  const buttons = descendants(dom.container, (node) => node.nodeName === "BUTTON");
  assert.equal(buttons.length, 2);
  const zh = buttons.find((button) => button.textContent === "中文");
  const en = buttons.find((button) => button.textContent === "EN");
  assert.ok(zh, "中文按钮必须始终显示中文");
  assert.ok(en, "英文按钮必须始终显示 EN");
  assert.equal(zh.getAttribute("lang"), "zh-CN");
  assert.equal(en.getAttribute("lang"), "en");
  assert.equal(zh.getAttribute("aria-pressed"), String(locale === "zh"));
  assert.equal(en.getAttribute("aria-pressed"), String(locale === "en"));
  return { zh, en };
}

async function click(button) {
  await act(() => {
    const props = button[Object.keys(button).find((key) => key.startsWith("__reactProps$"))];
    props.onClick();
  });
}

it("默认语言下真实语言按钮分别携带 zh-CN 和 en 标记", async (t) => {
  const { dom, i18n } = await mountLanguageToggle(t);
  assert.equal(i18n.getCurrentLocale(), "zh");
  checkButtons(dom, "zh");
});

it("点击 EN 切换到英文后，中文按钮仍携带 zh-CN 标记", async (t) => {
  const { dom, i18n } = await mountLanguageToggle(t);
  const { en } = checkButtons(dom, "zh");
  await click(en);
  assert.equal(i18n.getCurrentLocale(), "en");
  checkButtons(dom, "en");
});

it("中英文状态下卸载并重新挂载，语言按钮的 lang 属性保持一致", async (t) => {
  const { dom, i18n, render } = await mountLanguageToggle(t);
  for (const locale of ["zh", "en"]) {
    if (locale === "en") await click(checkButtons(dom, "zh").en);
    const before = checkButtons(dom, locale);
    await dom.render(null);
    assert.equal(descendants(dom.container, (node) => node.nodeName === "BUTTON").length, 0);
    await render();
    assert.equal(i18n.getCurrentLocale(), locale);
    const after = checkButtons(dom, locale);
    assert.notEqual(after.zh, before.zh, "中文按钮必须是重新挂载的新节点");
    assert.notEqual(after.en, before.en, "英文按钮必须是重新挂载的新节点");
  }
});
