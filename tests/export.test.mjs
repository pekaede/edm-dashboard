import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emailsToCSV } from "../src/export.ts";

const header = "market,brand,sent_date,theme,keywords,original_url";
const row = {
  market: "US", brand: "Zara", sent_date: "2026-10-20", theme: "new",
  keywords: ["linen", "autumn"], original_url: "https://milled.com/zara/example",
};

function assertMarketField(input, expectedField) {
  assert.equal(
    emailsToCSV([{ ...row, market: input }]),
    `${header}\r\n${expectedField},Zara,2026-10-20,new,linen;autumn,https://milled.com/zara/example`,
    JSON.stringify(input),
  );
}

describe("CSV 导出中和", () => {
  it("中和四种 ASCII 公式前缀与四种全角前缀", () => {
    for (const prefix of ["=", "+", "-", "@", "＝", "＋", "－", "＠"]) {
      assertMarketField(`${prefix}1`, `'${prefix}1`);
    }
  });

  it("跳过前导空白、控制字符与组合后仍中和公式", () => {
    for (const prefix of [" ", "\t", "\u0000", "\u001f", "\u007f", "\u0085", "\u009f", "\u00a0", "\u2003", "\u3000", "\ufeff", " \t\u0000\u009f\u3000"]) {
      for (const symbol of ["=", "+", "-", "@", "＝", "＋", "－", "＠"]) {
        assertMarketField(`${prefix}${symbol}1`, `'${prefix}${symbol}1`);
      }
    }
    assertMarketField("\n=1", "\"'\n=1\"");
    assertMarketField(" \r\n＠1", "\"' \r\n＠1\"");
  });

  it("直接以制表符或回车开头的文本也中和", () => {
    assertMarketField("\tplain text", "'\tplain text");
    assertMarketField("\rplain text", "\"'\rplain text\"");
  });

  it("中和覆盖所有导出列，关键词数组拼接后同样中和", () => {
    assert.equal(emailsToCSV([{
      market: "=1", brand: "+1", sent_date: "-1", theme: "@x",
      keywords: ["＝1", "linen"], original_url: "＠x",
    }]), `${header}\r\n'=1,'+1,'-1,'@x,'＝1;linen,'＠x`);
    assert.equal(emailsToCSV([{ ...row, keywords: "+offer" }]),
      `${header}\r\nUS,Zara,2026-10-20,new,'+offer,https://milled.com/zara/example`);
  });

  it("正常文本、非前缀运算符、已有单引号及数字保持原样", () => {
    for (const text of [
      "US", "意大利", "  linen", "linen + cotton", "sale=50%", "email@example.com",
      "'＝1", "50% OFF", "2026-10-20", "https://example.com/?q=+sale", "\nplain text",
    ]) {
      assertMarketField(text, text === "\nplain text" ? '"\nplain text"' : text);
    }
    assertMarketField(-42, "-42");
    assertMarketField(0, "0");
  });

  it("保留 CSV 引号、逗号和换行转义，记录以 CRLF 分隔", () => {
    assertMarketField('hello, "world"\nnext', '"hello, ""world""\nnext"');
    assertMarketField('=HYPERLINK("x","y")', '"\'=HYPERLINK(""x"",""y"")"');
    assert.equal(emailsToCSV([]), header);
    const record = "US,Zara,2026-10-20,new,linen;autumn,https://milled.com/zara/example";
    assert.equal(emailsToCSV([row, row]), `${header}\r\n${record}\r\n${record}`);
  });
});
