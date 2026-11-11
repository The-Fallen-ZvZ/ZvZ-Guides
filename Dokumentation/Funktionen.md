# Funktionen

Übersicht der Bereiche, die in `Anwendung/index.html` (v1.71.02) vorhanden sind. Quelle: Struktur der Datei selbst.

## Guide-Bereiche

| Bereich | Inhalt |
| --- | --- |
| ZvZ-Basics | Grundlagen des ZvZ |
| Comps | Comp-Übersicht mit Ablaufbeschreibungen |
| Rollen | Rollenvorgaben |
| Waffen & Battlemounts | Waffenliste, Battlemount-Bereich |
| Battlemounts | Detailansicht der Battlemounts (Q/W/E/F) |
| Buffs und Debuffs | Buff-/Debuff-Übersicht |
| Disarray | Disarray-Erklärung |
| Call-Glossar | Begriffe für Calls |
| Lootsplit & Regear | Lootsplit- und Regear-Berechnung |
| Erklärvideos | Videos inkl. Transkripte und YouTube-Links |
| VODs | VOD-Review-Bereich |
| Regelwerk | Regeln für Gildenmitglieder |
| Nachbesprechung | Auswertung nach dem Fight |
| Erweiterte Ansicht | Detailansicht |

## Werkzeuge

- **Suche** – durchsucht die Inhalte der Seite
- **Einstellungen** – gespeichert unter `tf-settings` in `localStorage` (u. a. Theme dunkel/hell/System, Rahmenbreite, Radius)
- **Feedback** – Feedback-Button mit Modal (Kategorie, Unterkategorie, Nachricht)
- **Changelog & Ideen** – Versionshistorie mit Download-Buttons je Version, Ideen-Bereich

## Moderatorenbereich

- **Live-Editor** – Inhalte direkt bearbeiten
- **Brainstorm (Waffen & BMs)** – Arbeitsfläche, u. a. mit eingebettetem Google Sheet
- **Changelog & Ideen** – Verwaltung der Einträge
- **Feedback-Übersicht** – eingegangenes Feedback (Login geschützt)

## Technischer Rahmen

- Eine einzige HTML-Datei mit eingebettetem CSS und JavaScript
- Persistenz im Browser über `localStorage`
- Keine Build-Tools, keine externen Abhängigkeiten außer eingebetteten Videos
