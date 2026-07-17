import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal",
};

// Compliance-sensitive content — text below is used verbatim as specified,
// not paraphrased. Change the wording here only on explicit instruction.
export default function LegalPage() {
  return (
    <div className="bg-ivory">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="font-heading text-3xl font-bold text-teal min-[860px]:text-4xl">
          Legal
        </h1>

        <div className="mt-12 flex flex-col gap-10">
          <section>
            <h2 className="font-heading text-lg font-bold text-teal">
              This website
            </h2>
            <p className="mt-3 text-base text-teal/80">
              This website is operated by Verumsell SRL. It does not use
              tracking cookies or analytics at this time, and collects no
              personal data through forms — the only interactive element is a
              mailto: link to contact@verumsell.com. If that changes, this page
              will be updated to reflect it.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-teal">
              How the Statura Labs Dynamics product handles data
            </h2>
            <p className="mt-3 text-base text-teal/80">
              The Statura Labs Dynamics product — as used in a pilot or
              deployment, separate from this website — processes camera video
              entirely on-device. Video frames are never stored or transmitted;
              only anonymous body-joint coordinates are used, tied to a
              workstation, never to a named individual. Statura Labs Dynamics is
              designed to meet the relevant requirements of the EU AI Act and
              GDPR from the development phase onward. Final regulatory
              classification will be confirmed by a formal legal opinion prior
              to commercial launch. Full technical documentation is available on
              request for prospective pilot partners.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-teal">
              Terms of use
            </h2>
            <p className="mt-3 text-base text-teal/80">
              Content on this website is provided for general information about
              Statura Labs Dynamics and is not a binding offer. All content, the
              Statura Labs Dynamics name, and associated marks are the property
              of Verumsell SRL. Nothing on this site constitutes professional,
              medical, or legal advice.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-teal">
              Company information
            </h2>
            <p className="mt-3 text-base text-teal/80">
              Verumsell SRL · CUI 51132090 · J2025002367001
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-teal">
              Contact
            </h2>
            <p className="mt-3 text-base text-teal/80">
              Questions about privacy or this website:{" "}
              <a href="mailto:contact@verumsell.com" className="underline">
                contact@verumsell.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
