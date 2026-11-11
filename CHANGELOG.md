# CHANGELOG

## Ausgangsstand

- **Version:** v1.71.02 (Stand 11.11.2026, 20:00 Uhr laut internem Changelog)
- **Datei:** `Anwendung/index.html`, 185.813 Bytes, 1.394 Zeilen
- **Übernommen:** 11.11.2026, unverändert aus dem Export `deepseek_html_20261111_bc916f (10).html`
- **Sicherung:** `Backups/The-Fallen_2026-11-11_original.html` (identische Prüfsumme)
- **SHA-256:** `F218EC0977858E1CA265B9CD431D764637A232771DC634C5BC22D270AE9A08A5`

Der vollständige, detaillierte Changelog bleibt in der Anwendung selbst (Tab „Changelog & Ideen“). Hier werden nur Änderungen dokumentiert, die im Vault vorgenommen werden.

## Einträge

### 2026-11-11 – Code-Landkarte

- `Dokumentation/Code-Landkarte.md` angelegt: Zeilenbereiche, Seiten-Renderer (`P`), Init-Funktionen (`I`), Einstellungen, Datenkonstanten, externe Quellen, Storage-Keys und „wo ändere ich was“
- Anwendung selbst unverändert

### 2026-11-11 – Aufräumen: eine Quelle für die Website

- Root-`index.html` aus dem Repo entfernt (alte Kopie, 185.814 Bytes) – die Website wird nur noch aus `Anwendung/index.html` gebaut
- Versehentliches Unter-Repo `HTML-App/HTML-App` gelöscht (enthielt nur `.gitattributes`)
- `.git/info/exclude`-Eintrag entfernt, da der Ordner nicht mehr existiert
- Live-Seite geprüft: `https://the-fallen-zvz.github.io/ZvZ-Guides/` liefert 186.008 Bytes inkl. Rollen-Link, `/Anwendung/` und `/AGENTS.md` sind 404

### 2026-11-11 – Deploy-Workflow für GitHub Pages

- `.github/workflows/pages.yml` angelegt: veröffentlicht bei jedem Push auf `main` ausschließlich den Ordner `Anwendung/`
- Notizen, Dokumentation und `Backups/` werden nicht ins Web-Deploy aufgenommen
- Noch einzurichten: GitHub-Repository veröffentlichen und `Settings → Pages → Source: GitHub Actions` wählen

### 2026-11-11 – Link im Rollen-Intro

- In `Anwendung/index.html`, Bereich **Rollen**, Satzende des Introtexts („Hier findest du …“) um Link ergänzt: „Zur AlbionZvZ-Composition“ auf `https://www.albionzvz.com/g/the-fallen/compositions/f730f3e1-87cb-4b2d-b1f8-b743cc887cf3` (`target="_blank"`, `rel="noopener"`, unterstrichen – gleiche Optik wie im Comps-Bereich)
- Nur diese eine Zeile geändert, JS-Syntax danach geprüft
- App-interne Versionsnummer unverändert (v1.71.02)

### 2026-11-11 – Erste Sicherung

- Git-Repository in `02_Projekte/HTML-App` initialisiert, Branch `main`
- Commit `4f25e32`: 11 Dateien, 1.623 Zeilen (Anwendung, Notizen, Dokumentation, `AGENTS.md`, `.gitignore`)
- `Anwendung/index.html` unverändert übernommen, Prüfsumme vor und nach dem Commit identisch
