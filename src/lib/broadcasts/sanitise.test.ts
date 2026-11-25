import { describe, expect, it } from "vitest";
import { broadcastBodyToText, sanitiseBroadcastBody } from "./sanitise";

describe("sanitiseBroadcastBody", () => {
  it("keeps the allowed formatting tags", () => {
    const out = sanitiseBroadcastBody(
      "<p>Bitte <strong>Schutzbrille</strong> tragen.</p><ul><li>Halle 2</li></ul>",
    );
    expect(out).toBe(
      "<p>Bitte <strong>Schutzbrille</strong> tragen.</p><ul><li>Halle 2</li></ul>",
    );
  });
  it("removes a script element with its content", () => {
    const out = sanitiseBroadcastBody(
      "<p>Hallo</p><script>alert('x')</script>",
    );
    expect(out).toBe("<p>Hallo</p>");
    expect(out).not.toContain("alert");
  });
  it("removes style, iframe and svg payloads", () => {
    expect(sanitiseBroadcastBody("<style>body{}</style>ok")).toBe("ok");
    expect(sanitiseBroadcastBody('<iframe src="x"></iframe>ok')).toBe("ok");
    expect(sanitiseBroadcastBody("<svg onload=1></svg>ok")).toBe("ok");
  });
  it("strips every attribute, including inline handlers", () => {
    const out = sanitiseBroadcastBody(
      '<p onclick="steal()" style="color:red">Text</p>',
    );
    expect(out).toBe("<p>Text</p>");
  });
  it("keeps a safe link and forces rel/target", () => {
    const out = sanitiseBroadcastBody(
      '<a href="https://example.org/regeln">Regeln</a>',
    );
    expect(out).toContain('href="https://example.org/regeln"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('target="_blank"');
  });
  it("drops a javascript: or data: link entirely", () => {
    expect(sanitiseBroadcastBody('<a href="javascript:alert(1)">x</a>')).toBe(
      "x",
    );
    expect(sanitiseBroadcastBody('<a href="data:text/html,x">x</a>')).toBe("x");
  });
  it("drops unknown tags but keeps their text", () => {
    expect(sanitiseBroadcastBody("<blink>wichtig</blink>")).toBe("wichtig");
  });
  it("escapes a stray less-than so nothing renders broken", () => {
    expect(sanitiseBroadcastBody("5 < 7")).toBe("5 &lt; 7");
  });
  it("normalises a self-closing br", () => {
    expect(sanitiseBroadcastBody("a<br>b")).toBe("a<br />b");
  });
  it("removes comments", () => {
    expect(sanitiseBroadcastBody("<!-- hidden -->sichtbar")).toBe("sichtbar");
  });
});

describe("broadcastBodyToText", () => {
  it("renders the plain-text form used for e-mail and the PDF", () => {
    expect(
      broadcastBodyToText(
        "<p>Bitte <strong>Schutzbrille</strong> tragen.</p><ul><li>Halle 2</li><li>Halle 3</li></ul>",
      ),
    ).toBe("Bitte Schutzbrille tragen.\n\n- Halle 2\n- Halle 3");
  });
  it("turns line breaks into newlines and decodes entities", () => {
    expect(broadcastBodyToText("a<br />b &amp; c")).toBe("a\nb & c");
  });
});
