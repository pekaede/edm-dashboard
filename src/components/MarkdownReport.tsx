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
    <article className="markdown-report overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_40px_rgb(58_76_110/0.07)]">
      <div className="h-1.5 bg-gradient-to-r from-[#55a6e8] via-[#8b6bd6] to-[#e85d75]" />
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
        {blocks.map((block, blockIndex) => {
          if (block.type === "heading") {
            if (block.level === 1) {
              return (
                <header key={blockIndex} className="mb-8 border-b border-slate-200 pb-6">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#6f51b5]">完整报告</p>
                  <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-[#10203f] sm:text-4xl">
                    {renderInline(block.content)}
                  </h1>
                </header>
              );
            }

            return (
              <h2
                key={blockIndex}
                className="mb-4 mt-10 scroll-mt-6 border-l-4 border-[#55a6e8] pl-4 text-xl font-extrabold tracking-[-0.02em] text-[#10203f] sm:text-2xl"
              >
                {renderInline(block.content)}
              </h2>
            );
          }

          if (block.type === "blockquote") {
            return (
              <aside
                key={blockIndex}
                className="my-5 space-y-2 rounded-xl border border-amber-200/80 bg-amber-50/65 px-4 py-4 text-sm leading-7 text-slate-700 sm:px-5"
              >
                {block.lines.map((line, lineIndex) => (
                  <p key={lineIndex}>{renderInline(line)}</p>
                ))}
              </aside>
            );
          }

          if (block.type === "unordered-list" || block.type === "ordered-list") {
            const List = block.type === "ordered-list" ? "ol" : "ul";
            return (
              <List
                key={blockIndex}
                className={`my-4 space-y-3 pl-6 text-[15px] leading-7 text-slate-700 marker:font-bold marker:text-[#6f51b5] ${
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
              <div key={blockIndex} className="my-6 overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-[760px] w-full border-collapse text-left text-sm leading-6">
                  <thead className="bg-slate-100 text-slate-900">
                    <tr>
                      {block.headers.map((header, cellIndex) => (
                        <th key={cellIndex} className="border-b border-slate-200 px-4 py-3 font-bold">
                          {renderInline(header)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="align-top even:bg-slate-50/60">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-4 py-4">
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          return (
            <p key={blockIndex} className="my-4 text-[15px] leading-7 text-slate-700">
              {renderInline(block.content)}
            </p>
          );
        })}
      </div>
    </article>
  );
}
