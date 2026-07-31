// Source-of-truth copy — matches the reviewed prototype content exactly.
// de.ts/ro.ts are meaning-based translations of this, not word-for-word.
export const en = {
  header: {
    requestPilot: "Request a pilot",
    signIn: "Sign in",
  },
  hero: {
    eyebrow: "Measured motion // workplace ergonomics",
    h1: "Ergonomic risk, read like an instrument reads it.",
    lede: "Statura Labs Dynamics turns an ordinary camera into a precision ergonomics assessment tool. Trunk, neck, shoulder, elbow, and knee angles scored against ISO 11228 and EN 1005 — in real working conditions, not a lab.",
    ctaPrimary: "Request a pilot",
    ctaSecondary: "See how it works",
  },
  pipeline: {
    eyebrow: "The pipeline",
    heading: "From a single camera to a documented score.",
    steps: [
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
    ],
  },
  privacy: {
    eyebrow: "Built for privacy, not around it",
    heading: "The camera sees a posture. It never sees a person.",
    items: [
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
    heading: "Ergonomics is bigger than one camera angle.",
    notes: [
      {
        kicker: "Why this matters",
        heading: "What workplace ergonomics actually measures",
        paragraphs: [
          "Musculoskeletal disorders — back, shoulder, and knee strain from repeated or sustained awkward posture — remain one of the largest categories of occupational injury, and one of the hardest to catch early, because the damage accumulates from ordinary movements repeated thousands of times, not a single accident.",
          "A proper assessment doesn't look at one moment — it looks at posture, repetition, force, and duration together, region by region: trunk, neck, shoulders, elbows, knees. Statura's scoring engine follows that same logic, built on ISO 11228 and EN 1005 rather than a single simplified \"risk score.\"",
        ],
        roadmapNote: null as string | null,
      },
      {
        kicker: "Capture flexibility",
        heading: "Fixed, handheld, and what's next",
        paragraphs: [
          "Today, Statura works with any camera a browser can access — a laptop or USB camera mounted once at a workstation for repeated audits, or a phone carried by an assessor from station to station across a facility. No proprietary hardware, no wearables.",
        ],
        roadmapNote:
          "In development: a dedicated close-range capture mode for regions a full-body shot can't resolve well — wrist and hand posture in particular. Not yet part of the product.",
      },
      {
        kicker: "Beyond posture",
        heading: "Adding load, force, and tools to the picture",
        paragraphs: [
          "Posture alone doesn't tell the whole story — a moderate forward bend holding nothing is a different risk than the same bend holding 20kg. Alongside every posture capture, Statura logs the manual context that shapes real risk: object weight, push/pull force, and the tool in use, entered by whoever is running the assessment.",
          "These aren't guesses layered on top of a score — they're structured data points tied to the same task and workstation, visible together in every report.",
        ],
        roadmapNote: null as string | null,
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
    ],
  },
  finalCta: {
    statusLine:
      "Currently in technical pilot with industrial manufacturing partners.",
    heading: "See it measure your own floor.",
    cta: "Request a pilot",
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
      "Statura Labs Dynamics started from a simple frustration: ergonomic risk in industrial workplaces is usually assessed by eye, on a clipboard, once a year if at all — not because anyone doesn't care, but because proper instrumented assessment has always meant wearables, specialized sensors, or an outside consultant's time. We set out to build something that runs on a camera you probably already own.",
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
    dataHandling: {
      heading: "How the Statura Labs Dynamics product handles data",
      paragraph:
        "The Statura Labs Dynamics product — as used in a pilot or deployment, separate from this website — processes camera video entirely on-device. Video frames are never stored or transmitted; only anonymous body-joint coordinates are used, tied to a workstation, never to a named individual. Statura Labs Dynamics is designed to meet the relevant requirements of the EU AI Act and GDPR from the development phase onward. Final regulatory classification will be confirmed by a formal legal opinion prior to commercial launch. Full technical documentation is available on request for prospective pilot partners.",
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
  },
};
