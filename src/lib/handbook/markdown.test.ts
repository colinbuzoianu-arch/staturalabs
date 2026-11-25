import { describe, expect, it } from "vitest";
import {
  handbookMarkdownToText,
  headingId,
  renderHandbookMarkdown,
} from "./markdown";

describe("headingId", () => {
  it("transliterates umlauts rather than stripping them", () => {
    expect(headingId("Überprüfung der Evaluierung")).toBe(
      "ueberpruefung-der-evaluierung",
    );
    expect(headingId("Maßnahmen")).toBe("massnahmen");
  });
  it("collapses punctuation and trims", () => {
    expect(headingId("Was Sie sehen — danach!")).toBe("was-sie-sehen-danach");
  });
});

describe("renderHandbookMarkdown", () => {
  it("renders headings with anchors and collects them", () => {
    const { html, headings } = renderHandbookMarkdown(
      "# Titel\n\nText.\n\n## Unterpunkt",
    );
    expect(html).toContain('<h1 id="titel">Titel</h1>');
    expect(html).toContain("<p>Text.</p>");
    expect(headings).toEqual([
      { level: 1, text: "Titel", id: "titel" },
      { level: 2, text: "Unterpunkt", id: "unterpunkt" },
    ]);
  });
  it("joins wrapped lines into one paragraph", () => {
    const { html } = renderHandbookMarkdown("Eine Zeile\nund noch eine.");
    expect(html).toBe("<p>Eine Zeile und noch eine.</p>");
  });
  it("renders bullet and ordered lists", () => {
    expect(renderHandbookMarkdown("- eins\n- zwei").html).toBe(
      "<ul><li>eins</li><li>zwei</li></ul>",
    );
    expect(renderHandbookMarkdown("1. eins\n2. zwei").html).toBe(
      "<ol><li>eins</li><li>zwei</li></ol>",
    );
  });
  it("switches list type without merging", () => {
    const { html } = renderHandbookMarkdown("- eins\n1. zwei");
    expect(html).toBe("<ul><li>eins</li></ul>\n<ol><li>zwei</li></ol>");
  });
  it("renders emphasis, code, rules and quotes", () => {
    expect(renderHandbookMarkdown("**fett**").html).toContain(
      "<strong>fett</strong>",
    );
    expect(renderHandbookMarkdown("*kursiv*").html).toContain(
      "<em>kursiv</em>",
    );
    expect(renderHandbookMarkdown("`code`").html).toContain(
      "<code>code</code>",
    );
    expect(renderHandbookMarkdown("---").html).toBe("<hr />");
    expect(renderHandbookMarkdown("> Hinweis").html).toBe(
      "<blockquote><p>Hinweis</p></blockquote>",
    );
  });
  it("does not process markup inside code", () => {
    const { html } = renderHandbookMarkdown("`**nicht fett**`");
    expect(html).toContain("<code>**nicht fett**</code>");
    expect(html).not.toContain("<strong>");
  });
  it("renders a fenced block as preformatted, escaped", () => {
    const { html } = renderHandbookMarkdown("```\n<b>x</b>\n```");
    expect(html).toBe("<pre><code>&lt;b&gt;x&lt;/b&gt;</code></pre>");
  });
  it("renders in-app links and marks external ones", () => {
    expect(renderHandbookMarkdown("[Hilfe](/app/help)").html).toContain(
      '<a href="/app/help">Hilfe</a>',
    );
    const external = renderHandbookMarkdown(
      "[RIS](https://ris.bka.gv.at)",
    ).html;
    expect(external).toContain('target="_blank"');
    expect(external).toContain('rel="noopener noreferrer"');
  });
  it("drops an unsafe link to plain text so the CI check can flag it", () => {
    const { html } = renderHandbookMarkdown("[x](javascript:alert(1))");
    expect(html).not.toContain("<a");
    expect(html).toContain("javascript:alert(1)");
  });
  it("escapes raw HTML in the source — a chapter cannot inject markup", () => {
    const { html } = renderHandbookMarkdown("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
  it("renders an image", () => {
    expect(
      renderHandbookMarkdown("![Seitenleiste](/handbuch/img/sidebar.png)").html,
    ).toContain('<img src="/handbuch/img/sidebar.png" alt="Seitenleiste"');
  });
});

describe("handbookMarkdownToText", () => {
  it("strips markup for the PDF and the search index", () => {
    expect(
      handbookMarkdownToText(
        "# Titel\n\n**fett** und [Link](/app) sowie `code`.\n\n- Punkt",
      ),
    ).toBe("Titel\n\nfett und Link sowie code.\n\n• Punkt");
  });
  it("drops images and fenced code entirely", () => {
    expect(handbookMarkdownToText("![x](/a.png)\n\n```\ncode\n```")).toBe("");
  });
});
