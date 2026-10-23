import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as windows from "../src/data-window.ts";
import { loadSourceModule } from "./source-module.mjs";

function marketCountsModule() {
  return loadSourceModule("email-data.ts", {
    expose: ["countEmailsByMarket"],
    imports: {
      "./data-window": windows,
      "./supabase": {
        fetchEmailDataset: () => Promise.resolve({ rows: [], exactTotal: 0 }),
        isIncompleteDataError: () => false,
      },
    },
  });
}

const email = (market) => ({
  brand: "Zara", date: "2026-10-01", theme: "new", keywords: [],
  day_seq: 1, source_index: 0, market,
});

describe("countEmailsByMarket 键名碰撞防护", () => {
  it("常规市场聚合回归：8 市场计数/形状不变", () => {
    const { countEmailsByMarket } = marketCountsModule();
    const counts = countEmailsByMarket([
      email("US"), email("US"), email("UK"), email("AU"),
    ]);
    // 摊开再比较：null 原型对象自身携带无原型标记，逐键比较才是行为契约。
    assert.deepEqual({ ...counts }, { US: 2, UK: 1, AU: 1 });
    assert.equal(counts["US"], 2);
    assert.equal(counts["XX"] ?? 0, 0);
    assert.equal(Object.getPrototypeOf(counts), null);
  });

  it('含 dunder 风格的市场代码被记为普通自有键（如 "__proto__" → "__PROTO__"）', () => {
    const { countEmailsByMarket } = marketCountsModule();
    const before = Object.getOwnPropertyDescriptors(Object.prototype);
    const counts = countEmailsByMarket([
      email("__proto__"), email("constructor"), email("toString"), email("US"),
    ]);
    // getEmailMarket 统一大写后均为普通键；无原型对象保证即使直接用原键也无碰撞。
    assert.equal(counts["__PROTO__"], 1);
    assert.equal(counts["CONSTRUCTOR"], 1);
    assert.equal(counts["TOSTRING"], 1);
    assert.equal(counts["US"], 1);
    assert.equal(Object.hasOwn(counts, "__PROTO__"), true);
    assert.equal(Object.getPrototypeOf(counts), null);
    assert.deepEqual(
      Object.getOwnPropertyDescriptors(Object.prototype),
      before,
      "Object.prototype 不应被污染"
    );
  });

  it("返回的计数全部是数字且可 JSON 序列化/摊开", () => {
    const { countEmailsByMarket } = marketCountsModule();
    const counts = countEmailsByMarket([email("__proto__"), email("US")]);
    for (const key of Object.keys(counts)) {
      assert.equal(typeof counts[key], "number");
    }
    assert.doesNotThrow(() => JSON.stringify(counts));
  });
});
