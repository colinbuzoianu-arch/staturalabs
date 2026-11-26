---
title: Auswertungen und Kennzahlen
part: 2
order: 120
roles: []
module: REPORTS
internal: false
summary: Die Kennzahlen, ihre Formeln, die nötigen Bezugsgrößen und warum manche Zahlen bewusst nicht angezeigt werden.
---

# Auswertungen und Kennzahlen

## Wozu

Die Auswertung beantwortet die Frage, die in der Geschäftsleitung gestellt
wird: **Wird es besser?** Sie rechnet aus den Daten, die ohnehin im System
stehen — es gibt keine zweite Erfassung für Kennzahlen.

## Was gerechnet wird

Der mitgelieferte Kennzahlensatz umfasst unter anderem:

- **Unfallzahl**, **Unfallrate** und **Unfallhäufigkeit**,
- **Ausfalltage** und **Ausfalltagerate**,
- **Schwererate**,
- **Beinaheunfall-Verhältnis** und **Beinaheunfallrate**,
- **offene** und **überfällige Maßnahmen**,
- **Wirksamkeit der Maßnahmen**,
- **Vollständigkeit der Beurteilungen**,
- **überfällige Prüfungen**,
- **Unterweisungsquote**,
- **Durchführungsquote Begehungen**,
- **Aktualität der Sicherheitsdatenblätter**,
- **Abfallmenge** und **wesentliche Umweltaspekte**,
- **Bestätigungsquote**, **überfällige Bestätigungen** und **mittlere Dauer
  bis zur Bestätigung** für Sicherheitsinformationen.

Der Satz ist **versioniert**: eine neue Fassung ändert nicht rückwirkend,
was eine alte Zahl bedeutete.

## Bezugsgrößen eintragen

Raten brauchen einen Nenner. Unter **Arbeitsstunden und Personalstand**
tragen Sie je Standort und Zeitraum ein:

- **Personalstand** (ein Bestandswert — er wird je Standort gemittelt und
  dann über die Standorte summiert),
- **geleistete Arbeitsstunden** (ein Flusswert — er wird summiert).

Das ist eine **Zahl**, keine Liste von Personen. Fehlt der Nenner, zeigt die
Anwendung bei der Rate **keinen Wert** — sie rechnet nicht mit einer
geschätzten Belegschaft.

## Mindestgruppengröße

Kennzahlen, die sich aus Personendaten ergeben (Ausfalltage,
Unterweisungsquote, Bestätigungsquoten), laufen durch eine
Mindestgruppengröße. Liegt die Gruppe darunter, erscheint statt der Zahl ein
Hinweis — auch im Export. Das ist keine Anzeigeeinstellung, sondern eine
Regel: aus einer sehr kleinen Gruppe lässt sich auf die einzelne Person
zurückrechnen.

## Sicht und Zeitraum

Die Kennzahlen lassen sich je **Standort** oder — für
Unternehmensadministratoren — für das **ganze Unternehmen** anzeigen, je
Jahr. Der **CSV-Export** folgt genau der Sicht auf dem Bildschirm;
unterdrückte Werte werden als Hinweis exportiert, nie als Zahl.

## Grenzen

- Export als Excel- oder PDF-Bericht ist noch nicht umgesetzt (CSV gibt es).
- Frei konfigurierbare Dashboards je Benutzer und Mehrjahres-Vergleiche sind
  noch nicht umgesetzt.
- Die Kennzahlen sind Betriebssteuerung, keine Benchmark gegen andere
  Betriebe.

## Häufige Fragen

**Warum ist meine Unfallrate leer, obwohl ein Unfall erfasst ist?**
Weil für das Jahr keine Arbeitsstunden oder kein Personalstand hinterlegt
sind. Tragen Sie die Bezugsgrößen ein; die Zahl erscheint sofort.

**Werden Beschäftigte miteinander verglichen?**
Nein. Es gibt keine Kennzahl je Person und keine Reihung von Personen.
