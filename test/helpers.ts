import type { KeybindingsManager } from "@earendil-works/pi-coding-agent";
import { setKeybindings, type EditorTheme, type KeybindingsConfig, type TUI, type TuiMode } from "@earendil-works/pi-tui";
import { OpenCCEditor } from "../src/editor.ts";

// host 的 manager 只有型別從 package root 匯出；測試以解析後的本地模組建立它，不讀使用者設定。
const entry = import.meta.resolve("@earendil-works/pi-coding-agent");
const { KeybindingsManager: HostKeybindingsManager } = await import(new URL("./core/keybindings.js", entry).href);
export const theme: EditorTheme = {
  borderColor: (text) => text,
  selectList: {
    selectedPrefix: (text) => text,
    selectedText: (text) => text,
    description: (text) => text,
    scrollInfo: (text) => text,
    noMatch: (text) => text,
  },
};

export function harness(options: { mode?: TuiMode; bindings?: KeybindingsConfig; convert?: (text: string) => string } = {}) {
  const reference = { mode: options.mode ?? "fullscreen", terminal: { rows: 30 }, requestRender: () => { renders++; } };
  let renders = 0;
  let errors = 0;
  const submitted: string[] = [];
  const bindings: KeybindingsManager = new HostKeybindingsManager({ "tui.editor.undo": "ctrl+z", "app.suspend": [], "app.message.followUp": "ctrl+q", ...options.bindings });
  setKeybindings(bindings);
  const editor = new OpenCCEditor(reference as unknown as TUI, theme, bindings, () => errors++, options.convert);
  editor.onSubmit = (text) => submitted.push(text);
  const label = () => editor.render(80).join("\n");
  return { editor, reference, bindings, submitted, label, get errors() { return errors; }, get renders() { return renders; } };
}
