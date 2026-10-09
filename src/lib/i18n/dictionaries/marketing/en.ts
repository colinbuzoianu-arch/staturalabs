// Source-of-truth copy — matches the reviewed prototype content exactly.
// de.ts/ro.ts are meaning-based translations of this, not word-for-word.
export const en = {
  header: {
    requestPilot: "Request a pilot",
    signIn: "Sign in",
  },
  // The "/" country-chooser page — SLD_IMPLEMENTATION_PLAN_austria-first.md
  // §4.2: a real page with explicit links, never a geo-redirect.
  countryChooser: {
    metaTitle: "Choose your market",
    eyebrow: "Choose your market",
    h1: "Statura Labs Dynamics, by market.",
    lede: "Legal limits, terminology, and the generated document all follow the country a workplace is actually in — not the other way around. Pick yours.",
    countryLabels: { at: "Austria", de: "Germany", ch: "Switzerland" },
    statusAvailable: "Available",
    statusInPreparation: "In preparation",
  },
  hero: {
    eyebrow: "Measured motion // workplace ergonomics",
    h1: "Ergonomic risk, read like an instrument reads it.",
    lede: "Statura Labs Dynamics turns ergonomic risk assessment into a precision instrument. An assessor classifies the posture they observe — trunk, neck, shoulder, elbow, wrist, knee — scored against ISO 11228 and EN 1005, in real working conditions, not a lab. No camera, no video, no personal data.",
    ctaPrimary: "Request a pilot",
    ctaSecondary: "See how it works",
  },
  pipeline: {
    eyebrow: "The pipeline",
    heading: "From a structured observation to a documented score.",
    steps: [
      {
        step: "01 / ASSESS",
        heading: "Classify the posture at the workstation",
        description:
          "No camera, no wearables, no sensors. A trained assessor records the posture they observe.",
      },
      {
        step: "02 / RECORD",
        heading: "Posture and context captured as data",
        description:
          "Observed posture categories, plus load, force, and duration — entered directly. No footage is involved at any point.",
      },
      {
        step: "03 / SCORE",
        heading: "Angles are checked, region by region",
        description:
          "Trunk, neck, shoulder, elbow, wrist, knee — each scored against ISO 11228 / EN 1005.",
      },
      {
        step: "04 / REPORT",
        heading: "A record your EHS file can use",
        description:
          "A documented report, not just a dashboard — ready to hand to someone else.",
      },
    ],
  },
  privacy: {
    eyebrow: "Built for privacy, not around it",
    heading: "It assesses a posture, never a person.",
    items: [
      {
        heading: "No camera, no video, anywhere",
        description:
          "There is no camera in the loop and no footage to store, stream, or leak. An assessment is a set of structured observations — posture categories and measured values — nothing more.",
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
    ],
  },
  standards: {
    eyebrow: "Grounded, not guessed",
    heading: "Scored against real engineering standards.",
    paragraph:
      "Every threshold in Statura's scoring engine is built on established occupational ergonomics standards — not a proprietary black box, and not a borrowed methodology from a system we don't own.",
    cards: [
      { tag: "ISO 11228", label: "Manual handling & static posture" },
      { tag: "EN 1005", label: "Human physical performance in machinery" },
    ],
  },
  fieldNotes: {
    eyebrow: "Field notes",
    heading: "Ergonomics is bigger than a single snapshot.",
    notes: [
      {
        kicker: "Why this matters",
        heading: "What workplace ergonomics actually measures",
        paragraphs: [
          "Musculoskeletal disorders — back, shoulder, and knee strain from repeated or sustained awkward posture — remain one of the largest categories of occupational injury, and one of the hardest to catch early, because the damage accumulates from ordinary movements repeated thousands of times, not a single accident.",
          "A proper assessment doesn't look at one moment — it looks at posture, repetition, force, and duration together, region by region: trunk, neck, shoulders, elbows, wrists, knees. Statura's scoring engine follows that same logic, built on ISO 11228 and EN 1005 rather than a single simplified \"risk score.\"",
        ],
        roadmapNote: null as string | null,
      },
      {
        kicker: "How assessment works",
        heading: "Structured observation, not a camera feed",
        paragraphs: [
          "Statura doesn't watch your workers. A trained assessor classifies the posture they observe at each workstation — trunk, neck, shoulders, elbows, wrists, knees — and records the load, force, and duration that shape real risk. No proprietary hardware, no wearables, no camera, no footage. It takes the method a certified ergonomist already uses on the floor and makes it consistent, versioned, and documented.",
        ],
        roadmapNote: null as string | null,
      },
      {
        kicker: "Beyond posture",
        heading: "Adding load, force, and tools to the picture",
        paragraphs: [
          "Posture alone doesn't tell the whole story — a moderate forward bend holding nothing is a different risk than the same bend holding 20kg. Alongside every posture assessment, Statura logs the manual context that shapes real risk: object weight, push/pull force, and the tool in use, entered by whoever is running the assessment.",
          "These aren't guesses layered on top of a score — they're structured data points tied to the same task and workstation, visible together in every report.",
        ],
        roadmapNote: null as string | null,
      },
      {
        kicker: "On the roadmap",
        heading: "Shared human-robot workspaces",
        paragraphs: [
          "Understanding how a body moves through a workspace is a natural starting point for a related but distinct question: how humans and robots share space safely on the same shop floor.",
        ],
        roadmapNote:
          "This is a direction we're exploring, not a shipped feature. Safety monitoring in shared human-robot environments sits under a different regulatory regime than ergonomics assessment (functional safety standards, not just data protection), and any capability here will go through its own dedicated compliance review before release — not inherited from the ergonomics product around it.",
      },
    ],
  },
  finalCta: {
    statusLine:
      "Currently in technical pilot with industrial manufacturing partners.",
    heading: "See it measure your own floor.",
    cta: "Request a pilot",
  },
  // Rendered by CountryContextSection on a /[country] homepage — see
  // SLD_IMPLEMENTATION_PLAN_austria-first.md §4.1/§4.2. The verified
  // branch's actual terminology/positioning line comes from the country
  // pack (src/lib/country/packs/**), not from here; this dictionary only
  // holds the section chrome, which stays the same shape across markets.
  countryContext: {
    eyebrow: "Built for this market",
    verifiedHeading: "Speaking your regulator's language.",
    unverifiedHeading: "This market's legal framing is still in preparation.",
    unverifiedNote:
      "We haven't yet checked this market's legal references and terminology against a primary source. Rather than guess, this page stays positioning-only until that review is done.",
  },
  footer: {
    about: "About",
    legal: "Legal",
    copyright: (year: number) =>
      `© ${year} Verumsell SRL · Statura Labs Dynamics is a product of Verumsell SRL`,
  },
  about: {
    metaTitle: "About",
    eyebrow: "About",
    h1: "Built to measure what used to be guessed.",
    paragraphs: [
      "Statura Labs Dynamics started from a simple frustration: ergonomic risk in industrial workplaces is usually assessed by eye, on a clipboard, once a year if at all — not because anyone doesn't care, but because proper instrumented assessment has always meant wearables, specialized sensors, or an outside consultant's time. We set out to build something that brings that rigor to any assessor on the floor, with no special hardware — and no camera — at all.",
      "Statura is built by an engineer with a background in industrial occupational health and safety systems, developed under Verumsell SRL, a Romania-based software studio. The product is in active technical pilot with industrial manufacturing partners. We're building it deliberately and in the open about what's proven versus what's still in development, rather than rushing a polished claim ahead of the evidence.",
    ],
    grounded: {
      eyebrow: "Grounded, not guessed",
      paragraph:
        "Every threshold in Statura's scoring engine is built on established occupational ergonomics standards — ISO 11228 and EN 1005 — not a proprietary black box. The architecture was built around data minimization and current AI Act guidance from the first line of code, not retrofitted after the fact.",
    },
    whereWeAreNow: {
      eyebrow: "Where we are now",
      paragraph:
        "Statura Labs Dynamics is currently in technical pilot with industrial manufacturing partners, not yet a commercial product. If you want to see it measure a real workstation, we'd like to hear from you.",
    },
    cta: "Request a pilot",
  },
  legal: {
    metaTitle: "Legal",
    h1: "Legal",
    thisWebsite: {
      heading: "This website",
      paragraph:
        "This website is operated by Verumsell SRL. It does not use tracking cookies or analytics at this time, and collects no personal data through forms — the only interactive element is a mailto: link to contact@verumsell.com. If that changes, this page will be updated to reflect it.",
    },
    // REVIEW REQUIRED (2026-10-09, colinbuzoianu): this paragraph was
    // rewritten to remove the previous "processes camera video on-device"
    // wording after camera capture was removed from the product for GDPR.
    // It is compliance-sensitive legal copy — have it checked by legal
    // before commercial launch, same standing as the jurisdictionNotice
    // below. The de/ro translations below carry the same requirement.
    dataHandling: {
      heading: "How the Statura Labs Dynamics product handles data",
      paragraph:
        "The Statura Labs Dynamics product — as used in a pilot or deployment, separate from this website — does not use a camera and does not capture, record, store, or transmit any video or images. An assessment is recorded as structured observations: posture classifications and measured values such as load, force, and duration, entered by a trained assessor and tied to a workstation, never to a named individual. Statura Labs Dynamics is designed to meet the relevant requirements of the EU AI Act and GDPR from the development phase onward. Final regulatory classification will be confirmed by a formal legal opinion prior to commercial launch. Full technical documentation is available on request for prospective pilot partners.",
    },
    terms: {
      heading: "Terms of use",
      paragraph:
        "Content on this website is provided for general information about Statura Labs Dynamics and is not a binding offer. All content, the Statura Labs Dynamics name, and associated marks are the property of Verumsell SRL. Nothing on this site constitutes professional, medical, or legal advice.",
    },
    company: {
      heading: "Company information",
      paragraph: "Verumsell SRL · CUI 51132090 · J2025002367001",
    },
    contact: {
      heading: "Contact",
      prefix: "Questions about privacy or this website:",
    },
    // Shown on every /[country]/legal page — see
    // SLD_IMPLEMENTATION_PLAN_austria-first.md §7 B1: the content above
    // applies EU-wide and is already reviewed; a jurisdiction-specific
    // variant (an Austrian Offenlegung under §5 ECG, a German Impressum
    // under the DDG, Swiss revDSG framing) is new verbatim text that
    // still needs legal review, not something to paraphrase here.
    jurisdictionNotice: {
      heading: "Jurisdiction-specific notice",
      paragraph:
        "A jurisdiction-specific variant of this page for this market (for example an Austrian Offenlegung under §5 ECG, a German Impressum under the DDG, or Swiss-specific framing under revDSG) is in preparation and pending legal review. The content above applies EU-wide and remains accurate in the meantime.",
    },
  },
};
