import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout } from "node:timers/promises";
import { CURSOR_MARKER, visibleWidth } from "@earendil-works/pi-tui";
import { harness } from "./helpers.ts";

const enter = "\r";
const undo = "\x1a";
const paste = (text: string) => `\x1b[200~${text}\x1b[201~`;

test("第一次 Enter 留在原輸入框，第二次走原生 submit，下一則從編輯開始", () => {
  const h = harness();
  h.editor.setText("繁體軟體");
  assert.match(h.label(), /Enter 轉簡體/);
  h.editor.handleInput(enter);
  assert.equal(h.editor.getText(), "繁体软件");
  assert.deepEqual(h.submitted, []);
  assert.match(h.label(), /Enter 送出/);
  h.editor.handleInput(enter);
  assert.deepEqual(h.submitted, ["繁体软件"]);
  assert.equal(h.editor.getText(), "");
  assert.match(h.label(), /Enter 轉簡體/);
  h.editor.handleInput("繁體");
  h.editor.handleInput(enter);
  assert.equal(h.submitted.length, 1);
});

for (const text of ["English", "简体中文", "123", "`繁體`", "English 與軟體"]) {
  test(`非空草稿固定兩次 Enter：${text}`, () => {
    const h = harness();
    h.editor.setText(text);
    h.editor.handleInput(enter);
    assert.deepEqual(h.submitted, []);
    assert.match(h.label(), /Enter 送出/);
    const confirmed = h.editor.getExpandedText();
    h.editor.handleInput(enter);
    assert.deepEqual(h.submitted, [confirmed]);
  });
}

for (const text of ["", "   ", " \n "]) {
  test(`空白不確認、不送出：${JSON.stringify(text)}`, () => {
    const h = harness();
    h.editor.setText(text);
    h.editor.handleInput(enter);
    h.editor.handleInput(enter);
    assert.deepEqual(h.submitted, []);
    assert.equal(h.editor.getText(), text);
    assert.match(h.label(), /Enter 轉簡體/);
  });
}

test("確認後一般鍵入與局部貼上不重設、不重轉換", () => {
  const h = harness();
  h.editor.setText("繁體");
  h.editor.handleInput(enter);
  h.editor.handleInput("軟體");
  h.editor.handleInput(paste("滑鼠"));
  assert.match(h.label(), /Enter 送出/);
  h.editor.handleInput(enter);
  assert.deepEqual(h.submitted, ["繁体軟體滑鼠"]);
});

test("原生 undo 一次還原轉換，再次 Enter 重新轉換", () => {
  const h = harness();
  h.editor.setText("繁體");
  h.editor.handleInput(enter);
  h.editor.handleInput(undo);
  assert.equal(h.editor.getExpandedText(), "繁體");
  assert.match(h.label(), /Enter 轉簡體/);
  h.editor.handleInput(enter);
  assert.deepEqual(h.submitted, []);
  assert.equal(h.editor.getText(), "繁体");
});

test("多次修改與逐步 undo，最後才撤銷轉換", () => {
  const h = harness();
  h.editor.setText("繁體");
  h.editor.handleInput(enter);
  h.editor.handleInput("A");
  h.editor.handleInput(paste("B"));
  h.editor.handleInput(undo);
  assert.equal(h.editor.getText(), "繁体A");
  assert.match(h.label(), /Enter 送出/);
  h.editor.handleInput(undo);
  assert.equal(h.editor.getText(), "繁体");
  assert.match(h.label(), /Enter 送出/);
  h.editor.handleInput(undo);
  assert.equal(h.editor.getText(), "繁體");
  assert.match(h.label(), /Enter 轉簡體/);
});

test("人工完整恢復原文也回到編輯階段", () => {
  const h = harness();
  h.editor.setText("繁體");
  h.editor.handleInput(enter);
  h.editor.handleInput("\x7f");
  h.editor.handleInput("體");
  assert.equal(h.editor.getText(), "繁體");
  assert.match(h.label(), /Enter 轉簡體/);
  h.editor.handleInput(enter);
  assert.deepEqual(h.submitted, []);
});

test("相同結果無虛假 undo，既有紀錄維持原生行為", () => {
  const h = harness();
  h.editor.handleInput("English");
  h.editor.handleInput(enter);
  assert.match(h.label(), /Enter 送出/);
  h.editor.handleInput(undo);
  assert.equal(h.editor.getText(), "");
  assert.match(h.label(), /Enter 轉簡體/);
});

test("相同結果在修改後 undo 回原文仍維持確認", () => {
  const h = harness();
  h.editor.setText("English");
  h.editor.handleInput(enter);
  h.editor.handleInput(paste(" extra"));
  h.editor.handleInput(undo);
  assert.equal(h.editor.getText(), "English");
  assert.match(h.label(), /Enter 送出/);
  h.editor.handleInput(enter);
  assert.deepEqual(h.submitted, ["English"]);
});

