# pi-opencc

pi **Fullscreen** 輸入框的兩階段送出：

**繁體草稿 → 第一次 Enter 轉簡體 → 確認或修改 → 第二次 Enter 送出。**

採用純 JavaScript `opencc-js`，固定 `{ from: 'twp', to: 'cn' }`，將台灣用詞轉成大陸用詞，例如「軟體／滑鼠／網路」轉為「软件／鼠标／网络」。只處理輸入草稿，不轉換模型回覆或 thinking。

## 本地載入

需要 Node.js 22.19.0 以上與 npm；host API 已以 pi 1.2.0 驗證。專案的 pi 套件是型別檢查與測試用開發依賴，執行 extension 時使用 host 提供的套件。

```sh
npm ci
pi -e ./
```

這是一次性 extension 載入，不修改 pi 安裝或使用者設定。請在 pi 的 `/settings` 確認互動 TUI 使用 **Fullscreen**。不要用 `--print`、JSON 或 RPC 模式驗證兩階段操作；這些模式不轉換，一般 TUI 也直接沿用原生行為、不加入提示。

不再以 `-e ./` 載入，並重新啟動 pi，即可回復原生操作。已送出的測試對話不會因此刪除或回復。

## 操作

- **編輯階段**：editor 下邊框顯示「Enter 轉簡體」。第一次 Enter 只替換原輸入框，不送出、不排隊、不觸發模型。
- **確認階段**：邊框顯示「Enter 送出」。可直接修正文字，下一次 Enter 交由 pi 原生 submit 處理，**不再次轉換**，並保留原生 trimming、附件與生成中的 steering 流程。
- 英文、已是簡體或轉換結果相同的非空草稿也固定使用兩次 Enter。
- 空白草稿不確認、不送出。送出、清空、session 切換、fork、tree 導航、reload、離開 Fullscreen 或外部整段替換草稿，都清除確認狀態。
- 確認階段的一般鍵入、局部貼上、局部插入不清除確認；外部 editor 或 UI API 的整段 `setText()` 替換會清除，即使替換成相同文字。
- 尊重使用者的 `tui.input.submit` keybinding，不限定固定的 Enter 編碼。

### 原生 undo

不註冊或覆寫 Ctrl+Z，不做簡體反向轉繁體。沿用 pi 與使用者的 undo keybinding：Windows 預設 Ctrl+Z，其他平台依 pi 的配置。

實際轉換改變文字時，`Editor.setText()` 建立一次原生 undo 操作。立即 undo 能還原完整原始草稿，包含折疊的大段貼上；先修改再 undo，則依原生規則逐步撤銷修改，最後撤銷轉換。

只有**該次轉換確實改變文字**，且之後草稿完整恢復成轉換前的原文，才回到編輯階段；人工修改到與原文完全相同也適用。下一次 Enter 會重新轉換，不直接送出繁體。

**結果相同的例外**：仍進入確認階段，但不呼叫 `setText()`、不新增轉換 undo 紀錄，也不因文字等於原文而重設。此時 undo 撤銷的是既有編輯；若修改後 undo 回到相同原文，仍在確認階段，除非草稿被清空。

### 原生操作的例外

- `/` 命令與 `!`／`!!` shell 操作直接交由 pi，不經過兩階段或 OpenCC。
- autocomplete 顯示時，Enter 優先交由 pi 確認選項；命令 autocomplete 可能依 pi 的原生行為直接執行命令。
- Shift+Enter、多行換行與反斜線換行保留原生行為，不算兩階段中的一次 Enter。
- **其他送出鍵，包括原生 follow-up，不受兩階段保護**：可能直接送出當下草稿，不執行首次轉換。送出後清除確認狀態。
- 不讀取或修改附加檔案，不轉換獨立附件 payload，不自行收集、重建或送出附件。附件由 pi 原生 submit 處理。

## Markdown 與技術內容

使用 `mdast-util-from-markdown` 的 source offsets 保留原始語法，不重新序列化 Markdown。保護：

- fenced／indented code 與 inline code；
- URL、autolink、Markdown 連結目標與 title；一般連結的顯示文字可轉換；
- reference definitions 與 reference label；shortcut／collapsed reference 的顯示文字同時也是 identifier，因此整段保留；
- Markdown 圖片引用整段（包含 alt 與目標）、raw HTML 與其內文。

另以保守辨識保護裸 URL、未閉合 code、連結目標與 HTML／autolink；未閉合語法可能保護到草稿結尾，讓後續文字暫時不轉換。

**不保證裸路徑可辨識**，包含 pi 以一般文字插入的剪貼簿檔案路徑。需要逐字保留的中文路徑、圖片／檔案引用或技術字串，請放在 inline code 或其他受保護區段：

```markdown
請讀取 `繁體目錄/檔案.ts`，並參考 ![圖片](繁體目錄/圖片.png)。
```

轉換失敗時保留草稿與編輯階段，不送出；錯誤提示不包含草稿或 exception 內容。

## custom editor 相容性

本套件必須提供自己的 `CustomEditor`，**不支援與其他 custom editor extension 共同使用**。安裝 factory 前若已存在其他 custom editor，本功能停用並提示衝突，不覆蓋它。後載入的 extension 仍可能取代本 editor；不保證自動偵測或組合多個 editor。

## 開發與驗證

```sh
npm test
npm run check
npm pack --dry-run
```

自動測試使用實際的 pi `CustomEditor`／原生 undo 與 jiti loader，搭配假的 TUI reference 與 submit callback；不使用既有 session、不呼叫真實模型。測試包含兩階段送出、相同結果、修改與 undo、大段貼上、Markdown 保護、autocomplete、原生 keybindings、模式與 lifecycle、外部替換、衝突與錯誤。

### 待人工驗證

自動測試不能取代實際 Fullscreen 終端驗收。請使用 `pi -e ./` 開啟**新的測試 session**，確認 Fullscreen 後檢查：

- 中文 IME 輸入、第一次 Enter 顯示簡體而無模型請求，第二次才送出；
- 人工修正與 Windows Ctrl+Z，大段貼上的完整還原；
- 受保護區段內的圖片／檔案引用、命令 autocomplete、換行與生成中的 steering；
- resize、窄視窗、主題與 focus，離開再進入 Fullscreen 的階段重設。

第二次送出與 steering 驗證會呼叫真實模型，可能產生費用，pi 也會依原生行為保存測試對話。只有必要的手動情境也通過後，才算完整驗收完成。功能擴充列於 [TODO.md](TODO.md)。
