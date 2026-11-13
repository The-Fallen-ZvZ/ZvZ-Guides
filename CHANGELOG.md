# CHANGELOG

## Ausgangsstand

- **Version:** v1.71.02 (Stand 11.11.2026, 20:00 Uhr laut internem Changelog)
- **Datei:** `Anwendung/index.html`, 185.813 Bytes, 1.394 Zeilen
- **Übernommen:** 11.11.2026, unverändert aus dem Export `deepseek_html_20261111_bc916f (10).html`
- **Sicherung:** `Backups/The-Fallen_2026-11-11_original.html` (identische Prüfsumme)
- **SHA-256:** `F218EC0977858E1CA265B9CD431D764637A232771DC634C5BC22D270AE9A08A5`

Der vollständige, detaillierte Changelog bleibt in der Anwendung selbst (Tab „Changelog & Ideen“). Hier werden nur Änderungen dokumentiert, die im Vault vorgenommen werden.

## Einträge

### 2026-11-13 – Discord: Kanal-Meldungen und Todes-Erinnerung

- Alle Meldungen gehen jetzt in einen Discord-Kanal (`DISCORD_CHANNEL_ID`), nicht mehr als DM; ohne Kanal-ID greift weiterhin die DM als Fallback
- Drei eigene Nachrichtenformate: **📝 Neues Feedback**, **📋 Neue Anmeldung**, **☠️ Todes-Erinnerung**
- Feedback-Post scheitert nicht mehr, wenn Discord nicht erreichbar ist (Feedback liegt im KV, Antwort enthält `notified`)
- Neu: `GET /alerts?guild=…&key=…` prüft die letzten 3 ZvZ-Battles und meldet Spieler mit mindestens 2 Toden in einem Battle (Name, Tode, Kills, Battle-Zeit, Masse)
- Merker pro Battle + Spieler im KV (30 Tage), damit jede Warnung nur einmal kommt
- `scheduled`-Handler für einen Cron-Trigger (`*/5 * * * *`); Gilden-ID über `ALERT_GUILD`, Standard The-Fallen

### 2026-11-13 – Statistik-Tab: Gesamtübersicht, 3-Tage-Tode, 12-h-Cache

- Neuer Admin-Tab **Statistik** (`#admin-stats`), erreichbar über die Seitenleiste unter „Gilde"
- **Übersicht**: alle Spieler mit Battles, Kills, Toden, K/D, Fame und „zuletzt gesehen"; Fenster 7/30/90/Alles; Spaltenkopf klicken sortiert (Tode standardmäßig absteigend); Textfilter und Tode-Filter (mind. 1/2/3/5)
- **Letzte 3 Tage**: Tode je Spieler aus den ZvZ-Battles der letzten 72 h, sortiert nach Toden; Markierung „erhöht" ab 2 Toden, „häufig gestorben" ab 4 Toden
- **Datenaktualisierung**: Standard-Cache 12 h (`guildPlayers` von 1 h auf 12 h angehoben); Button „Daten aktualisieren" sendet `force=1` und umgeht den Cache, ohne den 12-h-Zyklus zu stören
- Neue Worker-Routen `GET /guildstats?guild=&window=&force=&key=` und `GET /guildrecent?guild=&force=&key=`
- `/guildrecent` nutzt die vorhandenen Battle-Caches (Battle-Daten 30 Tage, Liste 12 h) und begrenzt auf 40 Battles pro Aufruf (Subrequest-Limit der Free-Instanz)
- Client zeigt bei leerem oder ungültigem Moderatoren-Key eine klare Meldung statt einer leeren Tabelle

### 2026-11-13 – ZvZ-Zahlen direkt aus der Players-Tabelle

- Neue Quelle: `GET /guilds/europe/<id>?view=players&minMass=15&maxMass=29&window=30d` – die Tabelle steht serverseitig im HTML (`"players":[… `)
- `parseGuildPlayers` liest Name, Battles, Kills, Deaths, Fame und `lastSeenMs`; `/deaths` und `/deaths/detail` nutzen diese Werte (1 h KV-Cache)
- Ergebnis deckt sich exakt mit der Seite: Relgok 10/0/1, PDragonyx 8/9/3, Amayana 7/0/1
- Zeitfenster auf 7/30/90/Alles umgestellt (die Seite bietet kein 14 Tage)
- Doppelzählung behoben: Spieler-Endpunkte wiederholen bei `offset` dieselben Einträge; `fetchPlayerEvents` dedupliziert über `EventId`
- Todesliste im Detail weiter aus den Battle-Killfeeds, gefiltert aufs gewählte Fenster


