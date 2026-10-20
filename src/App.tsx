import { useEffect, useMemo, useRef, useState } from "react";
import { initAnalytics, trackView } from "./analytics";
import { BrandDetailDialog } from "./components/BrandDetailDialog";
import { BrandThemeBreakdown } from "./components/BrandThemeBreakdown";
import { CalendarView } from "./components/CalendarView";
import { CampaignOverview } from "./components/CampaignOverview";
import { ContentAnalysis } from "./components/ContentAnalysis";
import { DashboardFooter } from "./components/DashboardFooter";
import { DashboardHeader } from "./components/DashboardHeader";
import { ExtendedEmailFilter } from "./components/ExtendedEmailFilter";
import { Insights } from "./components/Insights";
import { KpiGrid } from "./components/KpiGrid";
import { MarketComparison } from "./components/MarketComparison";
import { MarkdownReport } from "./components/MarkdownReport";
import { PageNav } from "./components/PageNav";
import { ThemeDistribution } from "./components/ThemeDistribution";
import { WordCloud } from "./components/WordCloud";
import type { MarketFilterValue } from "./components/MarketFilter";
import type { Brand } from "./data";
import {
  SiteProvider,
  useComparisonMarkets,
  useSiteSelection,
} from "./site-data";
import { getSavedReadingPosition, useUrlSync } from "./use-url-sync";
import { THREE_WEEK_WINDOW } from "./three-week-aggregation";

type View = "dashboard" | "report" | "emails";

const DASHBOARD_SECTIONS = [
  { id: "onepage-summary", label: "OnePage 摘要" },
  { id: "overview", label: "数据概览" },
  { id: "keywords", label: "关键词" },
  { id: "calendar", label: "日历" },
  { id: "comparison", label: "跨市场对比" },
  { id: "content-analysis", label: "内容 AI 分析" },
];

// URL 原始 hash 的视图段；空 hash / "#" / 未知视图返回 null（旧行为：显示看板）。
function getRawView(
  hash: string,
): "dashboard" | "report" | "emails" | "calendar" | null {
  const seg = (hash.startsWith("#") ? hash.slice(1) : hash).split(/[/?]/)[0];
  if (
    seg === "report" ||
    seg === "emails" ||
    seg === "dashboard" ||
    seg === "calendar"
  ) {
    return seg;
  }
  return null;
}

