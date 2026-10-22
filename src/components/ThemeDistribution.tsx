import { useMemo, useState, type CSSProperties } from "react";
import { Pie, PieChart, Sector, type PieSectorShapeProps } from "recharts";
import { useLocale } from "../i18n";
import { useSiteEmails, useSiteSelection } from "../site-data";
import {
  aggregateThreeWeek,
  formatWindowRange,
  themeColor,
  themeLabelColor,
  THREE_WEEK_WINDOW,
} from "../three-week-aggregation";
import { buildHash } from "../url-state";
import { Card } from "./Card";
import { THEME_LABEL_KEYS } from "./dashboard";
import { EmptyState } from "./EmptyState";
import { ExtendedEmailsState } from "./ExtendedEmailsState";
import { Tooltip } from "./Tooltip";
import { ChartContainer, type ChartConfig } from "./ui/chart";

const EMPTY_STATE_CLASS_NAME =
  "[&>div]:border-[var(--border-default)] [&>div]:bg-[var(--surface-card)] [&_[aria-hidden]]:border-[var(--border-default)] [&_[aria-hidden]]:bg-[var(--surface-subtle)] [&_[aria-hidden]]:text-[var(--text-secondary)] [&_h3]:text-[var(--text-heading)] [&_p]:text-[var(--text-secondary)] [&_button]:bg-[var(--control-active-bg)] [&_button]:text-[var(--control-active-text)] [&_button:hover]:bg-[var(--control-active-hover-bg)] [&_button:focus-visible]:ring-[var(--accent-ink)] [&_button:focus-visible]:ring-offset-[var(--surface-card)]";

interface ThemeSliceDatum {
  key: string;
  labelZh: string;
  count: number;
  pct: number;
  span: number;
}

function themeEmailsHash(key: string): string {
  return buildHash({
    view: "emails",
    market: null,
    marketSpecified: false,
    brand: "all",
    theme: key,
    query: "",
    dateFrom: "",
    dateTo: "",
  });
}

