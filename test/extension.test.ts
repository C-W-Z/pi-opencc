import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionAPI, ExtensionContext, ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import opencc from "../src/index.ts";
import type { OpenCCEditor } from "../src/editor.ts";
import { harness, theme } from "./helpers.ts";

type Factory = Parameters<ExtensionUIContext["setEditorComponent"]>[0];

function extensionHarness(mode: ExtensionContext["mode"] = "tui", conflict = false) {
  const h = harness();
  const handlers = new Map<string, (event: unknown, ctx: ExtensionContext) => unknown>();
  const notifications: Array<{ message: string; type: string }> = [];
  let factory: Factory = conflict ? () => h.editor : undefined;
  let editor: OpenCCEditor | undefined;
  let assignments = 0;
  const ctx = {
    mode,
    ui: {
      getEditorComponent: () => factory,
      setEditorComponent: (value: Factory) => {
        assignments++;
        factory = value;
        if (value) editor = value(h.reference as unknown as TUI, theme, h.bindings) as OpenCCEditor;
      },
      notify: (message: string, type: string) => notifications.push({ message, type }),
    },
  } as unknown as ExtensionContext;
  const pi = {
    on: (name: string, handler: (event: unknown, ctx: ExtensionContext) => unknown) => {
      handlers.set(name, handler);
      return () => handlers.delete(name);
    },
  } as unknown as ExtensionAPI;
  opencc(pi);
  return {
    h, handlers, notifications,
    emit: async (name: string, event: unknown = { type: name }) => { await handlers.get(name)?.(event, ctx); },
    replaceFactory: (value: Factory) => { factory = value; },
    get factory() { return factory; },
    get editor() { return editor!; },
    get assignments() { return assignments; },
  };
}

for (const mode of ["rpc", "print", "json"] as const) {
  test(`${mode} 不安裝 editor、不轉換`, async () => {
    const h = extensionHarness(mode);
    await h.emit("session_start");
    assert.equal(h.assignments, 0);
    assert.deepEqual(h.notifications, []);
  });
}

test("其他 custom editor 衝突時不覆蓋，顯示警告", async () => {
  const h = extensionHarness("tui", true);
  const original = h.factory;
  await h.emit("session_start");
  assert.equal(h.factory, original);
  assert.equal(h.assignments, 0);
  assert.equal(h.notifications.length, 1);
  assert.equal(h.notifications[0].type, "warning");
  await h.emit("session_shutdown");
  assert.equal(h.factory, original);
});

for (const event of ["session_before_switch", "session_before_fork", "session_before_tree", "session_tree"]) {
  test(`${event} 清除確認狀態`, async () => {
    const h = extensionHarness();
    await h.emit("session_start");
    h.editor.setText("繁體");
    h.editor.handleInput("\r");
    assert.match(h.editor.render(80).join("\n"), /Enter 送出/);
    await h.emit(event);
    assert.match(h.editor.render(80).join("\n"), /Enter 轉簡體/);
    assert.equal(h.editor.getText(), "繁体");
  });
}

test("reload／shutdown 恢復 default factory，新啟動不沿用確認", async () => {
  const h = extensionHarness();
  await h.emit("session_start");
  h.editor.setText("繁體");
  h.editor.handleInput("\r");
  await h.emit("session_shutdown", { type: "session_shutdown", reason: "reload" });
  assert.equal(h.factory, undefined);
  await h.emit("session_start", { type: "session_start", reason: "reload" });
  h.editor.setText("繁体");
  assert.match(h.editor.render(80).join("\n"), /Enter 轉簡體/);
  assert.equal(h.assignments, 3);
  assert.equal(h.handlers.has("input"), false);
});

test("後載入的 editor 被替換後，shutdown 不刪除它的 factory", async () => {
  const h = extensionHarness();
  await h.emit("session_start");
  const replacement: Factory = () => h.h.editor;
  h.replaceFactory(replacement);
  await h.emit("session_shutdown");
  assert.equal(h.factory, replacement);
  assert.equal(h.assignments, 1);
});
