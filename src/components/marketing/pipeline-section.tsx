import { Eyebrow } from "./eyebrow";

const STEPS = [
  {
    step: "01 / CAPTURE",
    heading: "Point a camera at the workstation",
    description:
      "No wearables, no sensors to install. Any laptop or USB camera works.",
  },
  {
    step: "02 / ANALYZE",
    heading: "Posture is read on-device",
    description:
      "Pose estimation runs in the browser. Video is never stored or transmitted.",
  },
  {
    step: "03 / SCORE",
    heading: "Angles are checked, region by region",
    description:
      "Trunk, neck, shoulder, elbow, knee — each scored against ISO 11228 / EN 1005.",
  },
  {
    step: "04 / REPORT",
    heading: "A record your EHS file can use",
    description:
      "A documented report, not just a dashboard — ready to hand to someone else.",
  },
] as const;

export function PipelineSection() {
  return (
    <section id="pipeline" className="scroll-mt-20 bg-ivory">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <Eyebrow>The pipeline</Eyebrow>
        <h2 className="mt-4 max-w-2xl font-heading text-3xl font-bold text-teal">
          From a single camera to a documented score.
        </h2>

        <div className="mt-14 grid grid-cols-1 gap-10 min-[860px]:grid-cols-4 min-[860px]:gap-8">
          {STEPS.map((item) => (
            <div key={item.step} className="border-t border-sage-dark/40 pt-5">
              <p className="font-technical text-xs tracking-[0.15em] text-sage-dark">
                {item.step}
              </p>
              <h3 className="mt-3 font-heading text-lg font-bold text-teal">
                {item.heading}
              </h3>
              <p className="mt-2 text-sm text-teal/70">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
