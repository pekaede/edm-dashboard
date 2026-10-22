import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement as h } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";
import { deferred, flushPromises } from "./source-module.mjs";

async function mountAnalysis(t) {
  const dom = await mountDOM(t);
  const request = deferred();
  const overrides = {};
  const graph = sourceGraph({ overrides });
  // 仅在邮件数据与分析请求边界提供桩；组件、分析 hook 和状态更新使用生产实现。
  overrides["email-data.ts"] = {
    ...graph.load("email-data.ts"),
    useExtendedEmails: () => ({
      status: "ready", error: null, emails: [], retry() {}, meta: { dataSource: "supabase" },
    }),
  };
  overrides["email-content-analysis.ts"] = {
    ...graph.load("email-content-analysis.ts"),
    fetchContentAnalysis: () => request.promise,
  };
  const locale = graph.load("i18n/index.tsx");
  await locale.default.changeLanguage("zh");
  const { ContentAnalysis } = graph.load("components/ContentAnalysis.tsx");
  await dom.render(h(ContentAnalysis, {
    site: "US", window: { start: "2026-10-01", end: "2026-10-21" },
  }));
  const alerts = () => descendants(dom.container, (node) => node.getAttribute("role") === "alert");
  assert.equal(dom.container.firstChild.getAttribute("aria-busy"), "true");
  assert.equal(alerts().length, 0, "加载期间不应出现错误 alert");
  return {
    ...dom, alerts, translate: locale.translate,
    async fail(message) {
      await act(async () => {
        request.reject(new Error(message));
        await flushPromises();
      });
    },
  };
}

test("内容分析异步请求失败后，rose 错误容器带 role=alert", async (t) => {
  const f = await mountAnalysis(t);
  const message = "内容分析请求失败：HTTP 500";
  await f.fail(message);
  const error = f.container.firstChild;
  assert.ok(error.getAttribute("class").split(" ").includes("bg-rose-50"));
  assert.ok(error.textContent.includes(f.translate("caFailedTitle")));
  assert.ok(error.textContent.includes(message));
  assert.equal(error.getAttribute("role"), "alert");
  assert.deepEqual(f.alerts(), [error]);
});

test("内容分析未启用/未迁移时，amber 容器不带 role=alert", async (t) => {
  const f = await mountAnalysis(t);
  const message = "PGRST205: Could not find the table email_content_analysis";
  await f.fail(message);
  const notEnabled = f.container.firstChild;
  assert.ok(notEnabled.getAttribute("class").split(" ").includes("bg-amber-50"));
  assert.ok(notEnabled.textContent.includes(f.translate("caNotEnabledTitle")));
  assert.ok(notEnabled.textContent.includes(message));
  assert.equal(notEnabled.getAttribute("role"), null);
  assert.equal(f.alerts().length, 0, "未启用块及其子元素不应带 alert");
});
