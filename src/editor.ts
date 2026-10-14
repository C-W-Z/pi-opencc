import { CustomEditor, type KeybindingsManager } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth, type EditorTheme, type TUI } from "@earendil-works/pi-tui";
import { convertDraft } from "./convert.ts";

/** 只保留單次確認的記憶體狀態；原生 editor 負責 undo、附件與 submit。 */
export class OpenCCEditor extends CustomEditor {
  private confirmation?: { original: string; changed: boolean };
  private internalReplacement = false;
  private fullscreen = false;
  private receivingPaste = false;

  constructor(
    tui: TUI,
    theme: EditorTheme,
    private readonly bindings: KeybindingsManager,
    private readonly notifyError: () => void,
    private readonly convert: (text: string) => string = convertDraft,
  ) {
    super(tui, theme, bindings);
  }

  reset(): void {
    if (!this.confirmation) return;
    this.confirmation = undefined;
    this.tui.requestRender();
  }

  private sync(): void {
    const fullscreen = this.tui.mode === "fullscreen";
    if (fullscreen !== this.fullscreen) {
      this.reset();
      this.fullscreen = fullscreen;
    }
    if (!this.confirmation) return;
    const text = this.getExpandedText();
    if (!text.trim() || (this.confirmation.changed && text === this.confirmation.original)) this.reset();
  }

  override setText(text: string): void {
    if (!this.internalReplacement) this.reset();
    super.setText(text);
  }

  override insertTextAtCursor(text: string): void {
    super.insertTextAtCursor(text);
    this.sync();
  }

  private nativeInput(data: string): void {
    try {
      super.handleInput(data);
    } finally {
      this.sync();
    }
  }

  override handleInput(data: string): void {
    this.sync();
    // bracketed paste 的分段資料可能恰好是 Enter，不得將它當成送出。
    const paste = this.receivingPaste || data.includes("\x1b[200~");
    if (data.includes("\x1b[200~")) this.receivingPaste = true;
    if (data.includes("\x1b[201~")) this.receivingPaste = false;

    const cursor = this.getCursor();
    const backslash = cursor.col > 0 && this.getLines()[cursor.line]?.[cursor.col - 1] === "\\";
    const nativeNewline = this.bindings.matches(data, "tui.input.newLine") ||
      data === "\n" || (data.charCodeAt(0) === 10 && data.length > 1) ||
      data === "\x1b[13;2~" || (data.includes("\x1b") && data.includes("\r"));
    const history = this.bindings.matches(data, "tui.editor.historyPrevious") ||
      this.bindings.matches(data, "tui.editor.historyNext") ||
      this.bindings.matches(data, "tui.editor.cursorUp") ||
      this.bindings.matches(data, "tui.editor.cursorDown");
    const beforeHistory = history ? this.getExpandedText() : undefined;
    const appAction = this.bindings.matches(data, "app.clipboard.pasteImage") ||
      this.bindings.matches(data, "app.interrupt") ||
      this.bindings.matches(data, "app.exit") ||
      [...this.actionHandlers.keys()].some((action) => this.bindings.matches(data, action));
    if (paste || !this.fullscreen || this.disableSubmit || this.isShowingAutocomplete() ||
      nativeNewline || backslash || appAction || history ||
      !this.bindings.matches(data, "tui.input.submit")) {
      this.nativeInput(data);
      // 原生 history 使用內部替換 API；只有真的換了草稿才清除確認。
      if (beforeHistory !== undefined && beforeHistory !== this.getExpandedText()) this.reset();
      return;
    }

    const original = this.getExpandedText();
    if (/^[\/!]/.test(original.trimStart())) {
      this.nativeInput(data);
      return;
    }
    if (!original.trim()) {
      this.reset();
      return;
    }
    if (this.confirmation) {
      this.nativeInput(data);
      return;
    }
    // 保留 extension shortcut 的優先順序；第二次 Enter 由 super 自行處理。
    if (this.onExtensionShortcut?.(data)) {
      this.sync();
      return;
    }
    try {
      const converted = this.convert(original);
      const changed = converted !== original;
      if (changed) {
        this.internalReplacement = true;
        try {
          this.setText(converted);
        } finally {
          this.internalReplacement = false;
        }
      }
      // 相同結果不呼叫 setText，避免展開貼上或新增虛假的 undo 紀錄。
      this.confirmation = { original, changed };
      this.tui.requestRender();
    } catch {
      this.reset();
      this.notifyError();
    }
  }

  override render(width: number): string[] {
    this.sync();
    return super.render(width);
  }

  protected override renderBottomBorder(width: number, hiddenLineCount: number): string {
    const border = super.renderBottomBorder(width, hiddenLineCount);
    if (!this.fullscreen || width <= 0) return border;
    const label = truncateToWidth(this.confirmation ? " Enter 送出 " : " Enter 轉簡體 ", width, "");
    return truncateToWidth(border, Math.max(0, width - visibleWidth(label)), "") + this.borderColor(label);
  }
}
