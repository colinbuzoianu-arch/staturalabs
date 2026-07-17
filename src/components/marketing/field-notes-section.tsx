import Image from "next/image";
import { Eyebrow } from "./eyebrow";

type FieldNote = {
  kicker: string;
  heading: string;
  paragraphs: readonly string[];
  // Present only on the two genuinely-not-shipped items. Rendered with a
  // deliberately distinct, lower-confidence treatment (dashed border,
  // smaller mono type, muted color) — this is not decorative variety, it's
  // the only thing stopping a roadmap idea from reading as a shipped
  // capability. Never style this the same as `paragraphs`.
  roadmapNote?: string;
};

const NOTES: readonly FieldNote[] = [
  {
    kicker: "Why this matters",
    heading: "What workplace ergonomics actually measures",
    paragraphs: [
      "Musculoskeletal disorders — back, shoulder, and knee strain from repeated or sustained awkward posture — remain one of the largest categories of occupational injury, and one of the hardest to catch early, because the damage accumulates from ordinary movements repeated thousands of times, not a single accident.",
      "A proper assessment doesn't look at one moment — it looks at posture, repetition, force, and duration together, region by region: trunk, neck, shoulders, elbows, knees. Statura's scoring engine follows that same logic, built on ISO 11228 and EN 1005 rather than a single simplified \"risk score.\"",
    ],
  },
  {
    kicker: "Capture flexibility",
    heading: "Fixed, handheld, and what's next",
    paragraphs: [
      "Today, Statura works with any camera a browser can access — a laptop or USB camera mounted once at a workstation for repeated audits, or carried by an assessor from station to station across a facility. No proprietary hardware, no wearables.",
    ],
    roadmapNote:
      "In development: a dedicated mobile capture mode for close-range assessment of specific regions — like wrist and hand posture — that a full-body shot can't resolve well. Not yet part of the product.",
  },
  {
    kicker: "Beyond posture",
    heading: "Adding load, force, and tools to the picture",
    paragraphs: [
      "Posture alone doesn't tell the whole story — a moderate forward bend holding nothing is a different risk than the same bend holding 20kg. Alongside every posture capture, Statura logs the manual context that shapes real risk: object weight, push/pull force, and the tool in use, entered by whoever is running the assessment.",
      "These aren't guesses layered on top of a score — they're structured data points tied to the same task and workstation, visible together in every report.",
    ],
  },
  {
    kicker: "On the roadmap",
    heading: "Shared human-robot workspaces",
    paragraphs: [
      "The same on-device pose engine that reads human posture is a natural starting point for a related but distinct question: how humans and robots share space safely on the same shop floor.",
    ],
    roadmapNote:
      "This is a direction we're exploring, not a shipped feature. Safety monitoring in shared human-robot environments sits under a different regulatory regime than ergonomics assessment (functional safety standards, not just data protection), and any capability here will go through its own dedicated compliance review before release — not inherited from the ergonomics product around it.",
  },
] as const;

export function FieldNotesSection() {
  return (
    <section className="relative isolate overflow-hidden bg-ivory">
      <Image
        src="/bg/statura_bg_light.svg"
        alt=""
        aria-hidden="true"
        fill
        unoptimized
        className="-z-20 object-cover opacity-20"
      />
      {/* Scrim over the texture — same principle as the hero's gradient
          over statura_bg_dark.svg: the pattern is decoration, not
          something the four text blocks have to compete with. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ivory/85" />

      <div className="relative mx-auto max-w-6xl px-6 py-24">
        <Eyebrow>Field notes</Eyebrow>
        <h2 className="mt-4 max-w-2xl font-heading text-3xl font-bold text-teal">
          Ergonomics is bigger than one camera angle.
        </h2>

        <div className="mt-14 grid grid-cols-1 gap-10 min-[860px]:grid-cols-2 min-[860px]:gap-x-12 min-[860px]:gap-y-14">
          {NOTES.map((note) => (
            <article key={note.kicker} className="flex flex-col gap-3">
              <p className="font-technical text-xs uppercase tracking-[0.15em] text-coral">
                {note.kicker}
              </p>
              <h3 className="font-heading text-lg font-bold text-teal">
                {note.heading}
              </h3>
              {note.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-sm text-teal/70">
                  {paragraph}
                </p>
              ))}
              {note.roadmapNote && (
                <p className="mt-2 border-t border-dashed border-sage-dark/50 pt-3 font-technical text-xs text-sage-dark">
                  {note.roadmapNote}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
