import { DATA } from "../data";
import { Card } from "./Card";
import { THEME_COLORS } from "./dashboard";

export function BrandThemeBreakdown() {
  return (
    <Card title="各品牌内容结构">
      {/* Top Legend */}
      <div className="-mt-1 mb-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
        {DATA.themes.map((t) => (
          <div key={t.key} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: THEME_COLORS[t.key] }}
            />
            <span>{t.labelZh}</span>
          </div>
        ))}
      </div>

      {/* Brand rows */}
      <div className="space-y-4">
        {DATA.brands.map((b) => {
          // Sort brand's themes by count descending to match prototype order
          const segs = DATA.themes
            .filter((t) => (b.themes[t.key] || 0) > 0)
            .map((t) => ({
              ...t,
              themeCount: b.themes[t.key],
              pct: Math.round((b.themes[t.key] / b.total) * 100),
              widthPct: (b.themes[t.key] / b.total) * 100,
            }))
            .sort((a, b) => b.themeCount - a.themeCount);

          return (
            <div key={b.name} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-sm font-medium text-slate-800">
                {b.name}
              </span>

              <div className="relative flex h-7 flex-1 overflow-visible rounded-md bg-slate-100">
                <div className="flex h-full w-full overflow-hidden rounded-md">
                  {segs.map((t) => (
                    <div
                      key={t.key}
                      className="group/seg relative flex h-full items-center justify-center border-r border-white/60 transition-opacity hover:opacity-95 last:border-r-0"
                      style={{
                        width: `${t.widthPct}%`,
                        backgroundColor: THEME_COLORS[t.key],
                      }}
                    >
                      <span
                        className={`select-none font-sans font-semibold text-white ${
                          t.pct < 5 ? "text-[10px] px-0.5" : "text-xs"
                        }`}
                      >
                        {t.pct}%
                      </span>

                      {/* Tooltip */}
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 flex-col items-center group-hover/seg:flex">
                        <div className="whitespace-nowrap rounded-lg bg-[#1e293b] px-3 py-1.5 text-center text-xs text-white shadow-xl ring-1 ring-white/10">
                          <span className="font-semibold text-white">
                            {b.name} · {t.labelZh}
                          </span>
                          <span className="ml-1.5 font-mono text-slate-300">
                            {t.themeCount} 封 ({t.pct}%)
                          </span>
                        </div>
                        <div className="-mt-1 h-2 w-2 rotate-45 bg-[#1e293b]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
