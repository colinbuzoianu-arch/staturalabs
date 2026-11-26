---
title: Import von Stammdaten
part: 4
order: 40
roles: [COMPANY_ADMIN, SITE_ADMIN, SUPER_ADMIN, L3_SUPPORT]
module: none
internal: false
summary: CSV einlesen mit Probelauf, Fehlerbericht je Zeile und erst danach Übernahme.
---

# Import von Stammdaten

## Ablauf

Jeder Import läuft in derselben Reihenfolge, ohne Ausnahme:

1. **Vorlage herunterladen** — eine CSV mit den erwarteten Spalten.
2. **Datei hochladen** oder Inhalt einfügen.
3. **Probelauf** — die Anwendung prüft jede Zeile und zeigt einen Bericht:
   was übernommen würde, was nicht, und **warum** (je Zeile).
4. **Übernehmen** — erst jetzt wird geschrieben. Dabei wird **erneut**
   geprüft; der Probelauf allein ist kein Freifahrtschein.

Jede Übernahme wird protokolliert.

## Was importierbar ist

- **Arbeitsstunden und Personalstand** (für die Raten in den Auswertungen),
- **Ereignisse** — ausschließlich die personenfreien Fallangaben,
- **Fahrzeuge**,
- **Personen** und **Organisationseinheiten** (eigene Importwege).

Noch nicht über diesen Weg: Unterweisungsnachweise, Stoffe mit
Datenblättern, Begehungshistorie. Ein freies Zuordnen von Spalten im
Bildschirm ist ebenfalls noch nicht umgesetzt — halten Sie sich an die
Spaltennamen der Vorlage.

## Hinweise zur Datei

- Trennzeichen und Kodierung wie in der Vorlage.
- Die Kopfzeile wird automatisch zugeordnet; abweichende Bezeichnungen
  werden erkannt, wenn sie bekannt sind — sonst meldet der Probelauf die
  Spalte als unbekannt.
- Ein Import **ergänzt**; er löscht nichts.

## Häufige Fragen

**Der Probelauf meldet eine Zeile als Dublette.**
Dann existiert der Datensatz bereits (etwa dieselbe Personalnummer). Der
Import ist dadurch wiederholbar, ohne doppelte Datensätze zu erzeugen.

**Kann ich einen Import rückgängig machen?**
Nicht als Ganzes. Deshalb gibt es den Probelauf — prüfen Sie den Bericht,
bevor Sie übernehmen.
