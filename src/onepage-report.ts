import { BRAND_ORDER, type EmailRecord, type ExtendedEmailMeta } from "./email-data";
import { aggregateThreeWeek, buildSiteInsights, formatWindowRange, windowDays } from "./three-week-aggregation";

export interface OnePageDecisionSummary {
  decisions: { title: string; conclusion: string; evidence: string; action: string }[];
  watchpoints: string[];
  nextStep: string;
}

export function buildOnePageSummary(emails: EmailRecord[], meta: ExtendedEmailMeta): OnePageDecisionSummary {
  const data = aggregateThreeWeek(emails);
  if (data.total === 0) {
    return {
      decisions: [{
        title: "暂不做近期策略判断",
        conclusion: "三周窗口没有可见收录，不据此判断品牌停止发送或主题发生变化。",
        evidence: `${formatWindowRange(data.window)}：0 封；三个月样本 ${emails.length} 封。`,
        action: "先核对站点与收录覆盖，再用附录的三个月数据寻找待验证线索。",
      }],
      watchpoints: ["三个月记录不能替代三周窗口的近期证据。", `查询固定截止 ${meta.windowEnd}，不代表此后没有发送。`],
      nextStep: "补齐近期样本前，不调整主题预算或发送频次。",
    };
  }

  const brandMaximum = Math.max(...data.brands.map((brand) => brand.total));
  const leadingBrands = data.brands.filter((brand) => brand.total === brandMaximum);
  const themeMaximum = Math.max(...data.themes.map((theme) => theme.count));
  const leadingThemes = data.themes.filter((theme) => theme.count === themeMaximum);
  const leadingTheme = leadingThemes[0];
  const dailyRates = data.weeks.map((week, index) => data.weekTotals[index] / windowDays(week));
  const peakDaily = Math.max(...dailyRates);
  const peakWeeks = data.weeks.filter((_, index) => dailyRates[index] === peakDaily);
  const themeAction = leadingThemes.length > 1
    ? "先抽样比较并列主题的内容和受众，选择一个假设做单变量测试，不因排序强行押注单一主题。"
    : leadingTheme.key === "price"
      ? "先拆解优惠门槛、利益表达与落地页的一致性；用自有样本测试，不直接跟价。"
      : leadingTheme.key === "other"
        ? "先拆分服务、法务与可营销内容，不把其他类收录量转化为营销排期。"
        : `先抽样复盘${leadingTheme.labelZh}的价值表达与落地承接，再验证是否适合自有受众。`;
  const watchpoints = [
    `样本来自 ${meta.market} 的可见收录；市场收录覆盖不同，不把绝对邮件量当作市场需求或效果排名。`,
    `查询固定截止 ${meta.windowEnd}；三周与三个月是不同窗口，不能把两者总量直接当作增长。`,
    "没有打开率、点击率、转化率或退订数据；以下结论用于确定复盘和实验优先级，不证明营销效果。",
  ];
  const otherCount = data.themes.find((theme) => theme.key === "other")?.count ?? 0;
  if (otherCount > 0) watchpoints.unshift(`其他类有 ${otherCount} 封，可能包含服务或法务通知；确认用途后再纳入营销对标。`);
  if (data.total < 30) watchpoints.unshift("近期样本较少，少量新增记录就可能改变排序；先补充取证，不做强归因。");

  return {
    decisions: [
      {
        title: "先看谁：确定复盘对象",
        conclusion: `${leadingBrands.map((brand) => brand.name).join("、")}${leadingBrands.length > 1 ? "并列为" : "是"}当前可见样本中收录最多的品牌，优先作为素材复盘入口，而非效果标杆。`,
        evidence: `${leadingBrands.length > 1 ? "各" : ""}${brandMaximum} 封，占三周样本 ${(brandMaximum / data.total * 100).toFixed(1)}%。`,
        action: "先挑选该品牌同主题的代表邮件，比较利益点、CTA 与落地页，避免混合不同任务的邮件。",
      },
      {
        title: "看什么：形成内容假设",
        conclusion: `${leadingThemes.map((theme) => theme.labelZh).join("、")}${leadingThemes.length > 1 ? "并列为收录最多的主题" : "是收录最多的主题"}，可作为内容探索起点，但不能据此断言用户偏好。`,
        evidence: `${leadingThemes.length > 1 ? "各" : ""}${themeMaximum} 封，占三周样本 ${(themeMaximum / data.total * 100).toFixed(1)}%。`,
        action: themeAction,
      },
      {
        title: "何时看：核对触达节奏",
        conclusion: peakWeeks.length === data.weeks.length
          ? "各周日均收录相同，没有明确节奏峰值；先核对内容差异，不人为制造加频理由。"
          : `${peakWeeks.map((week) => `${week.label}（${week.range}）`).join("、")}的日均可见收录最高，值得核对活动节点和通知类邮件。`,
        evidence: `按各桶实际天数归一：${data.weeks.map((week, index) => `${week.label} ${dailyRates[index].toFixed(2)} 封/日（${windowDays(week)} 天）`).join("；")}。`,
        action: "把高频时段作为核查线索；频次调整先在自有可比受众上测试，同时观察退订与转化，不照搬竞品频次。",
      },
    ],
    watchpoints,
    nextStep: "本轮只选择一个内容或节奏假设，先核实邮件用途和素材，再做可比受众的单变量测试；用转化与退订反馈决定是否扩大。",
  };
}

