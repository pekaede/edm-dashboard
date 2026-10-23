import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("../public/preview.html", import.meta.url), "utf8");
const meta = '<meta name="robots" content="noindex" />';

describe("preview indexing", () => {
  it("includes a noindex robots meta inside head before its closing tag", () => {
    const head = source.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? "";
    assert.ok(head.includes(meta));
    assert.ok(source.indexOf(meta) < source.indexOf("</head>"));
  });
});
