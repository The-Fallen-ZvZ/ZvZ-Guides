# Arbeitsregeln für OpenCode

## Grundprinzip

Bearbeite meine bestehende Anwendung schrittweise. Erzeuge nicht bei jeder Aufgabe den gesamten HTML-Code neu.

## Änderungsregeln

- Analysiere zuerst die vorhandene Code-Struktur.
- Ermittle die Dateien und Funktionen, die für die gewünschte Änderung relevant sind.
- Ändere ausschließlich die notwendigen Codebereiche.
- Erhalte alle bestehenden Funktionen, Designs und Inhalte.
- Vermeide unnötige Umstrukturierungen.
- Lösche keine Funktionen ohne meine ausdrückliche Zustimmung.
- Erstelle keine zusätzlichen Dateien, wenn sie nicht benötigt werden.
- Prüfe nach jeder Änderung auf Syntaxfehler und mögliche Fehler in betroffenen Funktionen.

## Kostenoptimierung

- Lies nicht bei jeder Aufgabe sämtliche Projektdateien.
- Nutze vorhandene Dokumentation und gezielte Dateisuche.
- Lade nur den für die jeweilige Aufgabe erforderlichen Kontext.
- Vermeide unnötige Wiederholungen des gesamten Quellcodes.

## Sicherheit

- Arbeite im Projektordner `Anwendung/`.
- Erstelle vor größeren Änderungen einen nachvollziehbaren Sicherungspunkt.
- Frage vor dem Löschen oder grundlegenden Umbau nach.
- Dokumentiere abgeschlossene Änderungen in [[02_Projekte/HTML-App/CHANGELOG|CHANGELOG]].

## Kommunikation

Erkläre vor größeren Änderungen kurz, welche Dateien du verändern möchtest und warum. Melde danach die tatsächlich vorgenommenen Änderungen.

## Projektkontext

| Pfad | Zweck |
| --- | --- |
| `Anwendung/index.html` | bestehende HTML-Anwendung (nicht ohne Auftrag aufteilen) |
| `Anwendung/css/`, `Anwendung/js/` | für eine spätere Aufteilung vorgesehen |
| `Anwendung/assets/` | Bilder, Fonts, Medien |
| `Dokumentation/` | Funktionen, Bedienung, Fehler, technische Notizen |
| `Backups/` | Sicherungspunkte (von Git ausgenommen) |

Vault-Regeln: `AGENTS.md` im Vault-Hauptordner. Projektstatus: [[02_Projekte/HTML-App/Projektübersicht|Projektübersicht]] · [[02_Projekte/HTML-App/Aufgaben|Aufgaben]].
