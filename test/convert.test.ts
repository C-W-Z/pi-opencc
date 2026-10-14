import assert from "node:assert/strict";
import test from "node:test";
import { convertDraft } from "../src/convert.ts";

test("固定 twp → cn，包含台灣用詞", () => {
  assert.equal(convertDraft("繁體中文與軟體，使用滑鼠連接網路。"), "繁体中文与软件，使用鼠标连接网络。");
  for (const text of ["", " \n ", "English 123", "简体中文"]) assert.equal(convertDraft(text), text);
});

const fixtures: Array<[string, string]> = [
  ["# 繁體\n\n**軟體** _滑鼠_\n- 網路", "# 繁体\n\n**软件** _鼠标_\n- 网络"],
  ["說明 `繁體/圖片.png` 與 ``繁體`路徑``", "说明 `繁體/圖片.png` 与 ``繁體`路徑``"],
  ["說明\n```繁體\n軟體/圖片.png\n```\n後續", "说明\n```繁體\n軟體/圖片.png\n```\n后续"],
  ["說明\n\n    繁體/檔案.ts\n\n後續", "说明\n\n    繁體/檔案.ts\n\n后续"],
  ["[說明](繁體/圖片.png \"繁體標題\") 與 ![圖片](繁體/圖片.png)", "[说明](繁體/圖片.png \"繁體標題\") 与 ![圖片](繁體/圖片.png)"],
  ["[說明][繁體]\n\n[繁體]: 繁體/檔案.md \"標題\"", "[说明][繁體]\n\n[繁體]: 繁體/檔案.md \"標題\""],
  ["[繁體] 與 [繁體][]\n\n[繁體]: 繁體/檔案.md", "[繁體] 与 [繁體][]\n\n[繁體]: 繁體/檔案.md"],
  ["說明 https://繁體.example/圖片?q=軟體 與 www.繁體.example/檔案", "说明 https://繁體.example/圖片?q=軟體 与 www.繁體.example/檔案"],
  ["說明 <https://繁體.example/圖片> 與 <繁體@example.com>", "说明 <https://繁體.example/圖片> 与 <繁體@example.com>"],
  ["說明 <span title=\"繁體\">軟體</span> 後續", "说明 <span title=\"繁體\">軟體</span> 后续"],
  ["說明 <span><span>繁體</span>軟體</span> 後續", "说明 <span><span>繁體</span>軟體</span> 后续"],
  ["<!-- 繁體 -->\n\n後續", "<!-- 繁體 -->\n\n后续"],
  ["<div>\n繁體\n</div>\n\n後續", "<div>\n繁體\n</div>\n\n后续"],
  ["說明 `未閉合繁體\n軟體", "说明 `未閉合繁體\n軟體"],
  ["說明\n~~~ts\n未閉合繁體", "说明\n~~~ts\n未閉合繁體"],
  ["[說明](繁體/未閉合(圖片.png", "[说明](繁體/未閉合(圖片.png"],
  ["[說明](繁體/圖片.png \"未閉合標題", "[说明](繁體/圖片.png \"未閉合標題"],
  ["說明 <https://繁體.example/圖片", "说明 <https://繁體.example/圖片"],
  ["說明 <span title=\"未閉合繁體", "说明 <span title=\"未閉合繁體"],
  ["\\`繁體 \\[說明\\](繁體)", "\\`繁体 \\[说明\\](繁体)"],
  ["裸路徑 繁體/圖片.png", "裸路径 繁体/图片.png"],
  ["🙂繁體\r\n\t`繁體`", "🙂繁体\r\n\t`繁體`"],
];
for (const [source, expected] of fixtures) {
  test(`source offsets 保護：${JSON.stringify(source)}`, () => assert.equal(convertDraft(source), expected));
}
