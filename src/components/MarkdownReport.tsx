import type { ReactNode } from "react";
import reportMarkdown from "../../reports/onepage-edm-2026-10-16.md?raw";

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

const blocks = parseMarkdown(reportMarkdown);

export function MarkdownReport() {
  return (
    <article className="markdown-report overflow-hidden rounded-2xl border border-slate-200">
      <div className="h-1.5 bg-gradient-to-r from-[var(--accent)] to-[#c38a24]" />
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
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

            if (block.level >= 3) {
              return (
                <h4
                  key={blockIndex}
                  className="mb-3 mt-8 text-lg font-bold leading-snug text-slate-950"
                >
                  {renderInline(block.content)}
                </h4>
              );
            }

            return (
              <h3
                key={blockIndex}
                className="mb-4 mt-10 scroll-mt-6 border-l-4 border-[var(--accent)] pl-4 text-xl font-extrabold leading-snug tracking-tight text-slate-950 sm:mt-12 sm:text-2xl"
              >
                {renderInline(block.content)}
              </h3>
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
                className={`my-5 space-y-3 pl-6 text-[15px] leading-7 text-slate-700 marker:font-bold marker:text-slate-700 ${
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
                className="report-table-scroll my-7 overflow-x-auto rounded-xl border border-slate-200"
                role="region"
                aria-label={`报告数据表 ${blockIndex + 1}`}
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
                  <tbody className="divide-y divide-slate-200 text-slate-700">
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
    </article>
  );
}
