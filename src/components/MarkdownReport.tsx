import { useMemo, type ReactNode } from "react";
import { buildLiveOnePage, buildOnePageSummary } from "../onepage-report";
import { useSiteEmails, useSiteSelection } from "../site-data";
import { EmptyState } from "./EmptyState";
import { ExtendedEmailsState } from "./ExtendedEmailsState";

const EMPTY_STATE_CLASS_NAME =
  "[&>div]:border-[var(--border-default)] [&>div]:bg-[var(--surface-card)] [&_[aria-hidden]]:border-[var(--border-default)] [&_[aria-hidden]]:bg-[var(--surface-subtle)] [&_[aria-hidden]]:text-[var(--text-secondary)] [&_h3]:text-[var(--text-heading)] [&_p]:text-[var(--text-secondary)] [&_button]:bg-[var(--text-heading)] [&_button]:text-[var(--text-inverse)] [&_button:hover]:bg-[var(--text-body)] [&_button:focus-visible]:ring-[var(--accent-ink)] [&_button:focus-visible]:ring-offset-[var(--surface-card)]";

type MarkdownBlock =
  | { type: "heading"; level: number; content: string }
  | { type: "blockquote"; lines: string[] }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "paragraph"; content: string };

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(line: string) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, content: heading[2] });
      index += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].startsWith("> ")) {
        quoteLines.push(lines[index].slice(2).replace(/\s{2}$/, ""));
        index += 1;
      }
      blocks.push({ type: "blockquote", lines: quoteLines });
      continue;
    }

    if (/^-\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^-\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^-\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "unordered-list", items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "ordered-list", items });
      continue;
    }

    if (line.trim().startsWith("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const headers = splitTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim()) {
      const nextLine = lines[index];
      const startsNewBlock =
        /^(#{1,6})\s+/.test(nextLine) ||
        nextLine.startsWith("> ") ||
        /^-\s+/.test(nextLine) ||
        /^\d+\.\s+/.test(nextLine) ||
        (nextLine.trim().startsWith("|") &&
          index + 1 < lines.length &&
          isTableDivider(lines[index + 1]));

      if (startsNewBlock && paragraph.length > 0) break;
      paragraph.push(nextLine.trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", content: paragraph.join(" ") });
  }

  return blocks;
}

function renderInline(content: string): ReactNode[] {
  const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-bold text-slate-950">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-700">
          {part.slice(1, -1)}
        </code>
      );
    }

    return part;
  });
}

