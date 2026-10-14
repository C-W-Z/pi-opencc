import type { ExtensionAPI, ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { OpenCCEditor } from "./editor.ts";

type EditorFactory = Parameters<ExtensionUIContext["setEditorComponent"]>[0];

export default function opencc(pi: ExtensionAPI): void {
  let editor: OpenCCEditor | undefined;
  let factory: EditorFactory;
  const reset = () => editor?.reset();

  pi.on("session_start", (_event, ctx) => {
    reset();
    if (ctx.mode !== "tui") return;
    const existing = ctx.ui.getEditorComponent();
    if (existing && existing !== factory) {
      ctx.ui.notify("pi-opencc 已停用：另一個 extension 已提供 custom editor，無法共同使用。", "warning");
      return;
    }
    factory = (tui, theme, keybindings) => {
      editor = new OpenCCEditor(tui, theme, keybindings, () => {
        ctx.ui.notify("pi-opencc 轉換失敗；草稿未送出，請稍後重試。", "error");
      });
      return editor;
    };
    ctx.ui.setEditorComponent(factory);
  });

  pi.on("session_before_switch", reset);
  pi.on("session_before_fork", reset);
  pi.on("session_before_tree", reset);
  pi.on("session_tree", reset);
  pi.on("session_shutdown", (_event, ctx) => {
    reset();
    if (ctx.mode === "tui" && factory && ctx.ui.getEditorComponent() === factory) {
      ctx.ui.setEditorComponent(undefined);
    }
    editor = undefined;
    factory = undefined;
  });
}
