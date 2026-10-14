# pi-opencc 0.1.0

`pi-opencc` 初始版本：在 Pi 的 Fullscreen 輸入框中先將草稿由繁體轉為簡體，讓你確認或修改後再送出。

## 功能

- 第一次 Enter 將草稿轉成簡體並留在原輸入框；第二次 Enter 才交由 Pi 原生流程送出。
- 固定採用 OpenCC 台灣用詞至中國大陸用詞轉換，例如「軟體、滑鼠、網路」轉為「软件、鼠标、网络」。
- 可在轉換後繼續編輯；沿用 Pi 原生 undo 還原轉換與修改。
- 盡量保留 Markdown 程式碼、連結目標、圖片引用、URL 與 HTML 等技術內容。
- 自動測試涵蓋轉換、兩階段送出、undo、大段貼上、模式邊界與 Pi extension loader。

## 相容性與限制

- 需要 Node.js 22.19.0 以上、Pi 1.2.0 以上及 Fullscreen 互動 TUI。
- 不會轉換一般 TUI、RPC、print 或 JSON 模式，也不轉換模型回覆或 thinking。
- 命令、autocomplete、換行與附件沿用 Pi 原生行為；其他送出快捷鍵可能直接送出尚未轉換的草稿。
- **裸露的 `@檔名` 和檔案路徑目前可能被 OpenCC 改寫。** 中文檔名的 Pi 引用可能因此失效；請在送出前確認引用。保護 Pi 的 `@檔案` 引用仍是已知待辦。
- 需要自己的 custom editor，不能與其他提供 custom editor 的 extension 一起使用。
- 自動測試不取代實際終端驗收；Fullscreen、中文輸入法及不同終端的人工驗收仍待完成。

安裝方式與詳細使用說明請見 [README.md](README.md)。
