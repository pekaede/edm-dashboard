import { BRAND_ORDER, type EmailRecord, type ExtendedEmailMeta } from "./email-data";
import { aggregateThreeWeek, buildSiteInsights, formatWindowRange } from "./three-week-aggregation";

function table(headers: string[], rows: (string | number)[][]): string {
  const line = (cells: (string | number)[]) => `| ${cells.map((cell) => String(cell).replaceAll("|", "／").replaceAll("\n", " ")).join(" | ")} |`;
  return [line(headers), line(headers.map(() => "---")), ...rows.map(line)].join("\n");
}

export function buildLiveOnePage(emails: EmailRecord[], meta: ExtendedEmailMeta): string {
  const data = aggregateThreeWeek(emails);
  const days = Math.round((Date.parse(meta.windowEnd) - Date.parse(meta.windowStart)) / 86_400_000) + 1;
  const themeCounts = new Map<string, number>();
  const brandCounts = new Map<string, number>();
  const keywordCounts = new Map<string, number>();
  for (const email of emails) {
    themeCounts.set(email.theme, (themeCounts.get(email.theme) ?? 0) + 1);
    brandCounts.set(email.brand, (brandCounts.get(email.brand) ?? 0) + 1);
    for (const keyword of new Set(email.keywords.map((word) => word.trim().toLowerCase()).filter(Boolean))) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1);
    }
  }
  const brandNames = [...new Set([...BRAND_ORDER, ...brandCounts.keys()])];
  const weeklyRows: (string | number)[][] = [];
  for (let start = meta.windowStart, index = 1; start <= meta.windowEnd; index += 1) {
    const startMs = Date.parse(`${start}T00:00:00Z`);
    const end = new Date(Math.min(startMs + 6 * 86_400_000, Date.parse(`${meta.windowEnd}T00:00:00Z`))).toISOString().slice(0, 10);
    const inWeek = emails.filter((email) => email.date >= start && email.date <= end);
    weeklyRows.push([`W${index}`, `${start}–${end}`, ...brandNames.map((brand) => inWeek.filter((email) => email.brand === brand).length), inWeek.length]);
    start = new Date(startMs + 7 * 86_400_000).toISOString().slice(0, 10);
  }
  const themes = [...new Set([...data.themes.map((theme) => theme.key), ...themeCounts.keys()])];
  const topKeywords = [...keywordCounts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, 10);
  return [
    `# EDM 竞品 OnePage｜${meta.market}`,
    `> **数据源**：${meta.source}。${meta.provenance}`,
    `> **统计口径**：三周 ${formatWindowRange(data.window)}，${data.total} 封；三个月 ${meta.range}，${emails.length} 封。查询固定截止 ${meta.windowEnd}，不是开放日期查询。`,
    "> 计数为 Milled 可见收录，不是实际全量发送。每封只归一个主题；包含服务/法务通知，不能把全部邮件统称营销。没有打开率、点击率或转化率，不据此推断营销效果。",
    "## 1. 当前站点最近在做什么？",
    ...buildSiteInsights(data).map((insight) => `- ${insight}`),
    "### 三周分品牌周分布",
    table(["品牌", ...data.weeks.map((week) => `${week.label}（${week.range}）`), "合计", "日均"], [
      ...data.brands.map((brand) => [brand.name, ...brand.weekly, brand.total, (brand.total / data.windowDays).toFixed(2)]),
      ["合计", ...data.weekTotals, data.total, (data.total / data.windowDays).toFixed(2)],
    ]),
    "## 2. 主题与品牌日频有什么区别？",
    table(["主题", "三周封数", "三周占比", "三个月封数", "三个月占比"], themes.map((key) => {
      const theme = data.themes.find((item) => item.key === key);
      const count = themeCounts.get(key) ?? 0;
      return [theme?.labelZh ?? (key === "other" ? "其他" : key), theme?.count ?? 0,
        `${data.total > 0 ? ((theme?.count ?? 0) / data.total * 100).toFixed(1) : "0.0"}%`, count,
        `${emails.length > 0 ? (count / emails.length * 100).toFixed(1) : "0.0"}%`];
    })),
    table(["品牌", "三个月封数", `日均（${days} 天）`], brandNames.map((brand) => [brand, brandCounts.get(brand) ?? 0, ((brandCounts.get(brand) ?? 0) / days).toFixed(2)])),
    "### 三个月分品牌周分布",
    table(["周", "日期", ...brandNames, "合计"], weeklyRows),
    "## 3. 当前站点有哪些已标注关键词？",
    topKeywords.length > 0
      ? table(["关键词", "含该词的邮件数"], topKeywords.map(([word, count]) => [word, count]))
      : "当前站点暂无有效关键词标注。空字段不代表邮件正文不含关键词。",
    "## 4. 后续怎么验证？",
    "- 以当前站点主题和周分布为探索线索，先区分营销内容与服务/法务通知，再设计可比受众的单变量测试。",
    "- 发送频次应结合自有用户意图与退订反馈测试，不把竞品可见收录量当作发送目标。",
    "- 所有文案与 Banner 方案仍需单独取证；本报告只汇总当前站点记录，不复用历史 US 编辑结论。",
  ].join("\n\n");
}
