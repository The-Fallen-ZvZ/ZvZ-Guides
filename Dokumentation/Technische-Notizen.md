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

## Moderator-Zugang & Worker

Zwei getrennte Ebenen – das ist wichtig, wenn ein Passwort geändert wird:

| Ebene | Wo gespeichert | Wirkung |
| --- | --- | --- |
| Mod-Key (`modKey`) | Eingabe einmalig beim Moderatoren-Login (`adminLogin`, Zeile 764); `sessionStorage.feedbackModKey`; serverseitig Binding **`MOD_KEY`** im Cloudflare Worker | entscheidet über Zugriff auf Moderatorenbereich, Feedback und Editor |
| Admin-Status | `sessionStorage.isAdmin` | nur noch Anzeige-Flag, wird nach erfolgreicher Key-Prüfung gesetzt |

Ablauf beim Login:

1. Key abfragen (nur wenn noch keiner in der Sitzung liegt)
2. `GET {FEEDBACK_ENDPOINT}/feedback?key=…` – der Worker prüft gegen `MOD_KEY`
3. Erfolg → Key in `sessionStorage`, `isAdmin` setzen, Moderatorenbereich öffnen
4. Fehlschlag → „Moderatoren-Key ungültig oder Server nicht erreichbar“

Feedback und Live-Editor fragen **kein** Passwort mehr ab; sie nutzen den gespeicherten Key. `adminLogout()` löscht beide Einträge.

Übertragung an den Worker:

| Aktion | Aufruf |
| --- | --- |
| Feedback lesen | `GET {FEEDBACK_ENDPOINT}/feedback?key=…` |
| Inhalt speichern | `POST {CUSTOM_CONTENT_ENDPOINT}` mit `{ key, pageId, html }` |
| Inhalt zurücksetzen | `DELETE {CUSTOM_CONTENT_ENDPOINT}` mit `{ key, pageId }` |
| Feedback senden (öffentlich) | `POST {FEEDBACK_ENDPOINT}` mit `{ category, subcategory, message }` – ohne Key |

**Wenn `MOD_KEY` im Worker geändert wird:**
- Im Repository ist **nichts** zu ändern und nichts zu deployen – der Wert liegt nur in Cloudflare.
- Offene Sitzungen verlieren den Zugriff: „Moderatoren-Key ungültig …“ bzw. `Auth failed` beim Feedback. Lösung: abmelden (löscht den gespeicherten Key) und neu anmelden, dann den neuen Key eingeben. Alternativ den Tab schließen – `sessionStorage` wird dabei geleert.

**Sicherheitshinweis:** Der Mod-Key ist jetzt die einzige Prüfung und läuft über den Worker – das ist der wirksame Riegel. Er wird allerdings als Query-Parameter (`?key=…`) übertragen und landet damit in Logs und im Browserverlauf; sauberer wäre ein Header oder ein HttpOnly-Cookie.

## Umgebung

- Git: `2.55.0.windows.5` installiert
- GitHub Desktop: installiert
- Repository: initialisiert am 11.11.2026, Branch `main`
  - Erster Commit `4f25e32` – „Erste vollständige Projektsicherung“ (11 Dateien, 1.623 Zeilen)
  - `core.autocrlf=false` (keine Zeilenenden-Umwandlung, Dateien bleiben byte-identisch)
  - `Backups/` wird über `.gitignore` nicht versioniert
- Altlasten bereinigt: versehentliches Unter-Repo `HTML-App/HTML-App` gelöscht, Root-Duplikat `index.html` aus dem Repo entfernt (`Anwendung/index.html` ist einzige Quelle)