function table(headers: string[], rows: (string | number)[][]): string {
  const line = (cells: (string | number)[]) => `| ${cells.map((cell) => String(cell).replaceAll("|", "／").replaceAll("\n", " ")).join(" | ")} |`;
  return [line(headers), line(headers.map(() => "---")), ...rows.map(line)].join("\n");
}

export function buildLiveOnePage(emails: EmailRecord[], meta: ExtendedEmailMeta): string {
  const data = aggregateThreeWeek(emails);
  const summary = buildOnePageSummary(emails, meta);
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
    "## 决策摘要",
    "### 关键结论与行动",
    ...summary.decisions.map((decision) => `- **${decision.title}**：${decision.conclusion} 证据：${decision.evidence} 建议：${decision.action}`),
    "### 值得关注",
    ...summary.watchpoints.map((point) => `- ${point}`),
    `**下一步**：${summary.nextStep}`,
    "## 完整报告附录",
    "### 1. 当前站点最近在做什么？",
    ...buildSiteInsights(data).map((insight) => `- ${insight}`),
    "#### 三周分品牌周分布",
    table(["品牌", ...data.weeks.map((week) => `${week.label}（${week.range}）`), "合计", "日均"], [
      ...data.brands.map((brand) => [brand.name, ...brand.weekly, brand.total, (brand.total / data.windowDays).toFixed(2)]),
      ["合计", ...data.weekTotals, data.total, (data.total / data.windowDays).toFixed(2)],
    ]),
    "### 2. 主题与品牌日频有什么区别？",
    table(["主题", "三周封数", "三周占比", "三个月封数", "三个月占比"], themes.map((key) => {
      const theme = data.themes.find((item) => item.key === key);
      const count = themeCounts.get(key) ?? 0;
      return [theme?.labelZh ?? (key === "other" ? "其他" : key), theme?.count ?? 0,
        `${data.total > 0 ? ((theme?.count ?? 0) / data.total * 100).toFixed(1) : "0.0"}%`, count,
        `${emails.length > 0 ? (count / emails.length * 100).toFixed(1) : "0.0"}%`];
    })),
    table(["品牌", "三个月封数", `日均（${days} 天）`], brandNames.map((brand) => [brand, brandCounts.get(brand) ?? 0, ((brandCounts.get(brand) ?? 0) / days).toFixed(2)])),
    "#### 三个月分品牌周分布",
    table(["周", "日期", ...brandNames, "合计"], weeklyRows),
    "### 3. 当前站点有哪些已标注关键词？",
    topKeywords.length > 0
      ? table(["关键词", "含该词的邮件数"], topKeywords.map(([word, count]) => [word, count]))
      : "当前站点暂无有效关键词标注。空字段不代表邮件正文不含关键词。",
    "### 4. 后续怎么验证？",
    "- 以当前站点主题和周分布为探索线索，先区分营销内容与服务/法务通知，再设计可比受众的单变量测试。",
    "- 发送频次应结合自有用户意图与退订反馈测试，不把竞品可见收录量当作发送目标。",
    "- 所有文案与 Banner 方案仍需单独取证；本报告只汇总当前站点记录，不复用历史 US 编辑结论。",
  ].join("\n\n");
}
