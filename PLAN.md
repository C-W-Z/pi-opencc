# pi-opencc MVP：輸入框內的兩階段送出

## 摘要
第一版只實作：

**繁體草稿 → 第一次 Enter 在原輸入框轉成簡體 → 確認或修改 → 第二次 Enter 送出。**

不做回覆轉換、原文送出快捷鍵、預覽視窗或原文檢視。其他功能列入 `TODO.md`，不提前實作。

沿用已確認的設定：僅支援互動 TUI 的 **Fullscreen**；採台灣用詞到大陸用詞的 OpenCC 轉換，並保護 Markdown 技術內容。

## 使用行為

### 兩階段 Enter
- **編輯階段**：第一次 Enter 只轉換文字，直接替換原輸入框內容，不送出、不清空、不觸發模型或排隊。
- **確認階段**：可直接修改簡體；下一次 Enter 原樣交給 pi 送出，**不再次經過 OpenCC**。例外是實際發生過文字轉換，而且草稿之後完整恢復成轉換前的原文，此時回到編輯階段，依下述 undo 規則處理。
- 僅在 Fullscreen 使用簡短的 editor 邊框提示區分「Enter 轉簡體」與「Enter 送出」，不另開視窗、不取代 footer；一般 TUI 不加入本套件提示。
- 空白輸入不進入確認階段，也不送出。
- 為維持一致操作，普通非空輸入即使是英文、已是簡體或轉換結果相同，也使用兩次 Enter；不靠語言偵測決定是否直接送出。
- 送出後回到編輯階段，下一則草稿重新開始。

### 原生 undo
- **不註冊、不覆寫 Ctrl+Z，也不做簡體反向轉繁體。**
- 使用 pi 的 `Editor.setText()`；只有替換後的文字與替換前不同時，才會建立一次原生 undo 操作。實際發生轉換後立即 undo，可恢復轉換前的原始草稿。
- 若轉換後先修改文字，undo 依序撤銷修改，再撤銷轉換。
- 僅在該次轉換確實改變文字，且後續文字變更使草稿完整恢復成轉換前的原文時，回到編輯階段；下一次 Enter 再轉換，不直接送出繁體。人工修改成完全相同的原文也適用這個規則，不嘗試區分還原方式。
- 轉換結果相同時仍進入確認階段，不新增虛假的 undo 操作，也不因文字等於原文而重設階段；原生 undo 維持既有的編輯紀錄。
- 沿用各平台與使用者的 undo keybinding；Windows 預設 Ctrl+Z。
- 大段貼上的折疊內容使用 `getExpandedText()` 轉換，驗證原生 undo 也能恢復完整貼上資料，而非留下無效 placeholder。

### 原生操作與模式邊界
- `/` 命令與 `!`／`!!` shell 操作不進入兩階段，沿用 pi 行為。
- autocomplete 顯示時，Enter 優先交給 pi 確認選項；Shift+Enter、多行換行及反斜線換行保留原生行為。
- 第一次 Enter 只替換草稿中的可轉換文字；位於受保護 Markdown 區段內的圖片／檔案引用維持原樣。裸路徑的限制依下述轉換核心規則處理，不承諾所有檔案引用都能自動辨識或保留。
- 第二次 Enter 透過原生 submit 保留 pi 的送出流程；生成中仍採原生 streaming steering 行為。套件不自行收集、重建或送出附件。
- 其他送出快捷鍵，包括原生 follow-up，不納入此 MVP 的兩階段處理，維持原生行為：它們可能直接送出當下草稿，不執行首次轉換。README 明確說明這項例外；透過這些操作送出後也清除確認狀態。
- 非 Fullscreen 的 TUI，以及 RPC／print／JSON，不轉換也不攔截。
- session 切換、fork、tree 導航、reload、外部草稿替換、離開 Fullscreen 或清空輸入框，都清除確認狀態。重新進入 Fullscreen 時從編輯階段開始，不沿用先前確認。
- 「外部草稿替換」包含外部 editor 或 UI API 整段替換草稿，不包含本套件第一次 Enter 的替換，也不包含確認階段中的一般鍵入、貼上或局部編輯；後者維持確認階段，除非符合上述完整恢復原文的規則。