function Dashboard() {
  const { market: siteMarket, setMarket: setSiteMarket } = useSiteSelection();
  const [comparisonMarkets, setComparisonMarkets] = useComparisonMarkets();
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);

  // URL 状态由 useUrlSync 统一管理（视图/站点/主题/搜索词与 hash 双向同步，
  // 前进后退、复制链接可还原同一视图和筛选）。
  // 注意：ExtendedEmailFilter 内已挂了一个 useUrlSync 实例负责邮件列表的滚动恢复，
  // 这里的实例用 preserveScroll: false，不做滚动恢复、不持久化保存滚动位置，
  // 只做 URL 状态同步（hook 的 scroll 监听本身不受 preserveScroll 门控，
  // 仍会写共享的滚动快照内存 Map，但本实例不触发恢复、也不持久化，无实际影响）。
  // initialState 只在无真实视图 hash 时补默认看板；有 hash 时以解析结果为准，
  // 不能无条件覆盖（否则 #report 这类链接会被改写回看板）。
  const initialUrlState = useMemo(
    () =>
      typeof window !== "undefined" &&
      getRawView(window.location.hash) !== null
        ? {}
        : { view: "dashboard" as const },
    [],
  );
  const {
    state: urlState,
    setMarket: setHookMarket,
    hash: rawHash,
  } = useUrlSync({
    preserveScroll: false,
    initialState: initialUrlState,
  });

  // 视图以 URL 原始 hash 为准：空 hash / "#" / 未知 hash → 看板（旧行为）。
  // 不能只用 urlState.view，因为 parseHash 会把空/未知 hash 默认解析为 report，
  // 挂载后导航到这类 hash 时会错误进入报告。rawHash 来自 hook 的响应式状态：
  // 解析状态相同（如 #unknown/UK 与 #report/UK）时它仍会变化并触发重渲染。
  const rawView = getRawView(rawHash);
  // "calendar" 不是独立视图，日历是看板内的一个区块，映射回看板（与旧行为一致）。
  const view: View =
    rawView === null || rawView === "calendar" ? "dashboard" : rawView;
  // emailTheme 必须是独立派生：离开邮件视图时视为 null（P0-01），不沿用上次主题。
  const emailTheme = urlState.view === "emails" ? urlState.theme : null;

  const [analyticsReady, setAnalyticsReady] = useState(false);
  const lastTrackedViewRef = useRef<View | null>(null);
  const analyticsView =
    rawView === null && rawHash !== "" && rawHash !== "#" ? null : view;

  useEffect(() => {
    let cancelled = false;
    void initAnalytics().then((ready) => {
      if (ready && !cancelled) setAnalyticsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [analyticsView]);

  useEffect(() => {
    if (analyticsView === null) {
      lastTrackedViewRef.current = null;
      return;
    }
    if (
      !analyticsReady ||
      lastTrackedViewRef.current === analyticsView
    ) return;
    trackView(analyticsView);
    lastTrackedViewRef.current = analyticsView;
  }, [analyticsReady, analyticsView, urlState.view]);

  useEffect(() => setSelectedBrand(null), [siteMarket]);

  // URL 市场为 null 时：显式写了市场段（marketSpecified，如 /all）→ 恢复全部市场；
  // 否则（旧链接/视图导航未写市场段）→ 保留当前站点并写回 URL（replace，不产生多余历史）。
  // 空/未知 hash 不碰 URL 与站点（旧行为：仅显示看板）。
  const applyNullHookMarket = (currentSite: MarketFilterValue) => {
    if (
      typeof window !== "undefined" &&
      getRawView(window.location.hash) === null
    )
      return;
    if (urlState.marketSpecified) {
      if (currentSite !== null) setSiteMarket(null);
    } else {
      setHookMarket(currentSite, { replace: true });
    }
  };

  // 市场双向同步：SiteProvider 是站点事实来源，hook 是 URL 事实来源。
  // 挂载时 hash 里的市场优先；之后按“最后变化的一方”同步，两边相等即停，不成环。
  // 空/未知 hash 不碰 URL 与站点（旧行为：仅显示看板）。
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      getRawView(window.location.hash) === null
    )
      return;
    if (urlState.market !== null && urlState.market !== siteMarket) {
      setSiteMarket(urlState.market);
    } else if (urlState.market === null) {
      applyNullHookMarket(siteMarket);
    }
    // 只在挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const prevMarketsRef = useRef({
    hook: urlState.market,
    specified: urlState.marketSpecified,
    site: siteMarket,
  });
  // 上一次同步 effect 运行时的原始视图（null = 空/未知 hash）。
  // 离开空/未知视图时解析状态可能完全相同（如 #unknown/UK → #report/UK），
  // prev 比较无法区分“真正同步过”与“未知阶段仅记录”，必须强制按 URL 对齐一次站点。
  const prevRawViewRef = useRef(rawView);
  useEffect(() => {
    const rawViewNow = getRawView(rawHash);
    const wasUnknown = prevRawViewRef.current === null;
    prevRawViewRef.current = rawViewNow;
    if (rawViewNow === null) {
      // 空/未知 hash：不碰 URL 与站点，但把当前状态记为“已见”，
      // 避免下一轮误判为站点选择器/URL 变化（空 hash 下切站点再导航
      // #emails/all 时，陈旧的 prev.site 会导致 URL 被误写回站点）。
      prevMarketsRef.current = {
        hook: urlState.market,
        specified: urlState.marketSpecified,
        site: siteMarket,
      };
      return;
    }
    const prev = prevMarketsRef.current;
    if (wasUnknown) {
      // 离开空/未知视图：URL 重新成为事实来源，强制对齐站点。
      if (urlState.market === null) {
        applyNullHookMarket(siteMarket);
      } else if (urlState.market !== siteMarket) {
        setSiteMarket(urlState.market);
      }
    } else if (siteMarket !== prev.site) {
      // 站点选择器变化（用户切站点）→ 写入 URL（push，前进后退可回到上一站点）。
      if (urlState.market !== siteMarket) setHookMarket(siteMarket);
    } else if (
      urlState.market !== prev.hook ||
      urlState.marketSpecified !== prev.specified
    ) {
      // URL 变化（前进后退/链接）→ 同步到站点选择器；URL 未写市场则按 applyNullHookMarket 处理。
      // 注意比较 marketSpecified：#emails → #emails/all 时 market 都是 null，
      // 但 marketSpecified false→true 是语义变化，必须触发同步，否则全部市场无法恢复。
      if (urlState.market === null) {
        applyNullHookMarket(siteMarket);
      } else if (urlState.market !== siteMarket) {
        setSiteMarket(urlState.market);
      }
    }
    prevMarketsRef.current = {
      hook: urlState.market,
      specified: urlState.marketSpecified,
      site: siteMarket,
    };
  }, [
    rawHash,
    urlState.market,
    urlState.marketSpecified,
    siteMarket,
    setHookMarket,
    setSiteMarket,
  ]);

  // 视图切换时的滚动策略（跳过首次挂载，避免破坏刷新时的原生滚动恢复）：
  // - 进入看板/报告：无滚动恢复，直接回顶；
  // - 进入邮件列表：有已保存阅读位置时由列表内的 hook 恢复，这里不干预；
  //   无保存位置时回顶。
  const prevViewRef = useRef(view);
  useEffect(() => {
    const prevView = prevViewRef.current;
    prevViewRef.current = view;
    if (view === prevView) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (view !== "emails" || getSavedReadingPosition("emails") === null) {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    }
  }, [view]);

  const viewNavigation = (
    <nav aria-label="页面视图" className="flex min-w-0 justify-center sm:justify-end">
      <div className="view-switcher">
        <a
          href="#dashboard"
          aria-current={view === "dashboard" ? "page" : undefined}
          className={`view-switcher-link ${
            view === "dashboard"
              ? "bg-[var(--control-active-bg)] text-[var(--control-active-text)] shadow-[var(--shadow-switcher)]"
              : "text-[var(--control-text)] hover:bg-[var(--control-hover-bg)] hover:text-[var(--control-hover-text)]"
          }`}
        >
          数据看板
        </a>
        <a
          href="#report"
          aria-current={view === "report" ? "page" : undefined}
          className={`view-switcher-link ${
            view === "report"
              ? "bg-[var(--control-active-bg)] text-[var(--control-active-text)] shadow-[var(--shadow-switcher)]"
              : "text-[var(--control-text)] hover:bg-[var(--control-hover-bg)] hover:text-[var(--control-hover-text)]"
          }`}
        >
          OnePage 报告
        </a>
        <a
          href="#emails"
          aria-current={view === "emails" ? "page" : undefined}
          className={`view-switcher-link ${
            view === "emails"
              ? "bg-[var(--control-active-bg)] text-[var(--control-active-text)] shadow-[var(--shadow-switcher)]"
              : "text-[var(--control-text)] hover:bg-[var(--control-hover-bg)] hover:text-[var(--control-hover-text)]"
          }`}
        >
          邮件视图
        </a>
      </div>
    </nav>
  );

  return (
    <div className="dashboard-shell min-h-screen font-sans text-[var(--text-body)] antialiased">
      <DashboardHeader />

      <main className="dashboard-container space-y-[var(--card-padding)] pb-[calc(var(--card-padding)*2)] sm:space-y-[var(--card-padding-sm)] sm:pb-[calc(var(--card-padding-sm)*2)]">
        {view === "dashboard" ? (
          <>
            <PageNav sections={DASHBOARD_SECTIONS} />
            <KpiGrid />

            <section id="onepage-summary" aria-label="OnePage 摘要" className="scroll-mt-20 min-w-0 space-y-[calc(var(--card-padding)/2)] xl:[&_ol]:grid-cols-2">
              <div className="flex flex-col gap-[calc(var(--card-padding)/2)] sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[length:var(--type-h3-size)] font-[number:var(--type-h3-weight)] leading-[var(--type-h3-leading)] text-[var(--text-heading)]">OnePage 摘要</p>
                {viewNavigation}
              </div>
              <Insights />
            </section>

            <div id="overview" className="dashboard-overview-grid scroll-mt-20 grid items-stretch gap-[var(--card-padding)] sm:gap-[var(--card-padding-sm)] xl:grid-cols-[1.1fr_0.85fr_1.1fr]">
              <div className="min-w-0">
                <CampaignOverview onSelectBrand={setSelectedBrand} />
              </div>
              <div className="min-w-0">
                <ThemeDistribution />
              </div>
              <div className="min-w-0">
                <BrandThemeBreakdown onSelectBrand={setSelectedBrand} />
              </div>
            </div>

            <div className="grid items-start gap-[var(--card-padding)] sm:gap-[var(--card-padding-sm)] lg:grid-cols-2">
              <div id="keywords" className="scroll-mt-20 min-w-0">
                <WordCloud />
              </div>
              <div id="calendar" className="scroll-mt-20 min-w-0">
                <CalendarView key={siteMarket ?? "all"} />
              </div>
            </div>

            <div id="comparison" className="scroll-mt-20 min-w-0">
              <MarketComparison
                markets={comparisonMarkets}
                onMarketsChange={setComparisonMarkets}
              />
            </div>

            <div id="content-analysis" className="scroll-mt-20 min-w-0">
              {/* 内容 AI 分析：默认三周窗口 THREE_WEEK_WINDOW，组件内可切三个月（数据窗口） */}
              <ContentAnalysis site={siteMarket} window={THREE_WEEK_WINDOW} />
            </div>
            <DashboardFooter />
          </>
        ) : view === "report" ? (
          <>
            {viewNavigation}
            <MarkdownReport />
          </>
        ) : (
          <section
            className="space-y-[var(--card-padding)] sm:space-y-[var(--card-padding-sm)]"
            data-email-theme={emailTheme ?? undefined}
            aria-label="邮件视图"
          >
            {viewNavigation}
            <div>
              <a
                href="#dashboard"
                className="inline-flex min-h-[calc(var(--card-padding)*3)] items-center rounded-[var(--card-radius)] px-[var(--card-padding)] text-[length:var(--type-body-size)] font-[number:var(--type-h3-weight)] leading-[var(--type-body-leading)] text-[var(--control-text)] transition-colors hover:bg-[var(--control-hover-bg)] hover:text-[var(--control-hover-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--control-focus-offset)]"
                aria-label="返回数据看板"
              >
                ← 回到看板
              </a>
            </div>

            <ExtendedEmailFilter
              key={`${siteMarket ?? "all"}-${emailTheme ?? "all"}`}
              initialTheme={emailTheme}
            />
          </section>
        )}
      </main>

      {selectedBrand ? (
        <BrandDetailDialog brand={selectedBrand} onClose={() => setSelectedBrand(null)} />
      ) : null}
    </div>
  );
}

export default function App() {
  return <SiteProvider><Dashboard /></SiteProvider>;
}
