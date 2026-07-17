import { Eyebrow } from "./eyebrow";

const STANDARDS = [
  { tag: "ISO 11228", label: "Manual handling & static posture" },
  { tag: "EN 1005", label: "Human physical performance in machinery" },
] as const;

export function StandardsSection() {
  return (
    <section className="bg-ivory">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-24 min-[860px]:grid-cols-2 min-[860px]:gap-16">
        <div>
          <Eyebrow>Grounded, not guessed</Eyebrow>
          <h2 className="mt-4 font-heading text-3xl font-bold text-teal">
            Scored against real engineering standards.
          </h2>
          <p className="mt-6 text-base text-teal/70">
            Every threshold in Statura's scoring engine is built on established
            occupational ergonomics standards — not a proprietary black box, and
            not a borrowed methodology from a system we don't own.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {STANDARDS.map((s) => (
            <div
              key={s.tag}
              className="rounded-lg border border-sage-dark/40 p-6"
            >
              <p className="font-technical text-sm font-bold tracking-[0.1em] text-coral">
                {s.tag}
              </p>
              <p className="mt-2 font-heading text-lg font-bold text-teal">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