## 實作方式

### 編輯器整合
- 以 `CustomEditor` subclass 搭配 `ctx.ui.setEditorComponent()` 實作，在原生 submit 清空輸入框之前攔截第一次 Enter。
- 使用注入的 keybindings manager 判斷 `tui.input.submit`，不只比對固定字元；其餘按鍵交給 `super.handleInput()`。
- 透過公開的 `isShowingAutocomplete()`、`getCursor()`、`getLines()` 等 API 避開 autocomplete 與換行操作；尊重 `disableSubmit`。autocomplete 或原生換行使用的 Enter 不算兩階段中的一次 Enter，不藉由攔截造成提前送出。
- 第二次 Enter 直接呼叫原生 `handleInput()`，不自行呼叫 `sendUserMessage()`，不增加 `input` event 的二次轉換。
- 使用公開 TUI reference 的 `mode` 判斷 Fullscreen，並以該 reference 要求重繪；不讀寫 pi 私有 editor state 或 undo stack。於 render 與輸入處理同步模式邊界，並在相關 session lifecycle 邊界重設狀態，不假設存在專用的模式切換 event。
- 確認狀態只保存在記憶體，包含「編輯／確認」、該次轉換前的完整原文，以及該次轉換是否實際改變文字；原文比較使用 `getExpandedText()`，避免折疊貼上 placeholder 影響判斷。不新增 session metadata。
- 本套件呼叫 `setText()` 時以內部替換 guard 排除外部草稿重設，再建立確認狀態；一般編輯與原生 undo 後檢查是否清空或完整恢復原文。
- 安裝 editor factory 前檢查 `ctx.ui.getEditorComponent()`；已有其他 extension 提供 custom editor 時，不直接覆蓋，停用本功能並提示衝突。MVP 不實作多個 custom editor 的組合，也不保證後載入的其他 extension 不會取代本 editor；README 說明不支援共同使用。

### 轉換核心
- 使用純 JavaScript `opencc-js`，輸入方向固定為 `{ from: 'twp', to: 'cn' }`，初始化後重用 converter；不加入其他轉換風格設定。
- 使用 `mdast-util-from-markdown` 的 source offsets，只替換一般文字區段，不重新序列化 Markdown。
- 保護 fenced／indented code、inline code、URL／autolink、Markdown 連結與圖片目標、reference definitions 及 raw HTML；一般連結的顯示文字可轉換。
- source offsets 的保護不能只依賴完整 Markdown AST；另補 URL／autolink 與未閉合 code、連結目標的保守辨識，先排除受保護範圍，再轉換一般文字，不從 AST 重新生成內容。
- 裸路徑不保證可辨識，包含 pi 以一般文字插入的剪貼簿檔案路徑；需要精確保留的中文路徑或技術字串應放在 inline code 或其他受保護區段。本 MVP 不新增附件來源追蹤或裸路徑解析器。
- 不讀取附加檔案內容、不修改檔案，也不轉換獨立的附件 payload；草稿中的引用文字仍受上述轉換範圍與裸路徑限制約束。
- 轉換失敗時維持原草稿與編輯階段，顯示不包含草稿內容的錯誤提示，不送出。

## Package 與文件

- 建立 TypeScript package `pi-opencc`，使用 `pi-package` keyword 與明確的 `pi.extensions` entry。
- Runtime dependencies 只有 `opencc-js` 與 `mdast-util-from-markdown`；pi 提供的套件放 `peerDependencies: "*"`，型別檢查需要的 host 套件另列開發依賴。
- 使用 npm 與 lockfile，TypeScript check，Node test runner 搭配 `tsx`。
- README 使用繁體中文，只描述目前 MVP：兩次 Enter、原生 undo 與結果相同時的例外、Fullscreen 限制、Markdown 保護與裸路徑限制、命令／其他送出鍵例外、custom editor 衝突與本地載入方式。
- 不加入快捷鍵 flags、自訂詞庫、輸出轉換或設定檔讀寫。

