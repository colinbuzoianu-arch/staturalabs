// GENERATED FILE — do not edit.
//
// Source: docs/handbuch/de/*.md · Generator: scripts/build-handbook.mjs
// Run `npm run docs:handbook` after editing a chapter. CI fails if this file
// is not what the sources produce (scripts/check-handbook.mjs), so the two
// cannot drift.

import type { HandbookChapter } from "@/lib/handbook/chapters";

export const HANDBOOK_CHAPTERS: readonly HandbookChapter[] = [
  {
    "slug": "anmeldung",
    "title": "Anmeldung und erste Schritte",
    "part": 1,
    "order": 10,
    "roles": [],
    "module": null,
    "internal": false,
    "summary": "Wie Sie sich anmelden — mit E-Mail oder mit Personalnummer und Zugangscode — und was Sie danach sehen.",
    "markdown": "# Anmeldung und erste Schritte\n\nStatura Labs Dynamics hat **keine öffentliche Registrierung**. Konten werden\nimmer von Ihrer Administration angelegt; Sie erhalten eine Einladung per\nE-Mail oder ein Blatt mit einem Zugangscode.\n\n## Mit E-Mail und Passwort anmelden\n\n1. Öffnen Sie die Anmeldeseite.\n2. Wählen Sie **E-Mail & Passwort**.\n3. Geben Sie Ihre dienstliche E-Mail-Adresse und Ihr Passwort ein.\n\n## Mit Personalnummer und Zugangscode anmelden\n\nWer keine dienstliche E-Mail-Adresse hat, erhält ein Blatt mit einem\n**Einmal-Zugangscode**.\n\n1. Wählen Sie auf der Anmeldeseite **Personalnr. & Zugangscode**.\n2. Geben Sie Ihre Personalnummer und den Code ein.\n3. Legen Sie ein eigenes Passwort fest (mindestens zehn Zeichen).\n\nDer Code gilt **einmalig** und läuft nach 14 Tagen ab. Ist er abgelaufen oder\nverloren, stellt Ihre Administration ein neues Blatt aus.\n\n## Was Sie nach der Anmeldung sehen\n\n- **Meine Aufgaben** zeigt Ihre offenen Punkte über alle Standorte, auf die\n  Sie Zugriff haben.\n- Die **Seitenleiste** links führt zu den Modulen, die für Ihre Rolle und\n  Ihren Standort freigeschaltet sind. Module, die Ihre Rolle nicht betreffen,\n  werden gar nicht angezeigt.\n- Oben rechts wechseln Sie **Sprache** und **Hell/Dunkel**."
  },
  {
    "slug": "navigation",
    "title": "Navigation, Standortwechsel und Hilfe",
    "part": 1,
    "order": 20,
    "roles": [],
    "module": null,
    "internal": false,
    "summary": "Seitenleiste, Standortwechsel, Aktivitätenkalender, Benachrichtigungen und wo die Hilfe liegt.",
    "markdown": "# Navigation, Standortwechsel und Hilfe\n\n## Die Seitenleiste\n\nDie Seitenleiste ist nach Tätigkeit gegliedert: **Übersicht**, **Beurteilen**,\n**Steuern**, **Nachweisen** und unten die **Einstellungen**. Sie zeigt\nausschließlich Module, die\n\n- für Ihr Unternehmen freigeschaltet sind,\n- Ihre Rolle sehen darf und\n- bereits gebaut sind.\n\n## Standort wechseln\n\nOben in der Seitenleiste wählen Sie den Standort. Alle Inhalte darunter —\nEvaluierungen, Maßnahmen, Gefahrstoffe — gehören zu diesem Standort. Welches\nRecht gilt, hängt am Standort, nicht am Unternehmen.\n\n## Aktivitätenkalender\n\nDer **Aktivitätenkalender** sammelt alles mit Termin: fällige Maßnahmen,\ngeplante Begehungen, fällige Überprüfungen von Evaluierungen,\nRechtspflicht-Prüfungen, Meldefristen und offene Bestätigungen von\nSicherheitsinformationen.\n\n## Hilfe\n\nDieses Handbuch liegt im Menüpunkt **Hilfe** unten in der Seitenleiste. Auf\nvielen Modulseiten finden Sie zusätzlich **Hilfe zu diesem Modul**, das direkt\nin das passende Kapitel springt."
  }
] as const;
