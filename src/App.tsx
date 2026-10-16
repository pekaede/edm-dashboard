import { useEffect, useState } from "react";
import { BrandDetailDialog } from "./components/BrandDetailDialog";
import { BrandThemeBreakdown } from "./components/BrandThemeBreakdown";
import { CampaignOverview } from "./components/CampaignOverview";
import { DashboardFooter } from "./components/DashboardFooter";
import { DashboardHeader } from "./components/DashboardHeader";
import { Insights } from "./components/Insights";
import { KpiGrid } from "./components/KpiGrid";
import { MarkdownReport } from "./components/MarkdownReport";
import { ThemeDistribution } from "./components/ThemeDistribution";
import { WordCloud } from "./components/WordCloud";
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
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return (
    <div className="dashboard-shell min-h-screen font-sans text-slate-800 antialiased">
      <DashboardHeader />

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 pb-5 sm:px-6 lg:px-6">
        <nav aria-label="页面视图" className="flex justify-center sm:justify-end">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <a
              href="#dashboard"
              aria-current={view === "dashboard" ? "page" : undefined}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                view === "dashboard"
                  ? "bg-[#10203f] text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              数据看板
            </a>
            <a
              href="#report"
              aria-current={view === "report" ? "page" : undefined}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                view === "report"
                  ? "bg-[#10203f] text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              OnePage 报告
            </a>
          </div>
        </nav>

        {view === "dashboard" ? (
          <>
            <KpiGrid />

            <div className="grid items-stretch gap-4 xl:grid-cols-[1.13fr_0.7fr_1.13fr]">
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

            <div className="grid items-stretch gap-4 xl:grid-cols-2">
              <div className="min-w-0">
                <WordCloud />
              </div>
              <div className="min-w-0">
                <Insights />
              </div>
            </div>

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
