// A small, deliberately limited Markdown renderer for the handbook.
//
// Why not a dependency: the handbook's source is OURS (docs/handbuch/**, in
// this repo, written by us), so the input is trusted and the needed subset is
// tiny. A 150-line renderer we understand beats pulling a general-purpose
// parser plus a sanitiser into the bundle for ten syntax features. The CI
// check (scripts/check-handbook.mjs) fails the build on syntax this does not
// support, so "unsupported" can never silently render as literal text.
//
// Supported, and nothing else:
//   # … ###### headings · paragraphs · **bold** · *italic* · `code`
//   - / * bullet lists · 1. ordered lists · > blockquotes · --- rules
//   ```fenced code``` · [text](href) links · ![alt](src) images
//
// Pure, no DOM, unit-tested. Everything is escaped first and only the tags this
// file emits are ever produced, so a stray "<script>" in a chapter renders as
// text rather than as markup.

export type HeadingAnchor = { level: number; text: string; id: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Stable, readable anchor ids, so a deep link into a chapter keeps working:
// umlauts are transliterated rather than stripped (an "Überprüfung" heading
// must not become "-berpr-fung").
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Only in-app paths, http(s) and anchors. A handbook link to anything else
// (javascript:, data:, a mailto we did not intend) is dropped to plain text,
// which the CI link check then flags.
function safeHref(href: string): string | null {
  const value = href.trim();
  if (/^(https?:\/\/|\/|#)/.test(value)) return value;
  return null;
}

function inline(text: string): string {
  let out = escapeHtml(text);
  // Code first: its content must not be re-processed for bold/italic.
  const codes: string[] = [];
  out = out.replace(/`([^`]+)`/g, (_m, code: string) => {
    codes.push(code);
    return `\u0000CODE${codes.length - 1}\u0000`;
  });
  // Images before links (the syntaxes overlap).
  out = out.replace(
    /!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (full, alt: string, src: string) => {
      const safe = safeHref(src);
      if (!safe) return full;
      return `<img src="${safe}" alt="${alt}" class="handbook-img" />`;
    },
  );
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (full, label: string, href: string) => {
      const safe = safeHref(href);
      if (!safe) return full;
      const external = safe.startsWith("http");
      return `<a href="${safe}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
    },
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  // The sentinel is deliberately a NUL: escapeHtml() has already run over the
  // chapter text, so the only NUL in the string is the one the code-extraction
  // step above inserted itself.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: placeholder sentinel, see above
  out = out.replace(/\u0000CODE(\d+)\u0000/g, (_m, i: string) => {
    return `<code>${escapeHtml(codes[Number(i)])}</code>`;
  });
  return out;
}

export type RenderResult = { html: string; headings: HeadingAnchor[] };

export function renderHandbookMarkdown(source: string): RenderResult {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  const headings: HeadingAnchor[] = [];
  let paragraph: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];
  let fence: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((i) => `<li>${inline(i)}</li>`).join("");
    html.push(`<${list.type}>${items}</${list.type}>`);
    list = null;
  };
  const flushQuote = () => {
    if (quote.length === 0) return;
    html.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
    quote = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (fence !== null) {
      if (line.trim().startsWith("```")) {
        html.push(`<pre><code>${escapeHtml(fence.join("\n"))}</code></pre>`);
        fence = null;
      } else {
        fence.push(raw);
      }
      continue;
    }
    if (line.trim().startsWith("```")) {
      flushAll();
      fence = [];
      continue;
    }

    if (line.trim().length === 0) {
      flushAll();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = headingId(text);
      headings.push({ level, text, id });
      html.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushAll();
      html.push("<hr />");
      continue;
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      flushQuote();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ordered) {
      flushParagraph();
      flushQuote();
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }

    const blockquote = /^>\s?(.*)$/.exec(line);
    if (blockquote) {
      flushParagraph();
      flushList();
      quote.push(blockquote[1]);
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }
  if (fence !== null) {
    // An unterminated fence: emit what we have rather than losing it.
    html.push(`<pre><code>${escapeHtml(fence.join("\n"))}</code></pre>`);
  }
  flushAll();

  return { html: html.join("\n"), headings };
}

// The plain-text rendering used by the PDF export and by the search index.
export function handbookMarkdownToText(source: string): string {
  return (
    source
      .replace(/\r\n/g, "\n")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^>\s?/gm, "")
      // Horizontal whitespace only: `\s*` after a multiline `^` also matches the
      // following newline, which ate the blank line before a bullet and
      // collapsed paragraph breaks in the PDF text.
      .replace(/^[^\S\n]*[-*][^\S\n]+/gm, "• ")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
