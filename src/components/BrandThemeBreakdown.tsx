import { memo, useMemo, useState, type CSSProperties } from "react";
import { Bar, BarChart, LabelList, XAxis, YAxis, type BarShapeProps } from "recharts";
import type { Brand } from "../data";
import { useLocale } from "../i18n";
import { useSiteEmails, useSiteSelection } from "../site-data";
import {
  aggregateThreeWeek,
  buildAggregatedBrand,
  formatWindowRange,
  themeColor,
  themeLabelColor,
  THREE_WEEK_WINDOW,
  type ThreeWeekAggregatedBrand,
  type ThreeWeekAggregatedTheme,
} from "../three-week-aggregation";
import { Card } from "./Card";
import { themeLabelKeyOf } from "./dashboard";
import { EmptyState } from "./EmptyState";
import { ExtendedEmailsState } from "./ExtendedEmailsState";
import { Tooltip } from "./Tooltip";
import { ChartContainer, type ChartConfig } from "./ui/chart";

const EMPTY_STATE_CLASS_NAME =
  "[&>div]:border-[var(--border-default)] [&>div]:bg-[var(--surface-card)] [&_[aria-hidden]]:border-[var(--border-default)] [&_[aria-hidden]]:bg-[var(--surface-subtle)] [&_[aria-hidden]]:text-[var(--text-secondary)] [&_h3]:text-[var(--text-heading)] [&_p]:text-[var(--text-secondary)] [&_button]:bg-[var(--control-active-bg)] [&_button]:text-[var(--control-active-text)] [&_button:hover]:bg-[var(--control-active-hover-bg)] [&_button:focus-visible]:ring-[var(--accent-ink)] [&_button:focus-visible]:ring-offset-[var(--surface-card)]";

// 堆叠分段的圆角矩形路径：只有整条的首/尾段带外侧圆角（与原手写分段的 rounded-l/r-lg 一致）。
function segmentPath(x: number, y: number, width: number, height: number, roundLeft: boolean, roundRight: boolean) {
  const r = Math.min(8, height / 2, width);
  const tl = roundLeft ? r : 0;
  const tr = roundRight ? r : 0;
  const br = roundRight ? r : 0;
  const bl = roundLeft ? r : 0;
  return [
    `M ${x + tl} ${y}`,
    `H ${x + width - tr}`,
    tr ? `A ${tr} ${tr} 0 0 1 ${x + width} ${y + tr}` : `L ${x + width} ${y}`,
    `V ${y + height - br}`,
    br ? `A ${br} ${br} 0 0 1 ${x + width - br} ${y + height}` : `L ${x + width} ${y + height}`,
    `H ${x + bl}`,
    bl ? `A ${bl} ${bl} 0 0 1 ${x} ${y + height - bl}` : `L ${x} ${y + height}`,
    `V ${y + tl}`,
    tl ? `A ${tl} ${tl} 0 0 1 ${x + tl} ${y}` : `L ${x} ${y}`,
    "Z",
  ].join(" ");
}

interface BrandSeg extends ThreeWeekAggregatedTheme {
  themeCount: number;
  pct: number;
  widthPct: number;
}

function computeSegs(themes: ThreeWeekAggregatedTheme[], brand: ThreeWeekAggregatedBrand): BrandSeg[] {
  // Sort brand's themes by count descending to match visual layout
  return themes
    .filter((theme) => (brand.themes[theme.key] || 0) > 0)
    .map((theme) => ({
      ...theme,
      themeCount: brand.themes[theme.key],
      pct: Math.round((brand.themes[theme.key] / brand.total) * 100),
      widthPct: (brand.themes[theme.key] / brand.total) * 100,
    }))
    .sort((a, b) => b.themeCount - a.themeCount);
}

interface BrandBarProps {
  brandName: string;
  brandTotal: number;
  segs: BrandSeg[];
  chartConfig: ChartConfig;
  marketLabel: string;
  windowRange: string;
}

