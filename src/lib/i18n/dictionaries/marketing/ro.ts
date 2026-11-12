import type { en } from "./en";

// Romanian — a faithful equivalent of en.ts (RO is a UI language, not a sales
// market). Typed against `typeof en` so a missing key is a compile error.
export const ro: typeof en = {
  meta: {
    title:
      "Software pentru securitatea muncii și mediu pentru DACH | Statura Labs Dynamics",
    description:
      "Statura Labs Dynamics este platforma integrată pentru securitatea muncii, evaluarea riscurilor și protecția mediului în Austria, Germania și Elveția. Documente conforme legal, substanțe periculoase, instruiri, inspecții, măsuri și registru legal — conform GDPR.",
  },
  header: {
    requestPilot: "Solicită un pilot",
    signIn: "Autentificare",
  },
  hero: {
    eyebrow: "Securitatea muncii · Sănătate · Mediu",
    h1: "Securitatea muncii și protecția mediului — o singură platformă pentru întreaga regiune DACH.",
    lede: "Statura Labs Dynamics reunește evaluarea riscurilor, substanțele periculoase, instruirile, inspecțiile, evenimentele, măsurile, registrul legal și managementul de mediu într-un software conform legal pentru Austria, Germania și Elveția. Generați documentele cerute de lege, gestionați măsurile și dovediți eficacitatea acestora — pe deplin conform GDPR.",
    ctaPrimary: "Solicită un pilot",
    ctaSecondary: "Descoperă platforma",
  },
  platform: {
    eyebrow: "Platforma",
    heading:
      "Un sistem continuu pentru protecția lucrătorilor și managementul de mediu.",
    paragraphs: [
      "Securitatea muncii, protecția sănătății și managementul de mediu sunt adesea ținute în liste, dosare și tabele separate. Statura Labs Dynamics le unifică într-o singură platformă adaptată fiecărei țări — de la postul de lucru și evaluarea riscurilor până la documentul final, conform legal.",
      "Fiecare evaluare, fiecare măsură și fiecare înregistrare este versionată, trasabilă și legată de o locație și de legislația aplicabilă. Responsabilii de securitate, responsabilii de mediu și conducerea au mereu o imagine de ansamblu — și sunt pregătiți pentru o inspecție a autorităților sau un audit.",
    ],
  },
  modules: {
    eyebrow: "Module",
    heading: "Tot ce are nevoie securitatea muncii și managementul de mediu.",
    lede: "Activați modulele de care aveți nevoie — de la primul post de lucru până la un sistem de management complet.",
    items: [
      {
        title: "Evaluarea riscurilor / Evaluierung",
        description:
          "Evaluare structurată a riscurilor pe toate categoriile de pericol, cu măsuri și verificarea eficacității — în Austria ca Evaluierung conform ASchG.",
      },
      {
        title: "Substanțe periculoase",
        description:
          "Registru de substanțe periculoase, fișe cu date de securitate și instrucțiuni de lucru generate automat conform GefStoffV / ASchG.",
      },
      {
        title: "Instruiri",
        description:
          "Derivarea, planificarea și dovedirea obligațiilor de instruire — inclusiv gestionarea dovezilor și urmărirea termenelor.",
      },
      {
        title: "Inspecții & audituri",
        description:
          "Inspecții de securitate și audituri cu șabloane, liste de verificare și transformarea directă a constatărilor în măsuri.",
      },
      {
        title: "Evenimente",
        description:
          "Înregistrați, investigați și — unde este necesar — raportați autorităților accidentele, incidentele evitate și evenimentele; inclusiv registrul de prim ajutor.",
      },
      {
        title: "Mediu",
        description:
          "Evaluați aspectele de mediu, înregistrați cantitățile și deșeurile și generați conceptul de gestionare a deșeurilor conform AWG.",
      },
      {
        title: "Măsuri",
        description:
          "Un registru central de măsuri cu responsabilități, termene și verificarea documentată a eficacității.",
      },
      {
        title: "Registru legal",
        description:
          "Mențineți cerințele legale pe fiecare locație, confirmați aplicabilitatea și evaluați conformitatea legală.",
      },
      {
        title: "Documente",
        description:
          "Toate documentele conforme legal într-un singur loc — inclusiv o arhivă inviolabilă a înregistrărilor generate.",
      },
      {
        title: "Analize",
        description:
          "Indicatori și analize privind securitatea, măsurile și mediul — fără a evalua persoane individuale.",
      },
    ],
  },
  documents: {
    eyebrow: "Documente conforme legal",
    heading: "Înregistrările cerute — cu un clic, nu manual.",
    paragraph:
      "Statura Labs Dynamics generează documentele cerute de lege direct din datele dvs. — specifice fiecărei țări și mereu pe baza legală corectă. Fără copiere între șabloane, fără versiuni învechite.",
    items: [
      {
        title: "Documentul de securitate și sănătate (SGD)",
        description: "Pentru Austria, conform §5 ASchG și DOK-VO.",
      },
      {
        title: "Instrucțiuni de lucru",
        description:
          "Instrucțiuni de lucru pentru substanțe periculoase conform GefStoffV / ASchG.",
      },
      {
        title: "Concept de gestionare a deșeurilor (AWK)",
        description: "Conform §10 AWG 2002 pentru locațiile austriece.",
      },
      {
        title: "Înregistrări & rapoarte",
        description:
          "De la evaluare până la notificarea autorităților — arhivate inviolabil.",
      },
    ],
  },
  dach: {
    eyebrow: "Construit pentru regiunea DACH",
    heading: "Legea, terminologia și documentele urmează locația.",
    paragraph:
      "O companie poate avea locații în mai multe țări. De aceea, în Statura, locația efectivă decide ce limite se aplică, ce terminologie se folosește și ce document se generează — nu invers.",
    points: [
      "Austria: Evaluierung, SGD, logica AUVA și a inspecției muncii.",
      "Germania: evaluarea riscurilor conform ArbSchG, GefStoffV și DGUV.",
      "Elveția: în pregătire.",
    ],
  },
  trust: {
    eyebrow: "Protecția datelor de la început",
    heading: "Evaluați securitatea fără a supraveghea oamenii.",
    items: [
      {
        title: "Fără cameră, fără date video",
        description:
          "Platforma nu folosește cameră și nu stochează date de imagine sau video. O evaluare este o documentare structurată, nu material filmat.",
      },
      {
        title: "Evaluarea și persoana, separate",
        description:
          "Lanțul de evaluare este fără persoane: evaluările se referă la posturi de lucru, nu la nume. Datele personale obligatorii sunt ținute strict separat, într-un compartiment propriu.",
      },
      {
        title: "Conceput conform GDPR",
        description:
          "Minimizarea datelor și protecția datelor sunt integrate din prima linie de cod, nu adăugate ulterior.",
      },
    ],
  },
  finalCta: {
    eyebrow: "Începeți",
    heading: "Vedeți cum Statura vă securizează operațiunile.",
    paragraph:
      "Programați un pilot și experimentați platforma la o locație reală.",
    cta: "Solicită un pilot",
  },
  footer: {
    about: "Despre noi",
    legal: "Juridic",
    copyright: (year: number) =>
      `© ${year} Verumsell SRL · Statura Labs Dynamics este un produs al Verumsell SRL`,
  },
  about: {
    metaTitle: "Despre noi",
    eyebrow: "Despre noi",
    h1: "Protecția muncii și a mediului, reunite într-o singură platformă.",
    paragraphs: [
      "Statura Labs Dynamics a pornit de la o observație simplă: în multe companii, securitatea muncii, protecția sănătății și managementul de mediu sunt ținute în documente, tabele și mințile oamenilor separat — și reasamblate cu greu la o inspecție. Construim o platformă care unifică aceste obligații și generează automat înregistrările cerute.",
      "Statura Labs Dynamics este dezvoltată sub Verumsell SRL. Platforma este construită pentru regiunea DACH și se adresează operațiunilor industriale și comerciale care doresc să își organizeze protecția muncii și a mediului într-un mod conform legal și trasabil.",
    ],
    whereWeAreNow: {
      eyebrow: "Unde ne aflăm acum",
      paragraph:
        "Statura Labs Dynamics se află în dezvoltare activă alături de parteneri pilot. Dacă doriți să vedeți platforma la o locație reală, ne-ar plăcea să auzim de la dvs.",
    },
    cta: "Solicită un pilot",
  },
  legal: {
    metaTitle: "Juridic",
    h1: "Juridic",
    thisWebsite: {
      heading: "Acest site",
      paragraph:
        "Acest site este operat de Verumsell SRL. În prezent nu folosește cookie-uri de urmărire sau analiză și nu colectează date personale prin formulare — singurul element interactiv este un link mailto: către contact@verumsell.com. Dacă acest lucru se schimbă, pagina va fi actualizată în consecință.",
    },
    // REVIEW REQUIRED: text sensibil juridic — de verificat de un jurist
    // înainte de lansarea comercială.
    dataHandling: {
      heading: "Cum tratează datele produsul Statura Labs Dynamics",
      paragraph:
        "Produsul Statura Labs Dynamics — astfel cum este folosit într-un pilot sau în implementare, separat de acest site — nu folosește cameră și nu captează, înregistrează, stochează sau transmite date video sau imagini. Lanțul de evaluare este fără persoane: evaluările și măsurătorile sunt legate de un post de lucru sau o locație, niciodată de o persoană numită. Datele personale cerute de lege (de exemplu dovezi de instruire sau înregistrări de evenimente) sunt ținute strict separat, doar pentru o obligație legală concretă; datele de sănătate sunt în plus criptate, iar fiecare accesare este înregistrată. Statura Labs Dynamics este conceput pentru a îndeplini cerințele relevante ale GDPR al UE încă din faza de dezvoltare. Documentația tehnică completă este disponibilă la cerere pentru potențialii parteneri pilot.",
    },
    terms: {
      heading: "Condiții de utilizare",
      paragraph:
        "Conținutul acestui site este oferit cu titlu informativ general despre Statura Labs Dynamics și nu constituie o ofertă obligatorie. Întregul conținut, numele Statura Labs Dynamics și mărcile asociate sunt proprietatea Verumsell SRL. Nimic de pe acest site nu constituie consultanță profesională, medicală sau juridică.",
    },
    company: {
      heading: "Informații despre companie",
      paragraph: "Verumsell SRL · CUI 51132090 · J2025002367001",
    },
    contact: {
      heading: "Contact",
      prefix: "Întrebări despre confidențialitate sau acest site:",
    },
  },
};
