import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { BrandMark } from "./brand-mark";

// P18 B.1: the handbook as a PDF — the full book, or one role's selection.
// These are the files the founder sends to prospects, so it carries a cover
// with the version and the date, and every chapter starts on its own page.
//
// Built from the SAME Markdown as the in-app renderer, via a plain-text
// rendering: react-pdf has no HTML renderer, and a second Markdown
// implementation for the PDF would be the thing that drifts. Headings keep
// their own style; everything else is paragraphs and bullets.

export type HandbookPdfBlock =
  | { kind: "h1" | "h2" | "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "li"; text: string }
  // A numbered step keeps its own number and takes no bullet glyph.
  | { kind: "step"; text: string }
  | { kind: "quote"; text: string };

export type HandbookPdfChapter = {
  title: string;
  partTitle: string;
  blocks: HandbookPdfBlock[];
};

export type HandbookPdfData = {
  title: string;
  subtitle: string;
  version: string;
  generatedOn: string; // ISO yyyy-mm-dd
  // Non-null for a role PDF; the cover names it so two files cannot be mixed up.
  roleLabel: string | null;
  contents: { partTitle: string; chapterTitles: string[] }[];
  chapters: HandbookPdfChapter[];
  footer: string;
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#fbf9f4",
    padding: 48,
    paddingBottom: 64,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1b2a2a",
    lineHeight: 1.45,
  },
  cover: {
    backgroundColor: "#fbf9f4",
    padding: 64,
    fontFamily: "Helvetica",
    color: "#1b2a2a",
  },
  coverTitle: {
    fontSize: 30,
    fontFamily: "Helvetica-Bold",
    color: "#0f766e",
    marginTop: 28,
  },
  coverSub: { fontSize: 13, marginTop: 10, color: "#374151" },
  coverMeta: { fontSize: 10, marginTop: 36, color: "#6b7280" },
  partTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.5,
    color: "#0f766e",
    marginBottom: 4,
  },
  h1: {
    fontSize: 19,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    color: "#1b2a2a",
  },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 12 },
  h3: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 10 },
  p: { marginTop: 6 },
  li: { marginTop: 3, marginLeft: 12 },
  quote: {
    marginTop: 6,
    marginLeft: 8,
    paddingLeft: 8,
    borderLeft: "2 solid #d6d3cb",
    color: "#374151",
  },
  tocPart: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
    color: "#0f766e",
  },
  tocItem: { marginTop: 3, marginLeft: 10 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#6b7280",
    borderTop: "1 solid #d6d3cb",
    paddingTop: 6,
  },
});

function Block({ block }: { block: HandbookPdfBlock }) {
  if (block.kind === "h1") return <Text style={styles.h1}>{block.text}</Text>;
  if (block.kind === "h2") return <Text style={styles.h2}>{block.text}</Text>;
  if (block.kind === "h3") return <Text style={styles.h3}>{block.text}</Text>;
  if (block.kind === "li")
    return <Text style={styles.li}>{`• ${block.text}`}</Text>;
  if (block.kind === "step") return <Text style={styles.li}>{block.text}</Text>;
  if (block.kind === "quote")
    return <Text style={styles.quote}>{block.text}</Text>;
  return <Text style={styles.p}>{block.text}</Text>;
}

export function HandbookDocument({ data }: { data: HandbookPdfData }) {
  return (
    <Document title={data.title}>
      <Page size="A4" style={styles.cover}>
        <BrandMark />
        <Text style={styles.coverTitle}>{data.title}</Text>
        <Text style={styles.coverSub}>{data.subtitle}</Text>
        {data.roleLabel && (
          <Text style={styles.coverSub}>{data.roleLabel}</Text>
        )}
        <Text style={styles.coverMeta}>
          {`${data.version} · ${data.generatedOn}`}
        </Text>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Inhalt</Text>
        {data.contents.map((part) => (
          <View key={part.partTitle}>
            <Text style={styles.tocPart}>{part.partTitle}</Text>
            {part.chapterTitles.map((title) => (
              <Text key={title} style={styles.tocItem}>
                {title}
              </Text>
            ))}
          </View>
        ))}
        <Text style={styles.footer} fixed>
          {data.footer}
        </Text>
      </Page>

      {data.chapters.map((chapter) => (
        <Page key={chapter.title} size="A4" style={styles.page}>
          <Text style={styles.partTitle}>
            {chapter.partTitle.toUpperCase()}
          </Text>
          {chapter.blocks.map((block, i) => (
            // Index keys: the blocks are a flat, immutable rendering of one
            // chapter, produced in order and never reordered.
            <Block key={`${chapter.title}-${i}`} block={block} />
          ))}
          <Text style={styles.footer} fixed>
            {data.footer}
          </Text>
        </Page>
      ))}
    </Document>
  );
}
