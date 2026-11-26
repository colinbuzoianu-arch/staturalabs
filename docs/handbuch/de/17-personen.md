---
title: Personen
part: 2
order: 80
roles: []
module: PEOPLE
internal: false
summary: Das Personenregister — warum es getrennt vom übrigen System liegt, welche Daten darin stehen und wie Austritte behandelt werden.
---

# Personen

## Wozu

Für drei gesetzliche Zwecke braucht die Anwendung Personendaten:
**Unterweisungsnachweis**, **Ereignisakte** und **Erste Hilfe**. Für nichts
anderes.

Deshalb liegt das Personenregister in einem eigenen, abgetrennten Bereich.
Die Beurteilungskette — Arbeitsplatz, Tätigkeit, Haltungsbeurteilung,
Gefährdungsbeurteilung, Messwerte — enthält **keinen** Verweis auf eine
Person, und es gibt keine Auswertung und keinen Export, der beides
zusammenführt. Das ist nicht nur eine Regel in der Anleitung: ein
automatischer Test im Quellcode schlägt fehl, sobald jemand eine solche
Verbindung einbaut.

## Was im Register steht

- Name, Personalnummer,
- Eintritt und (falls vorhanden) Austritt,
- optional eine E-Mail-Adresse — sie entscheidet nur, wie ein Konto
  bereitgestellt wird,
- **Zuordnungen**: Arbeitsplatz und/oder Organisationseinheit, mit Zeitraum.

Die Zuordnung ist der Dreh- und Angelpunkt: aus ihr ergibt sich der
Unterweisungsbedarf, die Zuständigkeit einer Führungskraft und der Zugang
einer Beschäftigten zu den eigenen Betriebsanweisungen.

Beurteilungsergebnisse, Leistungsbewertungen oder Gesundheitsdaten stehen
hier nicht. Gesundheitsangaben gibt es ausschließlich in der Ereignisakte,
im geschützten Bereich der Arbeitsmedizin.

## Konto und Person sind zwei Dinge

Ein **Benutzerkonto** meldet sich an. Eine **Person** ist ein
Personalstammsatz. Das sind getrennte Datensätze; sie können verknüpft
werden, damit eine Beschäftigte ihre eigenen Unterweisungen sieht, müssen es
aber nicht. Die meisten Personen im Register haben kein Konto.

## Konten für Beschäftigte

Konten für Beschäftigte sind **standardmäßig ausgeschaltet** und werden vom
Unternehmen bewusst eingeschaltet (Einstellungen). Danach gibt es zwei Wege:

- **mit E-Mail-Adresse** — Einladung per E-Mail, wie bei allen anderen
  Rollen;
- **ohne E-Mail-Adresse** — die Anwendung erzeugt einen **Zugangscode**:
  einmalig verwendbar, 14 Tage gültig, immer nur einer gleichzeitig. Der
  Code wird **nur als Prüfsumme** gespeichert und genau einmal angezeigt —
  auf einem druckfähigen Übergabeblatt für die Person. Geht er verloren,
  wird ein neuer erzeugt; der alte ist damit ungültig.

Die Anmeldung mit Personalnummer und Zugangscode führt über dieselbe
Anmeldeseite. Eine öffentliche Registrierung gibt es nirgends.

## Austritt

Endet die Beschäftigung, endet der Zugang. Die Prüfung läuft bei **jeder**
Anfrage, nicht in einem nächtlichen Lauf: ab dem Austrittstag kommt die
Person nicht mehr hinein. Unter **Personen › Konten** lässt sich das
zusätzlich sichtbar machen — Konten werden deaktiviert und noch nicht
eingelöste Zugangscodes verfallen.

Der **Nachweis** über erfolgte Unterweisungen bleibt bestehen. Dass jemand
den Betrieb verlassen hat, löscht nicht die Dokumentation darüber, dass die
Pflicht erfüllt war.

## Anonymisierung und Aufbewahrung

Nach Ablauf der Aufbewahrungsfristen schlägt die Anwendung eine
**Anonymisierung** vor: der Personenbezug fällt weg, die Nachweise und
Kennzahlen bleiben. Die Freigabe erteilt ein Administrator; ein
Aufbewahrungsvorbehalt verhindert sie. Dieser Stapel ist von den
Löschvorgängen für Gefahrstoffe, Ereignisse und
Sicherheitsinformationen **getrennt** — sie werden nie gemeinsam
freigegeben.

## Statistik über Personen

Jede Auswertung, die sich aus Personendaten ergibt (z. B.
Unterweisungsquote), läuft durch eine Mindestgruppengröße. Liegt die Gruppe
darunter, zeigt die Anwendung **keine Zahl**, sondern den Hinweis, dass die
Gruppe zu klein ist. Einzelne Personen werden nirgends verglichen oder
gereiht.

## Häufige Fragen

**Sieht eine Führungskraft das ganze Personenregister?**
Sie sieht das Register lesend; ihre eigentliche Arbeitsfläche ist die
Unterweisungsmatrix ihrer eigenen Organisationseinheiten. Anlegen, ändern
und importieren dürfen nur Administratoren.

**Können wir Personen importieren?**
Ja, über den Import in den Einstellungen.
