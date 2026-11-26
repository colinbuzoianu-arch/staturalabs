---
title: Intern — Plattformkonsole
part: 4
order: 90
roles: []
module: none
internal: true
summary: Nur für Anbieterrollen — Mandanten, Testzugänge, Freischaltungen, Fassungen, Vertretungszugriff, Export und Löschung.
---

# Intern — Plattformkonsole

Dieses Kapitel ist **nicht** Teil des Kundenhandbuchs. Es erscheint nur für
die Plattformrollen und ist in keinem kundenseitigen PDF enthalten.

## Mandanten

Unter **/admin** werden Unternehmen angelegt, archiviert und wieder
aktiviert. Zu jedem Mandanten:

- **Erster Administrator** per Einladung (es gibt keinen anderen Weg
  hinein),
- **Modulfreischaltung** je Mandant, mit einer Vorlage für Neuanlagen,
- **Status** (aktiv, archiviert). Eine Löschung setzt den Status
  *archiviert* voraus.

## Testzugänge

Ein Testmandant trägt eine eigene Art (**Testzugang**) und wird in den
Kundenzahlen **nicht** mitgezählt. Beim Anlegen:

- Laufzeit, Benutzerobergrenze, Obergrenze für unterstützende
  Auswertungsfunktionen,
- Beispieldaten laden (gekennzeichnet) oder leer starten,
- Einladung des ersten Administrators **vor** dem Einspielen der
  Beispieldaten (Beurteilungen brauchen einen Urheber).

Der Lebenszyklus läuft über einen Lauf, der Erinnerungen verschickt, nach
Ablauf **sperrt**, nach der Nachfrist eine **Löschung vorschlägt** und
Verlängerung, Zurücksetzen, Übernahme als Kunde oder Löschung erlaubt. Der
Löschvorschlag selbst wird bei einer Mandantenlöschung **nicht** entfernt —
er ist Teil der Nachvollziehbarkeit.

## Fassungen aktivieren

Kataloge und Bewertungsgrundlagen werden hier aktiviert: Gefährdungskatalog,
Risikomatrix, Methodik, Grenzwerte, Rechtsbestand, Rechtspflichten,
Kennzahlensatz, Aufbewahrungskatalog, Meldefristen. Es ist immer genau eine
Fassung aktiv; ohne aktive Fassung verweigert die Anwendung die Bewertung.

**Regel ohne Ausnahme:** Rechtsinhalte werden nie aus Modellwissen
übernommen. Entwurf, fachliche Prüfung, Freigabe, dann Umsetzung —
und jede Zeile trägt ihre Prüfart.

## Merkmalsschalter

- **Merkmalsschalter** je Mandant (mit globaler Voreinstellung), unter
  anderem für die unterstützenden Auswertungsfunktionen bei Gefahrstoffen.
- **Rechenmodule** mit drei Zuständen: *aus*, *Vorschau*, *geprüft*. Der
  Zustand *geprüft* setzt eine hinterlegte, aktuelle fachliche Prüfung
  voraus; fehlt sie, fällt der Schalter auf *Vorschau* zurück. In
  Produktionsumgebungen ist die Voreinstellung *aus*.
- **Zugriffsschutz** und **Zwei-Faktor-Pflicht** sind eigene Schalter mit
  dokumentiertem Einführungsweg.

## Vertretungszugriff

Der Zugriff auf einen Mandanten zur Unterstützung ist **nur lesend**:
Änderungen sind technisch gesperrt, im Bildschirm erscheint ein Hinweisband,
und der Zugriff wird protokolliert.

## Export und Löschung

- **Export** eines Unternehmens oder einer einzelnen Person als Datei;
  **niemals** die verschlüsselten medizinischen Freitexte, Dokumente nur als
  Verweis mit Prüfsumme.
- **Löschung eines Mandanten**: nur für die höchste Rolle, nur im Zustand
  *archiviert*, mit Namenseingabe zur Bestätigung. Sie löscht streng nach
  Unternehmenskennung, von den Blättern zur Wurzel; die gemeinsamen
  Systemkataloge bleiben unberührt, das Protokoll überlebt.

## Nutzung der Auswertungsfunktionen

Verbrauch und Obergrenzen je Mandant sind einsehbar. Ist die Obergrenze
erreicht, pausieren die unterstützenden Funktionen — die manuelle Erfassung
läuft unverändert weiter.

## Beispiel- und Demodaten

Demo- und Interessentendaten werden über wiederholbare Skripte eingespielt
und zurückgesetzt. Grundsätze: nur **erfundene** Firmen-, Produkt-,
Lieferanten- und Personennamen; echte Stoffe und echte Rechtsverweise sind
in Ordnung. Jeder Datensatz ist als Beispiel erkennbar.

## Betrieb

- Gesundheitsprüfung über einen eigenen Endpunkt.
- Strukturierte Protokolle ohne Personendaten.
- Eine Prüfung im Erstellungslauf stellt sicher, dass Handbuch, Handbuchbau
  und Oberfläche nicht auseinanderlaufen; eine zweite, dass die Anwendung
  auch unter einem Unterpfad baut.
