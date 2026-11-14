# Demo-Skript Gefahrstoffe (Prospect-Demo, ~10 Minuten)

**Zweck:** Vorführung der Gefahrstoff-Prüf- und Berechnungslogik als **Prüfhilfe**
auf einem geseedeten Prospect-Mandanten. Jeder Berechnungswert ist eine
**Vorschau** — nicht fachlich geprüft, nicht für Kennzeichnung, SDB oder
Weitergabe. Der Banner „Vorschau-Berechnung — nicht fachlich geprüft …" steht auf
jedem Berechnungs-Screen.

**Vorbereitung:** `npm run seed:prospect` (einmalig; idempotent). Danach sind alle
Engines für den Demo-Mandanten auf **PREVIEW**, sechs Demo-Produkte mit vollem SDB
und Zusammensetzung liegen vor. Anmeldung als `demo-admin`, Sprache Deutsch.
Rahmen für Interessenten: *„Berechnungslogik als Prüfhilfe; fachliche Validierung
in Vorbereitung."*

## Ablauf

1. **SDB hochladen → KI-Extraktion → bestätigen.**
   Gefahrstoffe › **SDB-Import (KI)**. Ein Lieferanten-SDB (PDF) hochladen (oder das
   eigene SDB des Interessenten). Die KI liest die Felder mit Seitenbeleg aus; Feld
   für Feld prüfen und bestätigen. (Betont: die KI ergänzt nichts aus eigenem Wissen
   — jedes Feld zeigt seine Quelle.)

2. **Produkt im Verzeichnis; Betriebsanweisung.**
   Gefahrstoffe › **Verzeichnis** → ein Demo-Produkt öffnen (z. B. *Reinex A60*).
   Einstufung, Piktogramme, H-Sätze, Referenzdaten (PubChem) ansehen. Unter
   **Betriebsanweisungen** einen Entwurf erzeugen bzw. den freigegebenen zeigen.

3. **„Prüfung & Berechnung" — Einstufungsvergleich mit einer erklärten Abweichung.**
   Am Produkt *Solvent-Mix S50* die **Prüfung & Berechnung** öffnen. Die
   physikalischen Schätzwerte zeigen beim **Flammpunkt** eine **Abweichung**:
   das SDB nennt 40 °C, die Berechnung aus der Zusammensetzung ergibt einen deutlich
   niedrigeren Wert → „⚠ Abweichung prüfen". Das ist der Kernmoment: SLD prüft, ob
   das Lieferanten-Datenblatt aufgeht. (Volle CLP-Einstufung: „nicht berechenbar —
   CLP-Konfiguration nicht geladen" — ehrliche Lücke, bis die amtlichen Schwellen
   geladen sind.)

4. **Abweichungsliste je Standort.**
   Gefahrstoffe › **Abweichungen SDB/Berechnung** — die Produkte mit Abweichungen
   auf einen Blick, je mit Link in die Produkt-Prüfung.

5. **TRGS-510-Lagercheck.**
   Gefahrstoffe › **Lagerung (TRGS 510)** — die Lagerorte und die vorhandenen
   Lagerklassen. (Für DE-Standorte; die Zusammenlagerungs-Matrix ist noch nicht
   geladen → „keine Zusammenlagerungsregel hinterlegt" — ehrliche Lücke, Daten als
   Founder-/Amtsschritt.)

6. **Wasserzeichen-SDB-Entwurf für ein eigenes Gemisch.**
   In **Prüfung & Berechnung** → **SDB-Entwurf erzeugen (PDF)**. Der 16-Abschnitts-
   Entwurf trägt auf jeder Seite „ENTWURF — NICHT ZUR WEITERGABE" und ist als
   `SDS_DRAFT_PREVIEW` archiviert.

**Zurücksetzen nach der Demo:** `npm run reset:prospect` (entfernt die Demo-Produkte,
Engines zurück auf OFF). Verweigert auf einem Mandanten ohne Demo-Markierung.

**Abschlussrahmen:** Alles Gezeigte ist Prüf-/Vorschaulogik. Bevor ein berechneter
Wert in eine Kennzeichnung, ein weitergegebenes SDB, das Gefahrstoffverzeichnis
oder eine Betriebsanweisung einfließt, braucht die jeweilige Engine eine
fachkundige Freigabe (Status VALIDATED, abgesichert durch einen Review-Datensatz).
