/* 品牌营销触达趋势看板 - 数据文件
 * 数据来源：Milled（美国市场），2026-09-24 至 2026-10-15（美东时间）
 * 口径：每封邮件只归一个主题；计数为 Milled 品牌页在窗口内可见的收录邮件数，
 * 非品牌向全量收件人的发送量。词频按“含该词的邮件数”统计，同一词在同一主题出现多次只计 1 次。
 * 更新数据时只改这个文件即可。
 */

export interface Week {
  id: string;
  label: string;
  range: string;
}

export interface Theme {
  key: string;
  label: string;
  labelZh: string;
  count: number;
  color: string;
}

export interface Brand {
  name: string;
  weekly: number[];
  total: number;
  perDay: number;
  strategy: string;
  themes: Record<string, number>;
  campaigns: string[];
  // 聚合周定义（m1）：实时聚合弹窗用，由 buildAggregatedBrand 从聚合 weeks 填入；
  // 缺失时弹窗回落到静态 DATA.weeks（默认窗口下两者一致）。
  weeks?: Week[];
}

export interface Word {
  text: string;
  count: number;
}

export const DATA = {
  meta: {
    title: "品牌营销触达趋势看板",
    range: "2026-09-24 – 2026-10-15",
    rangeLabel: "近 3 周 · 美东时间",
    market: "美国市场",
    source: "Milled",
    total: 196,
    brandCount: 6,
    weekCount: 3,
  },
  weeks: [
    { id: "W1", label: "Week 1", range: "9/24–9/30" },
    { id: "W2", label: "Week 2", range: "10/1–10/7" },
    { id: "W3", label: "Week 3", range: "10/8–10/15" },
  ] as Week[],
  // 主题分类：price 价格促销 / behavior 行为触发 / new 上新 / lifestyle 生活方式 / category 品类聚焦
  themes: [
    { key: "price", label: "Price Promotion", labelZh: "价格促销", count: 67, color: "#e85d7a" },
    { key: "behavior", label: "Behavior-triggered", labelZh: "行为触发", count: 47, color: "#f0a030" },
    { key: "new", label: "New Arrival", labelZh: "上新", count: 34, color: "#3fa66a" },
    { key: "lifestyle", label: "Lifestyle Content", labelZh: "生活方式", count: 31, color: "#8e7cc3" },
    { key: "category", label: "Category Focus", labelZh: "品类聚焦", count: 17, color: "#5b9bd5" },
  ] as Theme[],
  brands: [
    {
      name: "Halara",
      weekly: [14, 14, 15],
      total: 43,
      perDay: 2.0,
      strategy: "价格促销 + 捆绑价 / 闪购高频",
      themes: { price: 32, category: 6, new: 4, lifestyle: 1, behavior: 0 },
      campaigns: [
        "Buy 2 for $69 捆绑、Afterpay 联名折扣、牛仔折扣",
        "Style Day 大促、Buy 2 for $59/$69、Buy 3 for $59",
        "BOGO、Up to 80% Off、$9.95 闪购、VIP Deal、牛仔 50% Off",
      ],
    },
    {
      name: "ALO Yoga",
      weekly: [8, 10, 9],
      total: 27,
      perDay: 1.2,
      strategy: "上新 + 生活方式内容，零促销",
      themes: { price: 0, category: 1, new: 18, lifestyle: 8, behavior: 0 },
      campaigns: [
        "Idol 系列、Lounging Sets、Pastel Lookbook",
        "Bamboo Green、Ribbed Reset 胶囊、Drop Report、穿搭建议",
        "Rich Bordeaux、Momentum 胶囊、Everyday Pant、Sweater Weather",
      ],
    },
    {
      name: "SHEIN",
      weekly: [21, 20, 21],
      total: 62,
      perDay: 2.8,
      strategy: "价格促销 + 内容 + 券提醒三线并行",
      themes: { price: 28, category: 3, new: 4, lifestyle: 17, behavior: 10 },
      campaigns: [
        "Up to 90% Off 万圣节、All under $9.99、SHEINsight 趋势",
        "Under $10、Up to 70%/90% Off、穿搭建议、券到期提醒",
        "Halloween Deals、Brand Deals、券/个性化提醒、新品、家居品类",
      ],
    },
    {
      name: "Temu",
      weekly: [14, 15, 15],
      total: 44,
      perDay: 2.0,
      strategy: "行为触发（返现 / Credits + 清单提醒）",
      themes: { price: 7, category: 0, new: 0, lifestyle: 0, behavior: 37 },
      campaigns: [
        "$350 Credits、Thank-you reward、清单提醒、Attention Required",
        "Credit Back 返现确认、$210/$350 Credits、限时 Offer",
        "Credit Back 确认、Thank-you reward、清单提醒、限时 Offer",
      ],
    },
    {
      name: "lululemon",
      weekly: [4, 3, 6],
      total: 13,
      perDay: 0.6,
      strategy: "上新 + 品类聚焦，零促销",
      themes: { price: 0, category: 4, new: 7, lifestyle: 2, behavior: 0 },
      campaigns: [
        "Smooth Spacer 等上新、品类聚焦、生活方式内容",
        "上新为主、品类聚焦",
        "上新、品类聚焦（Puffers）、生活方式内容",
      ],
    },
    {
      name: "Zara",
      weekly: [3, 1, 3],
      total: 7,
      perDay: 0.3,
      strategy: "品类 / 生活方式，零促销，低频",
      themes: { price: 0, category: 3, new: 1, lifestyle: 3, behavior: 0 },
      campaigns: [
        "上新、品类聚焦、生活方式内容各 1 封",
        "Re{form} Vol.1 生活方式内容",
        "品类聚焦、生活方式内容",
      ],
    },
  ] as Brand[],
  // 主题行高频词：count = 含该词的邮件数（6 品牌合并，196 封样本）
  words: [
    { text: "New", count: 31 },
    { text: "Off", count: 21 },
    { text: "Up to", count: 19 },
    { text: "Down", count: 13 },
    { text: "Credit", count: 12 },
    { text: "Deal", count: 12 },
    { text: "Buy", count: 11 },
    { text: "Required", count: 11 },
    { text: "Fall", count: 11 },
    { text: "Style", count: 11 },
    { text: "Offer", count: 10 },
    { text: "Sale", count: 10 },
    { text: "Action", count: 8 },
    { text: "Coupon", count: 7 },
    { text: "Got", count: 7 },
    { text: "Listing", count: 7 },
    { text: "Please", count: 7 },
    { text: "Start", count: 7 },
    { text: "Under", count: 7 },
    { text: "Arrivals", count: 6 },
    { text: "Back", count: 6 },
    { text: "Price", count: 6 },
    { text: "Sent", count: 6 },
    { text: "Drop", count: 6 },
    { text: "Denim", count: 5 },
    { text: "Good", count: 5 },
    { text: "Less", count: 5 },
    { text: "Little", count: 5 },
    { text: "Thank", count: 5 },
    { text: "Attention", count: 4 },
    { text: "Zara", count: 4 },
  ] as Word[],
  insights: [
    "Halara 与 SHEIN 均以价格促销为核心，但 Halara 是“捆绑价 + 闪购”模板高频轰炸，SHEIN 是“折扣 + 内容 + 券提醒”组合。",
    "ALO Yoga、lululemon、Zara 完全避开价格战，用上新 + 生活方式 / 品类内容维持品牌调性。",
    "Temu 几乎不推商品本身，而是用返现 / Credits、清单与行动提醒等行为触发机制驱动复购与回访。",
    "各品牌每周均无断档；Halara、SHEIN、Temu 每日约 2–3 封，ALO 约 1–2 封，lululemon、Zara 低频。",
  ],
};

