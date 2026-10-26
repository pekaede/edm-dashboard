import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { aggregateThreeWeek } from "../src/three-week-aggregation.ts";
import { email, loadSiteData } from "./site-data-fixtures.mjs";

describe("Provider 的站点三周共享缓存", () => {
  it("多次读取相同站点得到同一结果，切站点隔离并在切回时复用", () => {
    let calculations = 0;
    const { createSiteDataCache } = loadSiteData({ aggregate(emails) {
      calculations += 1;
      return aggregateThreeWeek(emails);
    } });
    const read = createSiteDataCache();
    const emails = [email("2026-10-06"), email("2026-10-07", "UK")];
    const us = read(emails, "ready", "US");
    const uk = read(emails, "ready", "UK");
    assert.strictEqual(read(emails, "ready", "US"), us);
    assert.strictEqual(read(emails, "ready", "UK").threeWeekData, uk.threeWeekData);
    assert.notStrictEqual(us.threeWeekData, uk.threeWeekData);
    assert.deepEqual(us.emails, [emails[0]]);
    assert.deepEqual(uk.emails, [emails[1]]);
    assert.equal(calculations, 2);
    assert.equal(read(emails, "ready", null).threeWeekData.total, 2);
    assert.equal(calculations, 3);
  });

  it("邮件引用变化使所有站点缓存失效，包括尚未再次访问的站点", () => {
    const { createSiteDataCache } = loadSiteData();
    const read = createSiteDataCache();
    const emails = [email("2026-10-06"), email("2026-10-07", "UK")];
    const oldUS = read(emails, "ready", "US");
    const oldUK = read(emails, "ready", "UK");
    const refreshed = [...emails, email("2026-10-08", "UK")];
    assert.notStrictEqual(read(refreshed, "ready", "US").threeWeekData, oldUS.threeWeekData);
    const uk = read(refreshed, "ready", "UK");
    assert.notStrictEqual(uk.threeWeekData, oldUK.threeWeekData);
    assert.equal(uk.threeWeekData.total, 2);
    assert.strictEqual(read(refreshed, "ready", "UK"), uk);
  });

  it("loading/error/incomplete 不聚合、不缓存，恢复 ready 后即使同引用也重新计算", () => {
    for (const status of ["loading", "error", "incomplete"]) {
      const read = loadSiteData().createSiteDataCache();
      const emails = [email("2026-10-06")];
      const ready = read(emails, "ready", "US");
      const pending = read(emails, status, "US");
      assert.equal(pending.threeWeekData, null, status);
      assert.notStrictEqual(read(emails, status, "US"), pending, status);
      const recovered = read(emails, "ready", "US");
      assert.notStrictEqual(recovered.threeWeekData, ready.threeWeekData, status);
      assert.equal(recovered.threeWeekData.total, 1, status);
    }
  });

  it("Provider 缓存互相隔离，空站点也缓存有效的零值聚合", () => {
    const { createSiteDataCache } = loadSiteData();
    const first = createSiteDataCache();
    const second = createSiteDataCache();
    const emails = [email()];
    const empty = first(emails, "ready", "ES");
    assert.equal(empty.total, 0);
    assert.equal(empty.threeWeekData.total, 0);
    assert.deepEqual(empty.threeWeekData.weekTotals, [0, 0, 0]);
    assert.strictEqual(first(emails, "ready", "ES"), empty);
    assert.notStrictEqual(second(emails, "ready", "ES").threeWeekData, empty.threeWeekData);
  });

  it("真实 React Provider 下多个 hook 消费者只聚合一次，并保留公开返回结构", () => {
    let calculations = 0;
    const snapshot = {
      status: "ready", emails: [email("2026-10-06"), email("2026-10-07", "UK")], total: 2,
      error: null, retry: () => {},
      meta: { windowStart: "2026-07-20", windowEnd: "2026-10-20", range: "三个月", market: "原标签",
        source: "Milled", brandCount: 6, weekCount: 3, total: 2, dataSource: "supabase", provenance: "live" },
    };
    const { SiteProvider, useSiteEmails, useSiteThreeWeekData } = loadSiteData({ snapshot, aggregate(emails) {
      calculations += 1;
      return aggregateThreeWeek(emails);
    } });
    const consumers = [];
    function Consumer() {
      consumers.push({ site: useSiteEmails(), threeWeek: useSiteThreeWeekData() });
      return null;
    }
    renderToString(createElement(SiteProvider, null, createElement(Consumer), createElement(Consumer)));
    const [first, second] = consumers;
    assert.equal(calculations, 1);
    assert.strictEqual(first.site, second.site);
    assert.strictEqual(first.threeWeek.emails, second.threeWeek.emails);
    assert.strictEqual(first.threeWeek.data, second.threeWeek.data);
    assert.deepEqual(Object.keys(first.site).sort(), Object.keys(snapshot).sort());
    assert.deepEqual(Object.keys(first.threeWeek).sort(), [...Object.keys(snapshot), "data"].sort());
    assert.strictEqual(first.site.retry, snapshot.retry);
    assert.equal(first.site.total, 1);
    assert.deepEqual(first.site.meta, { ...snapshot.meta, market: "US", total: 1, brandCount: 1 });
    assert.equal(first.threeWeek.data.total, 1);
  });

  it("非 ready 保持 null 聚合与未知总数，JSON 来源和当前语言的标签仍正确", () => {
    for (const locale of ["zh", "en"]) {
      const snapshot = {
        status: "incomplete", emails: [email()], total: 1, error: "缺页", retry: () => {},
        meta: { dataSource: "json", total: 2, windowStart: "2026-07-16", windowEnd: "2026-10-15" },
      };
      const { SiteProvider, useSiteThreeWeekData } = loadSiteData({ snapshot, locale,
        label: () => locale === "en" ? "United States" : "美国" });
      let result;
      function Consumer() { result = useSiteThreeWeekData(); return null; }
      renderToString(createElement(SiteProvider, null, createElement(Consumer)));
      assert.equal(result.data, null);
      assert.equal(result.meta.total, null);
      assert.equal(result.meta.market, `${locale === "en" ? "United States" : "美国"}（历史 US 回滚源）`);
      assert.equal(result.error, "缺页");
      assert.strictEqual(result.retry, snapshot.retry);
    }
  });
});
