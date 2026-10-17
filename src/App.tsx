import { useEffect, useState } from "react";
import { BrandDetailDialog } from "./components/BrandDetailDialog";
import { BrandThemeBreakdown } from "./components/BrandThemeBreakdown";
import { CalendarView } from "./components/CalendarView";
import { CampaignOverview } from "./components/CampaignOverview";
import { DashboardFooter } from "./components/DashboardFooter";
import { DashboardHeader } from "./components/DashboardHeader";
import { ExtendedEmailFilter } from "./components/ExtendedEmailFilter";
import { Insights } from "./components/Insights";
import { KpiGrid } from "./components/KpiGrid";
import { MarketComparison } from "./components/MarketComparison";
import { MarkdownReport } from "./components/MarkdownReport";
import { ThemeDistribution } from "./components/ThemeDistribution";
import { WordCloud } from "./components/WordCloud";
import type { Brand } from "./data";
import { SiteProvider, useSiteSelection } from "./site-data";

type View = "dashboard" | "report" | "emails";

function getViewFromHash(): View {
  if (window.location.hash === "#report") {
    return "report";
  }

  if (
    window.location.hash === "#emails" ||
    window.location.hash.startsWith("#emails/")
  ) {
    return "emails";
  }

  return "dashboard";
}

function getEmailThemeFromHash(): string | null {
  const themePath = window.location.hash.slice("#emails/".length);

  if (!window.location.hash.startsWith("#emails/") || !themePath) {
    return null;
  }

  try {
    return decodeURIComponent(themePath);
  } catch {
    return themePath;
  }
}

function Dashboard() {
  const { market } = useSiteSelection();
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [view, setView] = useState<View>(getViewFromHash);
  // emailTheme 必须是独立 state：同页 hash 变化时 view 可能仍为 "emails"，
  // 仅 setView 会被 React 跳过渲染，主题与组件 key 都不会更新（P0-01）。
  const [emailTheme, setEmailTheme] = useState<string | null>(() =>
    getViewFromHash() === "emails" ? getEmailThemeFromHash() : null,
  );

  useEffect(() => setSelectedBrand(null), [market]);

  useEffect(() => {
    const handleHashChange = () => {
      const nextView = getViewFromHash();
      setView(nextView);
      setEmailTheme(nextView === "emails" ? getEmailThemeFromHash() : null);
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return (
    <div className="dashboard-shell min-h-screen font-sans text-slate-800 antialiased">
      <DashboardHeader />

      <main className="dashboard-container space-y-4 pb-6 sm:space-y-5 sm:pb-8">
        <nav aria-label="页面视图" className="flex justify-center sm:justify-end">
          <div className="view-switcher">
            <a
              href="#dashboard"
              aria-current={view === "dashboard" ? "page" : undefined}
              className={`view-switcher-link ${
                view === "dashboard"
                  ? "bg-[var(--control-active-bg)] text-[var(--control-active-text)] shadow-sm"
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
                  ? "bg-[var(--control-active-bg)] text-[var(--control-active-text)] shadow-sm"
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
                  ? "bg-[var(--control-active-bg)] text-[var(--control-active-text)] shadow-sm"
                  : "text-[var(--control-text)] hover:bg-[var(--control-hover-bg)] hover:text-[var(--control-hover-text)]"
              }`}
            >
              邮件视图
            </a>
          </div>
        </nav>

        {view === "dashboard" ? (
          <>
            <KpiGrid />

            <div className="dashboard-overview-grid grid items-stretch gap-4 xl:grid-cols-[1.1fr_0.85fr_1.1fr] xl:gap-5">
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

            <div className="grid items-stretch gap-4 xl:grid-cols-2 xl:gap-5">
              <div className="min-w-0">
                <WordCloud />
              </div>
              <div className="min-w-0">
                <Insights />
              </div>
            </div>

            <MarketComparison />
            <CalendarView key={market ?? "all"} />
            <DashboardFooter />
          </>
        ) : view === "report" ? (
          <MarkdownReport />
        ) : (
          <section
            className="space-y-4 sm:space-y-5"
            data-email-theme={emailTheme ?? undefined}
            aria-label="邮件视图"
          >
            <div>
              <a
                href="#dashboard"
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] focus-visible:ring-offset-2"
                aria-label="返回数据看板"
              >
                ← 回到看板
              </a>
            </div>

            <ExtendedEmailFilter
              key={`${market ?? "all"}-${emailTheme ?? "all"}`}
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
