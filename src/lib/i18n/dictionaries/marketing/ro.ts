import type { en } from "./en";

// Meaning-based translation, not word-for-word — see CLAUDE.md i18n notes.
export const ro: typeof en = {
  header: {
    requestPilot: "Solicită un proiect pilot",
    signIn: "Autentificare",
  },
  hero: {
    eyebrow: "Mișcare măsurată // ergonomia la locul de muncă",
    h1: "Riscul ergonomic, citit ca de un instrument de măsură.",
    lede: "Statura Labs Dynamics transformă o cameră video obișnuită într-un instrument de evaluare ergonomică de precizie. Unghiurile trunchiului, gâtului, umărului, cotului și genunchiului sunt evaluate conform ISO 11228 și EN 1005 — în condiții reale de lucru, nu într-un laborator.",
    ctaPrimary: "Solicită un proiect pilot",
    ctaSecondary: "Vezi cum funcționează",
  },
  pipeline: {
    eyebrow: "Fluxul de lucru",
    heading: "De la o singură cameră la un scor documentat.",
    steps: [
      {
        step: "01 / CAPTURE",
        heading: "Îndreaptă o cameră spre locul de muncă",
        description:
          "Fără dispozitive purtabile, fără senzori de instalat. Funcționează cu orice cameră de laptop sau USB.",
      },
      {
        step: "02 / ANALYZE",
        heading: "Postura este analizată direct pe dispozitiv",
        description:
          "Estimarea posturii rulează în browser. Videoclipul nu este niciodată stocat sau transmis.",
      },
      {
        step: "03 / SCORE",
        heading: "Unghiurile sunt verificate, regiune cu regiune",
        description:
          "Trunchi, gât, umăr, cot, genunchi — fiecare evaluat conform ISO 11228 / EN 1005.",
      },
      {
        step: "04 / REPORT",
        heading: "Un document util pentru dosarul dumneavoastră SSM",
        description:
          "Un raport documentat, nu doar un tablou de bord — gata de predat mai departe.",
      },
    ],
  },
  privacy: {
    eyebrow: "Construit pentru confidențialitate, nu adăugat ulterior",
    heading: "Camera vede o postură. Nu vede niciodată o persoană.",
    items: [
      {
        heading: "Niciun videoclip nu este stocat vreodată",
        description:
          "Cadrele sunt procesate și eliminate direct pe dispozitiv, în browser. Nimic nu este salvat, nimic nu părăsește dispozitivul sub formă de video.",
      },
      {
        heading: "Nicio dată de identitate, nicăieri",
        description:
          "Fiecare măsurătoare este asociată unui loc de muncă — niciodată unui nume, unei fețe sau unui dosar de angajat.",
      },
      {
        heading: "Gândit pentru UE încă de la început",
        description:
          "Arhitectura este construită în jurul principiului minimizării datelor din RGPD și al recomandărilor actuale ale AI Act, nu adaptată ulterior.",
      },
    ],
  },
  standards: {
    eyebrow: "Fundamentat, nu ghicit",
    heading: "Evaluat conform unor standarde tehnice reale.",
    paragraph:
      "Fiecare prag din motorul de evaluare Statura se bazează pe standarde consacrate de ergonomie ocupațională — nu este o cutie neagră proprietară și nici o metodologie împrumutată dintr-un sistem care nu ne aparține.",
    cards: [
      { tag: "ISO 11228", label: "Manipulare manuală & postură statică" },
      {
        tag: "EN 1005",
        label: "Performanța fizică umană în raport cu utilajele",
      },
    ],
  },
  fieldNotes: {
    eyebrow: "Note de pe teren",
    heading: "Ergonomia înseamnă mai mult decât un singur unghi de cameră.",
    notes: [
      {
        kicker: "De ce contează",
        heading: "Ce măsoară de fapt ergonomia la locul de muncă",
        paragraphs: [
          "Afecțiunile musculo-scheletice — solicitarea spatelui, umărului și genunchiului cauzată de posturi incomode repetate sau susținute — rămân una dintre cele mai frecvente categorii de accidentări profesionale și una dintre cele mai greu de depistat din timp, pentru că vătămarea se acumulează din mișcări obișnuite repetate de mii de ori, nu dintr-un singur accident.",
          "O evaluare corectă nu se uită la un singur moment — ia în considerare împreună postura, repetitivitatea, forța și durata, regiune cu regiune: trunchi, gât, umeri, coate, genunchi. Motorul de evaluare Statura urmează aceeași logică, bazat pe ISO 11228 și EN 1005, nu pe un simplu „scor de risc” simplificat.",
        ],
        roadmapNote: null as string | null,
      },
      {
        kicker: "Flexibilitate în captură",
        heading: "Fixă, portabilă și ce urmează",
        paragraphs: [
          "Astăzi, Statura funcționează cu orice cameră accesibilă unui browser — o cameră de laptop sau USB montată permanent la un loc de muncă pentru audituri repetate, sau purtată de un evaluator de la o stație la alta în cadrul unei fabrici. Fără hardware proprietar, fără dispozitive purtabile.",
        ],
        roadmapNote:
          "În dezvoltare: un mod dedicat de captură mobilă pentru evaluarea la distanță mică a unor regiuni specifice — precum postura încheieturii și a mâinii — pe care o imagine de corp întreg nu le poate surprinde suficient de bine. Nu face încă parte din produs.",
      },
      {
        kicker: "Dincolo de postură",
        heading: "Adăugăm în ecuație greutatea, forța și uneltele",
        paragraphs: [
          "Postura, singură, nu spune toată povestea — o aplecare moderată fără nimic în mâini reprezintă un risc diferit față de aceeași aplecare cu 20 kg. Alături de fiecare captură de postură, Statura înregistrează contextul manual care determină riscul real: greutatea obiectului, forța de împingere/tragere și unealta folosită, introduse de persoana care realizează evaluarea.",
          "Acestea nu sunt presupuneri adăugate peste un scor — sunt date structurate, asociate aceleiași sarcini și aceluiași loc de muncă, vizibile împreună în fiecare raport.",
        ],
        roadmapNote: null as string | null,
      },
      {
        kicker: "Pe foaia de parcurs",
        heading: "Spații de lucru comune om-robot",
        paragraphs: [
          "Același motor de recunoaștere a posturii, care rulează direct pe dispozitiv și citește postura umană, este un punct de plecare firesc pentru o întrebare conexă, dar distinctă: cum împart oamenii și roboții în siguranță același spațiu de producție.",
        ],
        roadmapNote:
          "Aceasta este o direcție pe care o explorăm, nu o funcționalitate lansată. Monitorizarea siguranței în medii comune om-robot se supune unui regim de reglementare diferit de evaluarea ergonomică (standarde de siguranță funcțională, nu doar protecția datelor), iar orice capabilitate în acest domeniu va trece printr-o evaluare de conformitate dedicată înainte de lansare — nepreluată automat din produsul de ergonomie din jurul ei.",
      },
    ],
  },
  finalCta: {
    statusLine:
      "În prezent în pilot tehnic alături de parteneri din producția industrială.",
    heading: "Vezi cum îți măsoară propria hală de producție.",
    cta: "Solicită un proiect pilot",
  },
  footer: {
    about: "Despre",
    legal: "Legal",
    copyright: (year: number) =>
      `© ${year} Verumsell SRL · Statura Labs Dynamics este un produs Verumsell SRL`,
  },
  about: {
    metaTitle: "Despre",
    eyebrow: "Despre",
    h1: "Construit pentru a măsura ceea ce înainte se ghicea.",
    paragraphs: [
      "Statura Labs Dynamics a pornit de la o frustrare simplă: riscul ergonomic în mediile industriale este de obicei evaluat din ochi, pe o clemă de hârtii, o dată pe an dacă e cazul — nu pentru că nimănui nu îi pasă, ci pentru că o evaluare instrumentată corectă a însemnat mereu dispozitive purtabile, senzori specializați sau timpul unui consultant extern. Ne-am propus să construim ceva care funcționează cu o cameră pe care probabil o aveți deja.",
      "Statura este construit de un inginer cu experiență în sisteme industriale de securitate și sănătate în muncă, dezvoltat sub Verumsell SRL, un studio de software din România. Produsul se află în pilot tehnic activ alături de parteneri din producția industrială. Îl construim deliberat și transparent în privința a ceea ce este deja dovedit față de ceea ce este încă în dezvoltare, în loc să grăbim o afirmație lustruită înaintea dovezilor.",
    ],
    grounded: {
      eyebrow: "Fundamentat, nu ghicit",
      paragraph:
        "Fiecare prag din motorul de evaluare Statura se bazează pe standarde consacrate de ergonomie ocupațională — ISO 11228 și EN 1005 — nu pe o cutie neagră proprietară. Arhitectura a fost construită în jurul minimizării datelor și al recomandărilor actuale ale AI Act încă de la prima linie de cod, nu adaptată ulterior.",
    },
    whereWeAreNow: {
      eyebrow: "Unde ne aflăm acum",
      paragraph:
        "Statura Labs Dynamics se află în prezent în pilot tehnic alături de parteneri din producția industrială și nu este încă un produs comercial. Dacă vreți să vedeți cum măsoară un loc de muncă real, ne-ar plăcea să auzim de la dumneavoastră.",
    },
    cta: "Solicită un proiect pilot",
  },
  legal: {
    metaTitle: "Legal",
    h1: "Legal",
    thisWebsite: {
      heading: "Acest website",
      paragraph:
        "Acest website este operat de Verumsell SRL. În prezent, nu utilizează cookie-uri de urmărire sau instrumente de analiză și nu colectează date cu caracter personal prin formulare — singurul element interactiv este un link mailto către contact@verumsell.com. Dacă această situație se schimbă, pagina va fi actualizată corespunzător.",
    },
    dataHandling: {
      heading: "Cum gestionează produsul Statura Labs Dynamics datele",
      paragraph:
        "Produsul Statura Labs Dynamics — utilizat într-un proiect pilot sau într-o implementare, separat de acest website — procesează videoclipul de la cameră integral pe dispozitiv. Cadrele video nu sunt niciodată stocate sau transmise; sunt folosite exclusiv coordonate anonime ale articulațiilor corpului, asociate unui loc de muncă, niciodată unei persoane identificate nominal. Statura Labs Dynamics este conceput să îndeplinească cerințele relevante ale AI Act al UE și ale RGPD încă din faza de dezvoltare. Încadrarea regulatorie finală va fi confirmată printr-un aviz juridic formal, înainte de lansarea comercială. Documentația tehnică completă este disponibilă la cerere pentru potențialii parteneri de pilot.",
    },
    terms: {
      heading: "Termeni de utilizare",
      paragraph:
        "Conținutul acestui website este furnizat cu titlu de informare generală despre Statura Labs Dynamics și nu constituie o ofertă cu caracter obligatoriu. Întregul conținut, numele Statura Labs Dynamics și mărcile asociate sunt proprietatea Verumsell SRL. Nimic de pe acest website nu constituie consultanță profesională, medicală sau juridică.",
    },
    company: {
      heading: "Date despre companie",
      paragraph: "Verumsell SRL · CUI 51132090 · J2025002367001",
    },
    contact: {
      heading: "Contact",
      prefix: "Întrebări despre confidențialitate sau despre acest website:",
    },
  },
};
