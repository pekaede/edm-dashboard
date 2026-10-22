import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sourceGraph } from "./mounted-source.mjs";

// 生成型文本 i18n 回归锁（洞察 / 品牌 strategy / OnePage 摘要与报告）：
// GOLDEN 是改版前生产代码（分支基点 3470f5b）在同一 fixture 上生成的输出，写死在此。
// zh 用例证明模板化后输出逐字不变（数字、百分比、日期与连接符口径未动）；
// en 用例断言无中文残留（本 fixture 的品牌名/市场名等专有名词均为拉丁字母），并抽查关键句。
const GOLDEN = {
 "insights": [
  "当前站点三周收录 41 封，覆盖 22 天，日均 1.9 封；这是可见收录量，不是实际全量发送。",
  "SHEIN 收录最多：14 封，占当前站点三周样本 34.1%。",
  "价格促销是当前主要主题：14 封，占 34.1%；含服务/法务通知的其他主题不等于营销。",
  "Week 3（10/13–10/20）收录 18 封；各桶覆盖天数可能不同，不能仅凭总量判断营销效果。"
 ],
 "insightsEmpty": [
  "该站点在三周窗口内暂无邮件，不推断主题偏好或触达策略。"
 ],
 "strategyHas": "SHEIN 在当前站点三周窗口收录 14 封；下列主题和周分布均为实时聚合，不代表营销效果。",
 "strategyZero": "lululemon 在当前站点三周窗口内暂未收录到邮件；未收录不代表该品牌未发送，可能存在渠道未覆盖。",
 "campaigns": [
  "当前站点 9/29–10/5 收录 4 封邮件。",
  "当前站点 10/6–10/12 收录 4 封邮件。",
  "当前站点 10/13–10/20 收录 6 封邮件。"
 ],
 "summary": {
  "decisions": [
   {
    "title": "先看谁：确定复盘对象",
    "conclusion": "SHEIN是当前可见样本中收录最多的品牌，优先作为素材复盘入口，而非效果标杆。",
    "evidence": "14 封，占三周样本 34.1%。",
    "action": "先挑选该品牌同主题的代表邮件，比较利益点、CTA 与落地页，避免混合不同任务的邮件。"
   },
   {
    "title": "看什么：形成内容假设",
    "conclusion": "价格促销是收录最多的主题，可作为内容探索起点，但不能据此断言用户偏好。",
    "evidence": "14 封，占三周样本 34.1%。",
    "action": "先拆解优惠门槛、利益表达与落地页的一致性；用自有样本测试，不直接跟价。"
   },
   {
    "title": "何时看：核对触达节奏",
    "conclusion": "Week 3（10/13–10/20）的日均可见收录最高，值得核对活动节点和通知类邮件。",
    "evidence": "按各桶实际天数归一：Week 1 1.57 封/日（7 天）；Week 2 1.71 封/日（7 天）；Week 3 2.25 封/日（8 天）。",
    "action": "把高频时段作为核查线索；频次调整先在自有可比受众上测试，同时观察退订与转化，不照搬竞品频次。"
   }
  ],
  "watchpoints": [
   "其他类有 4 封，可能包含服务或法务通知；确认用途后再纳入营销对标。",
   "样本来自 United States 的可见收录；市场收录覆盖不同，不把绝对邮件量当作市场需求或效果排名。",
   "查询固定截止 2026-10-20；三周与三个月是不同窗口，不能把两者总量直接当作增长。",
   "没有打开率、点击率、转化率或退订数据；以下结论用于确定复盘和实验优先级，不证明营销效果。"
  ],
  "nextStep": "本轮只选择一个内容或节奏假设，先核实邮件用途和素材，再做可比受众的单变量测试；用转化与退订反馈决定是否扩大。"
 },
 "summaryTie": {
  "decisions": [
   {
    "title": "先看谁：确定复盘对象",
    "conclusion": "Halara、Zara并列为当前可见样本中收录最多的品牌，优先作为素材复盘入口，而非效果标杆。",
    "evidence": "各14 封，占三周样本 50.0%。",
    "action": "先挑选该品牌同主题的代表邮件，比较利益点、CTA 与落地页，避免混合不同任务的邮件。"
   },
   {
    "title": "看什么：形成内容假设",
    "conclusion": "价格促销、上新并列为收录最多的主题，可作为内容探索起点，但不能据此断言用户偏好。",
    "evidence": "各14 封，占三周样本 50.0%。",
    "action": "先抽样比较并列主题的内容和受众，选择一个假设做单变量测试，不因排序强行押注单一主题。"
   },
   {
    "title": "何时看：核对触达节奏",
    "conclusion": "Week 1（9/29–10/5）、Week 2（10/6–10/12）的日均可见收录最高，值得核对活动节点和通知类邮件。",
    "evidence": "按各桶实际天数归一：Week 1 1.43 封/日（7 天）；Week 2 1.43 封/日（7 天）；Week 3 1.00 封/日（8 天）。",
    "action": "把高频时段作为核查线索；频次调整先在自有可比受众上测试，同时观察退订与转化，不照搬竞品频次。"
   }
  ],
  "watchpoints": [
   "近期样本较少，少量新增记录就可能改变排序；先补充取证，不做强归因。",
   "样本来自 United States 的可见收录；市场收录覆盖不同，不把绝对邮件量当作市场需求或效果排名。",
   "查询固定截止 2026-10-20；三周与三个月是不同窗口，不能把两者总量直接当作增长。",
   "没有打开率、点击率、转化率或退订数据；以下结论用于确定复盘和实验优先级，不证明营销效果。"
  ],
  "nextStep": "本轮只选择一个内容或节奏假设，先核实邮件用途和素材，再做可比受众的单变量测试；用转化与退订反馈决定是否扩大。"
 },
 "summaryEmpty": {
  "decisions": [
   {
    "title": "暂不做近期策略判断",
    "conclusion": "三周窗口没有可见收录，不据此判断品牌停止发送或主题发生变化。",
    "evidence": "2026-09-29 – 2026-10-20：0 封；三个月样本 0 封。",
    "action": "先核对站点与收录覆盖，再用附录的三个月数据寻找待验证线索。"
   }
  ],
  "watchpoints": [
   "三个月记录不能替代三周窗口的近期证据。",
   "查询固定截止 2026-10-20，不代表此后没有发送。"
  ],
  "nextStep": "补齐近期样本前，不调整主题预算或发送频次。"
 },
 "report": "# EDM 竞品 OnePage｜United States\n\n> **统计口径**：三周 2026-09-29 – 2026-10-20，41 封；三个月 2026-07-20 – 2026-10-20，41 封。查询固定截止 2026-10-20，不是开放日期查询。\n\n> 计数为 Milled 可见收录，不是实际全量发送。每封只归一个主题；包含服务/法务通知，不能把全部邮件统称营销。没有打开率、点击率或转化率，不据此推断营销效果。\n\n## 决策摘要\n\n### 关键结论与行动\n\n- **先看谁：确定复盘对象**：SHEIN是当前可见样本中收录最多的品牌，优先作为素材复盘入口，而非效果标杆。 证据：14 封，占三周样本 34.1%。 建议：先挑选该品牌同主题的代表邮件，比较利益点、CTA 与落地页，避免混合不同任务的邮件。\n\n- **看什么：形成内容假设**：价格促销是收录最多的主题，可作为内容探索起点，但不能据此断言用户偏好。 证据：14 封，占三周样本 34.1%。 建议：先拆解优惠门槛、利益表达与落地页的一致性；用自有样本测试，不直接跟价。\n\n- **何时看：核对触达节奏**：Week 3（10/13–10/20）的日均可见收录最高，值得核对活动节点和通知类邮件。 证据：按各桶实际天数归一：Week 1 1.57 封/日（7 天）；Week 2 1.71 封/日（7 天）；Week 3 2.25 封/日（8 天）。 建议：把高频时段作为核查线索；频次调整先在自有可比受众上测试，同时观察退订与转化，不照搬竞品频次。\n\n### 值得关注\n\n- 其他类有 4 封，可能包含服务或法务通知；确认用途后再纳入营销对标。\n\n- 样本来自 United States 的可见收录；市场收录覆盖不同，不把绝对邮件量当作市场需求或效果排名。\n\n- 查询固定截止 2026-10-20；三周与三个月是不同窗口，不能把两者总量直接当作增长。\n\n- 没有打开率、点击率、转化率或退订数据；以下结论用于确定复盘和实验优先级，不证明营销效果。\n\n**下一步**：本轮只选择一个内容或节奏假设，先核实邮件用途和素材，再做可比受众的单变量测试；用转化与退订反馈决定是否扩大。\n\n## 完整报告附录\n\n### 1. 当前站点最近在做什么？\n\n- 当前站点三周收录 41 封，覆盖 22 天，日均 1.9 封；这是可见收录量，不是实际全量发送。\n\n- SHEIN 收录最多：14 封，占当前站点三周样本 34.1%。\n\n- 价格促销是当前主要主题：14 封，占 34.1%；含服务/法务通知的其他主题不等于营销。\n\n- Week 3（10/13–10/20）收录 18 封；各桶覆盖天数可能不同，不能仅凭总量判断营销效果。\n\n#### 三周分品牌周分布\n\n| 品牌 | Week 1（9/29–10/5） | Week 2（10/6–10/12） | Week 3（10/13–10/20） | 合计 | 日均 |\n| --- | --- | --- | --- | --- | --- |\n| Halara | 3 | 3 | 3 | 9 | 0.41 |\n| ALO Yoga | 1 | 1 | 2 | 4 | 0.18 |\n| SHEIN | 4 | 4 | 6 | 14 | 0.64 |\n| Temu | 2 | 2 | 4 | 8 | 0.36 |\n| lululemon | 0 | 0 | 0 | 0 | 0.00 |\n| Zara | 1 | 2 | 3 | 6 | 0.27 |\n| 合计 | 11 | 12 | 18 | 41 | 1.86 |\n\n### 2. 主题与品牌日频有什么区别？\n\n| 主题 | 三周封数 | 三周占比 | 三个月封数 | 三个月占比 |\n| --- | --- | --- | --- | --- |\n| 价格促销 | 14 | 34.1% | 14 | 34.1% |\n| 行为触发 | 8 | 19.5% | 8 | 19.5% |\n| 上新 | 9 | 22.0% | 9 | 22.0% |\n| 生活方式 | 6 | 14.6% | 6 | 14.6% |\n| 品类聚焦 | 0 | 0.0% | 0 | 0.0% |\n| 其他 | 4 | 9.8% | 4 | 9.8% |\n\n| 品牌 | 三个月封数 | 日均（93 天） |\n| --- | --- | --- |\n| Zara | 6 | 0.06 |\n| lululemon | 0 | 0.00 |\n| ALO Yoga | 4 | 0.04 |\n| Halara | 9 | 0.10 |\n| Temu | 8 | 0.09 |\n| SHEIN | 14 | 0.15 |\n\n#### 三个月分品牌周分布\n\n| 周 | 日期 | Zara | lululemon | ALO Yoga | Halara | Temu | SHEIN | 合计 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n| W1 | 2026-07-20–2026-07-26 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |\n| W2 | 2026-07-27–2026-08-02 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |\n| W3 | 2026-08-03–2026-08-09 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |\n| W4 | 2026-08-10–2026-08-16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |\n| W5 | 2026-08-17–2026-08-23 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |\n| W6 | 2026-08-24–2026-08-30 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |\n| W7 | 2026-08-31–2026-09-06 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |\n| W8 | 2026-09-07–2026-09-13 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |\n| W9 | 2026-09-14–2026-09-20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |\n| W10 | 2026-09-21–2026-09-27 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |\n| W11 | 2026-09-28–2026-10-04 | 1 | 0 | 1 | 3 | 2 | 4 | 11 |\n| W12 | 2026-10-05–2026-10-11 | 2 | 0 | 1 | 3 | 2 | 4 | 12 |\n| W13 | 2026-10-12–2026-10-18 | 3 | 0 | 2 | 3 | 4 | 6 | 18 |\n| W14 | 2026-10-19–2026-10-20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |\n\n### 3. 当前站点有哪些已标注关键词？\n\n| 关键词 | 含该词的邮件数 |\n| --- | --- |\n| sale | 3 |\n\n### 4. 后续怎么验证？\n\n- 以当前站点主题和周分布为探索线索，先区分营销内容与服务/法务通知，再设计可比受众的单变量测试。\n\n- 发送频次应结合自有用户意图与退订反馈测试，不把竞品可见收录量当作发送目标。\n\n- 所有文案与 Banner 方案仍需单独取证；本报告只汇总当前站点记录，不复用历史 US 编辑结论。"
};

