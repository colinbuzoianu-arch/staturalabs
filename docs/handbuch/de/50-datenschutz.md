---
title: Datenschutz und Sicherheit
part: 5
order: 10
roles: []
module: none
internal: false
summary: Welche Daten entstehen, welche nicht, wer worauf zugreift, was protokolliert wird — und was die Anwendung bewusst nicht kann.
---

# Datenschutz und Sicherheit

Dieses Kapitel ist für die Einführung gedacht: für die Abstimmung mit dem
Betriebsrat, für die Verzeichnisse nach der Datenschutz-Grundverordnung und
für die Frage „Was passiert hier eigentlich mit unseren Daten?".

## Der Grundsatz: zwei getrennte Bereiche

Die **Beurteilungskette** — Arbeitsplatz, Tätigkeit, Haltungsbeurteilung,
Gefährdungsbeurteilung, Umweltbeurteilung, Messwerte — ist **personenfrei**.
Dort gibt es kein Feld, das eine Person benennt, und keines, das auf eine
Person verweist.

Personendaten liegen in einem **getrennten Bereich** — Personenregister,
Unterweisungsnachweise, Ereignisakten — und nur für benannte gesetzliche
Zwecke. Zwischen den beiden Bereichen besteht **keine** technische
Verbindung: keine Verknüpfung, keine gemeinsame Auswertung, kein
gemeinsamer Export. Ein automatischer Test im Quellcode schlägt fehl,
sobald jemand eine solche Verbindung einbaut.

Das ist der Unterschied zwischen „wir fragen die Daten nicht ab" und „die
Daten können nicht zusammengeführt werden".

## Was die Anwendung nicht tut

- **Keine Kamera, kein Video, keine Bilderkennung von Personen.** Die
  Haltungsbeurteilung ist eine **Einstufung** durch die beurteilende Person
  („Rumpf: gebeugt"), keine Messung an einer Aufnahme. Es gibt keinen
  Aufnahmeweg und keine Auswertung von Videomaterial.
- **Keine Leistungs- oder Verhaltenskontrolle.** Es gibt keine Kennzahl je
  Person, keine Reihung von Personen, keine Anwesenheits- oder
  Nutzungsauswertung über Beschäftigte.
- **Keine automatische Entscheidung über Menschen.** Jede Bewertung wird
  von einem Menschen gesetzt oder bestätigt.

## Gesundheitsdaten

Angaben zur Verletzung in einer Ereignisakte sind der engste Bereich:

- medizinische Freitexte liegen **verschlüsselt**;
- Zugriff hat ausschließlich die Rolle **Arbeitsmedizin**;
- jeder Lesezugriff wird protokolliert, bevor der Text erscheint;
- kein Export, keine Auswertung, kein Meldeblatt enthält diese Texte.

## Statistik über kleine Gruppen

Jede Kennzahl, die aus Personendaten entsteht, läuft durch eine
Mindestgruppengröße. Darunter zeigt die Anwendung keinen Wert — auch nicht
im Export. Sonst wäre die Quote einer Dreiergruppe eine Aussage über eine
Person.

## Protokollierung

Jede Änderung in einem regulierten Modul wird mit Zeitpunkt, handelnder
Person und Gegenstand protokolliert. Das Protokoll ist **anfügend**: es
lässt sich nicht ändern und nicht löschen, auch nicht durch einen
Administrator. IP-Adressen werden nur als Prüfsumme gespeichert. Protokolle
enthalten keine Personendaten im Klartext.

## Mandantentrennung

Jedes Unternehmen sieht ausschließlich seine eigenen Daten. Der Zugriff wird
bei **jeder** Abfrage geprüft, nicht nur in der Oberfläche. Ein Aufruf eines
fremden Datensatzes über die Adresszeile endet auf einer Fehlseite — die
Anwendung bestätigt nicht einmal, dass der Datensatz existiert.

## Zugriff durch den Anbieter

Unterstützung erfolgt im Vertretungszugriff: **nur lesend**, am Bildschirm
sichtbar gekennzeichnet, protokolliert, Änderungen gesperrt.

## Aufbewahrung und Löschung

Fristen sind je Art und Land hinterlegt, mit ihrer Grundlage (gesetzlich
oder betriebliche Voreinstellung). Löschungen laufen über getrennte Stapel
mit ausdrücklicher Freigabe; ein Aufbewahrungsvorbehalt hält sie zurück.
Personenbezogene Daten werden anonymisiert, nicht stillschweigend entfernt —
die Nachweise bleiben, die Namen fallen weg.

## Unterlagen für die Einführung

Zur Anwendung gehören Vorlagen für die Auftragsverarbeitung, eine
Beschreibung der technischen und organisatorischen Maßnahmen, eine Liste
der eingesetzten Unterauftragsverarbeiter und eine Mitbestimmungsunterlage.
Fragen Sie danach — sie sind für Ihre Prüfung gemacht.

## Häufige Fragen

**Werden Daten außerhalb Europas verarbeitet?**
Fragen Sie nach der aktuellen Liste der Unterauftragsverarbeiter; sie
benennt jeden Dienst und seinen Zweck. Für die unterstützenden
Auswertungsfunktionen bei Gefahrstoffen ist eine solche Verarbeitung
beteiligt — sie ist nur nach Freischaltung aktiv.

**Kann ein Administrator alles sehen?**
Nein. Gesundheitsdaten nicht, und Protokolle nicht verändern.
