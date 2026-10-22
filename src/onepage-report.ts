import { BRAND_ORDER, type EmailRecord, type ExtendedEmailMeta } from "./email-data";
import { THEME_LABEL_KEYS } from "./components/dashboard";
import {
  aggregateThreeWeek,
  buildSiteInsights,
  formatWindowRange,
  windowDays,
  type GeneratedTextTranslator,
} from "./three-week-aggregation";

export interface OnePageDecisionSummary {
  decisions: { title: string; conclusion: string; evidence: string; action: string }[];
  watchpoints: string[];
  nextStep: string;
}

// 主题名与组件同口径：优先字典键（当前语言），未知主题回落聚合层 labelZh。
// 查表必须先判自有属性：主题 key 可能是 toString/constructor/__proto__ 等原型属性名，
// 直接索引会命中 Object.prototype（与 three-week-aggregation 的 themeColor 守卫同一原因）。
function themeDisplayName(
  tr: GeneratedTextTranslator,
  theme: { key: string; labelZh: string },
): string {
  const dictKey = Object.prototype.hasOwnProperty.call(THEME_LABEL_KEYS, theme.key)
    ? THEME_LABEL_KEYS[theme.key]
    : undefined;
  return dictKey ? tr(dictKey) : theme.labelZh;
}

export function buildOnePageSummary(emails: EmailRecord[], meta: ExtendedEmailMeta, tr: GeneratedTextTranslator): OnePageDecisionSummary {
  const data = aggregateThreeWeek(emails);
  if (data.total === 0) {
    return {
      decisions: [{
        title: tr("opEmptyTitle"),
        conclusion: tr("opEmptyConclusion"),
        evidence: tr("opEmptyEvidence", { range: formatWindowRange(data.window), count: emails.length }),
        action: tr("opEmptyAction"),
      }],
      watchpoints: [tr("opEmptyWatchOld"), tr("opEmptyWatchCutoff", { date: meta.windowEnd })],
      nextStep: tr("opEmptyNext"),
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
    ? tr("opD2ActionMulti")
    : leadingTheme.key === "price"
      ? tr("opD2ActionPrice")
      : leadingTheme.key === "other"
        ? tr("opD2ActionOther")
        : tr("opD2ActionTheme", { theme: themeDisplayName(tr, leadingTheme) });
  const watchpoints = [
    tr("opWatchMarket", { market: meta.market }),
    tr("opWatchCutoff", { date: meta.windowEnd }),
    tr("opWatchNoMetrics"),
  ];
  const otherCount = data.themes.find((theme) => theme.key === "other")?.count ?? 0;
  if (otherCount > 0) watchpoints.unshift(tr("opWatchOther", { count: otherCount }));
  if (data.total < 30) watchpoints.unshift(tr("opWatchSmall"));

  const joiner = tr("opListJoiner");
  const evidence = (maximum: number, each: boolean) =>
    tr(each ? "opEvidenceEach" : "opEvidence", {
      count: maximum,
      pct: (maximum / data.total * 100).toFixed(1),
    });

  return {
    decisions: [
      {
        title: tr("opD1Title"),
        conclusion: tr(leadingBrands.length > 1 ? "opD1ConclusionTie" : "opD1ConclusionOne", {
          brands: leadingBrands.map((brand) => brand.name).join(joiner),
        }),
        evidence: evidence(brandMaximum, leadingBrands.length > 1),
        action: tr("opD1Action"),
      },
      {
        title: tr("opD2Title"),
        conclusion: tr(leadingThemes.length > 1 ? "opD2ConclusionTie" : "opD2ConclusionOne", {
          themes: leadingThemes.map((theme) => themeDisplayName(tr, theme)).join(joiner),
        }),
        evidence: evidence(themeMaximum, leadingThemes.length > 1),
        action: themeAction,
      },
      {
        title: tr("opD3Title"),
        conclusion: peakWeeks.length === data.weeks.length
          ? tr("opD3ConclusionFlat")
          : tr("opD3ConclusionPeak", {
              weeks: peakWeeks.map((week) => tr("opWeekColLabel", { label: week.label, range: week.range })).join(joiner),
            }),
        evidence: tr("opD3Evidence", {
          parts: data.weeks.map((week, index) => tr("opD3EvidencePart", {
            label: week.label,
            rate: dailyRates[index].toFixed(2),
            days: windowDays(week),
          })).join(tr("opPartJoiner")),
        }),
        action: tr("opD3Action"),
      },
    ],
    watchpoints,
    nextStep: tr("opNextStep"),
  };
}

function table(headers: string[], rows: (string | number)[][]): string {
  const line = (cells: (string | number)[]) => `| ${cells.map((cell) => String(cell).replaceAll("|", "／").replaceAll("\n", " ")).join(" | ")} |`;
  return [line(headers), line(headers.map(() => "---")), ...rows.map(line)].join("\n");
}

export function buildLiveOnePage(emails: EmailRecord[], meta: ExtendedEmailMeta, tr: GeneratedTextTranslator): string {
  const data = aggregateThreeWeek(emails);
  const summary = buildOnePageSummary(emails, meta, tr);
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
    `# ${tr("opReportTitle", { market: meta.market })}`,
    `> ${tr("opScopeLine", { range: formatWindowRange(data.window), total: data.total, range3: meta.range, count: emails.length, date: meta.windowEnd })}`,
    `> ${tr("opScopeNote")}`,
    `## ${tr("opSummaryTitle")}`,
    `### ${tr("opDecisionsTitle")}`,
    ...summary.decisions.map((decision) => `- ${tr("opDecisionLine", { title: decision.title, conclusion: decision.conclusion, evidence: decision.evidence, action: decision.action })}`),
    `### ${tr("opWatchTitle")}`,
    ...summary.watchpoints.map((point) => `- ${point}`),
    tr("opNextStepLine", { text: summary.nextStep }),
    `## ${tr("opAppendixTitle")}`,
    `### ${tr("opQ1Title")}`,
    ...buildSiteInsights(data, tr).map((insight) => `- ${insight}`),
    `#### ${tr("opWeeklyDistTitle")}`,
    table([tr("opColBrand"), ...data.weeks.map((week) => tr("opWeekColLabel", { label: week.label, range: week.range })), tr("opColTotal"), tr("opColPerDay")], [
      ...data.brands.map((brand) => [brand.name, ...brand.weekly, brand.total, (brand.total / data.windowDays).toFixed(2)]),
      [tr("opColTotal"), ...data.weekTotals, data.total, (data.total / data.windowDays).toFixed(2)],
    ]),
    `### ${tr("opQ2Title")}`,
    table([tr("opColTheme"), tr("opColThreeWeekCount"), tr("opColThreeWeekPct"), tr("opColThreeMonthCount"), tr("opColThreeMonthPct")], themes.map((key) => {
      const theme = data.themes.find((item) => item.key === key);
      const count = themeCounts.get(key) ?? 0;
      return [theme ? themeDisplayName(tr, theme) : key === "other" ? tr("themeOther") : key, theme?.count ?? 0,
        `${data.total > 0 ? ((theme?.count ?? 0) / data.total * 100).toFixed(1) : "0.0"}%`, count,
        `${emails.length > 0 ? (count / emails.length * 100).toFixed(1) : "0.0"}%`];
    })),
    table([tr("opColBrand"), tr("opColThreeMonthCount"), tr("opColPerDayDays", { days })], brandNames.map((brand) => [brand, brandCounts.get(brand) ?? 0, ((brandCounts.get(brand) ?? 0) / days).toFixed(2)])),
    `#### ${tr("opMonthlyDistTitle")}`,
    table([tr("opColWeek"), tr("opColDate"), ...brandNames, tr("opColTotal")], weeklyRows),
    `### ${tr("opQ3Title")}`,
    topKeywords.length > 0
      ? table([tr("opColKeyword"), tr("opColKeywordCount")], topKeywords.map(([word, count]) => [word, count]))
      : tr("opNoKeywords"),
    `### ${tr("opQ4Title")}`,
    `- ${tr("opVerify1")}`,
    `- ${tr("opVerify2")}`,
    `- ${tr("opVerify3")}`,
  ].join("\n\n");
}
