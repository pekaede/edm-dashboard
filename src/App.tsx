import { useEffect, useState } from "react";
import { BrandDetailDialog } from "./components/BrandDetailDialog";
import { BrandThemeBreakdown } from "./components/BrandThemeBreakdown";
import { CampaignOverview } from "./components/CampaignOverview";
import { DashboardFooter } from "./components/DashboardFooter";
import { DashboardHeader } from "./components/DashboardHeader";
import { ExtendedEmailFilter } from "./components/ExtendedEmailFilter";
import { Insights } from "./components/Insights";
import { KpiGrid } from "./components/KpiGrid";
import { MarkdownReport } from "./components/MarkdownReport";
import { ThemeDistribution } from "./components/ThemeDistribution";
import { WordCloud } from "./components/WordCloud";
import { DASHBOARD_THEME_STYLE } from "./components/dashboard";
import type { Brand } from "./data";

type View = "dashboard" | "report";

function getViewFromHash(): View {
  return window.location.hash === "#report" ? "report" : "dashboard";
}

export default function App() {
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [view, setView] = useState<View>(getViewFromHash);

  useEffect(() => {
    const handleHashChange = () => {
      setView(getViewFromHash());
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return (
    <div
      className="dashboard-shell min-h-screen font-sans text-slate-800 antialiased"
      style={DASHBOARD_THEME_STYLE}
    >
      <DashboardHeader />

      <main className="dashboard-container space-y-4 pb-6 sm:space-y-5 sm:pb-8">
        <nav aria-label="页面视图" className="flex justify-center sm:justify-end">
          <div className="view-switcher">
            <a
              href="#dashboard"
              aria-current={view === "dashboard" ? "page" : undefined}
              className={`view-switcher-link ${
                view === "dashboard"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              数据看板
            </a>
            <a
              href="#report"
              aria-current={view === "report" ? "page" : undefined}
              className={`view-switcher-link ${
                view === "report"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              OnePage 报告
            </a>
          </div>
        </nav>

        {view === "dashboard" ? (
          <>
            <KpiGrid />

            <div className="grid items-stretch gap-4 xl:grid-cols-[1.13fr_0.7fr_1.13fr] xl:gap-5">
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

            <ExtendedEmailFilter />

            <DashboardFooter />
          </>
        ) : (
          <MarkdownReport />
        )}
      </main>

      {selectedBrand ? (
        <BrandDetailDialog brand={selectedBrand} onClose={() => setSelectedBrand(null)} />
      ) : null}
    </div>
  );
}
