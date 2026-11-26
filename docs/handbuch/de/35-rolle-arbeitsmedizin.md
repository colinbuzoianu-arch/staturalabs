---
title: Rolle Arbeitsmedizin
part: 3
order: 60
roles: [OCCUPATIONAL_PHYSICIAN, COMPANY_ADMIN, SUPER_ADMIN, L3_SUPPORT]
module: none
internal: false
summary: Die einzige Rolle mit Zugriff auf Gesundheitsdaten — und was dieser Zugriff bedeutet.
---

# Rolle Arbeitsmedizin

Diese Rolle hat genau eine Besonderheit: sie ist die **einzige**, die
Gesundheitsangaben in einer Ereignisakte lesen und erfassen darf.

## Zuständig für

- **Ereignisse** lesen, um den medizinischen Teil zu führen.
- Den **Gesundheitsbereich** einer Ereignisakte: Verletzungsart,
  Körperregion, Ausfalltage, Erstversorgung sowie die medizinischen
  Freitexte.

## Wie dieser Bereich geschützt ist

- Die medizinischen **Freitexte** liegen **verschlüsselt** gespeichert.
- Jeder **Lesezugriff** wird protokolliert, **bevor** der Text angezeigt
  wird.
- Niemand sonst kann den Bereich öffnen — kein Administrator, keine
  EHS-Fachkraft, kein Betriebsrat, auch nicht der Anbieter über eine
  Einstellung.
- Kein Export, keine Auswertung, kein Meldeblatt und keine Datenübergabe
  enthält die Freitexte. Weitergegeben werden nur die groben Angaben, die
  für eine gesetzliche Meldung nötig sind.

## Nicht zuständig für

Gefährdungsbeurteilung, Gefahrstoffe, Personenregister, Unterweisungen,
Einstellungen. Die Rolle ist absichtlich eng: sie existiert für den
medizinischen Teil eines Falls, nicht als zweiter Administrator.

## Häufige Fragen

**Kann ich eine ärztliche Untersuchung oder Eignung dokumentieren?**
Nein. Die Anwendung führt kein arbeitsmedizinisches Vorsorgeregister. Der
Gesundheitsbereich gehört zu einem konkreten Ereignis.

**Was passiert mit den Angaben nach Ablauf der Frist?**
Sie werden im eigenen Löschstapel für Ereignisse vorgeschlagen und nach
Freigabe gelöscht, sofern kein Aufbewahrungsvorbehalt besteht.
