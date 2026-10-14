import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverAndLoadExtensions, type ExtensionContext, type ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import type { OpenCCEditor } from "../src/editor.ts";
import { harness, theme } from "./helpers.ts";

test("pi 原生 jiti loader 可載入 TypeScript extension 與 runtime dependencies", async () => {
  // 僅載入本專案；不啟動 session、不讀使用者設定、不呼叫真實模型。
  const isolated = await mkdtemp(join(tmpdir(), "pi-opencc-load-"));
  try {
    const packagePath = fileURLToPath(new URL("../", import.meta.url));
    const result = await discoverAndLoadExtensions([packagePath], isolated, isolated);
    assert.deepEqual(result.errors, []);
    assert.equal(result.extensions.length, 1);
    assert.equal(result.extensions[0].handlers.has("session_start"), true);
    assert.equal(result.extensions[0].handlers.has("input"), false);
    const h = harness();
    let editor: OpenCCEditor | undefined;
    const ctx = {
      mode: "tui",
      ui: {
        getEditorComponent: () => undefined,
        setEditorComponent: (factory: Parameters<ExtensionUIContext["setEditorComponent"]>[0]) => {
          editor = factory?.(h.reference as unknown as TUI, theme, h.bindings) as OpenCCEditor;
          editor.onSubmit = (text) => h.submitted.push(text);
        },
        notify: () => assert.fail("載入不應出現錯誤提示"),
      },
    } as unknown as ExtensionContext;
    for (const handler of result.extensions[0].handlers.get("session_start")!) {
      await handler({ type: "session_start", reason: "startup" }, ctx);
    }
    assert.ok(editor);
    editor.setText("繁體軟體");
    editor.handleInput("\r");
    assert.equal(editor.getText(), "繁体软件");
    assert.deepEqual(h.submitted, []);
    editor.handleInput("\r");
    assert.deepEqual(h.submitted, ["繁体软件"]);
  } finally {
    await rm(isolated, { recursive: true, force: true });
  }
});
