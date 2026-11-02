// Rebuild a query string from a Next.js searchParams object, for redirect
// stubs that must preserve query (e.g. ?present=1, ?planId=) when forwarding a
// moved URL to its new location. Returns "" or "?a=1&b=2".
export function forwardQuery(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
    }
  }
  return parts.length ? `?${parts.join("&")}` : "";
}
