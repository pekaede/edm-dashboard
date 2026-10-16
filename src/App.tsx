import { BrandThemeBreakdown } from "./components/BrandThemeBreakdown";
import { CampaignOverview } from "./components/CampaignOverview";
import { DashboardFooter } from "./components/DashboardFooter";
import { DashboardHeader } from "./components/DashboardHeader";
import { Insights } from "./components/Insights";
import { KpiGrid } from "./components/KpiGrid";
import { ThemeDistribution } from "./components/ThemeDistribution";
import { WordCloud } from "./components/WordCloud";

export default function App() {
  return (
    <div className="min-h-screen overflow-hidden font-sans text-slate-800 antialiased">
      <DashboardHeader />

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <KpiGrid />
        <CampaignOverview />

        <div className="grid items-stretch gap-8 lg:grid-cols-2">
          <ThemeDistribution />
          <BrandThemeBreakdown />
        </div>

        <WordCloud />
        <Insights />
        <DashboardFooter />
      </main>
    </div>
  );
}
