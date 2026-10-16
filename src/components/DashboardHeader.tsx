import { DATA } from "../data";
import { THEME_COLORS, THEME_TINTS } from "./dashboard";

export function DashboardHeader() {
  const tags = [
    { label: DATA.meta.market, theme: "price" },
    { label: DATA.meta.source, theme: "behavior" },
    { label: `${DATA.meta.total} 封样本`, theme: "new" },
    {
      label: `${DATA.meta.brandCount} 品牌 × ${DATA.meta.weekCount} 周`,
      theme: "lifestyle",
    },
  ];

  return (
    <header className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center">
          <h1 className="shrink-0 text-3xl font-extrabold tracking-[-0.04em] text-[#10203f] sm:text-[36px]">
            {DATA.meta.title}
          </h1>
          <div className="flex flex-wrap gap-2">
            {tags.map(({ label, theme }) => (
              <span
                key={label}
                className="rounded-full px-3.5 py-2 text-sm font-semibold"
                style={{
                  color: THEME_COLORS[theme],
                  background: THEME_TINTS[theme],
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        <p className="shrink-0 text-sm font-medium tracking-wide text-slate-500">{DATA.meta.range}</p>
      </div>
    </header>
  );
}
