# pi-opencc

[Pi 套件頁](https://pi.dev/packages/pi-opencc) · [GitHub](https://github.com/C-W-Z/pi-opencc) · [npm](https://www.npmjs.com/package/pi-opencc)

## 這是什麼

pi-opencc 是一個 [Pi](https://pi.dev) 套件，用來在輸入框中轉換繁體中文為簡體中文。

## 為什麼需要這個套件

因為目前 LLM 使用的 tokenizers，對簡體中文的分詞效率比繁體中文更高，換句話說，使用簡體中文更省 token。

### 為什麼不轉成英文

轉成英文會有以下主要問題：
1. 難以保證語意相同
2. 需要本地安裝翻譯模型
3. 翻譯速度比繁轉簡慢

我認為承受這些問題僅僅只是為了省 token 是完全沒必要的。如果你真的想要轉換成英文，可以使用其他人實作的 package，例如 [@pmlpm/pi-translate-zh-en](https://github.com/pmlpl/cn-en-bridge)

## 安裝

需要：
- Node.js 22.19.0 以上
- pi v1.2.0 以上 (v1.2.0 以下的版本不保證兼容)
- 互動 TUI 設為 **Fullscreen**

```sh
pi install npm:pi-opencc
```

移除套件：

```bash
pi remove npm:pi-opencc
```

## 如何使用

1. 在輸入框撰寫訊息，按第一次 Enter。
2. pi-opencc 會在原輸入框把文字轉成簡體，**不會送出**。
3. 檢查或修改內容，再按一次 Enter 送出。

輸入框邊框會提示目前 Enter 的作用：「Enter 轉簡體」或「Enter 送出」。一般 TUI、print、JSON 和 RPC 模式不會啟用本功能。

英文、已是簡體或轉換前後相同的非空草稿，也需要按兩次 Enter；空白草稿不會送出。OpenCC 使用台灣用詞轉大陸用詞，例如「軟體、滑鼠、網路」會轉成「软件、鼠标、网络」。

### 修改與復原

轉換後可以直接修改；第二次 Enter 會原樣送出，不會再轉一次。pi 原生 undo 也能復原轉換：轉換後立即 undo 可還原原稿；若先修改，undo 會先撤銷修改，再撤銷轉換。當確實發生轉換，而草稿之後完整恢復成原稿時，下一次 Enter 會重新轉換。

若轉換結果與原文相同，仍會進入確認階段，但不會新增多餘的 undo 紀錄。

## 哪些文字會轉換？

一般文字會轉換；程式碼、Markdown 連結目標、圖片引用、URL 與 HTML 等內容會盡量保留。一般 Markdown 連結的顯示文字仍會轉換。

**目前無法保證裸露的 `@檔名` 或檔案路徑維持原樣。** 例如 `@測試檔案` 可能被轉成 `@测试文件`，使 pi 找不到原檔。含中文的檔名或技術路徑，也請勿在未確認引用結果前直接送出；保護 pi 的 `@檔案` 引用仍是待辦。

需要原樣保留的路徑或技術字串，可用 Markdown inline code 包住，例如 `` `資料夾/測試檔案.ts` ``。這只保護文字轉換，不代表它仍會被 pi 當成可點選或附加的檔案引用。

轉換失敗時，草稿會保持原樣並留在輸入框，不會送出。

## 原生操作與限制

- `/` 命令與 `!`／`!!` shell 操作沿用 pi 原生行為，不經繁簡轉換。
- autocomplete 開啟時，Enter 先交給 pi 確認選項；Shift+Enter 與一般換行也維持原樣。
- 其他送出快捷鍵（例如 follow-up）不受兩階段保護，可能直接送出尚未轉換的草稿。
- 不會轉換附件內容；附件仍由 pi 原生處理。
- 本套件無法與其他提供 custom editor 的 extension 一起使用。若啟動時已偵測到衝突，本功能會停用並提示。

## 開發與測試

```sh
npm ci
npm run verify
npm pack --dry-run
```

自動測試不呼叫真實模型。實際 Fullscreen、中文輸入法與終端操作仍需人工確認；請查看 [TODO.md](TODO.md) 的驗收項目。

## 專案連結

- [GitHub repository](https://github.com/C-W-Z/pi-opencc)
- [回報問題](https://github.com/C-W-Z/pi-opencc/issues)
- [Pi package page](https://pi.dev/packages/pi-opencc)
- MIT License，詳見 [LICENSE](LICENSE)
