import { fromMarkdown } from "mdast-util-from-markdown";
import { Converter } from "opencc-js";

const convert = Converter({ from: "twp", to: "cn" });
type Range = [start: number, end: number];
type Node = ReturnType<typeof fromMarkdown> | ReturnType<typeof fromMarkdown>["children"][number];

/** 合併 source offsets，保留原始 Markdown，不經過重新序列化。 */
function mergeRanges(ranges: Range[]): Range[] {
  const merged: Range[] = [];
  for (const [start, end] of ranges.sort((a, b) => a[0] - b[0])) {
    const previous = merged.at(-1);
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

function protectedRanges(source: string): Range[] {
  const ranges: Range[] = [];
  const add = (start: number | undefined, end: number | undefined) => {
    if (start !== undefined && end !== undefined) ranges.push([start, end]);
  };
  const visit = (node: Node): void => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (["code", "inlineCode", "html", "definition"].includes(node.type)) {
      add(start, end);
      return;
    }
    if (node.type === "linkReference" && node.referenceType !== "full") {
      // shortcut／collapsed reference 的顯示文字也是 identifier，不能單獨改寫。
      add(start, end);
      return;
    }
    if (node.type === "link" || node.type === "linkReference") {
      // 顯示文字可轉換；目標、title 與 reference label 原封不動。
      if (source[start ?? 0] === "<") add(start, end);
      else add(node.children.at(-1)?.position?.end.offset, end);
    }
    if (node.type === "image" || node.type === "imageReference") {
      // alt 是技術引用的一部分，保守保留整個圖片語法。
      add(start, end);
    }
    if ("children" in node) for (const child of node.children) visit(child);
  };
  visit(fromMarkdown(source));

  // 裸 URL 與不完整 autolink 不能只靠 CommonMark AST 辨識。
  for (const match of source.matchAll(/\b(?:[a-z][a-z\d+.-]*:\/\/|mailto:|www\.)[^\s<>`]+/gi)) {
    add(match.index, match.index + match[0].length);
  }
  for (const match of source.matchAll(/<[^\s<>]+@[^<>]*(?:>|$)/g)) {
    add(match.index, match.index + match[0].length);
  }

  const astRanges = mergeRanges(ranges);
  let rangeIndex = 0;
  const escaped = (index: number) => {
    let count = 0;
    while (index > 0 && source[--index] === "\\") count++;
    return count % 2 === 1;
  };
  for (let i = 0; i < source.length; i++) {
    while (astRanges[rangeIndex] && astRanges[rangeIndex][1] <= i) rangeIndex++;
    const range = astRanges[rangeIndex];
    if (range && range[0] <= i && source[i] !== "<") {
      i = range[1] - 1;
      continue;
    }
    if (escaped(i)) continue;
    if (source[i] === "`") {
      const run = /^`+/.exec(source.slice(i))![0];
      let end = source.length;
      for (const match of source.slice(i + run.length).matchAll(/`+/g)) {
        if (match[0].length === run.length) {
          end = i + run.length + match.index + run.length;
          break;
        }
      }
      add(i, end);
      i = end - 1;
    } else if (source.startsWith("](", i)) {
      // 包含巢狀括號、跳脫與 title；未閉合時保護到草稿結尾。
      let depth = 1;
      let quote = "";
      let end = source.length;
      for (let j = i + 2; j < source.length; j++) {
        if (escaped(j)) continue;
        const char = source[j];
        if (quote) {
          if (char === quote) quote = "";
        } else if (char === '"' || char === "'") quote = char;
        else if (char === "(") depth++;
        else if (char === ")" && --depth === 0) {
          end = j + 1;
          break;
        }
      }
      add(i, end);
      i = end - 1;
    } else if (source[i] === "<") {
      // raw HTML 的內文也保留；未閉合標籤／autolink 採保守保護。
      const rest = source.slice(i);
      const tag = /^<([a-z][a-z\d-]*)(?=[\s/>]|$)[^>]*(?:>|$)/i.exec(rest);
      if (tag) {
        let end = i + tag[0].length;
        const isVoid = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i.test(tag[1]);
        if (!isVoid && !tag[0].endsWith("/>")) {
          const contentStart = end;
          const tags = new RegExp(`</?${tag[1]}(?=[\\s/>])[^>]*>`, "gi");
          let depth = 1;
          end = source.length;
          for (const nested of source.slice(contentStart).matchAll(tags)) {
            if (nested[0].startsWith("</")) depth--;
            else if (!nested[0].endsWith("/>")) depth++;
            if (depth === 0) {
              end = contentStart + nested.index + nested[0].length;
              break;
            }
          }
        }
        add(i, end);
        i = end - 1;
      } else if (/^<(?:[a-z][\w+.-]*:|[!/?])/i.test(rest)) {
        const closing = source.indexOf(">", i);
        const end = closing === -1 ? source.length : closing + 1;
        add(i, end);
        i = end - 1;
      }
    }
  }
  return mergeRanges(ranges);
}

/** 固定使用台灣用詞 → 大陸用詞，僅轉換受保護區段以外的草稿文字。 */
export function convertDraft(source: string): string {
  let cursor = 0;
  const chunks: string[] = [];
  for (const [start, end] of protectedRanges(source)) {
    chunks.push(convert(source.slice(cursor, start)), source.slice(start, end));
    cursor = end;
  }
  chunks.push(convert(source.slice(cursor)));
  return chunks.join("");
}