export function MarkdownReport() {
  const emailData = useSiteEmails();
  const { status, emails, meta, retry } = emailData;
  const { market, setMarket } = useSiteSelection();
  const { blocks, summary } = useMemo(
    () => {
      if (status !== "ready" || emails.length === 0) return { blocks: [], summary: null };
      const parsed = parseMarkdown(buildLiveOnePage(emails, meta));
      const appendixIndex = parsed.findIndex((block) => block.type === "heading" && block.level === 2 && block.content === "完整报告附录");
      const summaryIndex = parsed.findIndex((block) => block.type === "heading" && block.level === 2 && block.content === "决策摘要");
      return {
        blocks: [...parsed.slice(1, summaryIndex), ...parsed.slice(appendixIndex + 1)],
        summary: buildOnePageSummary(emails, meta),
      };
    },
    [status, emails, meta],
  );

  if (status !== "ready" || emails.length === 0) {
    return (
      <div className="markdown-report overflow-hidden rounded-2xl border border-slate-200">
        <div className="h-1.5 bg-gradient-to-r from-[var(--accent)] to-[var(--theme-behavior)]" />
        <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
          {status !== "ready" ? <ExtendedEmailsState {...emailData} /> : (
            <>
              <div className={EMPTY_STATE_CLASS_NAME}>
                <EmptyState
                  title={`${meta.market} · OnePage 报告暂无记录`}
                  description={`${meta.range} 内暂无邮件（0 封），不生成主题或发送频次结论。可切换市场或重新拉取数据。`}
                  actionLabel={market === null ? "重新拉取" : "切换至全部市场"}
                  onAction={market === null ? retry : () => setMarket(null)}
                />
              </div>
              <p className="mt-[calc(var(--card-padding)/2)] text-[length:var(--type-helper-size)] leading-[var(--type-helper-leading)] text-[var(--text-secondary)]">{meta.source} · {meta.provenance}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <article className="markdown-report overflow-hidden rounded-2xl border border-slate-200">
      <div className="h-1.5 bg-gradient-to-r from-[var(--accent)] to-[var(--theme-behavior)]" />
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
        <header className="mb-6">
          <p className="text-xs font-bold tracking-wide text-[var(--text-secondary)]">先决策，再查证 · {meta.market}</p>
          <h2 className="mt-2 text-2xl font-extrabold leading-snug text-[var(--text-heading)]">EDM 竞品 OnePage</h2>
          <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{meta.range} · 固定截止 {meta.windowEnd}。可见收录不等于实际全量发送，也不代表营销效果。</p>
        </header>
        {summary ? (
          <section aria-label="决策摘要" className="space-y-5">
            <h3 className="text-xl font-bold text-[var(--text-heading)]">决策摘要</h3>
            <div className="grid gap-4">
              {summary.decisions.map((decision) => (
                <section key={decision.title} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 sm:p-5">
                  <h4 className="font-bold text-[var(--text-heading)]">{decision.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-body)]">{decision.conclusion}</p>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">证据：{decision.evidence}</p>
                  <p className="mt-3 border-l-2 border-[var(--accent-ink)] pl-3 text-sm leading-6 text-[var(--text-body)]"><strong>建议：</strong>{decision.action}</p>
                </section>
              ))}
            </div>
            <section className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4 sm:p-5">
              <h4 className="font-bold text-[var(--status-warning)]">值得关注</h4>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-[var(--text-body)]">
                {summary.watchpoints.map((point) => <li key={point}>{point}</li>)}
              </ul>
            </section>
            <p className="rounded-xl bg-[var(--surface-subtle)] p-4 text-sm leading-6 text-[var(--text-body)]"><strong>下一步：</strong>{summary.nextStep}</p>
          </section>
        ) : null}
        <details className="mt-8 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 sm:p-5">
          <summary className="min-h-11 cursor-pointer rounded py-2 font-bold text-[var(--text-heading)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)]"><h3 className="inline">完整报告附录<span className="ml-2 text-xs font-normal text-[var(--text-secondary)]">统计口径、完整数据表与验证建议 · 点击展开</span></h3></summary>
          <div className="min-w-0">
        {blocks.map((block, blockIndex) => {
          if (block.type === "heading") {
            if (block.level === 1) {
              return (
                <header key={blockIndex} className="mb-9 border-b border-slate-200 pb-7 sm:mb-10 sm:pb-8">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-700">
                    完整报告
                  </p>
                  <h2 className="text-2xl font-extrabold leading-snug tracking-tight text-slate-950 sm:text-3xl">
                    {renderInline(block.content)}
                  </h2>
                </header>
              );
            }

            if (block.level >= 4) {
              return (
                <h5
                  key={blockIndex}
                  className="mb-3 mt-8 text-lg font-bold leading-snug text-slate-950"
                >
                  {renderInline(block.content)}
                </h5>
              );
            }

            return (
              <h4
                key={blockIndex}
                className="mb-4 mt-10 scroll-mt-6 border-l-4 border-[var(--accent)] pl-4 text-xl font-extrabold leading-snug tracking-tight text-slate-950 sm:mt-12 sm:text-2xl"
              >
                {renderInline(block.content)}
              </h4>
            );
          }

          if (block.type === "blockquote") {
            return (
              <blockquote
                key={blockIndex}
                className="my-6 space-y-2 rounded-xl border-l-4 border-[var(--theme-behavior)] bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700 sm:px-5"
              >
                {block.lines.map((line, lineIndex) => (
                  <p key={lineIndex}>{renderInline(line)}</p>
                ))}
              </blockquote>
            );
          }

          if (block.type === "unordered-list" || block.type === "ordered-list") {
            const List = block.type === "ordered-list" ? "ol" : "ul";
            return (
              <List
                key={blockIndex}
                className={`my-5 space-y-3 pl-6 text-[length:var(--type-body-report-size)] leading-7 text-slate-700 marker:font-bold marker:text-slate-700 ${
                  block.type === "ordered-list" ? "list-decimal" : "list-disc"
                }`}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="pl-1">
                    {renderInline(item)}
                  </li>
                ))}
              </List>
            );
          }

          if (block.type === "table") {
            return (
              <div
                key={blockIndex}
                className="report-table-scroll my-7 overflow-x-auto rounded-xl border border-[var(--border-default)] p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)]"
                role="region"
                aria-label={`报告数据表：${block.headers.join("、")}，可横向滚动`}
                tabIndex={0}
              >
                <table className="w-full min-w-[44rem] border-collapse text-left text-sm leading-6">
                  <thead className="bg-slate-100 text-slate-950">
                    <tr>
                      {block.headers.map((header, cellIndex) => (
                        <th
                          key={cellIndex}
                          scope="col"
                          className="border-b border-slate-200 px-4 py-3.5 font-bold"
                        >
                          {renderInline(header)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--divider)] text-slate-700">
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="align-top transition-colors even:bg-slate-50/70 hover:bg-slate-100/80">
                        {row.map((cell, cellIndex) =>
                          cellIndex === 0 ? (
                            <th key={cellIndex} scope="row" className="px-4 py-4 font-bold text-slate-950">
                              {renderInline(cell)}
                            </th>
                          ) : (
                            <td key={cellIndex} className="px-4 py-4">
                              {renderInline(cell)}
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          return (
            <p key={blockIndex} className="my-5 text-[15px] leading-7 text-slate-700 sm:text-base sm:leading-8">
              {renderInline(block.content)}
            </p>
          );
        })}
          </div>
        </details>
      </div>
    </article>
  );
}
