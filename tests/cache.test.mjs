import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as windows from "../src/data-window.ts";
import { createClock, deferred, flushPromises, loadSourceModule } from "./source-module.mjs";

function emailCache() {
  const clock = createClock();
  const calls = [];
  const api = loadSourceModule("email-data.ts", {
    expose: ["requestExtendedEmails", "loadExtendedEmails", "getSnapshot"],
    globals: clock.globals,
    imports: {
      "./data-window": windows,
      "./supabase": {
        fetchEmailDataset(force) {
          const request = { ...deferred(), force };
          calls.push(request);
          return request.promise;
        },
        isIncompleteDataError: (error) => error?.code === "incomplete",
      },
    },
  });
  return { api, clock, calls };
}

const emptyDataset = { rows: [], exactTotal: 0 };

describe("邮件缓存：真实实现与可控适配器/时钟", () => {
  it("请求去重；新鲜度从完成时起算，恰好五分钟失效", async () => {
    const { api, clock, calls } = emailCache();
    const first = api.getExtendedEmails("supabase");
    assert.strictEqual(api.getExtendedEmails("supabase"), first);
    assert.equal(calls.length, 1);
    clock.advance(1_000);
    calls[0].resolve(emptyDataset);
    await first;
    assert.equal(clock.pendingCount(), 0);
    clock.advance(api.EMAIL_DATA_STALE_TIME - 1);
    assert.strictEqual(api.getExtendedEmails("supabase"), first);
    clock.advance(1);
    const expired = api.getExtendedEmails("supabase");
    assert.notStrictEqual(expired, first);
    assert.equal(calls.length, 2);
    calls[1].resolve(emptyDataset);
    await expired;
  });

  it("超时拒绝、释放 pending，重试不被未响应的旧请求或迟到结果占住", async () => {
    const { api, clock, calls } = emailCache();
    const first = api.getExtendedEmails("supabase");
    const rejected = assert.rejects(first, /邮件加载超时/);
    clock.advance(api.EMAIL_DATA_REQUEST_TIMEOUT_MS);
    await rejected;
    assert.equal(clock.pendingCount(), 0);
    const retry = api.getExtendedEmails("supabase");
    assert.notStrictEqual(retry, first);
    assert.equal(calls.length, 2);
    calls[0].resolve(emptyDataset);
    await flushPromises();
    assert.strictEqual(api.getExtendedEmails("supabase"), retry);
    calls[1].resolve(emptyDataset);
    await retry;
    assert.strictEqual(api.getExtendedEmails("supabase"), retry);
  });

  it("force 同时穿透新鲜缓存与 pending，并把 force 传给下层", async () => {
    const { api, calls } = emailCache();
    const first = api.getExtendedEmails("supabase");
    calls[0].resolve(emptyDataset);
    await first;
    const forced = api.requestExtendedEmails("supabase", true, true);
    assert.notStrictEqual(forced, first);
    const forcedAgain = api.requestExtendedEmails("supabase", true, true);
    assert.notStrictEqual(forcedAgain, forced);
    assert.deepEqual(calls.map((call) => call.force), [false, true, true]);
    assert.strictEqual(api.getExtendedEmails("supabase"), forcedAgain);
    calls[2].resolve(emptyDataset);
    await forcedAgain;
    calls[1].resolve(emptyDataset);
    await forced;
    assert.strictEqual(api.getExtendedEmails("supabase"), forcedAgain);
  });

  it("reset 隔离旧响应；旧请求结算不能删除新 pending 或覆盖当前状态", async () => {
    const { api, calls } = emailCache();
    api.loadExtendedEmails();
    const old = api.getExtendedEmails("supabase");
    api.resetExtendedEmailsCache();
    assert.equal(api.getSnapshot().status, "loading");
    api.loadExtendedEmails();
    const current = api.getExtendedEmails("supabase");
    assert.notStrictEqual(current, old);
    calls[0].resolve(emptyDataset);
    await old;
    assert.equal(api.getSnapshot().status, "loading");
    assert.strictEqual(api.getExtendedEmails("supabase"), current);
    calls[1].resolve(emptyDataset);
    await current;
    assert.equal(api.getSnapshot().status, "ready");
    assert.strictEqual(api.getExtendedEmails("supabase"), current);
  });

  it("失败及不完整首次结果不成为有效缓存，后台刷新失败保留成功结果", async () => {
    const { api, calls } = emailCache();
    const failed = api.getExtendedEmails("supabase");
    const rejected = assert.rejects(failed, /网络失败/);
    calls[0].reject(new Error("网络失败"));
    await rejected;
    const incomplete = api.getExtendedEmails("supabase");
    calls[1].resolve({ rows: [], exactTotal: 1 });
    await incomplete;
    const complete = api.getExtendedEmails("supabase");
    assert.notStrictEqual(complete, incomplete);
    calls[2].resolve(emptyDataset);
    await complete;
    const refresh = api.requestExtendedEmails("supabase", true);
    const refreshRejected = assert.rejects(refresh, /刷新失败/);
    calls[3].reject(new Error("刷新失败"));
    await refreshRejected;
    assert.strictEqual(api.getExtendedEmails("supabase"), complete);
  });
});

