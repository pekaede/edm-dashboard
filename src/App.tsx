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
    <div className="min-h-screen font-sans text-slate-800 antialiased">
      <DashboardHeader />

      <main className="mx-auto max-w-6xl space-y-5 px-5 py-6">
        <KpiGrid />
        <CampaignOverview />

        <div className="grid gap-5 lg:grid-cols-2">
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