test("大段貼上轉換與 undo 還原完整資料及有效 placeholder", () => {
  const h = harness();
  const text = Array(25).fill("繁體與軟體 `圖片/繁體.png`").join("\n");
  h.editor.handleInput(paste(text));
  const folded = h.editor.getText();
  assert.match(folded, /\[paste #/);
  h.editor.handleInput(enter);
  assert.equal(h.editor.getExpandedText(), text.replaceAll("繁體與軟體", "繁体与软件"));
  assert.deepEqual(h.submitted, []);
  h.editor.handleInput(undo);
  assert.equal(h.editor.getText(), folded);
  assert.equal(h.editor.getExpandedText(), text);
  assert.match(h.label(), /Enter 轉簡體/);
  h.editor.handleInput(enter);
  h.editor.handleInput(enter);
  assert.equal(h.submitted[0], text.replaceAll("繁體與軟體", "繁体与软件"));
});

test("相同結果的大段貼上不展開、不新增轉換 undo", () => {
  const h = harness();
  const text = Array(20).fill("English").join("\n");
  h.editor.handleInput(paste(text));
  const folded = h.editor.getText();
  h.editor.handleInput(enter);
  assert.equal(h.editor.getText(), folded);
  assert.match(h.label(), /Enter 送出/);
  h.editor.handleInput(undo);
  assert.equal(h.editor.getExpandedText(), "");
});

test("分段 bracketed paste 內的 Enter 不轉換", () => {
  const h = harness();
  h.editor.handleInput("\x1b[200~繁體");
  h.editor.handleInput(enter);
  h.editor.handleInput("軟體\x1b[201~");
  assert.equal(h.editor.getExpandedText(), "繁體\n軟體");
  assert.deepEqual(h.submitted, []);
  assert.match(h.label(), /Enter 轉簡體/);
});

for (const text of ["/help", "!echo 繁體", "!!echo 繁體"]) {
  test(`命令沿用原生送出：${text}`, () => {
    const h = harness();
    h.editor.setText(text);
    h.editor.handleInput(enter);
    assert.deepEqual(h.submitted, [text]);
    assert.match(h.label(), /Enter 轉簡體/);
  });
}

test("確認階段改成命令仍原生送出", () => {
  const h = harness();
  h.editor.setText("繁體");
  h.editor.handleInput(enter);
  h.editor.handleInput("\x15");
  h.editor.handleInput("!echo 繁體");
  h.editor.handleInput(enter);
  assert.deepEqual(h.submitted, ["!echo 繁體"]);
  assert.match(h.label(), /Enter 轉簡體/);
});

test("Shift+Enter、Ctrl+J、反斜線 Enter 保留換行", () => {
  for (const newline of ["\x1b[13;2u", "\n", "\x1b\r"]) {
    const h = harness();
    h.editor.setText("繁體");
    h.editor.handleInput(newline);
    assert.equal(h.editor.getText(), "繁體\n");
    assert.deepEqual(h.submitted, []);
    assert.match(h.label(), /Enter 轉簡體/);
  }
  const h = harness();
  h.editor.setText("繁體\\");
  h.editor.handleInput(enter);
  assert.equal(h.editor.getText(), "繁體\n");
  assert.match(h.label(), /Enter 轉簡體/);
});

test("注入的 submit keybinding 決定攔截，而非固定 Enter 字元", () => {
  const h = harness({ bindings: { "tui.input.submit": "ctrl+s" } });
  h.editor.setText("繁體");
  h.editor.handleInput(enter);
  assert.equal(h.editor.getText(), "繁體");
  h.editor.handleInput("\x13");
  assert.equal(h.editor.getText(), "繁体");
  h.editor.handleInput("\x13");
  assert.deepEqual(h.submitted, ["繁体"]);
});

test("disableSubmit 不轉換、不送出、不推進階段", () => {
  const h = harness();
  h.editor.setText("繁體");
  h.editor.disableSubmit = true;
  h.editor.handleInput(enter);
  assert.equal(h.editor.getText(), "繁體");
  assert.deepEqual(h.submitted, []);
  assert.match(h.label(), /Enter 轉簡體/);
  h.editor.disableSubmit = false;
  h.editor.handleInput(enter);
  h.editor.disableSubmit = true;
  h.editor.handleInput(enter);
  assert.match(h.label(), /Enter 送出/);
  assert.deepEqual(h.submitted, []);
});

test("原生 autocomplete 確認不算第一次 Enter", async () => {
  const h = harness();
  h.editor.setAutocompleteProvider({
    triggerCharacters: ["@"],
    getSuggestions: async () => ({ items: [{ label: "繁體.md", value: "繁體.md" }], prefix: "@" }),
    applyCompletion: () => ({ lines: ["`繁體.md` 與軟體"], cursorLine: 0, cursorCol: 13 }),
  });
  h.editor.handleInput("@");
  // 等待原生 provider 的非同步工作，不觸碰私有 autocomplete state。
  for (let i = 0; i < 20 && !h.editor.isShowingAutocomplete(); i++) await setTimeout(20);
  assert.equal(h.editor.isShowingAutocomplete(), true);
  h.editor.handleInput(enter);
  assert.deepEqual(h.submitted, []);
  assert.equal(h.editor.getText(), "`繁體.md` 與軟體");
  assert.match(h.label(), /Enter 轉簡體/);
  h.editor.handleInput(enter);
  assert.equal(h.editor.getText(), "`繁體.md` 与软件");
  assert.deepEqual(h.submitted, []);
});

test("其他送出鍵沿用原生 action handler，送出後清除確認", () => {
  const h = harness();
  h.editor.onAction("app.message.followUp", () => {
    h.submitted.push(h.editor.getExpandedText());
    h.editor.setText("");
  });
  h.editor.setText("繁體");
  h.editor.handleInput("\x11");
  assert.deepEqual(h.submitted, ["繁體"]);
  h.editor.setText("繁體");
  h.editor.handleInput(enter);
  h.editor.handleInput("\x11");
  assert.deepEqual(h.submitted, ["繁體", "繁体"]);
  assert.match(h.label(), /Enter 轉簡體/);
});

test("submit 與 app action 衝突時不覆蓋原生 action", () => {
  const h = harness({ bindings: { "app.message.followUp": "enter" } });
  h.editor.onAction("app.message.followUp", () => { h.submitted.push(h.editor.getText()); h.editor.setText(""); });
  h.editor.setText("繁體");
  h.editor.handleInput(enter);
  assert.deepEqual(h.submitted, ["繁體"]);
});

test("extension shortcut 優先處理 Enter", () => {
  const h = harness();
  let calls = 0;
  h.editor.onExtensionShortcut = () => { calls++; return true; };
  h.editor.setText("繁體");
  h.editor.handleInput(enter);
  assert.equal(calls, 1);
  assert.equal(h.editor.getText(), "繁體");
  assert.deepEqual(h.submitted, []);
});

test("一般 TUI passthrough、不加入提示", () => {
  const h = harness({ mode: "regular" });
  h.editor.setText("繁體");
  assert.doesNotMatch(h.label(), /Enter (送出|轉簡體)/);
  h.editor.handleInput(enter);
  assert.deepEqual(h.submitted, ["繁體"]);
});

test("render 同步離開與進入 Fullscreen，重新確認", () => {
  const h = harness();
  h.editor.setText("繁體");
  h.editor.handleInput(enter);
  h.reference.mode = "regular";
  assert.doesNotMatch(h.label(), /Enter 送出/);
  h.reference.mode = "fullscreen";
  assert.match(h.label(), /Enter 轉簡體/);
  h.editor.handleInput(enter);
  assert.deepEqual(h.submitted, []);
  h.editor.handleInput(enter);
  assert.deepEqual(h.submitted, ["繁体"]);
});

test("輸入時也同步模式邊界", () => {
  const h = harness();
  h.editor.setText("繁體");
  h.editor.handleInput(enter);
  h.reference.mode = "regular";
  h.editor.handleInput("A");
  h.reference.mode = "fullscreen";
  h.editor.handleInput(enter);
  assert.deepEqual(h.submitted, []);
});

test("外部 setText、清空與 reset 清除確認，局部 insertText 不清除", () => {
  const h = harness();
  h.editor.setText("繁體");
  h.editor.handleInput(enter);
  h.editor.insertTextAtCursor("軟體");
  assert.match(h.label(), /Enter 送出/);
  h.editor.setText(h.editor.getText());
  assert.match(h.label(), /Enter 轉簡體/);
  h.editor.handleInput(enter);
  h.editor.reset();
  assert.match(h.label(), /Enter 轉簡體/);
  h.editor.handleInput(enter);
  h.editor.setText("");
  assert.match(h.label(), /Enter 轉簡體/);
});

test("history 替換草稿清除確認", () => {
  const h = harness({ bindings: { "tui.editor.historyPrevious": "ctrl+p" } });
  h.editor.addToHistory("另一份繁體");
  h.editor.setText("繁體");
  h.editor.handleInput(enter);
  h.editor.handleInput("\x10");
  assert.equal(h.editor.getText(), "另一份繁體");
  assert.match(h.label(), /Enter 轉簡體/);
});

test("轉換失敗維持原文與編輯階段，不洩露草稿", () => {
  const h = harness({ convert: () => { throw new Error("敏感草稿"); } });
  h.editor.setText("繁體");
  h.editor.handleInput(enter);
  assert.equal(h.editor.getText(), "繁體");
  assert.deepEqual(h.submitted, []);
  assert.equal(h.errors, 1);
  assert.match(h.label(), /Enter 轉簡體/);
});

test("邊框提示不超出窄視窗，保留 focus 與原生 cursor marker", () => {
  const h = harness();
  h.editor.focused = true;
  h.editor.setText("繁體");
  for (const width of [5, 12, 20, 80]) {
    const lines = h.editor.render(width);
    assert.ok(visibleWidth(lines.at(-1)!) <= width);
  }
  assert.equal(h.editor.focused, true);
  assert.ok(h.editor.render(80).some((line) => line.includes(CURSOR_MARKER)));
});
