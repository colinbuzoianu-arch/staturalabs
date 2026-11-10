import type { en } from "./en";

export const de: typeof en = {
  heading: "Zwei-Faktor-Authentifizierung",
  enrollIntro:
    "Ihre Rolle erfordert einen zweiten Faktor. Scannen Sie den QR-Code mit einer Authenticator-App (z. B. Google Authenticator, 1Password) und geben Sie anschließend den 6-stelligen Code ein.",
  challengeIntro:
    "Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein, um fortzufahren.",
  secretLabel: "Oder diesen Einrichtungsschlüssel manuell eingeben:",
  codeLabel: "6-stelliger Code",
  verifyButton: "Bestätigen",
  verifying: "Wird geprüft…",
  loading: "Wird geladen…",
  success: "Zwei-Faktor-Authentifizierung ist aktiv. Weiterleitung…",
  errorGeneric:
    "Der Code konnte nicht bestätigt werden. Bitte erneut versuchen.",
  errorEnroll:
    "Die Einrichtung konnte nicht gestartet werden. Bitte Seite neu laden.",
  signOut: "Abmelden",
};
