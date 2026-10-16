import { useState } from "react";
import { BrandDetailDialog } from "./components/BrandDetailDialog";
import { BrandThemeBreakdown } from "./components/BrandThemeBreakdown";
import { CampaignOverview } from "./components/CampaignOverview";
import { DashboardFooter } from "./components/DashboardFooter";
import { DashboardHeader } from "./components/DashboardHeader";
import { Insights } from "./components/Insights";
import { KpiGrid } from "./components/KpiGrid";
import { ThemeDistribution } from "./components/ThemeDistribution";
import { WordCloud } from "./components/WordCloud";
import type { Brand } from "./data";

export default function App() {
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);

  return (
    <div className="dashboard-shell min-h-screen font-sans text-slate-800 antialiased">
      <DashboardHeader />

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 pb-5 sm:px-6 lg:px-6">
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
      </main>

      {selectedBrand ? (
        <BrandDetailDialog brand={selectedBrand} onClose={() => setSelectedBrand(null)} />
      ) : null}
    </div>
  );
}
