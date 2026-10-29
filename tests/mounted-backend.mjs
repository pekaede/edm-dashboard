import assert from "node:assert/strict";
import { deferred } from "./source-module.mjs";

export const liveEnv = {
  VITE_EDM_DATA_SOURCE: "supabase",
  VITE_SUPABASE_URL: "https://edm-backend.test",
  VITE_SUPABASE_PUBLISHABLE_KEY: "test-public-key",
};

export function emailRow(source_index, market = "US") {
  return {
    brand: market === "US" ? "Zara" : "SHEIN", sent_date: "2026-10-09", market,
    theme: "new", keywords: [], original_url: null, day_seq: source_index, source_index,
  };
}

// 只替换 fetch：Supabase 分页/完整性校验、内外两层邮件缓存、分析读取及缓存均用生产实现。
export function mountedBackend() {
  let emails = [emailRow(0), emailRow(1, "UK")];
  let analysisVersion = 0;
  const calls = [];
  const gates = new Map();
  function hold(kind) {
    assert.ok(!gates.has(kind));
    const gate = deferred();
    gates.set(kind, gate);
    return () => { gates.delete(kind); gate.resolve(); };
  }
  return {
    calls, hold,
    setEmails(rows) { emails = rows; },
    setAnalysisVersion(value) { analysisVersion = value; },
    counts() {
      return Object.fromEntries(["schema", "emails", "analysis"].flatMap((kind) =>
        (kind === "schema" ? ["GET"] : ["HEAD", "GET"]).map((method) =>
          [`${kind}:${method}`, calls.filter((call) => call.kind === kind && call.method === method).length])));
    },
    async fetch(input, options = {}) {
      options.signal?.throwIfAborted();
      const url = new URL(input);
      assert.equal(url.origin, liveEnv.VITE_SUPABASE_URL, "测试禁止访问真实网络");
      const kind = url.pathname.endsWith("/emails") ? "emails"
        : url.pathname.endsWith("/email_content_analysis_current") ? "analysis"
          : url.pathname === "/rest/v1/" ? "schema" : null;
      assert.ok(kind, `意外的网络路径 ${url.pathname}`);
      const method = options.method ?? "GET";
      const call = { kind, method, url: new URL(url), signal: options.signal };
      calls.push(call);
      if (kind === "schema") return Response.json({});
      assert.equal(options.headers.Prefer, "count=exact");
      const rows = kind === "emails" ? emails : [{
        market: url.searchParams.get("market").slice(3), brand: "Zara", sent_date: "2026-10-01",
        day_seq: analysisVersion, analysis_type: "subject", status: "failed", result: null,
        analyzed_at: null, is_stale: false,
      }];
      if (method === "GET") await gates.get(kind)?.promise;
      options.signal?.throwIfAborted();
      const offset = Number(url.searchParams.get("offset"));
      const page = rows.slice(offset, offset + Number(url.searchParams.get("limit")));
      return new Response(method === "HEAD" ? null : JSON.stringify(page), {
        headers: { "Content-Range": `${offset}-${offset + page.length - 1}/${rows.length}` },
      });
    },
  };
}
