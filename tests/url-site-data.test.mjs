import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildHash, isEqualPageState, parseHash } from "../src/url-state.ts";
import { email, loadSiteData } from "./site-data-fixtures.mjs";

describe("URL 与站点缓存的纯逻辑契约", () => {
  it("多实例独立解析同一 URL 后，读取相同站点的同一聚合对象", () => {
    const read = loadSiteData().createSiteDataCache();
    const emails = [email(), email("2026-10-02", "UK")];
    const hash = "#emails/uk/Zara/new?q=coat";
    const first = parseHash(hash);
    const second = parseHash(hash);
    assert.notStrictEqual(first, second);
    assert.equal(isEqualPageState(first, second), true);
    assert.strictEqual(read(emails, "ready", first.market).threeWeekData,
      read(emails, "ready", second.market).threeWeekData);
    first.query = "另一个实例的局部变更";
    assert.equal(second.query, "coat");
    assert.equal(isEqualPageState(first, second), false);
  });

  it("按前进/后退顺序读取完整 URL 快照，站点、全部市场及筛选能独立恢复", () => {
    const read = loadSiteData().createSiteDataCache();
    const emails = [email(), email("2026-10-02", "UK"), email("2026-10-03", "UK")];
    const history = ["#emails/US/Zara/new?q=coat", "#calendar/UK/SHEIN/price?q=sale", "#dashboard/all"];
    const expected = [
      { market: "US", total: 1, brand: "Zara", theme: "new", query: "coat" },
      { market: "UK", total: 2, brand: "SHEIN", theme: "price", query: "sale" },
      { market: null, total: 3, brand: "all", theme: null, query: "" },
    ];
    const seen = new Map();
    for (const index of [0, 1, 2, 1, 0, 1, 2]) {
      const state = parseHash(history[index]);
      const { total, ...filters } = expected[index];
      assert.deepEqual({ market: state.market, brand: state.brand, theme: state.theme, query: state.query }, filters);
      assert.equal(state.marketSpecified, true);
      assert.equal(buildHash(state), history[index]);
      const site = read(emails, "ready", state.market);
      assert.equal(site.threeWeekData.total, total);
      if (seen.has(index)) assert.strictEqual(site.threeWeekData, seen.get(index));
      else seen.set(index, site.threeWeekData);
    }
  });

  it("导航中的未指定市场与显式全部市场即使 market 同为 null 也不相等", () => {
    const implicit = parseHash("#emails");
    const explicit = parseHash("#emails/all");
    assert.equal(implicit.market, null);
    assert.equal(explicit.market, null);
    assert.equal(isEqualPageState(implicit, explicit), false);
    for (const [hash, specified] of [["#emails", false], ["#emails/all", true], ["#emails", false]]) {
      const state = parseHash(hash);
      assert.equal(state.marketSpecified, specified);
      assert.equal(buildHash(state), hash);
    }
  });

  it("连续编辑最新序列化状态时，切站点和改搜索词均保留其他实例的筛选字段", () => {
    // 只验证 parse/build 的组合契约；hook 是否确实读取最新 location 需集成验证。
    let hash = "#emails/US";
    hash = buildHash({ ...parseHash(hash), brand: "SHEIN", theme: "price" });
    hash = buildHash({ ...parseHash(hash), market: "UK", marketSpecified: true });
    hash = buildHash({ ...parseHash(hash), query: "linen + sale" });
    assert.deepEqual(parseHash(hash), {
      view: "emails", market: "UK", marketSpecified: true,
      brand: "SHEIN", theme: "price", query: "linen + sale",
      dateFrom: "", dateTo: "",
    });
  });

  it("导航相等判定覆盖所有状态字段；原始视图不同可具有相同解析状态", () => {
    const base = parseHash("#emails/US/Zara/new?q=coat");
    for (const change of [
      { view: "calendar" }, { market: "UK" }, { marketSpecified: false },
      { brand: "SHEIN" }, { theme: "price" }, { query: "sale" },
      { dateFrom: "2026-10-01" }, { dateTo: "2026-10-20" },
    ]) {
      assert.equal(isEqualPageState(base, { ...base, ...change }), false, JSON.stringify(change));
    }
    assert.equal(isEqualPageState(base, { ...base }), true);
    assert.equal(isEqualPageState(parseHash("#unknown/UK"), parseHash("#report/UK")), true);
  });
});
