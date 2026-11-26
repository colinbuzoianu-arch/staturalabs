---
title: Kataloge, Fassungen und Aufbewahrung
part: 4
order: 30
roles: [COMPANY_ADMIN, SITE_ADMIN, SUPER_ADMIN, L3_SUPPORT]
module: none
internal: false
summary: Warum jede Bewertungsgrundlage eine Fassung hat, wie Aufbewahrungsfristen wirken und wie Löschstapel freigegeben werden.
---

# Kataloge, Fassungen und Aufbewahrung

## Alles Bewertende ist versioniert

Die Anwendung bewertet nichts mit fest eingebauten Zahlen. Jede Grundlage
liegt als **Fassung** vor, von der genau eine aktiv ist:

- **Gefährdungskatalog** — die möglichen Gefährdungen je Kategorie.
- **Risikomatrix** — Eintrittswahrscheinlichkeit × Schwere, mit Stufen.
- **Beurteilungsmethodik** — die Schwellen für Haltung, Haltedauer, Lasten,
  Wiederholung.
- **Grenzwertkatalog** — die Expositionsgrenzwerte je Land.
- **Rechtsbestand** und **Rechtspflichten**.
- **Kennzahlensatz**.
- **Aufbewahrungskatalog**.

Zwei Folgen daraus:

1. Eine fertige Beurteilung behält die Fassung, mit der sie erstellt wurde.
   Eine neue Matrix ändert keine alte Bewertung rückwirkend.
2. Ist **keine** Fassung aktiv, verweigert die Anwendung die Bewertung mit
   einer Fehlermeldung — sie greift nicht auf „die neueste" zurück. Lieber
   ein sichtbarer Konfigurationsfehler als eine stille Falschbewertung.

Fassungen werden vom Anbieter aktiviert, nicht im Unternehmen.

## Herkunft von Rechtsinhalten

Jeder Rechtsbezug trägt, wie er geprüft wurde: amtliche Quelle, Spiegelung
oder Stichprobenprüfung. Nichts wird aus dem Gedächtnis eines Modells
übernommen. Wo keine erreichbare amtliche Fundstelle gesichert war, steht
eine Notiz statt eines Links — und für ein Land ohne geprüfte Grundlage
bleibt die Lücke sichtbar.

## Aufbewahrung

Je Art von Aufzeichnung und je Land ist eine Frist hinterlegt, mit ihrer
**Grundlage**:

- **gesetzlich** — mit Rechtsverweis,
- **betriebliche Voreinstellung** — wo es keine gesetzliche Frist gibt. Das
  wird auch so benannt, statt eine Pflicht zu behaupten.

## Löschstapel

Nach Ablauf schlägt die Anwendung Löschungen **in getrennten Stapeln** vor,
die nie gemeinsam freigegeben werden:

- Personen-**Anonymisierung** (Personenbezug fällt weg, Nachweise bleiben),
- **Gefahrstoffe** (Datenblätter und Verwendungen, endgültige Löschung),
- **Ereignisse** (einschließlich Gesundheitsangaben und Erste Hilfe),
- **Sicherheitsinformationen** (Bestätigungszeilen; Summe bleibt).

Ablauf immer: **Vorschlag → Freigabe durch den Administrator → Ausführung.**
Ein **Aufbewahrungsvorbehalt** auf einem betroffenen Datensatz hält den
ganzen Vorgang zurück — gedacht für laufende Verfahren.

## Datenauskunft und Löschung auf Anfrage

Für ein Unternehmen und für eine einzelne Person kann ein vollständiger
**Export** erzeugt werden. Er enthält niemals die verschlüsselten
medizinischen Freitexte; Dokumente werden mit Prüfsumme und Ablageort
benannt, nicht mitgeliefert.

## Häufige Fragen

**Können wir eigene Fristen setzen?**
Für bestimmte Unterweisungsarten gibt es eine Überschreibung. Gesetzliche
Fristen sind nicht verkürzbar.

**Was passiert bei einer neuen Katalogfassung mit unseren Daten?**
Nichts. Ihre Einträge, Entscheidungen und Nachweise bleiben; neue Einträge
kommen hinzu.
