import { DATA } from "../data";

export function DashboardHeader() {
  return (
    <header className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center">
          <h1 className="shrink-0 text-3xl font-extrabold tracking-[-0.04em] text-[#10203f] sm:text-[36px]">
            {DATA.meta.title}
          </h1>
          <div className="flex flex-wrap gap-2">
            {[DATA.meta.market, DATA.meta.source, `${DATA.meta.total} 封样本`, `${DATA.meta.brandCount} 品牌 × ${DATA.meta.weekCount} 周`].map((tag, index) => (
            <span
              key={tag}
              className="rounded-full px-3.5 py-2 text-sm font-semibold"
              style={{
                color: ["#be3d5b", "#b77911", "#227b4a", "#6c4ab1"][index],
                background: ["#fdecef", "#fff4d9", "#e8f7ee", "#f0eafb"][index],
              }}
            >
              {tag}
            </span>
          ))}
          </div>
        </div>
        <p className="shrink-0 text-sm font-medium tracking-wide text-slate-500">{DATA.meta.range}</p>
      </div>
    </header>
  );
}
