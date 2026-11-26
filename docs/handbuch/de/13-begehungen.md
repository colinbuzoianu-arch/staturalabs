---
title: Begehungen und Audits
part: 2
order: 40
roles: []
module: INSPECTIONS
internal: false
summary: Geplante Rundgänge mit Checkliste, Beobachtungen vor Ort und der direkte Weg zur Maßnahme.
---

# Begehungen und Audits

## Wozu

Die Gefährdungsbeurteilung beschreibt den Soll-Zustand. Die Begehung prüft,
ob es vor Ort noch so ist. Sie ist das wiederkehrende Instrument: Rundgang,
Checkliste, Beobachtung, Maßnahme.

Begehungen in dieser Anwendung beurteilen **Zustände**, nicht Personen. Die
Checklisten fragen nach Anlagen, Wegen, Lagerung, Kennzeichnung,
Schutzeinrichtungen — nicht nach dem Verhalten einzelner Beschäftigter.

## Vorlagen

Eine Begehung entsteht immer aus einer **Vorlage**. Eine Vorlage besteht aus
Abschnitten und Fragen; jede Frage hat einen Antworttyp:

- Ja / Nein / Nicht zutreffend
- Skala
- Zahl
- Text
- Auswahl
- Datei

Vorlagen sind versioniert und haben einen Gültigkeitsbereich: **System**
(mitgeliefert), **Unternehmen** oder **Standort**. Eine laufende Begehung
hängt nicht an der Vorlage: beim Anlegen werden die Fragen in die Begehung
**kopiert**. Wird die Vorlage später geändert, bleibt die abgeschlossene
Begehung genau das Dokument, das durchgeführt wurde.

> Die mitgelieferte System-Vorlage ist ein allgemeiner Rundgang. Sie enthält
> absichtlich **keine** Gesetzesverweise: eine länderspezifische
> Rechts-Checkliste wird erst nach fachlicher Prüfung ergänzt, nicht
> behauptet.

## Durchführen

1. **Planen** — Vorlage, Termin, Ort, Team (Benutzerkonten) und Durchführende
   festlegen. Status: *Geplant*.
2. **Durchführen** — Antworten erfassen. Status: *In Durchführung*.
3. **Abschließen** — möglich erst, wenn **jede Pflichtfrage** beantwortet ist.
   Fehlt eine Antwort, nennt die Anwendung sie und schließt nicht ab.
4. **Schließen** — der Vorgang ist endgültig abgelegt.

Ein einmaliger Rückschritt von *Abgeschlossen* auf *In Durchführung* ist
erlaubt, falls beim Abschluss etwas übersehen wurde.

## Beobachtungen

Was auffällt, wird als **Beobachtung** erfasst: Beschreibung, Ort, Schwere
(dieselben Risikostufen wie in der Gefährdungsbeurteilung) und optional ein
Foto.

> Auf Fotos gehören keine Personen. Die Anwendung weist bei jedem Upload
> darauf hin. Ein Foto einer Lagerfläche ist ein Nachweis; ein Foto eines
> Beschäftigten bei der Arbeit ist etwas anderes.

Aus einer Beobachtung lässt sich direkt eine **Maßnahme** erzeugen. Sie
landet im gemeinsamen Maßnahmenregister und trägt die Begehung als Quelle.

## Was noch nicht geht

- Eine Beobachtung wird noch nicht automatisch in eine Feststellung der
  Gefährdungsbeurteilung übernommen (sie braucht dafür eine Ziel-Beurteilung
  und eine Zuordnung zur Gefährdung). Die Schwere ist bereits erfasst, damit
  das später möglich bleibt.
- Wiederkehrende Begehungstermine werden noch nicht automatisch erzeugt;
  planen Sie den nächsten Termin manuell.

## Rechtlicher Hintergrund

Die regelmäßige Überprüfung der Arbeitsstätte und der Arbeitsmittel ist Teil
der Ermittlungs- und Beurteilungspflicht (§ 4 ASchG, § 5 ArbSchG). Eine
bestimmte Form oder Häufigkeit der Begehung schreibt die Anwendung nicht vor.

## Häufige Fragen

**Dürfen wir eigene Checklisten anlegen?**
Ja — als Unternehmens- oder Standortvorlage. Die System-Vorlagen bleiben
unverändert daneben bestehen.

**Kann eine Begehung ohne Internetverbindung durchgeführt werden?**
Für die Schnellmeldung eines Ereignisses gibt es eine Offline-Erfassung. Der
vollständige Begehungs-Durchlauf offline ist noch nicht umgesetzt.
