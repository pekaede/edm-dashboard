import assert from "node:assert/strict";
import { it } from "node:test";
import { act, createElement as h } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { mountedClock, sourceGraph } from "./mounted-source.mjs";
import { email, emailData } from "./site-data-fixtures.mjs";
import { flushPromises } from "./source-module.mjs";

const propsOf = (node) => node[Object.keys(node).find((key) => key.startsWith("__reactProps$"))];
const buttons = (dom) => descendants(dom.container, (node) => node.nodeName === "BUTTON");
const paragraphs = (dom) => descendants(dom.container, (node) => node.nodeName === "P");
const meta = emailData.EXTENDED_EMAIL_META;

async function mountComparison(t, language, snapshot) {
  const dom = await mountDOM(t);
  const clock = mountedClock();
  Object.assign(dom.window, clock.globals, { localStorage: globalThis.sessionStorage });
  const graph = sourceGraph({
    globals: { ...clock.globals },
    overrides: {
      "email-data.ts": {
        ...emailData,
        useExtendedEmails: () => ({ status: "ready", emails: [], total: 0, error: null, meta, ...snapshot }),
      },
    },
  });
  const locale = graph.load("i18n/index.tsx");
  await locale.default.changeLanguage(language);
  const { MarketComparison } = graph.load("components/MarketComparison.tsx");
  await dom.render(h(MarketComparison));
  return { dom, locale };
}

function assertCardCopy(dom, locale) {
  const titles = descendants(dom.container, (node) => node.nodeName === "H2");
  assert.equal(titles.length, 1);
  assert.equal(titles[0].textContent, locale.translate("mcTitle"));
  assert.ok(paragraphs(dom).some((node) => node.textContent === locale.translate("mcHintFallback")));
}

// 全量测试以 --test-isolation=none 共享 i18n 单例，语言循环必须以中文收尾。
for (const [language, emptyText, retryText] of [
  ["en", "No emails", "Retry"],
  ["zh", "暂无邮件", "重新拉取"],
]) {
  it(`MarketComparison ready 空邮件显示原文案与唯一重试按钮，点击仅调用一次 retry（${language}）`, async (t) => {
    let calls = 0;
    const retry = () => { calls += 1; };
    const { dom, locale } = await mountComparison(t, language, { retry });
    assertCardCopy(dom, locale);
    assert.equal(locale.translate("mcEmpty"), emptyText);
    assert.equal(locale.translate("kpiRetry"), retryText);
    const empty = paragraphs(dom).filter((node) => node.getAttribute("role") === "status");
    assert.equal(empty.length, 1);
    assert.equal(empty[0].textContent, emptyText);

    const renderedButtons = buttons(dom);
    assert.equal(renderedButtons.length, 1, "空邮件只提供重试入口");
    const [button] = renderedButtons;
    assert.equal(button.getAttribute("type"), "button");
    assert.equal(button.textContent, locale.translate("kpiRetry"));
    assert.equal(propsOf(button).onClick, retry);
    assert.equal(empty[0].parentNode.childNodes[0], empty[0]);
    assert.ok(empty[0].parentNode.childNodes[1].contains(button), "按钮应位于 mcEmpty 段落下方");
    assert.equal(descendants(dom.container, (node) => node.nodeName === "INPUT").length, 0);
    assert.equal(calls, 0, "挂载不应触发重试");
    await act(async () => { propsOf(button).onClick(); await flushPromises(); });
    assert.equal(calls, 1);
  });

  it(`MarketComparison error 仍渲染 ExtendedEmailsState 的错误提示与重试（${language}）`, async (t) => {
    let calls = 0;
    const retry = () => { calls += 1; };
    const error = "request failed";
    const { dom, locale } = await mountComparison(t, language, { status: "error", error, retry });
    assertCardCopy(dom, locale);
    const alerts = descendants(dom.container, (node) => node.getAttribute("role") === "alert");
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].getAttribute("aria-live"), "assertive");
    const headings = descendants(alerts[0], (node) => node.nodeName === "H3");
    assert.equal(headings[0].textContent, locale.translate("stErrorTitleEmails"));
    assert.ok(paragraphs(dom).some((node) => node.textContent === error));
    assert.ok(!paragraphs(dom).some((node) => node.textContent === emptyText));
    const renderedButtons = buttons(dom);
    assert.equal(renderedButtons.length, 1);
    const [button] = renderedButtons;
    assert.ok(alerts[0].contains(button));
    assert.equal(button.textContent, locale.translate("stRetryLoad"));
    assert.equal(button.getAttribute("type"), "button");
    assert.equal(propsOf(button).onClick, retry);
    assert.equal(calls, 0);
    await act(async () => { propsOf(button).onClick(); await flushPromises(); });
    assert.equal(calls, 1);
  });

  it(`MarketComparison ready 有数据时显示对比内容，不显示空态重试按钮（${language}）`, async (t) => {
    let calls = 0;
    const { dom, locale } = await mountComparison(t, language, {
      emails: [email(meta.windowStart)], total: 1, retry: () => { calls += 1; },
    });
    assert.ok(!paragraphs(dom).some((node) => node.textContent === emptyText));
    assert.equal(buttons(dom).filter((node) => node.textContent === locale.translate("kpiRetry")).length, 0);
    assert.equal(buttons(dom).filter((node) => node.getAttribute("role") === "tab").length, 3);
    assert.equal(descendants(dom.container, (node) => node.nodeName === "INPUT").length, 8);
    assert.equal(calls, 0);
  });
}
