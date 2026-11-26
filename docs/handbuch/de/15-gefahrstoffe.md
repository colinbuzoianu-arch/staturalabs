---
title: Gefahrstoffe
part: 2
order: 60
roles: []
module: CHEMICALS
internal: false
summary: Stoffverzeichnis, Sicherheitsdatenblätter, Betriebsanweisungen, Lagerung und die rechnerischen Prüfhilfen.
---

# Gefahrstoffe

## Wozu

Das Modul führt die Stoffe, die im Betrieb tatsächlich verwendet werden —
mit ihrer Einstufung, ihrem Sicherheitsdatenblatt, der Betriebsanweisung und
dem Ort, an dem sie lagern. Daraus entstehen zwei Dokumente, die verlangt
werden: das **Verzeichnis** und die **Betriebsanweisung**.

Auch dieses Modul ist personenfrei: erfasst wird, **wo** ein Stoff verwendet
wird (Arbeitsplatz, Organisationseinheit), nicht **wer** ihn verwendet.

## Das Stoffregister

Je Stoff werden geführt:

- Bezeichnung, Lieferant, CAS-/EG-Nummer,
- **Einstufung** nach CLP: Piktogramme (GHS01–GHS09), H-, P- und
  EUH-Sätze, Signalwort,
- **CMR-Eigenschaften** als drei getrennte Kategorien (1A, 1B, 2) — nie als
  einfaches Ja/Nein, weil die Rechtsfolgen sich unterscheiden,
- Arbeitsplatzgrenzwerte, soweit für das Land hinterlegt,
- **Verwendungen**: an welchem Arbeitsplatz, in welcher Tätigkeit.

## Sicherheitsdatenblätter

Ein Sicherheitsdatenblatt wird mit **Version und Datum** geführt. Eine neue
Fassung ersetzt die alte nicht, sondern löst sie ab — die vorige bleibt
nachweisbar. Das Register warnt bei

- fehlendem Datenblatt,
- veralteter Fassung,
- einem Datenblatt, das nicht in der Landessprache vorliegt.

### Einlesen mit Unterstützung

Ist die Funktion für Ihr Unternehmen freigeschaltet, kann die Anwendung ein
Sicherheitsdatenblatt als PDF einlesen und einen **Vorschlag** erzeugen: zu
jedem Feld die gefundene Seite und die Textstelle. Nichts davon wird
übernommen, bevor Sie Feld für Feld bestätigt haben. Die Anwendung erfindet
keine Angaben; findet sie etwas nicht, bleibt das Feld leer.

## Betriebsanweisung

Aus dem Stoff und seiner Verwendung erzeugt die Anwendung eine
deutschsprachige **Betriebsanweisung** im üblichen Aufbau mit orangem
Rahmen: Bezeichnung, Gefahren, Schutzmaßnahmen, Verhalten im Gefahrfall,
Erste Hilfe, sachgerechte Entsorgung.

Sie läuft als **Entwurf → Freigabe → Archiv**. Erscheint ein neues
Sicherheitsdatenblatt, markiert die Anwendung die freigegebene
Betriebsanweisung als **prüfbedürftig** — sie wird nicht stillschweigend
ungültig und nicht stillschweigend geändert.

Rechtsgrundlage: in Deutschland § 14 GefStoffV, in Österreich § 14 ASchG.

## Verzeichnis

Zwei länderspezifische Ausgaben:

- **Deutschland** — Gefahrstoffverzeichnis nach § 6 GefStoffV, mit einem
  gesonderten Anhang für Stoffe geringer Gefährdung.
- **Österreich** — Arbeitsstoffliste nach § 41 ASchG, mit dem ausdrücklichen
  Hinweis, dass es sich nicht um ein gesetzlich vorgeschriebenes Verzeichnis
  im deutschen Sinn handelt.

## Lagerung

Lagerorte werden als eigene Einträge geführt (nicht als Freitext). Daraus
ergeben sich zwei Prüfungen:

- **Zusammenlagerung** nach dem deutschen Regelwerk — soweit das Regelwerk
  im System geladen ist. Ist es nicht geladen, sagt die Anwendung das, statt
  eine Bewertung zu erfinden.
- **Wassergefährdungsklasse** und Flammpunkt, soweit vom Lieferanten
  angegeben.

## Substitution

Zu jedem Stoff gibt es eine **Ersatzprüfung**: wurde geprüft, ob ein weniger
gefährlicher Stoff möglich ist, mit Ergebnis und Begründung. Für CMR-Stoffe
der Kategorien 1A und 1B ist das der entscheidende Punkt jeder Prüfung.

## Prüfung und Berechnung

Unter **Prüfung & Berechnung** stellt die Anwendung — wenn freigeschaltet —
eigene Rechenergebnisse **neben** die Angaben des Lieferanten: geschätzte
physikalische Werte, Gemischrechnung, Transporteinstufung,
Lagerklassen-Vorschlag. Dazu gilt ohne Ausnahme:

> Diese Ergebnisse sind eine **Prüfhilfe**, keine Einstufung. Sie sind als
> Vorschlag gekennzeichnet, ersetzen keine Einstufung und kein
> Sicherheitsdatenblatt, und sie fließen **nicht** in das Verzeichnis, in
> eine Betriebsanweisung, in ein Kennzeichnungsschild oder in ein nach außen
> gegebenes Datenblatt ein. Fehlen Eingangsdaten oder das Regelwerk,
> verweigert die Prüfung die Antwort, anstatt zu schätzen.

Erkannte Abweichungen zwischen Rechnung und Lieferantenangabe erscheinen
zusätzlich in einer Liste je Standort.

## Unterweisung und Aufbewahrung

Ein verwendeter Gefahrstoff erzeugt automatisch einen
Unterweisungsbedarf für den betroffenen Arbeitsbereich. Für CMR-Stoffe der
Kategorien 1A und 1B ist eine deutlich längere Aufbewahrung der Nachweise
vorgesehen.

Sicherheitsdatenblätter und Verwendungen werden nach Ablauf ihrer Frist in
einem **eigenen** Löschstapel vorgeschlagen — getrennt von allen
personenbezogenen Löschvorgängen.

Die personenbezogenen Expositionsverzeichnisse (§ 10a GefStoffV in
Deutschland, § 47 ASchG in Österreich) sind in der Anwendung **bewusst noch
nicht** umgesetzt und werden auch nicht angedeutet.

## Häufige Fragen

**Können wir Stoffe importieren?**
Ja, über den Import in den Einstellungen; der Stoff-Import ist derzeit auf
die Grunddaten beschränkt.

**Warum sehe ich keine Rechenergebnisse?**
Weil die Funktion für Ihr Unternehmen nicht freigeschaltet ist. Ohne
Freischaltung gibt es keine Vorschläge — und keine halben Anzeigen.
