# CHANGELOG

## Ausgangsstand

- **Version:** v1.71.02 (Stand 11.11.2026, 20:00 Uhr laut internem Changelog)
- **Datei:** `Anwendung/index.html`, 185.813 Bytes, 1.394 Zeilen
- **Übernommen:** 11.11.2026, unverändert aus dem Export `deepseek_html_20261111_bc916f (10).html`
- **Sicherung:** `Backups/The-Fallen_2026-11-11_original.html` (identische Prüfsumme)
- **SHA-256:** `F218EC0977858E1CA265B9CD431D764637A232771DC634C5BC22D270AE9A08A5`

Der vollständige, detaillierte Changelog bleibt in der Anwendung selbst (Tab „Changelog & Ideen“). Hier werden nur Änderungen dokumentiert, die im Vault vorgenommen werden.

## Einträge

### 2026-11-13 – Tode und Aktivität aus der Albion-API

- Neue Worker-Route `GET /deaths?guild=<id>&names=…&days=30&key=…`: Mitglieder auflösen, Tode je Spieler zählen (30 Tage, 7 Tage, letzter Tod), Cache 12 h im vorhandenen KV
- Drosselung: sequenziell mit 700 ms Abstand, 429-Retry, maximal 60 Namen pro Aufruf; nur angemeldete Spieler werden abgefragt
- Roster-Ansicht zeigt `† 10 · zuletzt vor 3 Tagen` je Spieler (grün ≤ 7 Tage, orange ≤ 30, grau danach)
- Gewichtung im Gehirn: +6 / +3 bei Aktivität in 7/14 Tagen, −5 bei > 30 Tagen, −0,5 pro Tod (max. −6), Gesamtdeckel ±10
- Gilde als `RB_GUILD_ID` hinterlegt (`p9uAFij9ReO0BhIhHlVa8g`, The-Fallen EU)
- Geprüft: 401/400, Zählung, Pagination, Cache (zweiter Aufruf ohne API-Requests), Badges im Headless-Test


### 2026-11-13 – Discord-Benachrichtigung pro Zuweisung

- Neue Worker-Route `POST /notify`: schickt Änderungen als DM an `DISCORD_USER_ID` (Komma-getrennt möglich) und kann den Roster-Link in `DISCORD_CHANNEL_ID` posten und pinnen
- Client vergleicht nach jedem Build mit dem zuletzt gemeldeten Stand (`tf-rb-notified`, pro Event): nur neue oder geänderte Zuweisungen lösen eine Meldung aus, Abgänge als „hat den Slot verlassen"
- Meldung enthält Name → Rolle und den Link zur Roster-Seite; max. 20 Zeilen pro DM
- Schalter „Discord: an/aus" in der Comp-Leiste (Standard an), Button „Link anpinnen" in der Kopfzeile
- Versand wird erst nach erfolgreicher Antwort als erledigt markiert (Retry beim nächsten Build)
- `Worker/roster.js` um `handleNotify` ergänzt


### 2026-11-13 – Auto-Zuweisung und Live-Start