### 2026-11-13 – ZvZ-Zahlen exakt aus den Battle-Daten

- Neue Quelle: `GET /api/dev/battle-board/battle/events?server=europe&battleId=…` liefert `playerStats` und `killFeed` je Battle (öffentlich)
- ZvZ-Kills/-Tode und K/D stammen jetzt aus den Battles der Gilde (Masse 15–29) und stimmen mit der Players-Tabelle von AlbionZvZ überein (Relgok 10/0/1, PDragonyx 8/9/3, Amayana 7/0/1)
- Battle-Daten 30 Tage im KV (unveränderlich), Battle-Liste 12 h; erster Aufruf ~5 s, danach Cache
- `/deaths` (Roster) zählt nur noch ZvZ-Tode und Battles aus diesen Daten – keine Spieler-Endpunkte mehr, dadurch schneller und exakt
- `/deaths/detail` liefert `zvz`, `zvzDeaths`, `zvzKills`; die Seite nutzt sie für ZvZ-Zeile und ZvZ-Tabelle, „Alle" bleibt der Spieler-Endpunkt
- Badge zeigt `† 1 ZvZ · 10 Battles`


### 2026-11-13 – ZvZ exakt über Battle-IDs, Farben im Gilde-Tab

- ZvZ wird nicht mehr über die Gruppengröße geschätzt: Der Worker lädt die ZvZ-Battles der Gilde (`/api/guild-profile/battles`, Masse 15–29, `massMode=guild`, 90 Tage, 12 h KV-Cache) und vergleicht die `BattleId` jedes Todes/Kills
- Fallback auf `groupMemberCount >= 10`, wenn die Battle-Liste nicht erreichbar ist (`zvzSource: group`)
- Antworten enthalten `zvzMass`, `zvzCount`, `zvzSource`, damit die Seite die Grundlage anzeigen kann
- Gilde-Tab: Tode rot, Kills grün, K/D grün ab 1,5, orange ab 1,0, rot darunter; Roster-Badge ebenfalls rot
- Hinweiszeile im Detail nennt die Masse (15–29) und die Zahl der Battles


### 2026-11-13 – Worker als eine Datei

- `Worker/worker.js` angelegt: der komplette Worker (Feedback, Live-Editor, Roster, Discord, Tode, Gildenliste) in einer Datei zum Kopieren
- Ab jetzt wird nur noch diese Datei gepflegt; `Worker/roster.js` bleibt als Modul-Referenz liegen
- Deploy-Anleitung in der Doku auf „Datei komplett einfügen" umgestellt
- Syntax mit `node --check` geprüft (als ESM), alle fünf Routen vorhanden


### 2026-11-13 – ZvZ-Filter, K/D und sparsamere Abfragen

- ZvZ-Erkennung über `groupMemberCount >= 10` bzw. `numberOfParticipants >= 10` (`ZVZ_MIN_GROUP`); Roster-Badge und Gewichtung nutzen nur noch ZvZ-Tode
- Gilde-Tab: Umschalter **ZvZ / Gesamt**, Zeitraum **7 / 14 / 30 / Gesamt**, Auswertung mit Toden, Kills und K/D für beide Welten
- `/deaths/detail` liefert jetzt Tode **und** Kills (je max. 40) inklusive ZvZ-Flag, Gruppe und Beteiligten
- Polling von 5 s auf **5 Minuten** reduziert (Roster-Abruf), Auto-Zuweisung bleibt bei 5 Minuten
- Discord-DM nur noch, wenn sich jemand **neu angemeldet** hat; beim ersten Öffnen keine Nachricht, Änderungen innerhalb von 5 Minuten gebündelt
- Cache 12 h für Tode/Details; `/deaths` zählt bis 40 Ereignisse


### 2026-11-13 – Gilde-Tab mit Todesdetails

- Neue Admin-Seite `#admin-guild`: alle Mitglieder alphabetisch, Suchfeld, Klick auf einen Namen zeigt die letzten Tode
- Tabelle mit Datum, relativem Zeitpunkt, Gebiet, Gegner (Name + Gilde), Waffe und Item Power; Zusammenfassung 30/7 Tage und „zuletzt"
- Worker-Routen `GET /guild` (Mitglieder, 12 h KV-Cache) und `GET /deaths/detail` (bis 30 Tode je Spieler, 12 h Cache)
- Waffennamen werden lesbar gemacht (`T8_MAIN_MACE` → `MACE`)
- Sidebar-Link „Gilde", breites Layout, Editor-Seitenliste ausgenommen
- Geprüft: Worker (200/404/Cache), Seite im Headless-Browser (Liste, Details, Filter, keine Fehler)


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
