# Videoskripte (DE) — Statura Labs Dynamics

P18 Teil C. Zehn Videos, deutschsprachig, für Website, Vertrieb und
Einführung. Der Gründer spricht, das Bild kommt aus dem Demo-Mandanten.

## Vor jeder Aufnahme

1. Demo-Mandanten zurücksetzen und neu einspielen — die Skripte setzen die
   Demodaten voraus (fiktive Firma, fiktive Personen, echte Stoffe und echte
   Rechtsverweise):

   ```
   npm run reset:demo && npm run seed:demo
   npm run seed:prospect
   ```

2. Entwicklungsserver starten (`npm run dev`) und **Sprache Deutsch**
   einstellen (Sprachumschalter in der Kopfzeile).
3. **Helles Design**, Fenster 1920 × 1080, Browserleiste ausblenden oder
   beschneiden. Keine Lesezeichenleiste, keine Benachrichtigungen.
4. Der Mandant heißt sichtbar „DEMO" — das ist gewollt und darf im Bild
   bleiben; es ist ehrlicher als ein erfundener Kundenname.
5. Nichts zeigen, was nicht im Demo-Mandanten steht. Keine Funktion
   ankündigen, die es nicht gibt (siehe „Nicht sagen" je Skript).

## Rollen und Konten (Demo-Mandant, Standort Österreich)

| Kürzel im Skript | Konto | Rolle |
| --- | --- | --- |
| **ADMIN** | `demo-admin@statura.local` | Administrator |
| **STANDORT** | `demo-standortadmin@statura.local` | Standortadministrator |
| **EHS** | `demo-ehsfachkraft@statura.local` | EHS-Fachkraft |
| **FÜHRUNG** | `demo-fuehrungskraft@statura.local` | Führungskraft |
| **MITARBEIT** | `demo-mitarbeiter@statura.local` | Mitarbeitende |

Kennwort: das veröffentlichte Demo-Kennwort (`DEMO_PASSWORD`, Standard
`demo1234`).

`{siteId}` steht für die Kennung des österreichischen Demo-Standorts; sie
steht in der Adresszeile, sobald ein Standort gewählt ist.

---

## 1 — Überblick: SLD in 3 Minuten

**Länge** 3:30 · **Rolle** ADMIN

**Klickweg**

1. `/app/sites` — Standortauswahl.
2. `/app/s/{siteId}` — Cockpit.
3. Seitenleiste von oben nach unten einmal durchzeigen (nicht klicken).
4. `/app/s/{siteId}/risk/workstations` — Arbeitsplätze mit Risikostufen.
5. `/app/s/{siteId}/actions` — Maßnahmenregister, Filter „Überfällig".
6. `/app/s/{siteId}/reports/kpis` — Kennzahlen.
7. `/app/s/{siteId}/documents/generated` — Archiv der erzeugten Dokumente.

**Sprechtext**

> Arbeitnehmerschutz ist in den meisten Betrieben dokumentiert — nur
> verstreut. In Tabellen, in Ordnern, in E-Mail-Anhängen. Statura Labs
> Dynamics führt diese Dokumentation an einem Ort, für Österreich und
> Deutschland, und beweist am Ende etwas, das eine Tabelle nicht beweisen
> kann: dass die Maßnahmen gewirkt haben.
>
> Das ist das Cockpit eines Standorts. Links die Module, gruppiert nach
> Aufgabe: beurteilen, erledigen, nachweisen, verwalten. Sichtbar ist nur,
> was für diesen Betrieb freigeschaltet und für diese Rolle zugelassen ist.
>
> Hier sind die Arbeitsplätze mit ihrer Risikostufe. Ein Arbeitsplatz ohne
> Beurteilung ist eigens hervorgehoben — denn eine fehlende Beurteilung ist
> selbst ein Befund.
>
> Jede Feststellung führt zu einer Maßnahme. Jede Maßnahme hat eine Quelle,
> eine Verantwortlichkeit, eine Frist — und einen Wirksamkeitsnachweis. Ohne
> Nachweis lässt sich eine Maßnahme nicht abschließen.
>
> Daraus rechnet die Anwendung die Kennzahlen, ohne zweite Erfassung. Und
> jedes erzeugte Dokument liegt im Archiv, mit Prüfsumme, in der Fassung, in
> der es erstellt wurde.
>
> Kein Video, keine Kamera, keine Bewertung von Personen. Beurteilt wird der
> Arbeitsplatz.

**Nicht sagen:** keine Zertifizierung, keine Rechtsberatung, keine Schweiz
als verfügbaren Markt.

---

## 2 — Arbeitsplatzevaluierung / Gefährdungsbeurteilung

**Länge** 3:00 · **Rolle** EHS

**Klickweg**

1. `/app/s/{siteId}/risk/workstations` — Liste, einen Arbeitsplatz öffnen.
2. Im Arbeitsplatz-Hub die 13 Kategorien zeigen; eine offene Kategorie
   aufklappen.
3. Eine Feststellung anlegen: Gefährdung wählen, Wahrscheinlichkeit und
   Schwere setzen — die Risikostufe erscheint.
4. Einen Messwert ergänzen (Lärm): die zweistufigen österreichischen
   Grenzwerte werden vorbelegt und die Überschreitung markiert.
5. Haltungsbeurteilung: die Einstufung je Körperzone zeigen.
6. Vollständigkeitsbalken zeigen, dann „Zur Prüfung einreichen".
7. `/app/s/{siteId}/risk/assessments` — Status, dann das erzeugte Dokument
   herunterladen.

**Sprechtext**

> Eine Evaluierung je Arbeitsplatz — in Deutschland
> Gefährdungsbeurteilung. Die Anwendung verwendet den Begriff des
> Standortlandes.
>
> Dreizehn Gefährdungskategorien, als Checkliste. Jede wird bearbeitet. „Kein
> Risiko" ist eine zulässige Antwort — aber eine bewusste, begründete. Solange
> eine Kategorie offen ist, lässt sich die Beurteilung nicht einreichen.
>
> Eine Feststellung wird gegen einen versionierten Gefährdungskatalog
> angelegt und über die Risikomatrix bewertet: Wahrscheinlichkeit mal
> Schwere.
>
> Bei einem Messwert kennt die Anwendung die Grenzwerte des Standortlandes.
> In Österreich sind es bei Lärm zwei Stufen — Auslösewert und
> Expositionsgrenzwert. Beide werden ausgewiesen, beide stehen im Dokument.
>
> Die Körperhaltung wird eingestuft, nicht gemessen. Es gibt keine Kamera und
> kein Video. Haltung, Haltedauer, Lastgewicht und Wiederholung bleiben
> getrennte Teilwerte — sie werden nie zu einer Zahl verrechnet, die alles
> verdeckt.
>
> Einreichen, freigeben — und das Dokument ist fertig: in Österreich das
> Sicherheits- und Gesundheitsschutzdokument, mit einer Tabelle zur
> Vollständigkeit über alle Kategorien.

**Nicht sagen:** keine Aussage darüber, dass die Beurteilung fachlich
richtig sei — die Anwendung dokumentiert, sie beurteilt nicht.

---

## 3 — Begehungen & Audits

**Länge** 2:30 · **Rolle** EHS

**Klickweg**

1. `/app/s/{siteId}/inspections/templates` — eine Vorlage mit Abschnitten
   und Fragen öffnen.
2. `/app/s/{siteId}/inspections/planned` — eine Begehung planen (Termin,
   Ort, Team).
3. Begehung öffnen, einige Antworten erfassen.
4. Eine Beobachtung anlegen, Schwere setzen.
5. Abschluss versuchen, solange eine Pflichtfrage offen ist — die Anwendung
   nennt sie.
6. Antwort nachtragen, abschließen.
7. Aus der Beobachtung eine Maßnahme erzeugen; in
   `/app/s/{siteId}/actions` wiederfinden.

**Sprechtext**

> Die Beurteilung beschreibt den Soll-Zustand. Die Begehung prüft, ob es vor
> Ort noch so ist.
>
> Jede Begehung entsteht aus einer Vorlage — mitgeliefert, oder eigene je
> Unternehmen und Standort. Beim Anlegen werden die Fragen in die Begehung
> kopiert: ändert sich die Vorlage später, bleibt die abgeschlossene Begehung
> genau das Dokument, das durchgeführt wurde.
>
> Begehungen beurteilen Zustände, nicht Personen. Auf Fotos gehören keine
> Beschäftigten — darauf weist die Anwendung bei jedem Hochladen hin.
>
> Abschließen lässt sich erst, wenn jede Pflichtfrage beantwortet ist. Auch
> hier: Vollständigkeit ist eine Bedingung, keine Disziplin.
>
> Und was auffällt, bleibt kein Zettel: aus der Beobachtung wird eine
> Maßnahme im gemeinsamen Register — mit der Begehung als Quelle.

---

## 4 — Ereignisse und gesetzliche Meldefristen

**Länge** 3:00 · **Rolle** EHS

**Klickweg**

1. `/app/s/{siteId}/incidents/reports` — die Liste mit dem seeded
   Arbeitsunfall.
2. Den österreichischen Fall öffnen: Verlauf, Frist-Countdown,
   Rechtsverweis.
3. Das vorbereitete Meldeblatt herunterladen.
4. Zum deutschen Standort wechseln und dort den Fall öffnen: kürzere Frist,
   Hinweis auf die Unterrichtung des Betriebsrats.
5. `/app/s/{siteId}/incidents/verbandbuch` — Verbandbuch zeigen.
6. `/app/s/{siteId}/incidents/quick` — Schnellmeldung zeigen (Telefonbreite).

**Sprechtext**

> Ein Ereignis ist alles, was gemeldet werden soll: Arbeitsunfall,
> Beinaheunfall, Wegunfall, Sachschaden, Beschwerde.
>
> Der Fall läuft von der Meldung über die Einstufung und Untersuchung bis zur
> Maßnahme. Die Schilderung ist bewusst personenfrei — die Anwendung weist
> darauf hin, dass dort keine Namen hingehören. Betroffene Personen werden an
> genau einer Stelle zugeordnet.
>
> Die Meldefrist kennt die Anwendung je Land und rechnet sie aus dem
> Ereigniszeitpunkt: in Österreich die Meldung an den
> Unfallversicherungsträger, in Deutschland die Anzeige mit kürzerer Frist,
> dazu der Hinweis auf die Unterrichtung des Betriebsrats.
>
> Das Datenblatt ist vorbereitet und deutschsprachig — ausdrücklich kein
> amtliches Formular, und es enthält nur die groben Angaben. Für ein Land
> ohne geprüfte Rechtsgrundlage erzeugt die Anwendung kein Dokument und sagt
> das auch. Eine erfundene Frist wäre schlimmer als eine Lücke.
>
> Medizinische Angaben liegen in einem eigenen, verschlüsselten Bereich.
> Zugriff hat ausschließlich die Arbeitsmedizin, und jeder Lesezugriff wird
> protokolliert. Weder dieses Meldeblatt noch eine Auswertung enthält diese
> Texte.
>
> Erste-Hilfe-Leistungen führt die Anwendung als Verbandbuch. Und für den
> Moment, in dem etwas passiert, gibt es die Schnellmeldung — wenige Felder,
> funktioniert ohne Verbindung.

---

## 5 — Maßnahmen und Aktivitätenkalender

**Länge** 2:30 · **Rolle** EHS

**Klickweg**

1. `/app/s/{siteId}/actions` — Register, Filter „Offen", „Überfällig",
   „Wartet auf Wirksamkeitsprüfung".
2. Eine Maßnahme öffnen: Quelle, Rangfolge, Verantwortliche, Frist,
   Statushistorie.
3. Status auf „Umgesetzt" setzen.
4. Wirksamkeitsprüfung versuchen ohne Nachweis — die Anwendung lässt es
   nicht zu.
5. Erneute Beurteilung als Nachweis verknüpfen, Ergebnis „wirksam" setzen.
6. `/app/s/{siteId}/actions/effectiveness` — die Übersicht.
7. `/app/s/{siteId}/calendar` — Fälligkeiten aller Module; dann `/app/me`.

**Sprechtext**

> Ein Register für alle Maßnahmen — gleich, woraus sie entstanden sind. Und
> jede Maßnahme hat genau eine Quelle: eine Feststellung, eine Beobachtung,
> ein Ereignis, eine Konformitätsbewertung. Es gibt keine Maßnahme ohne
> Befund.
>
> Die Rangfolge der Schutzmaßnahmen steht am Eintrag: eine technische Lösung
> ist einer Unterweisung vorzuziehen — und die Auswertung zeigt später, wie
> das in Ihrem Betrieb verteilt ist.
>
> „Umgesetzt" ist noch kein Nachweis. Für den Abschluss verlangt die
> Anwendung zwingend ein Ergebnis und einen Beleg: entweder eine erneute
> Beurteilung nach der Maßnahme, oder eine schriftliche Begründung. Das ist
> absichtlich unbequem. Der Vergleich vorher–nachher ist der eigentliche
> Wert der Dokumentation.
>
> Jeder Statuswechsel wird protokolliert und lässt sich nicht nachträglich
> ändern.
>
> Alle Fälligkeiten aus allen Modulen stehen im Aktivitätenkalender — und was
> davon Sie selbst betrifft, finden Sie in „Meine Aufgaben", über alle Ihre
> Standorte.

---

## 6 — Gefahrstoffe: Sicherheitsdatenblatt einlesen und prüfen

**Länge** 3:00 · **Rolle** EHS

**Klickweg**

1. `/app/s/{siteId}/chemicals/register` — Register mit Einstufung und
   SDB-Warnungen.
2. Einen Stoff öffnen: Piktogramme, H- und P-Sätze, CMR-Kategorien,
   Verwendungen.
3. `/app/s/{siteId}/chemicals/sds-review` — einen eingelesenen Entwurf mit
   Seitenangabe und Textstelle Feld für Feld bestätigen.
4. Registerkarte „Prüfung & Berechnung": die Abweichung beim Flammpunkt.
5. `/app/s/{siteId}/chemicals/deviations` — Abweichungen je Standort.
6. `/app/s/{siteId}/chemicals/operating-instructions` — eine
   Betriebsanweisung freigeben und als PDF zeigen.
7. Das Verzeichnis erzeugen (Arbeitsstoffliste für Österreich).

**Sprechtext**

> Das Stoffregister führt, was im Betrieb tatsächlich verwendet wird — mit
> der Einstufung nach CLP und den CMR-Eigenschaften in drei getrennten
> Kategorien, weil die Rechtsfolgen unterschiedlich sind.
>
> Sicherheitsdatenblätter sind versioniert. Eine neue Fassung ersetzt die
> alte nicht, sie löst sie ab — die vorige bleibt nachweisbar. Fehlt ein
> Datenblatt, ist es veraltet oder nicht deutschsprachig, warnt das Register.
>
> Ein Datenblatt kann die Anwendung einlesen und als Vorschlag vorlegen: zu
> jedem Feld die Seite und die Textstelle, auf die sich der Vorschlag
> stützt. Übernommen wird nichts, bevor Sie es bestätigt haben. Was nicht
> gefunden wird, bleibt leer — es wird nichts geraten.
>
> Daneben rechnet die Anwendung selbst und stellt das Ergebnis neben die
> Lieferantenangabe. Hier weicht der Flammpunkt ab. Das ist ausdrücklich eine
> Prüfhilfe, keine Einstufung: es fließt nicht in das Verzeichnis, nicht in
> eine Betriebsanweisung, nicht in eine Kennzeichnung und nicht in ein nach
> außen gegebenes Datenblatt. Fehlt das Regelwerk, verweigert die Prüfung die
> Antwort, statt zu schätzen.
>
> Aus Stoff und Verwendung entsteht die Betriebsanweisung — mit Freigabe und
> Archivierung. Erscheint ein neues Datenblatt, wird sie als prüfbedürftig
> markiert; sie wird nicht stillschweigend geändert und nicht stillschweigend
> ungültig.
>
> Und das Verzeichnis: in Deutschland das Gefahrstoffverzeichnis, in
> Österreich die Arbeitsstoffliste.

**Nicht sagen:** nicht behaupten, die Rechenergebnisse seien geprüft oder
verwendbar für eine Einstufung. Sie laufen als Vorschau.

---

## 7 — Unterweisungen aus Sicht der Führungskraft

**Länge** 2:30 · **Rolle** FÜHRUNG

**Klickweg**

1. Anmelden als FÜHRUNG — die Seitenleiste ist kürzer als die der
   EHS-Fachkraft.
2. `/app/s/{siteId}/training/matrix` — nur die eigene Organisationseinheit;
   die vier Zustände und die Begründung je Zeile.
3. `/app/s/{siteId}/training/sessions` — einen Termin planen.
4. Teilnahme erfassen, Nachweis als PDF herunterladen.
5. `/app/s/{siteId}/legal/register` über die Adresszeile aufrufen — Fehlseite.

**Sprechtext**

> Das ist die Sicht einer Führungskraft. Sie ist für ihre eigenen Bereiche
> zuständig — nicht für den Standort. Die Seitenleiste ist deshalb kürzer.
>
> Die Matrix zeigt je Person und Unterweisungsart vier Zustände: erfüllt,
> läuft ab, fällig, nicht vorhanden. Und sie nennt den Grund — abgeleitet aus
> der Tätigkeit, einem verwendeten Gefahrstoff, einer Maßnahme oder einer
> Pflichtlektüre. Die Anwendung behauptet keinen Bedarf ohne Begründung.
>
> Termin planen, Teilnahme erfassen, Nachweis erzeugen: Thema, Inhalt, Datum,
> Dauer, Unterweisende, Teilnehmerliste zum Unterschreiben.
>
> Was diese Rolle nicht darf, ist nicht ausgegraut — es ist nicht
> erreichbar. Auch nicht über die Adresszeile. Und es gibt keine Kennzahl je
> Person: diese Anwendung taugt nicht zur Leistungskontrolle, und das ist
> eine Entscheidung, nicht ein Zufall.

---

## 8 — Rechtskataster

**Länge** 2:30 · **Rolle** EHS

**Klickweg**

1. `/app/s/{siteId}/legal/register` — Register, Filter nach Bereich und
   Status.
2. Eine Pflicht öffnen: Kurzbeschreibung, Rechtsverweis mit Quelle,
   Anwendbarkeitsvorschlag mit Begründung.
3. „Gilt nicht" wählen — die Anwendung verlangt eine Begründung.
4. Eine andere Pflicht als anwendbar bestätigen und bewerten („teilweise
   konform").
5. Aus der Bewertung eine Maßnahme erzeugen.
6. `/app/s/{siteId}/legal/review-due` — überfällige Prüfungen.
7. Kurz einen Schweizer Standort zeigen: ehrliche Lücke.

**Sprechtext**

> Die Frage „Welche Vorschriften gelten für diesen Standort, und erfüllen wir
> sie?" ist in vielen Betrieben Erfahrungswissen. Hier ist sie ein Register.
>
> Die Anwendung schlägt vor, ob eine Pflicht gilt, und begründet den
> Vorschlag. Entschieden wird von einem Menschen. Wer eine Pflicht als nicht
> anwendbar ablegt, muss begründen — das ist die Zeile, die eine Prüfung
> lesen wird.
>
> Zur anwendbaren Pflicht kommt die Bewertung: konform, teilweise, nicht
> konform — mit Begründung und Nachweis. Jede Änderung bleibt im Verlauf
> lesbar. Und aus einer nicht konformen Bewertung wird direkt eine Maßnahme.
>
> Jeder Rechtsverweis trägt, wie er geprüft wurde. Nichts darin stammt aus
> dem Gedächtnis eines Sprachmodells. Und wenn für ein Land kein geprüfter
> Bestand vorliegt — wie derzeit für die Schweiz —, dann bleibt die Lücke
> sichtbar, statt mit dem Recht eines anderen Landes gefüllt zu werden.

---

## 9 — Auswertungen und Kennzahlen

**Länge** 2:30 · **Rolle** ADMIN

**Klickweg**

1. `/app/s/{siteId}/reports/kpis` — Kennzahlen, Jahr wechseln.
2. Auf Unternehmenssicht umschalten.
3. Arbeitsstunden und Personalstand zeigen — eine Rate ohne Nenner bleibt
   leer.
4. Eine unterdrückte Kennzahl zeigen (kleine Gruppe).
5. CSV exportieren und die Datei öffnen: die Unterdrückung steht auch dort.

**Sprechtext**

> Die Auswertung beantwortet die Frage, die in der Geschäftsleitung gestellt
> wird: Wird es besser? Gerechnet wird aus den Daten, die ohnehin im System
> stehen — es gibt keine zweite Erfassung für Kennzahlen.
>
> Unfälle und Unfallraten, Ausfalltage, Beinaheunfälle, offene und überfällige
> Maßnahmen, Wirksamkeit, Vollständigkeit der Beurteilungen,
> Unterweisungsquote, Begehungen, Aktualität der Sicherheitsdatenblätter,
> Abfallmengen.
>
> Raten brauchen einen Nenner. Arbeitsstunden und Personalstand tragen Sie je
> Standort und Jahr ein — als Zahl, nicht als Personenliste. Fehlt der
> Nenner, zeigt die Anwendung keinen Wert; sie rechnet nicht mit einer
> geschätzten Belegschaft.
>
> Und wo eine Kennzahl aus Personendaten entsteht, läuft sie durch eine
> Mindestgruppengröße. Liegt die Gruppe darunter, erscheint ein Hinweis statt
> einer Zahl — auch im Export. Sonst wäre die Quote einer Dreiergruppe eine
> Aussage über eine Person.

---

## 10 — Rollen und Zugang für Mitarbeitende

**Länge** 3:00 · **Rolle** ADMIN, dann MITARBEIT

**Klickweg**

1. Als ADMIN: `/app/s/{siteId}/settings/users` — Rollen und
   Zuständigkeitsbereiche.
2. `/app/s/{siteId}/settings/roles` — Rechtebündel und die festen Schranken.
3. `/app/s/{siteId}/people/accounts` — Beschäftigtenkonten einschalten,
   Zugangscode erzeugen, Übergabeblatt zeigen (Code genau einmal sichtbar).
4. Abmelden; auf der Anmeldeseite „Personalnr. & Zugangscode" verwenden.
5. Als MITARBEIT: `/app/me/instructions`, `/app/me/documents`,
   `/app/me/broadcasts`, `/app/me/incidents`.
6. `/app/s/{siteId}` über die Adresszeile aufrufen — Fehlseite.

**Sprechtext**

> Fünf Rollen im Betrieb, zwei besondere. Jede hat nicht nur Rechte, sondern
> auch einen Zuständigkeitsbereich: ein Unternehmen, Standorte,
> Organisationseinheiten — oder nur die eigenen Daten.
>
> Die Rechtebündel lassen sich je Betrieb anpassen, innerhalb fester
> Schranken: Gesundheitszugriff ist nie an Führungskräfte, Beschäftigte oder
> EHS-Fachkräfte vergebbar, und eine Führungskraft kommt nie über ihren
> Bereich hinaus. Jede Änderung wird protokolliert.
>
> Konten für Beschäftigte sind standardmäßig aus. Schaltet der Betrieb sie
> ein, gibt es zwei Wege: Einladung per E-Mail — oder, für Beschäftigte ohne
> betriebliche Adresse, ein Übergabeblatt mit Personalnummer und einem
> einmaligen Zugangscode. Der Code ist 14 Tage gültig, wird nur als
> Prüfsumme gespeichert und genau einmal angezeigt. Eine öffentliche
> Registrierung gibt es nirgends.
>
> So sieht es für die Beschäftigte aus: ihre Unterweisungen mit Begründung,
> ihre Betriebsanweisungen, die an sie gerichteten Sicherheitsinformationen
> mit Bestätigung, ihre eigenen Meldungen. Und sonst nichts — auch nicht über
> die Adresszeile.
>
> Endet die Beschäftigung, endet der Zugang am Austrittstag. Geprüft wird das
> bei jeder Anfrage, nicht in einem nächtlichen Lauf. Der
> Unterweisungsnachweis bleibt.

---

## Rohaufnahmen automatisch erzeugen (optional)

`npm run docs:videos` fährt die Klickwege der Skripte 1–10 im
Demo-Mandanten automatisch ab und nimmt stumme Bildschirmvideos in 1080p
auf (`docs/videos/raw/`). Gedacht als Rohmaterial oder als Probelauf — der
Sprechtext kommt in jedem Fall vom Gründer.

Playwright ist absichtlich keine Projekt-Abhängigkeit (ein mehrere hundert
Megabyte großer Browser-Download, den nur dieses Skript und die Screenshots
brauchen):

```
npm i -D playwright && npx playwright install chromium
npm run dev
npm run docs:videos
```

Die Aufnahme deckt nur die reinen Navigationswege ab. Schritte, die etwas
schreiben (eine Feststellung anlegen, eine Maßnahme abschließen, einen
Zugangscode erzeugen), sind bewusst **nicht** automatisiert: sie würden den
Demo-Mandanten während der Aufnahme verändern und die nächste Aufnahme
anders aussehen lassen. Diese Teile nimmt der Gründer live auf, nach einem
`npm run reset:demo && npm run seed:demo`.
