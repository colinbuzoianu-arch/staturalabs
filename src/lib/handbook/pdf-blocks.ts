import type { HandbookPdfBlock } from "@/lib/report/HandbookDocument";

// Turn a chapter's Markdown into the flat block list the PDF renders.
//
// Deliberately a second, much smaller pass over the SAME Markdown rather than a
// second Markdown implementation: react-pdf cannot render HTML, so the in-app
// renderer's output is no use here, but the source stays single. Everything
// inline (bold, links, code) collapses to plain text — a printed handbook has
// no hover and no click.
//
// Pure + unit-tested.

function stripInline(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

export function markdownToPdfBlocks(source: string): HandbookPdfBlock[] {
  const blocks: HandbookPdfBlock[] = [];
  let paragraph: string[] = [];
  let inFence = false;

  const flush = () => {
    if (paragraph.length === 0) return;
    const text = stripInline(paragraph.join(" "));
    if (text.length > 0) blocks.push({ kind: "p", text });
    paragraph = [];
  };

  for (const raw of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();

    // Fenced code is dropped: a handbook chapter's code block is a path or a
    // command, which reads as noise in a printed PDF and is already in the
    // in-app version.
    if (line.startsWith("```")) {
      flush();
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (line.length === 0) {
      flush();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const kind = (["h1", "h2", "h3"] as const)[heading[1].length - 1];
      blocks.push({ kind, text: stripInline(heading[2]) });
      continue;
    }
    // Deeper headings become bold-ish h3s rather than vanishing.
    const deep = /^#{4,6}\s+(.*)$/.exec(line);
    if (deep) {
      flush();
      blocks.push({ kind: "h3", text: stripInline(deep[1]) });
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line)) {
      flush();
      continue; // a rule has no meaning in the paged layout
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flush();
      blocks.push({ kind: "li", text: stripInline(bullet[1]) });
      continue;
    }
    const ordered = /^(\d+)[.)]\s+(.*)$/.exec(line);
    if (ordered) {
      flush();
      // Numbered steps keep their number — in a handbook the order IS the
      // content ("1. Open …, 2. Choose …") — and take no bullet glyph.
      blocks.push({
        kind: "step",
        text: `${ordered[1]}. ${stripInline(ordered[2])}`,
      });
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flush();
      blocks.push({ kind: "quote", text: stripInline(quote[1]) });
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return blocks;
}
