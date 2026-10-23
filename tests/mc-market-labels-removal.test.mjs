import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadSourceModule } from "./source-module.mjs";

const DATA = { themes: [{ key: "new", labelZh: "新" }] };
const emailData = {
  BRAND_ORDER: ["Zara", "lululemon", "ALO Yoga", "Halara", "Temu", "SHEIN"],
  getEmailMarket(email) {
    const market = (email.market ?? "US").trim().toUpperCase();
    return market === "" ? "US" : market;
  },
};

function email(date = "2026-10-01", market = "US", overrides = {}) {
  return { date, market, brand: "Zara", theme: "new", keywords: [], day_seq: 1, source_index: 0, ...overrides };
}

function loadComparison() {
  return loadSourceModule("components/MarketComparison.tsx", {
    expose: ["aggregateComparison"],
    imports: {
      "../data": { DATA },
      "../email-data": emailData,
      "../i18n": {}, "./Card": {}, "./dashboard": {}, "./ExtendedEmailsState": {},
      "./MarketFilter": {}, "./Tooltip": {}, "../three-week-aggregation": {},
    },
  });
}

const meta = { windowStart: "2026-10-01", windowEnd: "2026-10-07" };

describe("MarketComparison marketLabels 清理", () => {
  it("常规 8 市场聚合结果不含 marketLabels 键", () => {
    const { aggregateComparison } = loadComparison();
    const fixedMarkets = ["US", "UK", "AU", "FR", "DE", "IT", "ES", "NL"];
    const data = aggregateComparison(fixedMarkets.map((market) => email("2026-10-01", market)), meta);

    assert.equal(Object.hasOwn(data, "marketLabels"), false);
    assert.deepEqual(data.markets, fixedMarkets);
  });

  it("未知市场仍按字母序追加并参与聚合", () => {
    const { aggregateComparison } = loadComparison();
    const data = aggregateComparison([email("2026-10-01", "ZZ")], meta);

    assert.equal(Object.hasOwn(data, "marketLabels"), false);
    assert.deepEqual(data.markets, ["US", "UK", "AU", "FR", "DE", "IT", "ES", "NL", "ZZ"]);
    assert.equal(data.marketTotals.get("ZZ"), 1);
    assert.equal(data.brandMarket.get("Zara").get("ZZ"), 1);
  });
});