- Live-Polling startet beim Öffnen der Seite automatisch (kein Refresh, kein Klick auf „Live")
- Beim Zurückkehren in den Tab wird sofort aktualisiert (Browser drosseln Intervalle im Hintergrund)
- Neuer Schalter **Auto**: weist bei Änderungen sofort und sonst alle 5 Minuten selbst zu; beim Öffnen wird direkt gebaut
- Manueller Eingriff (Ziehen, ×, Picker) schaltet Auto ab, damit Korrekturen nicht überschrieben werden; Zustand in `tf-rb-auto`
- Statistikzeile zeigt „Auto · HH:MM"; „Build the Group" bleibt als einmaliger Vorschlag


### 2026-11-13 – Roster-Brain in die Anwendung eingebaut

- Neue Admin-Seite `#admin-roster` (nur mit Mod-Key): Anmeldungen, Comp, Gehirn-Panel, Live-Schalter, Historie
- AlbionZvZ bleibt verbindlich – die Seite liefert nur den Vorschlag und eine Kopiervorlage, kein Zurückschreiben
- Engine zweistufig (Haupt-Comp, dann Reserve), Caller fest gesetzt, Doppel-Slots mit Waffenwahl, Rollenfamilien über `playstyle`
- Live: Polling alle 5 s über `ROSTER_ENDPOINT`; Historie lokal (`tf-rb-hist`), Token in `tf-rb-token`
- Page wird breiter (`main.rb-wide`), Editor-Seitenliste und Sidebar angepasst
- `Worker/roster.js` angelegt: Route `GET /roster?event=<token>&key=<mod-key>`, CORS, 5-Minuten-Cache für die Event-Seite, kein KV/DO
- Worker lokal geprüft: 401/403/200, 12 Spieler, 51 aktive Slots, Prefs aufgelöst
- `index.html` geprüft: `node --check`, Headless-Chromium mit gestubbter Antwort (Build, Historie, Live, Navigation hin/zurück)


### 2026-11-13 – Rollen-Zähler und Live-Pfad

- Rollen-Zähler als Badge am Chip eingebaut (wie in AlbionZvZ), Summe je Spieler in der Karte
- Geprüft: die Zahlen sind **nicht** öffentlich abrufbar (`/roster` ohne Zähler, Mastery nur mit Session) → eigene Historie `hist[rolle]`, `+1` pro bestätigtem Einsatz, Button „Historie +1" im Prototyp
- Realtime geprüft: `GET /api/events/public/<token>/assignments/ops?sinceSeq=` liefert öffentlich ein Delta (427 Bytes) mit `signup_added`/`signup_removed`; `/roster` liefert den Vollstand
- Kein CORS-Header und kein Push-Kanal → Live-Aktualisierung nur über Worker-Polling (5 s) + WebSocket an die Moderator-Seite
- Prototyp: Live-Schalter mit klarer Meldung, solange `LIVE_ENDPOINT` leer ist; Polling-Logik vorbereitet
- Doku um beide Abschnitte ergänzt


### 2026-11-13 – Test-Event importiert, automatischer Import bestätigt

- Öffentlichen Event-Link (`albionzvz.com/e/75f6722e…`) geprüft: Spieler, Wünsche, Zuweisungen und das Rollen-Lexikon (160 Einträge) stehen im HTML, kein Login nötig
- Parser geschrieben: React-Flight-Chunks lesen, JSON-Objekt mit `event`/`parties`/`players` extrahieren, IDs über das Lexikon auflösen
- Test-Datensatz in den Prototyp eingebaut (Umschalter „Test-Event" / „Demo"): 13 Anmeldungen, 60 Slots, 51 aktiv, 12 Vorbelegungen
- Rollen außerhalb der Comp (Occult, Heron, Hoj, Lifecursed, Infernal Staff, Riftglaive, Fill — Healer) über `playstyle` auf Rollenfamilien abgebildet, sonst hätten 5 von 13 keinen Slot
- Caller wird vor der Optimierung fest gesetzt und löst keine Konflikte mehr aus
- Fehler behoben: „gesetzt/ausgewichen"-Meldung zählte Spieler als ausgewichen, die dieselbe Rolle bekamen; offene Slots werden auf 10 Einträge gekappt
- Doku um Import-Abschnitt, Rollen-Abbildung und Abgrenzung zu AlbionZvZ ergänzt


### 2026-11-13 – Echte Comp übernommen (2 × 20 + Reserve)

- Comp-Stand aus dem Live-Event eingebaut: Party 1 (20 Slots), Party 2 (20 Slots), „Alternative Rollen und BMs" (11 aktiv von 20)
- Doppel-Slots „Longbow / Demonfang": ein Platz mit zwei erlaubten Waffen, pro Zuweisung wird die Waffe des Spielers gespeichert (`pick`)
- Zuweisung auf **zweistufiges Verfahren** umgestellt (erst Haupt-Comp, dann Reserve aus den Übrigen) – ein einstufiger Optimierer leerte Haupt-Slots, um mehr Reserve-Slots zu besetzen
- Reserve: Schwelle 60 Punkte und nur bei echtem Wunsch oder Historie; Dummy-Spalten erlauben leere Slots
- Rollenfarben und Kürzel der echten Comp (Locus, Spiked Gauntlets, Permafrost, Rootbound MeleeClap, Grovekeeper, Venom/Chariot) inklusive Kurzformen-Erkennung beim Import
- Demo mit 50 Anmeldungen: 40/40 Haupt-Slots, 7/11 Reserve, 3 auf der Bank
- Gildenseite `albionzvz.com/g/the-fallen` als login-geschützt geprüft (kein öffentlicher Abruf); Doku um Comp-Tabelle und Regeln ergänzt


### 2026-11-13 – Moderator-Roster: Konzept und Prototyp

- `Dokumentation/Moderator-Roster.md` angelegt: Machbarkeit, Architektur (Cloudflare Worker + Durable Object, WebSocket), Datenmodell, Zuweisungsregeln, vier Wege für die Signup-Daten, Einbaustellen, offene Fragen
- `Prototyp/Roster-Brain.html` angelegt: eigenständige Moderator-Ansicht mit Comp-Grid, Signup-Liste, Ziehen/Zuweisen, „Build the Group", Konflikt- und Bank-Anzeige, Import-Parser, Tab-Sync via `BroadcastChannel`
- Prototyp liegt **außerhalb** von `Anwendung/` – wird durch den Pages-Workflow nicht veröffentlicht; `Anwendung/index.html` bleibt unverändert
- Zuweisungs-Engine getestet: Ungarische Methode gegen Brute-Force (0 Abweichungen), Randfälle 0–40 Anmeldungen, 16 Funktionstests in Headless-Chromium bestanden
- Ergebnis Demo-Comp 24: 24/24 Slots besetzt, 2 auf der Bank, Überschneidungen (Spiked, 1H Hammer, Exalted) nach Historie aufgelöst

### 2026-11-12 – Erklärvideos: zweites Video, Platzhalter reduziert

- Neues Video als zweite Karte: „84s (Luke Melee Clap) vs Contigent (CG) 150 Kills“ (`gyDtY8G9tz8`), eingebettet über `youtube-nocookie` plus YouTube-Link
- Beschreibung: „Kampfausschnitt aus Lukes ZvZ (Calls, Movement sowie Spells erkennt man sehr gut).“ – die Formulierung „150 Kills in 84 Sekunden“ war falsch
- Beide Platzhalter („Praktik – Luke 1“ und „2“) entfernt – es bleiben nur die zwei echten Videos
- Reihenfolge: Sentus-Video → 84s vs CG
- JS-Syntax und Tag-Bilanz geprüft

### 2026-11-11 – Worker-Routen korrigiert

- Der Worker kennt keinen Pfad `/feedback` (antwortet 405). Login-Prüfung und Feedback-Liste nutzen jetzt `GET /?key=…`
- 401 beim Feedback-Laden löscht die Sitzung und meldet „Key ungültig … bitte neu anmelden“
- Öffentliches Feedback sendet weiterhin an `POST /` (unverändert korrekt)
- Code-Landkarte: Tabelle der Worker-Routen ergänzt

### 2026-11-11 – Moderatoren-Login: eine Abfrage statt drei

- `adminLogin()` (Zeile 764) prüft den Mod-Key jetzt einmalig gegen den Worker (`GET /feedback?key=…`); das hartkodierte Klartext-Passwort ist entfernt
- Passwort-Prompt in `initAdminFeedback()` (607) und `initAdminEditor()` (674) entfernt – beide nutzen den gespeicherten `sessionStorage.feedbackModKey`
- `adminLogout()` (794) löscht `isAdmin` und `feedbackModKey`
- Verhalten bei geändertem `MOD_KEY`: kein Deploy nötig, aber abmelden und mit neuem Key anmelden
- Code-Landkarte auf die neuen Zeilennummern aktualisiert (1.421 Zeilen)

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
