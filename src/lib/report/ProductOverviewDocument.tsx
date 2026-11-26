import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { BrandMark } from "./brand-mark";
import type { HandbookPdfBlock } from "./HandbookDocument";

// P18 B.4: the Produktüberblick — the short sales document, about ten pages,
// derived from the same Markdown pipeline as the handbook.
//
// It is NOT a second handbook: one page per topic, a screenshot where one
// exists, and the legal-coverage figures come from the installation's own
// active catalogue (resolved by the route), never from a marketing claim.
//
// German only, like every document this app generates for a DACH reader.

export type OverviewPdfSection = {
  title: string;
  blocks: HandbookPdfBlock[];
  // A data URI for the section's screenshot, or null when none was produced
  // yet. A missing screenshot renders as nothing — a sales document with a
  // broken-image box is worse than one page without a picture. The CI check
  // guards the names, so a typo is loud at build time instead.
  imageSrc: string | null;
};

export type OverviewPdfData = {
  title: string;
  subtitle: string;
  version: string;
  generatedOn: string; // ISO yyyy-mm-dd
  sections: OverviewPdfSection[];
  footer: string;
};

const styles = StyleSheet.create({
  cover: {
    backgroundColor: "#fbf9f4",
    padding: 64,
    fontFamily: "Helvetica",
    color: "#1b2a2a",
  },
  coverTitle: {
    fontSize: 32,
    fontFamily: "Helvetica-Bold",
    color: "#0f766e",
    marginTop: 28,
  },
  coverSub: { fontSize: 14, marginTop: 12, color: "#374151" },
  coverMeta: { fontSize: 10, marginTop: 40, color: "#6b7280" },
  coverToc: { fontSize: 10, marginTop: 28, color: "#374151" },
  tocItem: { marginTop: 4 },
  page: {
    backgroundColor: "#fbf9f4",
    padding: 48,
    paddingBottom: 64,
    fontSize: 10.5,
    fontFamily: "Helvetica",
    color: "#1b2a2a",
    lineHeight: 1.45,
  },
  h1: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    color: "#1b2a2a",
  },
  h2: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    color: "#0f766e",
  },
  h3: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 10 },
  p: { marginTop: 6 },
  li: { marginTop: 3, marginLeft: 12 },
  quote: {
    marginTop: 8,
    marginLeft: 8,
    paddingLeft: 8,
    borderLeft: "2 solid #e8622b",
    color: "#374151",
  },
  // Capped height, not natural size: a 1440x900 screenshot at full page width
  // is ~310pt tall and pushes most sections onto a second page. The document is
  // meant to be short.
  shot: {
    marginTop: 14,
    height: 190,
    objectFit: "contain",
    border: "1 solid #d6d3cb",
    borderRadius: 3,
  },
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

export function ProductOverviewDocument({ data }: { data: OverviewPdfData }) {
  return (
    <Document title={data.title}>
      <Page size="A4" style={styles.cover}>
        <BrandMark />
        <Text style={styles.coverTitle}>{data.title}</Text>
        <Text style={styles.coverSub}>{data.subtitle}</Text>
        <Text style={styles.coverMeta}>
          {`${data.version} · ${data.generatedOn}`}
        </Text>
        <View style={styles.coverToc}>
          {data.sections.map((section) => (
            <Text key={section.title} style={styles.tocItem}>
              {section.title}
            </Text>
          ))}
        </View>
      </Page>

      {data.sections.map((section) => (
        <Page key={section.title} size="A4" style={styles.page}>
          {section.blocks.map((block, i) => (
            // Index keys: a flat, immutable rendering of one section, produced
            // in order and never reordered.
            <Block key={`${section.title}-${i}`} block={block} />
          ))}
          {section.imageSrc && (
            <Image src={section.imageSrc} style={styles.shot} />
          )}
          <Text style={styles.footer} fixed>
            {data.footer}
          </Text>
        </Page>
      ))}
    </Document>
  );
}
