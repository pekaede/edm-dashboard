import assert from "node:assert/strict";
import { it } from "node:test";
import { act, createElement as h, Fragment } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { mountedClock, sourceGraph } from "./mounted-source.mjs";
import { flushPromises } from "./source-module.mjs";

const settle = (fn) => act(async () => { fn(); await flushPromises(); });

async function mountFilter(t, language) {
  const dom = await mountDOM(t, "#emails/all");
  const clock = mountedClock();
  Object.assign(dom.window, clock.globals, {
    scrollY: 0,
    localStorage: globalThis.sessionStorage,
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  // 日期筛选区只在有邮件时渲染，给两封最小样本。
  const emails = [0, 1].map((index) => ({
    brand: "Halara", date: "2026-10-01", market: "US", theme: "price",
    keywords: ["coat"], subject: `Coat offer ${index}`, preheader: "",
    url: `https://example.test/email/${index}`, day_seq: index, source_index: index,
  }));
  const graph = sourceGraph({
    globals: { ...clock.globals },
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
  const locale = graph.load("i18n/index.tsx");
  await locale.default.changeLanguage(language);
  const { ExtendedEmailFilter } = graph.load("components/ExtendedEmailFilter.tsx");
  await dom.render(h(ExtendedEmailFilter));
  await settle(() => {});
  return { dom, locale };
}

function customDateGroup(dom, label) {
  const groups = descendants(
    dom.container,
    (node) => node.nodeName === "DIV" && node.getAttribute("aria-label") === label,
  );
  assert.equal(groups.length, 1, `应挂载唯一带 aria-label="${label}" 的容器`);
  return groups[0];
}

it("自定义日期输入区带 role=group（中文）", async (t) => {
  const { dom, locale } = await mountFilter(t, "zh");
  const label = locale.translate("efFilterByDate");
  assert.ok(label && label.length > 0, "字典应提供 efFilterByDate");
  const group = customDateGroup(dom, label);
  assert.equal(group.getAttribute("role"), "group", "自定义日期区应声明组语义");
  const inputs = descendants(group, (node) =>
    node.nodeName === "INPUT" && node.type === "date");
  assert.equal(inputs.length, 2, "组内应包含起止两个日期输入框");
});

it("自定义日期输入区带 role=group（英文）", async (t) => {
  const { dom, locale } = await mountFilter(t, "en");
  const label = locale.translate("efFilterByDate");
  const group = customDateGroup(dom, label);
  assert.equal(group.getAttribute("role"), "group");
  assert.notEqual(label, "", "英文字典应提供对应标签");
});

it("日期预设组语义保持不变", async (t) => {
  const { dom, locale } = await mountFilter(t, "zh");
  const presetLabel = locale.translate("efDateGroupAria");
  const presetGroups = descendants(
    dom.container,
    (node) => node.nodeName === "DIV" && node.getAttribute("aria-label") === presetLabel,
  );
  assert.equal(presetGroups.length, 1, "日期预设组仍应唯一存在");
  assert.equal(presetGroups[0].getAttribute("role"), "group");
});
