# Technische Notizen

## Ablage der Anwendung

- `Anwendung/index.html` – die bestehende Anwendung, übernommen am 11.11.2026
  - Version v1.71.02 · 185.813 Bytes · 1.394 Zeilen
  - SHA-256: `F218EC0977858E1CA265B9CD431D764637A232771DC634C5BC22D270AE9A08A5`
  - Herkunft: `deepseek_html_20261111_bc916f (10).html` (aus dem Vault-Hauptordner hierher verschoben)
  - Original-Sicherung: `Backups/The-Fallen_2026-11-11_original.html`, byte-identisch
- `css/` und `js/` sind für eine spätere Aufteilung vorgesehen; `js/features/` für einzelne Funktionsmodule.
- Erst aufteilen, wenn es ausdrücklich beauftragt wird.
- **Code-Index:** [[Code-Landkarte]] – Zeilenbereiche, alle Funktionen, Datenkonstanten und typische Änderungsstellen

## Git-Sicherung (GitHub Desktop)

Nur den Projektordner sichern:

```text
02_Projekte/
└── HTML-App/     ← dieses Verzeichnis ist das Repository
```

**Nicht** den gesamten Vault als Repository anlegen – so bleiben private Notizen außen vor.

1. GitHub Desktop installieren und starten.
2. `File → Add Local Repository` → Ordner `02_Projekte/HTML-App` wählen.
3. Meldet das Programm „not a Git repository“, `Create a Repository` wählen, Name `HTML-App`, im vorhandenen Ordner anlegen.
4. Unter `Changes` prüfen, welche Dateien erfasst werden.
5. Zusammenfassung „Erste vollständige Projektsicherung“ eintragen → `Commit to main`.

### Nach jeder KI-Änderung

1. GitHub Desktop öffnen.
2. Änderungen und betroffene Dateien prüfen.
3. Kurze Beschreibung eingeben.
4. `Commit to main` – so entsteht eine nachvollziehbare Versionsgeschichte.

## `.gitignore`

Liegt direkt in `HTML-App/` (nicht in `Anwendung/`, nicht im Vault-Hauptordner).

| Regel | Bedeutung |
| --- | --- |
| `.DS_Store` | macOS-Systemdateien |
| `Thumbs.db` | Windows-Vorschaudateien |
| `*.tmp`, `*.log` | temporäre Dateien und Protokolle |
| `node_modules/` | installierte Abhängigkeiten |
| `.env`, `.env.*` | private Zugangsdaten (`!.env.example` bleibt erlaubt) |
| `Backups/` | verhindert doppelte Sicherungskopien |
| `.vscode/` | lokale Editor-Einstellungen |

HTML-, CSS-, JavaScript- und Dokumentationsdateien werden normal versioniert.

**Windows-Hinweis:** Dateiendungen im Explorer einblenden (`Ansicht → Einblenden → Dateinamenerweiterungen`), damit die Datei nicht als `.gitignore.txt` endet.

## Veröffentlichung (GitHub Pages)

Die Website wird aus dem Unterordner `Anwendung/` veröffentlicht; Notizen und Dokumentation bleiben außen vor.

- Repository: `https://github.com/The-Fallen-ZvZ/ZvZ-Guides` (öffentlich, Branch `main`)
- Website: `https://the-fallen-zvz.github.io/ZvZ-Guides/`
- Workflow: `.github/workflows/pages.yml` (lädt bei jedem Push nur `Anwendung/` hoch)

1. Lokal ändern → Commit → `Push origin`
2. GitHub Actions baut (~30–60 s), die Seite ist danach aktuell

**Pages-Quelle:** `Settings → Pages → Build and deployment → Source: GitHub Actions` ist aktiv. Die Website wird ausschließlich aus dem Artefakt von `Anwendung/` gebaut – eine Kopie im Wurzelverzeichnis gibt es nicht mehr, `Anwendung/index.html` ist die einzige Quelle.

**Wichtig:** Es gibt keine Echtzeit-Übertragung. Obsidian speichert lokal, GitHub Pages baut erst nach dem Push. Für „automatisch“ müsste ein Watcher regelmäßig committen und pushen.

## Umgebung

- Git: `2.55.0.windows.5` installiert
- GitHub Desktop: installiert
- Repository: initialisiert am 11.11.2026, Branch `main`
  - Erster Commit `4f25e32` – „Erste vollständige Projektsicherung“ (11 Dateien, 1.623 Zeilen)
  - `core.autocrlf=false` (keine Zeilenenden-Umwandlung, Dateien bleiben byte-identisch)
  - `Backups/` wird über `.gitignore` nicht versioniert
- Altlasten bereinigt: versehentliches Unter-Repo `HTML-App/HTML-App` gelöscht, Root-Duplikat `index.html` aus dem Repo entfernt (`Anwendung/index.html` ist einzige Quelle)