// 独立追加的 3 个月逐封衍生数据；现有 DATA 的 3 周口径、总数及主题数保持不变。
// 重叠窗口 2026-09-24 至 2026-10-15：Zara 8 vs DATA 7，ALO Yoga 28 vs DATA 27，lululemon 13 vs DATA 13。
// 第二轮重叠窗口：Halara 44 vs DATA 43，Temu 44 vs DATA 44，SHEIN 65 vs DATA 62；仅记录差异，不覆盖 DATA。
// Temu 原始 93 封中的 8 封 other 为商家侧 listing 邮件，不是消费者 EDM；EXTENDED_3MONTH 排除后计 85 封。
// Halara 3 个月主题按标题主钩分类，与 DATA 旧 3 周口径不同；此处保留原始分类，不强行调和。
export const EXTENDED_RECONCILIATION = [
  { brand: "Zara", collected: 8, existing: 7, status: "difference-recorded" },
  { brand: "ALO Yoga", collected: 28, existing: 27, status: "difference-recorded" },
  { brand: "lululemon", collected: 13, existing: 13, status: "matched" },
  { brand: "Halara", collected: 44, existing: 43, status: "difference-recorded" },
  { brand: "Temu", collected: 44, existing: 44, status: "matched" },
  { brand: "SHEIN", collected: 65, existing: 62, status: "difference-recorded" },
];
