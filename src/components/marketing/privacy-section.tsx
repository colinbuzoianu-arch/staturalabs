import { Eyebrow } from "./eyebrow";

const ITEMS = [
  {
    heading: "No video is ever stored",
    description:
      "Frames are processed and discarded on-device, in the browser. Nothing is saved, nothing leaves the machine as video.",
  },
  {
    heading: "No identity data, anywhere",
    description:
      "Every measurement is tied to a workstation — never to a name, a face, or an employee record.",
  },
  {
    heading: "EU-minded from day one",
    description:
      "Architecture built around GDPR data minimization and current AI Act guidance, not retrofitted after the fact.",
  },
] as const;

export function PrivacySection() {
  return (
    <section className="bg-teal">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <Eyebrow>Built for privacy, not around it</Eyebrow>
        <h2 className="mt-4 max-w-2xl font-heading text-3xl font-bold text-ivory">
          The camera sees a posture. It never sees a person.
        </h2>

        <div className="mt-14 grid grid-cols-1 gap-10 min-[860px]:grid-cols-3 min-[860px]:gap-8">
          {ITEMS.map((item) => (
            <div key={item.heading} className="flex flex-col gap-3">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-coral"
              />
              <h3 className="font-heading text-lg font-bold text-ivory">
                {item.heading}
              </h3>
              <p className="text-sm text-ivory/70">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
