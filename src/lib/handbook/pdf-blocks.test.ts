import { describe, expect, it } from "vitest";
import { markdownToPdfBlocks } from "./pdf-blocks";

describe("markdownToPdfBlocks", () => {
  it("maps headings to their own kinds", () => {
    expect(markdownToPdfBlocks("# A\n\n## B\n\n### C")).toEqual([
      { kind: "h1", text: "A" },
      { kind: "h2", text: "B" },
      { kind: "h3", text: "C" },
    ]);
  });
  it("keeps a deeper heading visible as an h3 rather than dropping it", () => {
    expect(markdownToPdfBlocks("#### Tief")).toEqual([
      { kind: "h3", text: "Tief" },
    ]);
  });
  it("joins wrapped lines into one paragraph", () => {
    expect(markdownToPdfBlocks("Eine Zeile\nund noch eine.")).toEqual([
      { kind: "p", text: "Eine Zeile und noch eine." },
    ]);
  });
  it("strips inline markup — a printed page has no hover and no click", () => {
    expect(
      markdownToPdfBlocks("**fett**, *kursiv*, `code` und [Link](/app)."),
    ).toEqual([{ kind: "p", text: "fett, kursiv, code und Link." }]);
  });
  it("renders a bullet as a bullet and a numbered step as a step", () => {
    expect(markdownToPdfBlocks("- Punkt")).toEqual([
      { kind: "li", text: "Punkt" },
    ]);
    // The step keeps its number and must NOT also get a bullet glyph (the PDF
    // read "• 1. Öffnen Sie …" before this distinction existed).
    expect(markdownToPdfBlocks("1. Öffnen Sie die Seite.")).toEqual([
      { kind: "step", text: "1. Öffnen Sie die Seite." },
    ]);
  });
  it("renders a blockquote", () => {
    expect(markdownToPdfBlocks("> Hinweis")).toEqual([
      { kind: "quote", text: "Hinweis" },
    ]);
  });
  it("drops fenced code and horizontal rules", () => {
    expect(markdownToPdfBlocks("```\nnpm run x\n```\n\n---\n\nText")).toEqual([
      { kind: "p", text: "Text" },
    ]);
  });
  it("drops images (the PDF has its own figures)", () => {
    expect(markdownToPdfBlocks("![x](/handbuch/img/x.png)")).toEqual([]);
  });
});
