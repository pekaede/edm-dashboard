import { Card } from "./Card";
import { PALETTE, TOTAL } from "./dashboard";

// Only these 10 words, as specified in the prototype description
const WORDS = [
  { text: "New", count: 31 },
  { text: "Off", count: 21 },
  { text: "Up to", count: 19 },
  { text: "Down", count: 13 },
  { text: "Credit", count: 12 },
  { text: "Deal", count: 12 },
  { text: "Buy", count: 11 },
  { text: "Fall", count: 11 },
  { text: "Style", count: 11 },
  { text: "Sale", count: 10 },
];

export function WordCloud() {
  const minCount = 10;
  const maxCount = 31;

  // Render a single word item with font size, PALETTE color, and hover tooltip
  const renderWord = (w: (typeof WORDS)[number], index: number) => {
    // Proportional font size from 18px to 52px
    const fontSize = Math.round(
      18 + ((w.count - minCount) / (maxCount - minCount)) * 34,
    );
    const color = PALETTE[index % PALETTE.length];
    const pct = ((w.count / TOTAL) * 100).toFixed(1);

    return (
      <div
        key={w.text}
        className="group/word relative inline-flex cursor-pointer items-baseline transition-transform duration-200 hover:scale-105"
        tabIndex={0}
      >
        <span
          className="font-bold tracking-tight select-none"
          style={{ fontSize: `${fontSize}px`, color }}
        >
          {w.text}
        </span>
        <span
          className="ml-1 select-none font-mono font-medium opacity-65 tabular-nums"
          style={{
            fontSize: `${Math.max(12, Math.round(fontSize * 0.58))}px`,
            color,
          }}
        >
          {w.count}
        </span>

        {/* Hover Tooltip */}
        <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 flex-col items-center group-hover/word:flex group-focus-within/word:flex">
          <div className="whitespace-nowrap rounded-lg bg-[#1e293b] px-3 py-2 text-center text-xs text-white shadow-xl ring-1 ring-white/10">
            <div className="font-semibold text-white">{w.text}</div>
            <div className="mt-0.5 text-xs text-slate-200">
              出现 {w.count} 次 ({pct}%)
            </div>
          </div>
          <div className="-mt-1 h-2 w-2 rotate-45 bg-[#1e293b]" />
        </div>
      </div>
    );
  };

  // Split words to match the prototype layout composition
  const offWord = WORDS[1]; // Off 21
  const upToWord = WORDS[2]; // Up to 19
  const downWord = WORDS[3]; // Down 13
  const newWord = WORDS[0]; // New 31
  const creditWord = WORDS[4]; // Credit 12
  const bottomWords = WORDS.slice(5); // Deal 12, Buy 11, Fall 11, Style 11, Sale 10

  return (
    <Card
      title="主题行高频词云"
      hint="统计口径：含该词的邮件数，同一词在同一主题出现多次只计 1 次；字号越大，出现邮件越多。"
    >
      <div className="flex min-h-[220px] flex-col justify-between gap-y-6 py-2">
        {/* Top row */}
        <div className="flex items-center justify-between px-4 sm:px-8">
          <div>{renderWord(offWord, 1)}</div>
          <div>{renderWord(upToWord, 2)}</div>
        </div>

        {/* Middle row: Down on left, New in center, Credit on right */}
        <div className="flex items-center justify-between px-2 sm:px-6">
          <div className="w-1/4">{renderWord(downWord, 3)}</div>
          <div className="flex justify-center">{renderWord(newWord, 0)}</div>
          <div className="flex w-1/4 justify-end">
            {renderWord(creditWord, 4)}
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-2 sm:px-6">
          {bottomWords.map((w, i) => renderWord(w, i + 5))}
        </div>
      </div>
    </Card>
  );
}