### `TODO.md` 的待辦清單
- [ ] 原文送出快捷鍵，例如 Ctrl+Enter；處理 terminal protocol 支援差異。
- [ ] 快捷鍵在輸入框切換原文／簡體預覽，保留原始草稿。
- [ ] 模型回覆與可見 thinking 的串流繁體顯示，保留模型原文及上下文。
- [ ] 整段回覆原文／繁體切換。
- [ ] 可設定的快捷鍵與轉換風格。
- [ ] 一般 TUI、RPC 等模式的支援。
- [ ] 自訂詞庫與固定技術詞保護。

上述項目只列待辦，不提供空殼 API 或預先加入其 runtime 狀態。獨立的 Ctrl+Z 功能不列待辦，因為採用原生 undo 即可。

## 驗證與驗收

### 自動測試
- 第一次 Enter 將轉換結果留在輸入框，submit callback 呼叫次數為零；第二次呼叫一次且內容為確認後的草稿。轉換結果相同時，文字不變但仍進入確認階段。
- 簡體經人工修改後，第二次 Enter 原樣送出，不重轉換。
- 實際改變文字的轉換可透過原生 undo 恢復原始繁體並重設階段；轉換後多次修改與逐步 undo 正常。
- 英文、已是簡體、結果相同、混合文字及空白輸入的階段行為；結果相同時不得誤判為恢復原文，仍能在第二次 Enter 送出。
- 轉換後人工完整恢復原文會重設階段；一般修改、局部貼上不重設；結果相同時的 undo 不偽造轉換紀錄。
- Markdown 保護、裸 URL、未閉合語法、多行及大段貼上／undo；受保護區段內的中文路徑逐字保留，裸路徑不列為保留保證。
- autocomplete、換行、命令、原生送出後的狀態重設；其他送出鍵維持原生行為，不意外進入兩階段。
- 非 Fullscreen passthrough、離開再進入 Fullscreen、session lifecycle、外部整段草稿替換、其他 custom editor 衝突與轉換錯誤。

### Fullscreen 手動驗收
- 中文 IME 輸入後第一次 Enter 可見簡體，尚無模型請求；第二次才送出。
- 人工修正與 Windows Ctrl+Z 能按上述規則操作。
- 受保護 Markdown 區段內的圖片／檔案引用保持原樣；使用 pi 原生 submit 驗證生成中的 steering、正常換行及命令 autocomplete，不宣稱支援裸中文路徑的自動保護。
- resize、窄視窗、主題與 focus 正常；離開 Fullscreen 後回復原生行為。

完成 `npm test`、TypeScript check、`npm pack --dry-run`，以及一次性本地載入 `pi -e ./` 的驗證，並確認該次互動 TUI 為 Fullscreen。自動檢查通過後可建立實作 commit；無法在自動環境完成的本地 TUI 載入、IME 或實際終端檢查，須明列為待人工驗證。只有必要的手動情境也通過後，才宣稱完整驗收完成。

## 交付與安全邊界

實作開始前檢查 Git，若出現使用者的未提交變更，先停止並請使用者提交；不覆寫使用者尚未提交的內容。

此 MVP 作為一個可獨立檢閱的階段，依上述檢查與驗收規則使用 `git-commit` skill 建立本地 Conventional Commit，回報 short hash 與 branch。不推送、不發布、不修改 pi 安裝或使用者設定。自動測試不使用既有 session，也不呼叫真實模型；手動模型送出驗證由使用者執行，或另取得明確確認後才執行，且只使用新建的測試 session。真實模型請求可能產生費用，pi 也會依原生行為記錄測試對話。以一次性 extension 載入驗證，停用套件並重新載入或重啟後回復原生 pi；不承諾刪除或回復已送出的測試對話。

## Sources
- [opencc-js 官方 API 與轉換方向](https://raw.githubusercontent.com/nk2028/opencc-js/main/README.md)
- pi 本機 1.2.0 的 `CustomEditor` example、extension UI declarations 與 `Editor` 實作，確認 `setText()` 支援原生 undo。