// 单个品牌的 100% 堆叠条。图表元素 memoize：悬停/锁定状态变化时不重建 SVG 节点
// （否则 Recharts 会替换分段节点、卸载正在聚焦的分段，Esc 也无法再清除锁定）。
// 分段的淡化由 index.css 按作用域上的 data-highlighted 驱动，颜色经 --sector-color 变量传入；
// 分段悬停/聚焦的描边同样是 CSS（:hover / :focus-visible）。
const BrandBar = memo(function BrandBar({ brandName, brandTotal, segs, chartConfig, marketLabel, windowRange }: BrandBarProps) {
  const { t } = useLocale();
  const [hotKey, setHotKey] = useState<string | null>(null);
  const themeName = (theme: { key: string; labelZh: string }) => {
    const key = themeLabelKeyOf(theme.key);
    return key ? t(key) : theme.labelZh;
  };
  const segLabel = (seg: BrandSeg) =>
    t("btbSegLabel", { brand: brandName, theme: themeName(seg), count: seg.themeCount, pct: seg.pct, total: brandTotal });
  const activeSeg = hotKey ? segs.find((seg) => seg.key === hotKey) : undefined;

  const chart = useMemo(() => {
    if (brandTotal <= 0) return null;
    // Recharts 行数据：每个主题键对应一段的封数（defineProperty 避免 __proto__ 类键名污染）。
    const barRow: Record<string, number | string> = { name: brandName };
    for (const seg of segs) {
      Object.defineProperty(barRow, seg.key, {
        value: seg.themeCount,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    const renderSegShape = (seg: BrandSeg, index: number) => (props: BarShapeProps) => {
      const x = props.x ?? 0;
      const y = props.y ?? 0;
      const width = props.width ?? 0;
      const height = props.height ?? 0;
      if (!(width > 0) || !(height > 0)) return <g />;
      const isFirst = index === 0;
      const isLast = index === segs.length - 1;
      return (
        <g>
          <path
            d={segmentPath(x, y, width, height, isFirst || segs.length === 1, isLast || segs.length === 1)}
            data-x={Math.round(x)}
            data-w={Math.round(width)}
            data-key={seg.key}
            className="btb-sector-path cursor-pointer outline-none"
            style={{
              "--sector-color": themeColor(seg.key),
              "--sector-label-color": themeLabelColor(seg.key),
            } as CSSProperties}
            fill="var(--sector-color)"
            tabIndex={0}
            role="img"
            aria-label={segLabel(seg)}
            onMouseEnter={() => setHotKey(seg.key)}
            onMouseLeave={() => setHotKey(null)}
            onFocus={() => setHotKey(seg.key)}
            onBlur={() => setHotKey(null)}
          />
          {!isLast ? (
            <line x1={x + width} y1={y} x2={x + width} y2={y + height} stroke="var(--surface-card)" strokeWidth={1} className="pointer-events-none" />
          ) : null}
        </g>
      );
    };
    const renderSegLabel = (seg: BrandSeg) => (props: { x?: number | string; y?: number | string; width?: number | string; height?: number | string }) => {
      // Only show percentage when wide enough to prevent overlap/clipping
      if (seg.widthPct < 14) return <g />;
      const x = Number(props.x ?? 0) + Number(props.width ?? 0) / 2;
      const y = Number(props.y ?? 0) + Number(props.height ?? 0) / 2;
      return (
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          data-key={seg.key}
          className="btb-sector-label pointer-events-none select-none font-mono text-xs font-bold"
          style={{ "--sector-label-color": themeLabelColor(seg.key) } as CSSProperties}
          fill="var(--sector-label-color)"
        >
          {seg.pct}%
        </text>
      );
    };
    return (
      <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
        <BarChart data={[barRow]} layout="vertical" stackOffset="expand" margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap={0}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" hide width={0} />
          {segs.map((seg, index) => (
            <Bar
              key={seg.key}
              dataKey={seg.key}
              stackId="total"
              barSize={32}
              isAnimationActive={false}
              shape={renderSegShape(seg, index)}
            >
              <LabelList dataKey={seg.key} content={renderSegLabel(seg)} />
            </Bar>
          ))}
        </BarChart>
      </ChartContainer>
    );
    // segLabel/themeName 随 locale 变化，经 chartConfig/segs 的上层 memo 在语言切换时重建。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandName, brandTotal, segs, chartConfig]);

  return (
    <div className="relative order-3 col-span-2 flex h-8 min-w-0 flex-1 rounded-lg bg-[var(--surface-subtle)] sm:order-none">
      {brandTotal > 0 ? (
        <Tooltip
          anchorRole="group"
          className="block h-full w-full rounded-lg"
          label={activeSeg ? segLabel(activeSeg) : `${brandName} · ${brandTotal} ${t("marketUnitEmails", { count: brandTotal })}`}
          onOpenChange={(open) => {
            if (!open) setHotKey(null);
          }}
          content={activeSeg ? (<>
            <div className="font-semibold">{brandName} · {themeName(activeSeg)}</div>
            <div className="mt-1 font-mono font-bold">{activeSeg.themeCount} {t("marketUnitEmails", { count: activeSeg.themeCount })} · {t("btbBrandShare")} {activeSeg.pct}%</div>
            <div className="mt-1">{marketLabel} · {windowRange} · {t("btbDenominator")} {brandTotal} {t("marketUnitEmails", { count: brandTotal })}</div>
          </>) : (<>
            <div className="font-semibold">{brandName}</div>
            <div className="mt-1 font-mono font-bold">{brandTotal} {t("marketUnitEmails", { count: brandTotal })}</div>
            <div className="mt-1">{marketLabel} · {windowRange}</div>
          </>)}
        >
          {chart}
        </Tooltip>
      ) : null}
    </div>
  );
});

interface BrandThemeBreakdownProps {
  onSelectBrand: (brand: Brand) => void;
}

export function BrandThemeBreakdown({ onSelectBrand }: BrandThemeBreakdownProps) {
  const { t, locale } = useLocale();
  const themeName = (theme: { key: string; labelZh: string }) => {
    const key = themeLabelKeyOf(theme.key);
    return key ? t(key) : theme.labelZh;
  };
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);
  const [pinnedTheme, setPinnedTheme] = useState<string | null>(null);
  const highlightedTheme = previewTheme ?? pinnedTheme;
  const { status, emails, total, error, retry, meta } = useSiteEmails();
  const { market, setMarket } = useSiteSelection();
  const data = useMemo(
    () => (status === "ready" ? aggregateThreeWeek(emails) : null),
    [status, emails],
  );
  const chartConfig = useMemo<ChartConfig>(() => {
    if (!data) return {};
    return Object.fromEntries(
      data.themes
        .filter((theme) => theme.count > 0)
        .map((theme) => [theme.key, { label: themeName(theme), color: themeColor(theme.key) }]),
    );
    // themeName 随 locale 变化，locale 已在依赖中。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, locale]);
  const brandSegs = useMemo(
    () => (data ? data.brands.map((brand) => computeSegs(data.themes, brand)) : []),
    [data],
  );

  const hint = data
    ? `${meta.market} · ${t("btbHintRealtime")}${formatWindowRange(data.window)}${t("btbHintTotalPart")}${data.total}${t("btbHintDiffPart")}${meta.total}${t("btbHintDescPart")}`
    : `${meta.market} · ${t("btbHintRealtime")}${formatWindowRange(THREE_WEEK_WINDOW)}${t("btbHintFallback")}`;

  if (status !== "ready" || !data) {
    return (
      <Card title={t("btbTitle")} hint={hint}>
        <ExtendedEmailsState status={status} total={total} error={error} retry={retry} meta={meta} />
      </Card>
    );
  }

  if (data.total === 0) {
    return (
      <Card title={t("btbTitle")} hint={hint}>
        <div className={EMPTY_STATE_CLASS_NAME}>
          <EmptyState
            title={t("btbEmptyTitle")}
            description={t("btbEmptyDesc")}
            actionLabel={market === null ? t("btbRetry") : t("btbSwitchAll")}
            onAction={market === null ? retry : () => setMarket(null)}
          />
        </div>
      </Card>
    );
  }

  // 锁定主题的恢复规则按数据键动态生成（同 ThemeDistribution）：未知主题键也要能高亮。
  const segCss = data.themes
    .filter((theme) => theme.count > 0)
    .map((theme) => {
      const k = theme.key.replace(/["\\]/g, "\\$&");
      return [
        `.btb-scope[data-highlighted="${k}"] .btb-sector-path[data-key="${k}"] { fill: var(--sector-color); }`,
        `.btb-scope[data-highlighted="${k}"] .btb-sector-label[data-key="${k}"] { fill: var(--sector-label-color); }`,
      ].join("\n");
    })
    .join("\n");

  return (
    <Card
      title={t("btbTitle")}
      hint={hint}
    >
      <p className="mb-3 text-xs leading-5 text-[var(--text-secondary)]">{t("btbNote")}</p>
      <div
        className="btb-scope"
        data-highlighted={highlightedTheme ?? undefined}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setPinnedTheme(null);
            setPreviewTheme(null);
          }
        }}
      >
      {segCss ? <style>{segCss}</style> : null}
      <div
        className="-mt-1 mb-4 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-[var(--text-secondary)]"
        role="group"
        aria-label={t("btbLegendAria")}
      >
        {data.themes
          .filter((theme) => theme.count > 0)
          .map((theme) => {
          const isHighlighted = highlightedTheme === theme.key;
          return (
            <button
              type="button"
              key={theme.key}
              aria-pressed={pinnedTheme === theme.key}
              onClick={() => {
                setPinnedTheme((previous) => previous === theme.key ? null : theme.key);
                setPreviewTheme(null);
              }}
              onMouseEnter={() => setPreviewTheme(theme.key)}
              onMouseLeave={() => setPreviewTheme(null)}
              onFocus={() => setPreviewTheme(theme.key)}
              onBlur={() => setPreviewTheme(null)}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)] ${
                isHighlighted
                  ? "border-[var(--control-focus)] bg-[var(--surface-subtle)] font-semibold text-[var(--text-heading)]"
                  : "border-[var(--border-default)] text-[var(--text-body)] hover:bg-[var(--surface-subtle)]"
              }`}
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: themeColor(theme.key) }}
              />
              <span>{themeName(theme)}</span>
              {pinnedTheme === theme.key ? <span className="text-xs">{t("btbPinned")}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="mb-2 flex justify-between text-xs text-[var(--text-secondary)]" aria-hidden="true"><span>{t("btbAxisLeft")}</span><span>{t("btbAxisRight")}</span></div>
      <div className="space-y-3.5">
        {data.brands.map((b, brandIndex) => {
          const segs = brandSegs[brandIndex] ?? [];
          return (
            <div key={b.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 sm:flex sm:gap-3">
              {/* Brand button with keyboard navigation */}
              <button
                type="button"
                className="min-h-11 w-fit shrink-0 rounded-md px-1 py-0.5 text-left text-xs font-semibold text-[var(--text-body)] transition hover:bg-[var(--accent-tint)] hover:text-[var(--accent-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)] sm:w-22 sm:text-sm"
                onClick={() => onSelectBrand(buildAggregatedBrand(data, b.name, t))}
              >
                {b.name}
              </button>

              {/* Segmented Bar（Recharts 100% 堆叠条；数值口径仍为品牌内封数占比） */}
              <BrandBar
                brandName={b.name}
                brandTotal={b.total}
                segs={segs}
                chartConfig={chartConfig}
                marketLabel={meta.market}
                windowRange={formatWindowRange(data.window)}
              />

              {/* Total volume label */}
              <div className="w-11 shrink-0 text-right font-mono text-xs font-semibold text-[var(--text-secondary)] tabular-nums sm:w-12">
                {b.total} {t("marketUnitEmails", { count: b.total })}
              </div>

              {b.total === 0 ? <p className="order-4 col-span-2 text-xs text-[var(--text-secondary)] sm:sr-only">{t("btbZeroNote")}</p> : null}
            </div>
          );
        })}
      </div>
      </div>
    </Card>
  );
}
