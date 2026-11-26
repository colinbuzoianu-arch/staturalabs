---
title: Ereignisse — Unfälle, Beinaheunfälle, Beschwerden
part: 2
order: 50
roles: []
module: INCIDENTS
internal: false
summary: Meldung, Untersuchung, Meldefristen an den Unfallversicherungsträger, Verbandbuch und der geschützte Gesundheitsbereich.
---

# Ereignisse

## Wozu

Ein Ereignis ist alles, was gemeldet werden soll: Arbeitsunfall,
Beinaheunfall, Wegunfall, Sachschaden, Umweltereignis, Fahrzeugereignis,
Beschwerde, Haftungsfall. Das Modul führt den Fall von der Meldung über die
Untersuchung bis zur Maßnahme — und hält fest, ob eine gesetzliche Meldung
fällig war und wann sie erfolgt ist.

## Der Fallverlauf

**Gemeldet → Eingestuft → In Untersuchung → Maßnahmen offen →
Abgeschlossen.** Ein Fall darf genau einmal wieder geöffnet werden.

Jeder Schritt wird protokolliert. Der Fall selbst ist **personenfrei
aufgebaut**: der Sachverhalt wird als Text beschrieben, und die Anwendung
weist ausdrücklich darauf hin, dass in diese Beschreibung **keine Namen**
gehören. Betroffene Personen werden an genau einer Stelle zugeordnet (siehe
unten), nicht in der Schilderung.

## Schnellmeldung

Unter **Ereignisse › Schnellmeldung** gibt es eine für das Telefon gedachte
Erfassung: wenige Felder, funktioniert ohne Verbindung und sendet, sobald
wieder Netz vorhanden ist. Gedacht für den Moment, in dem etwas passiert —
die Einstufung und Untersuchung folgt später am Schreibtisch.

## Beteiligte Personen

Erst in der Fallakte wird eine Person aus dem Personenregister zugeordnet.
Das ist die einzige Stelle, an der eine Person und ein Ereignis zusammen
geführt werden, und sie existiert, weil das Gesetz es verlangt. Es gibt
keine Verbindung von dieser Zuordnung zu einer Arbeitsplatz-Beurteilung.

## Gesundheitsdaten

Angaben zur Verletzung liegen in einem eigenen, zusätzlich geschützten
Bereich:

- **grobe Angaben** (Verletzungsart, Körperregion, Ausfalltage, tödlich,
  Erstversorgung) — werden für das Meldeblatt und die Kennzahlen gebraucht;
- **medizinische Freitexte** — sind **verschlüsselt** gespeichert.

Zugriff hat ausschließlich die Rolle **Arbeitsmedizin**. Jeder Lesezugriff
wird protokolliert, bevor der Text angezeigt wird. Administratoren,
EHS-Fachkräfte und der Betriebsrat sehen diesen Bereich nicht — auch nicht
über eine Auswertung, einen Export oder das Meldeblatt.

## Meldefristen

Die Anwendung kennt die Meldepflicht je Land und rechnet die Frist aus dem
Ereigniszeitpunkt:

- **Österreich** — Meldung an den Unfallversicherungsträger nach § 363 ASVG.
- **Deutschland** — Anzeige nach § 193 SGB VII; bei tödlichen oder
  Massenunfällen sofort. Die Anwendung erinnert zusätzlich an die
  Unterrichtung des Betriebsrats.
- **Schweiz** — in der Anwendung bewusst noch nicht als Frist hinterlegt.

In der Fallakte erscheint der Countdown, der Rechtsverweis und die
Möglichkeit, die Meldung als **erfolgt** zu vermerken (mit Datum und
Referenz) oder begründet zu **verzichten**. Für Österreich und Deutschland
lässt sich ein vorbereitetes, deutschsprachiges **Datenblatt** als PDF
erzeugen. Es ist ausdrücklich **kein amtliches Formular**, enthält nur die
groben Angaben und niemals die verschlüsselten Freitexte.

Für ein Land ohne geprüfte Rechtsgrundlage erzeugt die Anwendung **kein**
Dokument und sagt das auch — eine erfundene Frist wäre schlimmer als eine
Lücke.

## Verbandbuch

Erste-Hilfe-Leistungen werden als eigene Einträge geführt und als
druckfähiges **Verbandbuch** ausgegeben. Medizinische Freitexte erscheinen
dort nie. Grundlage in Deutschland ist § 24 DGUV Vorschrift 1.

## Untersuchung und Maßnahmen

Zu jedem Fall gehört eine Untersuchung: Methode, Ursachen, Ergebnis. Daraus
entstehen Maßnahmen, die im gemeinsamen Maßnahmenregister landen und das
Ereignis als Quelle tragen.

## Beschwerden und Haftungsfälle

Zwei Ereignisarten sind keine Unfälle: **Beschwerde** (mit Quelle und
Gegenstand) und **Haftungsfall** (mit Anspruchsgrundlage). Eine Beschwerde
kann anonym gemeldet werden — ohne Melder.

## Aufbewahrung

Ereignisse, Gesundheitsangaben und Erste-Hilfe-Einträge haben eigene
Aufbewahrungsfristen je Land (Österreich: § 16 ASchG). Nach Ablauf schlägt
die Anwendung die Löschung in einem eigenen Stapel vor, der getrennt von
allen anderen Löschvorgängen freigegeben wird. Ein gesetzlicher
Aufbewahrungsvorbehalt („legal hold") verhindert die Löschung.

## Häufige Fragen

**Wer darf ein Ereignis melden?**
Jede Rolle mit Lesezugriff auf das Modul; erfassen und bearbeiten dürfen
EHS-Fachkräfte, Führungskräfte und Administratoren. Beschäftigte sehen ihre
eigenen Meldungen.

**Warum sehe ich die medizinischen Angaben nicht?**
Weil Sie nicht die Rolle Arbeitsmedizin haben. Das ist keine Einstellung,
die sich im Unternehmen freischalten lässt.
