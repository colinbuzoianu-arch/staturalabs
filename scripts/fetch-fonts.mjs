// Provisions the self-hosted brand typefaces into /public/fonts, served from
// this app's own origin rather than pulled from the Google Fonts CDN at
// request time — same reasoning as scripts/fetch-pose-model.mjs (shop-floor
// networks often block arbitrary external domains).
//
// Google's CSS API (fonts.googleapis.com/css2) itself is only hit here, once,
// at predev/prebuild time — it responds with immutable, content-hashed
// fonts.gstatic.com file URLs, which is what actually gets downloaded to
// disk. That response varies by User-Agent (different formats/subsets), so
// a modern-Chrome UA is pinned below to get a stable woff2/latin result.
//
// Run via `npm run predev` / `npm run prebuild` (wired in package.json).
// Output is gitignored (public/fonts/) — re-run this script rather than
// committing the binaries.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outDir = path.join(projectRoot, "public", "fonts");

// Mimics a recent Chrome on Windows so Google's CSS API returns woff2 (not
// the older ttf/eot fallbacks it serves to unrecognized/legacy clients).
const CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// One entry per font file this app actually uses (CLAUDE.md design system:
// Outfit 400/700 for headings + the SLD logotype, Jura 500 for the brand
// wordmark, JetBrains Mono 400 for technical readouts).
const FONTS = [
  { family: "Outfit", weight: 400, filename: "outfit-400.woff2" },
  { family: "Outfit", weight: 700, filename: "outfit-700.woff2" },
  { family: "Jura", weight: 500, filename: "jura-500.woff2" },
  {
    family: "JetBrains Mono",
    weight: 400,
    filename: "jetbrains-mono-400.woff2",
  },
];

async function resolveLatinWoff2Url(family, weight) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
  const res = await fetch(cssUrl, {
    headers: { "User-Agent": CHROME_USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(
      `Failed to fetch Google Fonts CSS for ${family} ${weight}: ${res.status} ${res.statusText}`,
    );
  }
  const css = await res.text();

  // Google always labels the unrestricted-Latin block with this exact
  // comment; other blocks (cyrillic, greek-ext, latin-ext, ...) are scoped
  // via a narrower unicode-range and aren't what this app needs.
  const latinBlockMatch = css.match(/\/\* latin \*\/\s*@font-face\s*{[^}]+}/);
  if (!latinBlockMatch) {
    throw new Error(
      `No "latin" @font-face block found for ${family} ${weight}`,
    );
  }
  const urlMatch = latinBlockMatch[0].match(/url\((https:\/\/[^)]+\.woff2)\)/);
  if (!urlMatch) {
    throw new Error(`No woff2 url found for ${family} ${weight}`);
  }
  return urlMatch[1];
}

async function fetchFont({ family, weight, filename }) {
  const fontFileUrl = await resolveLatinWoff2Url(family, weight);
  const dest = path.join(outDir, filename);
  console.log(
    `Fetching ${family} ${weight} -> ${path.relative(projectRoot, dest)}`,
  );
  const res = await fetch(fontFileUrl);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch font file for ${family} ${weight}: ${res.status} ${res.statusText}`,
    );
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buffer);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  for (const font of FONTS) {
    await fetchFont(font);
  }
  console.log("Brand fonts ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