export function ThemeDistribution() {
  const { t, locale } = useLocale();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [marketingOnly, setMarketingOnly] = useState(false);
  const { status, emails, total: emailTotal, error, retry, meta } = useSiteEmails();
  const { market, setMarket } = useSiteSelection();
  const data = useMemo(
    () => (status === "ready" ? aggregateThreeWeek(emails) : null),
    [status, emails],
  );
  const themeName = (theme: { key: string; labelZh: string }) =>
    THEME_LABEL_KEYS[theme.key] ? t(THEME_LABEL_KEYS[theme.key]) : theme.labelZh;
  const hint = data
    ? `${meta.market} · ${t("tdHintRealtime")}${formatWindowRange(data.window)}${t("tdHintTotalPart")}${data.total}${t("tdHintDiffPart")}${meta.total}${t("tdHintDescPart")}`
    : `${meta.market} · ${t("tdHintRealtime")}${formatWindowRange(THREE_WEEK_WINDOW)}${t("tdHintFallback")}`;

  // 「其他」多为事务/法务类通知，会稀释营销主题占比；开关打开时把它剔出分母与切片。
  // 全部邮件都是「其他」时剔除会让分母为 0，此时不提供开关。
  const otherCount = data?.themes.find((theme) => theme.key === "other")?.count ?? 0;
  const canExcludeOther = data !== null && otherCount > 0 && otherCount < data.total;
  const excludeOther = marketingOnly && canExcludeOther;
  const activeTotal = data ? (excludeOther ? data.total - otherCount : data.total) : 0;

  // 环形图数据：角度跨度仍以 activeTotal 为分母（与开关剔除口径一致），Recharts 按 count 归一化的
  // 结果与之等价；span 只用于决定是否在切片内标注占比（>= 25°）。
  const { chartData, chartConfig } = useMemo(() => {
    if (!data) return { chartData: [] as ThemeSliceDatum[], chartConfig: {} as ChartConfig };
    const visibleThemes = data.themes
      .filter((theme) => theme.count > 0 && (!excludeOther || theme.key !== "other"))
      .map((theme) => (excludeOther
        ? { ...theme, pct: activeTotal > 0 ? Math.round((theme.count / activeTotal) * 100) : 0 }
        : theme));
    const slices: ThemeSliceDatum[] = visibleThemes.map((theme) => ({
      ...theme,
      span: theme.count / activeTotal * 360,
    }));
    const config: ChartConfig = Object.fromEntries(
      slices.map((theme) => [theme.key, { label: themeName(theme), color: themeColor(theme.key) }]),
    );
    return { chartData: slices, chartConfig: config };
    // themeName 随 locale 变化，locale 已在依赖中；t 本身不直接引用。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, excludeOther, activeTotal, locale]);

  const sliceAria = (theme: { key: string; labelZh: string; count: number; pct: number }) =>
    t("tdSliceAria", { label: themeName(theme), count: theme.count, pct: theme.pct });

  // 图表元素 memoize：悬停状态变化时不重建 SVG 节点（否则 Recharts 会替换扇区节点、
  // 卸载正在聚焦的链接）。切片的淡化/高亮改由 index.css 按 wrapper 的 data-hovered 驱动，
  // 每片颜色经 --sector-color / --sector-label-color 变量传入。
  const donutChart = useMemo(() => {
    const renderSlice = (props: PieSectorShapeProps) => {
      const theme = props.payload as ThemeSliceDatum;
      const { cx, cy, innerRadius, outerRadius } = props;
      const midAngle = props.midAngle ?? 0;
      const middle = (-midAngle * Math.PI) / 180;
      const labelRadius = (innerRadius + outerRadius) / 2;
      const x = cx + labelRadius * Math.cos(middle);
      const y = cy + labelRadius * Math.sin(middle);
      return (
        <a
          key={theme.key}
          href={themeEmailsHash(theme.key)}
          tabIndex={0}
          aria-label={sliceAria(theme)}
          data-sector-key={theme.key}
          style={{
            "--sector-color": themeColor(theme.key),
            "--sector-label-color": themeLabelColor(theme.key),
          } as CSSProperties}
          onMouseEnter={() => setHoveredKey(theme.key)}
          onMouseLeave={() => setHoveredKey(null)}
          onFocus={() => setHoveredKey(theme.key)}
          onBlur={() => setHoveredKey(null)}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              window.location.hash = themeEmailsHash(theme.key);
            }
          }}
          className="td-sector-link cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)]"
        >
          {chartData.length === 1 ? (
            <>
              <circle className="td-sector-ring" cx={cx} cy={cy} r={labelRadius} fill="none" stroke="var(--sector-color)" strokeWidth={outerRadius - innerRadius} />
              <circle className="td-sector-focusring" cx={cx} cy={cy} r={Math.max(0, outerRadius - 1)} fill="none" stroke="transparent" strokeWidth={2} />
            </>
          ) : (
            <Sector
              className="td-sector-path"
              cx={cx}
              cy={cy}
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              startAngle={props.startAngle}
              endAngle={props.endAngle}
              fill="var(--sector-color)"
              stroke="var(--surface-card)"
              strokeWidth={2}
            />
          )}
          {theme.span >= 25 ? (
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="var(--sector-label-color)" className="td-sector-label pointer-events-none select-none text-xs font-bold">
              {theme.pct}%
            </text>
          ) : null}
        </a>
      );
    };
    return (
      <ChartContainer config={chartConfig} className="aspect-square w-full">
        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="key"
            cx="50%"
            cy="50%"
            innerRadius="50%"
            outerRadius="90%"
            startAngle={90}
            endAngle={-270}
            paddingAngle={0}
            isAnimationActive={false}
            shape={renderSlice}
            onMouseLeave={() => setHoveredKey(null)}
          />
        </PieChart>
      </ChartContainer>
    );
    // sliceAria/themeName 随 locale 变化，locale 已在依赖中。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, chartConfig, locale]);

  // 当前主题的恢复规则按数据中实际出现的键动态生成：聚合会保留未知主题键（如 winback），
  // 在 index.css 里写死六个固定键会让未知主题在悬停/聚焦时丢高亮，故这里按 chartData 生成。
  const sectorCss = chartData.map((theme) => {
    const k = theme.key.replace(/["\\]/g, "\\$&");
    return [
      `.td-chart[data-hovered="${k}"] .td-sector-link[data-sector-key="${k}"] .td-sector-path { fill: var(--sector-color); stroke: var(--control-focus); }`,
      `.td-chart[data-hovered="${k}"] .td-sector-link[data-sector-key="${k}"] .td-sector-ring { stroke: var(--sector-color); }`,
      `.td-chart[data-hovered="${k}"] .td-sector-link[data-sector-key="${k}"] .td-sector-focusring { stroke: var(--control-focus); }`,
      `.td-chart[data-hovered="${k}"] .td-sector-link[data-sector-key="${k}"] .td-sector-label { fill: var(--sector-label-color); }`,
    ].join("\n");
  }).join("\n");

  if (status !== "ready" || !data) {
    return (
      <Card title={t("tdTitle")} hint={hint}>
        <ExtendedEmailsState status={status} total={emailTotal} error={error} retry={retry} meta={meta} />
      </Card>
    );
  }
  if (data.total === 0) {
    return (
      <Card title={t("tdTitle")} hint={hint}>
        <div className={EMPTY_STATE_CLASS_NAME}>
          <EmptyState
            title={t("tdEmptyTitle")}
            description={t("tdEmptyDesc")}
            actionLabel={market === null ? t("tdRetry") : t("tdSwitchAll")}
            onAction={market === null ? retry : () => setMarket(null)}
          />
        </div>
      </Card>
    );
  }

  const active = chartData.find((theme) => theme.key === hoveredKey);
  const activeName = active ? themeName(active) : null;
  const centerLabel = activeName && activeName.length > 8 ? `${activeName.slice(0, 7)}…` : activeName;
  const chartLabel = t("tdChartLabel", { market: meta.market, range: formatWindowRange(data.window), total: activeTotal, parts: chartData.map((theme) => t("tdChartPart", { label: themeName(theme), count: theme.count, pct: theme.pct })).join("；") });

  return (
    <Card title={t("tdTitle")} hint={hint}>
      <div
        className="flex flex-col items-center"
        onKeyDownCapture={(event) => {
          if (event.key === "Escape") setHoveredKey(null);
        }}
      >
        {canExcludeOther ? (
          <div className="mb-1 flex w-full items-center justify-between gap-3">
            {/* 口径注脚：开关只影响本卡的占比计算，其他区块仍按全量分母。 */}
            <span className="text-xs text-[var(--text-secondary)]">{t("tdMarketingOnlyScope")}</span>
            <button
              type="button"
              aria-pressed={excludeOther}
              onClick={() => setMarketingOnly((value) => !value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)] ${excludeOther ? "border-[var(--control-active-bg)] bg-[var(--control-active-bg)] text-[var(--control-active-text)]" : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--control-focus)] hover:text-[var(--text-body)]"}`}
            >
              {t("tdMarketingOnly")}
            </button>
          </div>
        ) : null}
        <Tooltip
          anchorRole="group"
          className="my-1 w-full max-w-64 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)]"
          label={chartLabel}
          onOpenChange={(open) => {
            if (!open) setHoveredKey(null);
          }}
          content={<>
            <div className="font-semibold">{activeName ?? t("tdAllThemes")} · {meta.market}</div>
            <div className="mt-1 font-mono font-bold">{active?.count ?? activeTotal} {t("marketUnitEmails", { count: active?.count ?? activeTotal })} · {t("tdTooltipShare")} {active?.pct ?? 100}%</div>
            <div className="mt-1">{formatWindowRange(data.window)} · {t("tdDenominator")} {activeTotal} {t("marketUnitEmails", { count: activeTotal })} · {t("tdVisible")}</div>
          </>}
        >
          <div className="td-chart relative" data-hovered={hoveredKey ?? undefined} role="group" aria-label={t("tdSliceGroupAria")}>
            {sectorCss ? <style>{sectorCss}</style> : null}
            {donutChart}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-mono text-3xl font-bold text-[var(--text-heading)]">{active?.count ?? activeTotal}</div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">{active ? `${centerLabel} ${active.pct}%` : t("tdCenterAll")}</div>
            </div>
          </div>
        </Tooltip>
        <div className="chart-legend mt-3 grid w-full gap-2 text-sm" role="group" aria-label={t("tdLegendAria")}>
          {chartData.map((theme) => (
            <a
              key={theme.key}
              href={themeEmailsHash(theme.key)}
              onMouseEnter={() => setHoveredKey(theme.key)}
              onMouseLeave={() => setHoveredKey(null)}
              onFocus={() => setHoveredKey(theme.key)}
              onBlur={() => setHoveredKey(null)}
              className={`grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg border px-3 py-2 no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)] ${hoveredKey === theme.key ? "border-[var(--control-focus)] bg-[var(--surface-subtle)]" : "border-[var(--border-default)] hover:border-[var(--control-focus)]"}`}
              aria-label={sliceAria(theme)}
            >
              <span className="flex min-w-0 items-center gap-2 text-[var(--text-body)]">
                <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: themeColor(theme.key) }} />
                <span className="min-w-0 font-semibold leading-snug [overflow-wrap:anywhere]">{themeName(theme)}</span>
              </span>
              <span className="shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-[var(--text-secondary)]"><strong className="text-[var(--text-heading)]">{theme.count} {t("marketUnitEmails", { count: theme.count })}</strong> · {theme.pct}%</span>
            </a>
          ))}
        </div>
        <p className="mt-3 w-full text-xs leading-5 text-[var(--text-secondary)]">{t("tdFooterNote")}</p>
      </div>
    </Card>
  );
}
