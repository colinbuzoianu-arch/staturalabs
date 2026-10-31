import type { NextConfig } from "next";
import { LEGACY_REDIRECTS } from "./src/lib/routes/legacy-redirects";

const nextConfig: NextConfig = {
  // Permanent redirects from the pre-/app URL structure to the new /app tree
  // (SLD_RESTRUCTURE_PLAN_platform-modules.md §2.3). The map is shared data in
  // src/lib/routes/legacy-redirects.ts so it stays the single source and is
  // unit-tested (legacy-redirects.test.ts).
  async redirects() {
    return LEGACY_REDIRECTS.map((r) => ({ ...r }));
  },
};

export default nextConfig;
