import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadSourceModule } from "./source-module.mjs";

// 开放 ContentAnalysis.tsx 的私有纯函数 aggregateSubjectAnalysis，直接断言聚合语义；不修改聚合实现。
function loadAggregate() {
  return loadSourceModule("components/ContentAnalysis.tsx", {
    expose: ["aggregateSubjectAnalysis"],
    imports: {
      "../email-content-analysis": {},
      "../email-content-analysis-data": {},
      "../email-data": {},
      "../i18n": {},
      "./Card": {},
      "./EmptyState": {},
      "./ui/button": {},
      "./ui/loading-block": {},
      "./ui/popover": {},
    },
  });
}

function subject(overrides = {}) {
  return {
    tactics: [],
    discount_framing: null,
    length_chars: 10,
    emoji_count: 0,
    cta_verbs: [],
    personalization: false,
    trend_terms: [],
    ...overrides,
  };
}

describe("aggregateSubjectAnalysis 封内归一化去重", () => {
  it("单封内大小写/空格变体策略只计一次，占比不超 100%", () => {
    const { aggregateSubjectAnalysis } = loadAggregate();
    const summary = aggregateSubjectAnalysis([
      subject({ tactics: ["discount", " Discount ", "DISCOUNT"] }),
    ]);
    assert.equal(summary.analyzedCount, 1);
    assert.deepEqual(
      summary.tactics.map(({ key, count, percentage }) => ({ key, count, percentage })),
      [{ key: "discount", count: 1, percentage: 100 }],
    );
  });

  it("单封内重复 CTA 动词只计一次", () => {
    const { aggregateSubjectAnalysis } = loadAggregate();
    const summary = aggregateSubjectAnalysis([
      subject({ cta_verbs: ["Shop", " shop", "SHOP"] }),
    ]);
    assert.deepEqual(
      summary.topCtaVerbs.map(({ verb, count }) => ({ verb, count })),
      [{ verb: "shop", count: 1 }],
    );
  });

  it("discount_framing 大小写变体合并计数，展示保留首次原文", () => {
    const { aggregateSubjectAnalysis } = loadAggregate();
    const summary = aggregateSubjectAnalysis([
      subject({ discount_framing: "20% OFF" }),
      subject({ discount_framing: "20% off" }),
      subject({ discount_framing: "Buy 1 Get 1" }),
    ]);
    assert.deepEqual(summary.discountFramings, [
      { text: "20% OFF", count: 2 },
      { text: "Buy 1 Get 1", count: 1 },
    ]);
  });

  it("跨封聚合行为不变：不同封同策略累加、不同策略各自计数并按计数降序", () => {
    const { aggregateSubjectAnalysis } = loadAggregate();
    const summary = aggregateSubjectAnalysis([
      subject({ tactics: ["discount", "urgency"] }),
      subject({ tactics: ["discount"] }),
      subject({ tactics: ["  ", ""] }),
    ]);
    assert.equal(summary.analyzedCount, 3);
    assert.deepEqual(
      summary.tactics.map(({ key, count, percentage }) => ({ key, count, percentage })),
      [
        { key: "discount", count: 2, percentage: 67 },
        { key: "urgency", count: 1, percentage: 33 },
      ],
    );
  });

  it("跨封动词累加、空值与空白被忽略", () => {
    const { aggregateSubjectAnalysis } = loadAggregate();
    const summary = aggregateSubjectAnalysis([
      subject({ cta_verbs: ["shop"] }),
      subject({ cta_verbs: ["Shop", "buy"] }),
      subject({ cta_verbs: ["", "   "], discount_framing: "   " }),
    ]);
    assert.deepEqual(
      summary.topCtaVerbs.map(({ verb, count }) => ({ verb, count })),
      [
        { verb: "shop", count: 2 },
        { verb: "buy", count: 1 },
      ],
    );
    assert.deepEqual(summary.discountFramings, []);
  });
});