const graph = sourceGraph();
const aggregation = graph.load("three-week-aggregation.ts");
const reportModule = graph.load("onepage-report.ts");
const { translateIn } = graph.load("i18n/index.tsx");
const trZh = (key, values) => translateIn("zh", key, values);
const trEn = (key, values) => translateIn("en", key, values);

const WEEK_STARTS = ["2026-09-29", "2026-10-06", "2026-10-13"];
function buildEmails(spec) {
  const emails = [];
  let seq = 0;
  spec.forEach(([brand, theme, counts]) => {
    counts.forEach((count, wi) => {
      for (let i = 0; i < count; i += 1) {
        const d = new Date(`${WEEK_STARTS[wi]}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + (i % 7));
        emails.push({ date: d.toISOString().slice(0, 10), brand, theme, keywords: [], market: "US", day_seq: seq, source_index: seq });
        seq += 1;
      }
    });
  });
  return emails;
}
// fixture 1：41 封，SHEIN/价格促销居首（14 封，34.1%），周量 11/12/18，其他类 4 封。
const SPEC1 = [
  ["SHEIN", "price", [4, 4, 6]],
  ["Halara", "new", [3, 3, 3]],
  ["Temu", "behavior", [2, 2, 4]],
  ["Zara", "lifestyle", [1, 2, 3]],
  ["ALO Yoga", "other", [1, 1, 2]],
];
// fixture 2：28 封，品牌与主题双并列（各 14 封），触发并列结论/并列行动/小样本关注项。
const SPEC2 = [
  ["Zara", "price", [5, 5, 4]],
  ["Halara", "new", [5, 5, 4]],
];
const meta = {
  windowStart: "2026-07-20", windowEnd: "2026-10-20",
  range: "2026-07-20 – 2026-10-20", market: "United States",
  source: "Milled", brandCount: 6, weekCount: 13, total: null,
  dataSource: "supabase", provenance: "",
};

const HAN_RE = /[㐀-鿿]/;
function assertNoHan(value, path = "$") {
  if (typeof value === "string") {
    assert.ok(!HAN_RE.test(value), `${path} 不得含中文：${value}`);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoHan(item, `${path}[${index}]`));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) assertNoHan(item, `${path}.${key}`);
  }
}

describe("生成型文本接入 i18n", () => {
  const emails1 = buildEmails(SPEC1);
  emails1.slice(0, 3).forEach((email) => { email.keywords = ["Sale"]; });
  const emails2 = buildEmails(SPEC2);
  const data1 = aggregation.aggregateThreeWeek(emails1);

  it("zh 洞察四句与改版前逐字一致", () => {
    assert.deepEqual(aggregation.buildSiteInsights(data1, trZh), GOLDEN.insights);
  });

  it("zh 空窗口洞察与改版前逐字一致", () => {
    assert.deepEqual(
      aggregation.buildSiteInsights(aggregation.aggregateThreeWeek([]), trZh),
      GOLDEN.insightsEmpty,
    );
  });

  it("zh 品牌 strategy 与 campaigns 与改版前逐字一致", () => {
    const shein = aggregation.buildAggregatedBrand(data1, "SHEIN", trZh);
    assert.equal(shein.strategy, GOLDEN.strategyHas);
    assert.deepEqual(shein.campaigns, GOLDEN.campaigns);
    assert.equal(aggregation.buildAggregatedBrand(data1, "lululemon", trZh).strategy, GOLDEN.strategyZero);
  });

  it("zh OnePage 摘要与改版前逐字一致（含并列与空窗口分支）", () => {
    assert.deepEqual(reportModule.buildOnePageSummary(emails1, meta, trZh), GOLDEN.summary);
    assert.deepEqual(reportModule.buildOnePageSummary(emails2, meta, trZh), GOLDEN.summaryTie);
    assert.deepEqual(reportModule.buildOnePageSummary([], meta, trZh), GOLDEN.summaryEmpty);
  });

  it("zh OnePage 报告全文与改版前逐字一致", () => {
    assert.equal(reportModule.buildLiveOnePage(emails1, meta, trZh), GOLDEN.report);
  });

  it("en 洞察四句为英文且数值口径不变", () => {
    assert.deepEqual(aggregation.buildSiteInsights(data1, trEn), [
      "The current site collected 41 emails in the 3-week window, covering 22 days, an average of 1.9 per day; this is the visibly collected volume, not the actual total sent.",
      "SHEIN has the most collected emails: 14 emails, 34.1% of the current site's 3-week sample.",
      "Price Promotion is the current main theme: 14 emails, 34.1%; the 'other' themes, which include service and legal notices, do not count as marketing.",
      "Week 3 (10/13–10/20) collected 18 emails; the buckets may cover different numbers of days, so totals alone cannot judge marketing effectiveness.",
    ]);
  });

  it("en 品牌 strategy 与 campaigns 无中文残留", () => {
    const zero = aggregation.buildAggregatedBrand(data1, "lululemon", trEn);
    assert.equal(
      zero.strategy,
      "lululemon has no emails collected at the current site within the 3-week window yet; not being collected does not mean the brand did not send, as some channels may not be covered.",
    );
    assertNoHan(aggregation.buildAggregatedBrand(data1, "SHEIN", trEn));
  });

  it("en OnePage 摘要无中文残留且关键证据句正确", () => {
    const summary = reportModule.buildOnePageSummary(emails1, meta, trEn);
    assertNoHan(summary);
    assert.equal(
      summary.decisions[0].conclusion,
      "SHEIN is the brand with the most collected emails in the current visible sample; use it first as an entry point for creative review, not as an effectiveness benchmark.",
    );
    assert.equal(summary.decisions[0].evidence, "14 emails, 34.1% of the 3-week sample.");
    assert.equal(
      summary.decisions[2].evidence,
      "Normalized by the actual days in each bucket: Week 1 1.57 per day (7 days); Week 2 1.71 per day (7 days); Week 3 2.25 per day (8 days).",
    );
    assertNoHan(reportModule.buildOnePageSummary([], meta, trEn));
    assertNoHan(reportModule.buildOnePageSummary(emails2, meta, trEn));
  });

  it("zh 原型属性名未知主题回落为原 key，不抛错且不命中原型", () => {
    // toString/constructor/__proto__ 作为主题 key 时，字典查表不得命中 Object.prototype。
    const weird = buildEmails([
      ["SHEIN", "price", [2, 0, 0]],
      ["Zara", "toString", [1, 0, 0]],
      ["Zara", "constructor", [1, 0, 0]],
      ["Zara", "__proto__", [1, 0, 0]],
    ]);
    const doc = reportModule.buildLiveOnePage(weird, meta, trZh);
    assert.ok(doc.includes("| toString | 1 |"), "toString 主题应原样显示");
    assert.ok(doc.includes("| constructor | 1 |"), "constructor 主题应原样显示");
    assert.ok(doc.includes("| __proto__ | 1 |"), "__proto__ 主题应原样显示");
    const docEn = reportModule.buildLiveOnePage(weird, meta, trEn);
    assert.ok(docEn.includes("| toString | 1 |"), "en 下 toString 主题同样原样显示");
  });

  it("zh/en 未知主题居首时洞察与摘要按原 key 生成", () => {
    const leading = buildEmails([
      ["Zara", "toString", [3, 0, 0]],
      ["SHEIN", "price", [2, 0, 0]],
    ]);
    const data = aggregation.aggregateThreeWeek(leading);
    assert.equal(
      aggregation.buildSiteInsights(data, trZh)[2],
      "toString是当前主要主题：3 封，占 60.0%；含服务/法务通知的其他主题不等于营销。",
    );
    assert.ok(
      aggregation.buildSiteInsights(data, trEn)[2].startsWith("toString is the current main theme: 3 emails, 60.0%"),
    );
    const summary = reportModule.buildOnePageSummary(leading, meta, trZh);
    assert.equal(
      summary.decisions[1].conclusion,
      "toString是收录最多的主题，可作为内容探索起点，但不能据此断言用户偏好。",
    );
    assert.equal(
      summary.decisions[1].action,
      "先抽样复盘toString的价值表达与落地承接，再验证是否适合自有受众。",
    );
  });

  it("en OnePage 报告无中文残留且标题/表头/合计行正确", () => {
    const doc = reportModule.buildLiveOnePage(emails1, meta, trEn);
    assert.ok(!HAN_RE.test(doc), "en 报告全文不得含中文");
    assert.ok(doc.startsWith("# EDM Competitor OnePage | United States"));
    assert.ok(doc.includes("## Decision summary"));
    assert.ok(doc.includes("## Full report appendix"));
    assert.ok(doc.includes("| Total | 11 | 12 | 18 | 41 | 1.86 |"));
    assert.ok(doc.includes("| Price Promotion | 14 | 34.1% | 14 | 34.1% |"));
  });
});
