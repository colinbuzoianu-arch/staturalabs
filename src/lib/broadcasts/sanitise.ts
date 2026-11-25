// Server-side sanitiser for a broadcast body. The compose form offers light
// rich text (paragraphs, line breaks, bold/italic, lists, links); everything
// else is stripped BEFORE the row is written, so the stored body is already
// safe and no read path has to remember to escape it.
//
// An allowlist, not a blocklist, and no DOM: the input is small, the allowed
// surface is tiny, and a dependency-free allowlist cannot be out-manoeuvred by
// a blocklist gap. Same posture as the upload safety gate.
//
// Pure + unit-tested.

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "a",
]);

// Only http(s) and mailto links survive; javascript:/data: are dropped.
const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

function sanitiseAnchor(attrs: string): string {
  const hrefMatch = /href\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
  const href = (hrefMatch?.[2] ?? hrefMatch?.[3] ?? "").trim();
  if (!href || !SAFE_HREF.test(href)) return "";
  const escaped = href.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  // rel/target are forced, never taken from the input.
  return `<a href="${escaped}" rel="noopener noreferrer nofollow" target="_blank">`;
}

export function sanitiseBroadcastBody(input: string): string {
  // 1) Remove whole dangerous elements with their content (a bare tag strip
  //    would leave the script body as visible text).
  let out = input.replace(
    /<(script|style|iframe|object|embed|svg|math|template)\b[\s\S]*?<\/\1\s*>/gi,
    "",
  );
  // 2) Drop comments and any remaining unclosed dangerous opener.
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(
    /<\/?(script|style|iframe|object|embed|svg|math|template)\b[^>]*>/gi,
    "",
  );

  // 3) Unsafe anchors are removed WITH their closing tag, keeping the link
  //    text — dropping only the opener would leave an orphan </a>.
  out = out.replace(
    /<\s*a\b([^>]*)>([\s\S]*?)<\s*\/\s*a\s*>/gi,
    (full: string, attrs: string, inner: string) =>
      sanitiseAnchor(attrs) === "" ? inner : full,
  );

  // 4) Walk the remaining tags: keep the allowlist, strip every attribute
  //    except a safe href on <a>.
  out = out.replace(
    /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g,
    (_full, slash: string, rawTag: string, attrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (slash === "/") return `</${tag}>`;
      if (tag === "a") return sanitiseAnchor(attrs);
      if (tag === "br") return "<br />";
      return `<${tag}>`;
    },
  );

  // 5) Any stray "<" that is not part of a tag we kept would render as broken
  //    markup — escape what is left.
  out = out.replace(/<(?![/a-zA-Z])/g, "&lt;");

  return out.trim();
}

// The plain-text rendering used for the e-mail channel, the notice-board PDF
// and the notification body — never the HTML.
export function broadcastBodyToText(body: string): string {
  return (
    body
      .replace(/<br\s*\/?>/gi, "\n")
      // A paragraph break reads as a blank line, a list item as a single one.
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li>/gi, "- ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
