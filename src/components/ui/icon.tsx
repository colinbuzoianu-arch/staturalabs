import type { IconName } from "@/lib/modules/registry";

// Minimal inline-SVG icon set for the P2 proposal, one glyph per registry
// IconName. Deliberately dependency-free: the real build adopts lucide-react
// (proposed in the design showcase) — this keeps the sidebar/showcase
// reviewable now without presuming that install. Simple 20x20 line glyphs,
// currentColor stroke, so they inherit the sidebar's text colour.
const PATHS: Record<IconName, string> = {
  cockpit: "M3 12a9 9 0 0 1 18 0M12 12l4-2M12 12v0", // gauge
  inbox: "M3 13h4l2 3h6l2-3h4M4 13V5h16v8", // inbox tray
  "clipboard-check": "M9 4h6v2H9zM7 6h10v14H7zM9 13l2 2 4-4", // clipboard + check
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4", // magnifier
  "alert-triangle": "M12 4 2 20h20L12 4zM12 10v5M12 18v0", // warning
  leaf: "M5 19C5 10 12 5 19 5c0 9-7 14-14 14zM5 19c3-5 7-8 11-9", // leaf
  target:
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11v2", // target
  flask: "M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7 15h10", // flask
  "graduation-cap": "M2 9l10-4 10 4-10 4L2 9zM6 11v5c0 1 3 2 6 2s6-1 6-2v-5", // cap
  users:
    "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 6-5s6 2 6 5M16 11a3 3 0 1 0-1-6M22 20c0-3-2-5-5-5", // people
  scale:
    "M12 3v18M6 21h12M12 5 5 9m7-4 7 4M5 9l-2 4a3 3 0 0 0 6 0L5 9zm14 0-2 4a3 3 0 0 0 6 0l-4-4z", // scales
  folder:
    "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z", // folder
  "bar-chart": "M4 20V4M4 20h16M8 20v-6M13 20V9M18 20v-9", // bars
  settings:
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2l1.5 2.5 3-.5.5 3L19.5 9 18 12l1.5 3-2.5 1.5-.5 3-3-.5L12 22l-1.5-2.5-3 .5-.5-3L4.5 15 6 12 4.5 9 7 7.5l.5-3 3 .5L12 2z", // gear
};

export function Icon({
  name,
  className,
  size = 20,
}: {
  name: IconName;
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
