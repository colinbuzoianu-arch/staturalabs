// Reused verbatim across every section: mono, coral, tracked, uppercase —
// defined once in the hero spec, reused by name ("eyebrow") for every
// other section without restating the treatment each time.
export function Eyebrow({ children }: { children: string }) {
  return (
    <p className="font-technical text-xs uppercase tracking-[0.2em] text-coral">
      {children}
    </p>
  );
}