function analysisCache() {
  const clock = createClock();
  const calls = [];
  let notify;
  const api = loadSourceModule("email-content-analysis-data.ts", {
    expose: ["getEntry", "loadAnalysis", "cancelRequest"],
    globals: clock.globals,
    imports: {
      "./email-data": {
        EMAIL_DATA_STALE_TIME: 300_000, EMAIL_DATA_REQUEST_TIMEOUT_MS: 30_000,
        subscribeEmailDataRefresh(listener) { notify = listener; },
      },
      "./email-content-analysis": {
        fetchContentAnalysis(params) {
          const request = { ...deferred(), params };
          calls.push(request);
          return request.promise;
        },
      },
    },
  });
  return { api, calls, clock, notify: (event) => notify(event) };
}

const params = { source: "supabase", market: "US", start: "2026-07-20", end: "2026-10-20" };

describe("分析缓存：真实实现与可控请求/时钟", () => {
  it("缓存键区分来源、站点、窗口；JSON 和全部市场不查询 live", () => {
    const { api, calls } = analysisCache();
    const first = api.getEntry(params);
    assert.strictEqual(api.getEntry({ ...params }), first);
    for (const changes of [{ source: "json" }, { market: "UK" }, { start: "2026-07-21" }, { end: "2026-10-19" }]) {
      assert.notStrictEqual(api.getEntry({ ...params, ...changes }), first);
    }
    for (const changes of [{ source: "json" }, { market: null }]) {
      const entry = api.getEntry({ ...params, ...changes });
      api.loadAnalysis(entry, true, true);
      assert.deepEqual(entry.state, { status: "ready", rows: [], error: null });
    }
    assert.equal(calls.length, 0);
  });

  it("恰好五分钟失效；force 取消 pending，迟到响应不能回写", async () => {
    const { api, calls, clock } = analysisCache();
    const entry = api.getEntry(params);
    api.loadAnalysis(entry);
    api.loadAnalysis(entry);
    assert.equal(calls.length, 1);
    calls[0].resolve([{ id: "first" }]);
    await flushPromises();
    clock.advance(299_999);
    api.loadAnalysis(entry);
    assert.equal(calls.length, 1);
    clock.advance(1);
    api.loadAnalysis(entry);
    api.loadAnalysis(entry, true, true);
    assert.equal(calls.length, 3);
    assert.equal(calls[1].params.signal.aborted, true);
    calls[2].resolve([{ id: "new" }]);
    await flushPromises();
    calls[1].resolve([{ id: "late" }]);
    await flushPromises();
    assert.deepEqual(entry.state.rows, [{ id: "new" }]);
    assert.equal(entry.controller, null);
  });

  it("超时取消并释放控制器，首次失败不缓存且可重试", async () => {
    const { api, calls, clock } = analysisCache();
    const entry = api.getEntry(params);
    api.loadAnalysis(entry);
    clock.advance(30_000);
    await flushPromises();
    assert.equal(calls[0].params.signal.aborted, true);
    assert.equal(entry.controller, null);
    assert.equal(entry.updatedAt, null);
    assert.equal(entry.state.status, "error");
    assert.match(entry.state.error.message, /内容分析加载超时/);
    api.loadAnalysis(entry);
    calls[1].resolve([]);
    await flushPromises();
    assert.equal(entry.state.status, "ready");
    assert.equal(clock.pendingCount(), 0);
  });

  it("reset 清空未订阅缓存并阻止旧响应回写；取消后重新加载也隔离旧响应", async () => {
    const { api, calls, notify } = analysisCache();
    const entry = api.getEntry(params);
    api.loadAnalysis(entry);
    notify({ type: "reset" });
    assert.equal(calls[0].params.signal.aborted, true);
    assert.equal(entry.updatedAt, null);
    assert.equal(entry.state.status, "loading");
    api.loadAnalysis(entry);
    api.cancelRequest(entry);
    assert.equal(calls[1].params.signal.aborted, true);
    api.loadAnalysis(entry);
    calls[2].resolve([{ id: "current" }]);
    await flushPromises();
    calls[0].resolve([{ id: "before-reset" }]);
    calls[1].resolve([{ id: "before-cancel" }]);
    await flushPromises();
    assert.deepEqual(entry.state.rows, [{ id: "current" }]);
  });

  it("成功数据后台刷新超时仍保留，主数据 force 信号只刷新同来源的订阅项", async () => {
    const { api, calls, notify, clock } = analysisCache();
    const entry = api.getEntry(params);
    const idle = api.getEntry({ ...params, market: "UK" });
    entry.listeners.add(() => {});
    api.loadAnalysis(entry);
    calls[0].resolve([{ id: "cached" }]);
    await flushPromises();
    const successful = entry.state;
    notify({ type: "refresh", source: "json", force: true });
    assert.equal(calls.length, 1);
    notify({ type: "refresh", source: "supabase", force: true });
    assert.equal(calls.length, 2);
    assert.equal(idle.controller, null);
    clock.advance(30_000);
    await flushPromises();
    assert.strictEqual(entry.state, successful);
    assert.equal(entry.controller, null);
  });
});
