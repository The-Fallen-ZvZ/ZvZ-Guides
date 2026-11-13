# Moderator-Roster & Roster-Brain

Stand: 13.11.2026 · **in `Anwendung/index.html` eingebaut** · Worker-Erweiterung liegt bereit.

## Status

| Teil | Zustand |
| --- | --- |
| Ansicht `#admin-roster` | eingebaut, nur mit Mod-Key erreichbar |
| Gilde-Tab `#admin-guild` | eingebaut: alle Mitglieder, Klick zeigt die letzten Tode |
| AlbionZvZ | **bleibt verbindlich** – das Brain liefert nur den Vorschlag und eine Kopiervorlage |
| Worker-Route `/roster` | Code fertig (`Worker/roster.js`), muss noch deployt werden |
| Discord | Kanal-Nachricht bei jeder Änderung, Todes-Erinnerung per Cron, optional angepinnter Roster-Link |
| Historie | lokal im Browser (später optional KV) |
| Live-Aktualisierung | Polling alle 5 Minuten, startet beim Öffnen automatisch |
| Auto-Zuweisung | standardmäßig an: bei Änderungen sofort, sonst alle 5 Minuten |

## Ablauf im Betrieb

1. Moderatoren-Login → **Roster-Brain** in der Seitenleiste.
2. Event-Token aus dem AlbionZvZ-Link einfügen (`/e/…`) → **Verbinden**.
3. **Live** startet automatisch – neue Anmeldungen erscheinen ohne Reload (Abfrage alle 5 Minuten). Beim Zurückwechseln in den Tab wird sofort aktualisiert.
4. **Auto** ist standardmäßig an: Das Gehirn weist bei jeder Änderung sofort und sonst alle 5 Minuten selbst zu. Wer selbst bauen will, schaltet Auto aus – oder greift einfach manuell ein, dann schaltet es sich ab.
5. **Build the Group** – einmaliger Vorschlag mit Begründung, Konflikten, Bank und offenen Slots.
5. Manuell korrigieren: Spieler auf einen Slot ziehen, freien Slot anklicken (nach Passung sortierte Liste), × zum Entfernen.
6. **Kopieren** und das Ergebnis in AlbionZvZ übertragen – dort bleibt die verbindliche Zuweisung.
7. **Historie +1** zählt die aktuelle Zuweisung als einen gespielten Einsatz; die Zahlen wachsen damit.

## Auto-Modus

Der Schalter **Auto** sitzt neben „Build the Group" und merkt sich seinen Zustand.

| Zustand | Verhalten |
| --- | --- |
| **Auto: an** | Weist bei jeder erkannten Änderung sofort zu (neuer/abgemeldeter Spieler, geänderte Wünsche) und sonst spätestens alle 5 Minuten. Beim Öffnen der Seite wird sofort gebaut. |
| **Auto: aus** | Nichts wird automatisch verändert. „Build the Group" bleibt als einmaliger Vorschlag verfügbar. |
| **Manueller Eingriff** | Ziehen, × oder Picker setzt Auto automatisch auf aus und meldet „Auto aus – manuelle Zuweisung". So wird eine korrigierte Gruppe nicht beim nächsten Poll überschrieben. |

Damit ist der Ablauf: Moderatoren-Login → Seite öffnen (Live + Auto laufen) → Ergebnis in AlbionZvZ übertragen. Ohne offene Seite wird nichts zugewiesen – es gibt keinen Server-Job, der im Hintergrund arbeitet.

## Discord-Benachrichtigungen

Der Schalter **Discord** (neben „Historie +1") steuert, ob Meldungen rausgehen; Standard ist an.

Alle Meldungen gehen in den Kanal aus `DISCORD_CHANNEL_ID` (Feedback, Anmeldungen, Todes-Erinnerung). Ist keine Kanal-ID gesetzt, fällt der Worker auf DMs an `DISCORD_USER_ID` zurück.

Ablauf: Nach jedem Build vergleicht die Seite die Zuweisung mit dem zuletzt gemeldeten Stand (`tf-rb-notified`, pro Event). Nur echte Änderungen erzeugen eine Nachricht:

```
**📋 Neue Anmeldung** · ZVZ-Builds ZVZ Test Event
Anmeldung von: **Pinsel** → Locus
Anmeldung von: **Boerse** → Tank Hallowfall

Manuell anpassen: https://the-fallen-zvz.github.io/ZvZ-Guides/#admin-roster
```

- **Ein Spieler = eine Zeile**, mehrere Änderungen gebündelt in einer Nachricht (max. 20, Rest gekürzt).
- **Gemeldet wird jede Abweichung** gegenüber dem zuletzt gemeldeten Stand: neue Anmeldung, Rollenwechsel, Austritt. Die Erstbelegung beim ersten Login (oder nach gelöschtem Browser-Speicher) wird nur gemerkt, nicht gesendet.
- **Beim ersten Öffnen keine Meldung** – die Erstbelegung ist keine neue Anmeldung.
- **Wer den Slot verlässt**, wird als „hat den Slot verlassen" gemeldet.
- **Kein Doppelversand:** gleicher Spieler + gleiche Rolle wird nicht erneut geschickt; erst eine neue Rolle löst wieder aus.
- **Nur bei geänderten Daten** – ein Poll ohne Änderung schickt nichts.
- **5-Minuten-Sperre mit Warteschlange:** Zwischen zwei Anmeldungs-Nachrichten desselben Events liegen mindestens 5 Minuten. Kommt innerhalb der Sperre etwas Neues, wird der Text in `rb:notifyq:<kanal>:<event>` gemerkt und **automatisch** gesendet, sobald die Sperre abgelaufen ist – durch den Cron (alle 5 Min) oder beim nächsten Aufruf, auch ohne offene Seite.
- **Doppel-Erkennung:** Ist der Text identisch mit der letzten Nachricht, wird er 10 Minuten lang nicht wiederholt – das verhindert doppelte Meldungen aus zwei Tabs oder nach einem Reload.
- **Sichtbar in der App:** Bei Sperre zeigt die Seite „Sperre aktiv – wird in ca. X Min automatisch gesendet", bei unverändertem Text „unverändert, nicht erneut gesendet".
- **Sperre zurücksetzen:** `POST /notify` mit `{ "key": "…", "type": "reset" }` löscht Sperren und Warteschlange (zum Testen).
- **Wartende sofort senden:** Der Button „Wartende senden" im Roster schickt alle während der Sperre gemerkten An-/Abmeldungen sofort (`POST /notify` mit `{ "key": "…", "type": "flush" }`). Der Discord-Test-Knopf bleibt separat und schickt nur eine Beispielnachricht.
- **Automatisch nachholen** passiert an drei Stellen: Cron (`*/5 * * * *`), jeder `/notify`-Aufruf und jeder `/roster`-Abruf (die Seite fragt alle 5 Minuten). `/health` zeigt unter `cron.ageSec`, wann der Cron zuletzt lief – `"cron":null` heißt: kein Cron-Trigger eingerichtet.
- **Fehler werden nicht als gesendet markiert**, der nächste Build versucht es erneut.

**Link anpinnen:** Der Button „Link anpinnen" postet den Roster-Link in `DISCORD_CHANNEL_ID` und pinnt die Nachricht. Dafür braucht der Bot `MANAGE_MESSAGES` im Kanal. Ohne die Variable meldet die Seite „DISCORD_CHANNEL_ID fehlt".

## Todes-Erinnerung im Kanal

Der Cron-Trigger (`*/5 * * * *`) prüft die **letzten 3 ZvZ-Battles**. Wer in einem dieser Battles **mindestens 2 Tode** hat, löst eine Nachricht aus:

```
**☠️ Todes-Erinnerung · ZvZ**
Battle 13.11., 21:34 · Masse 21
• **Relgok** — 3 Tode, 1 Kill
• **PDragonyx** — 2 Tode, 4 Kills
```

- Eine Nachricht pro Battle, sortiert nach Toden.
- Merker `rb:alert:<guild>:<battleId>:<name>` im KV (30 Tage): jede Warnung kommt genau einmal, auch wenn Cron und manueller Aufruf parallel laufen.
- Battle-Daten werden erst 2 Stunden nach dem Battle-Ende aus dem 30-Tage-Cache bedient; während des Fights gespeicherte Zwischenstände können so nicht dauerhaft falsche Tode zeigen.
- Gilden-ID für den Cron: `ALERT_GUILD`, Standard `p9uAFij9ReO0BhIhHlVa8g` (The-Fallen).

**Testen:**

```
# 1. Format prüfen (Beispielnachricht, keine echten Daten, kein Merker)
GET /alerts?demo=1&name=Takumoto04&deaths=5&key=<mod-key>

# 2. Trockenlauf: was würde gemeldet, ohne zu senden
GET /alerts?guild=<id>&key=<mod-key>&notify=0&force=1
#    Antwort: details[] mit name, deaths, kills, battleId, time, mass

# 3. Echter Test: Merker eines Spielers löschen und sofort neu melden
GET /alerts?guild=<id>&key=<mod-key>&reset=1&name=<Spieler>
```

Die `details` stammen aus denselben `playerStats` wie die Battle-Ansicht auf AlbionZvZ – ein Abgleich der Todeszahlen dort ist der Beleg, dass das Tracking stimmt.

## Tode und Aktivität (Albion-API)

Der Auto-Zuweiser liest die Todesdaten über die offizielle API, nicht über die Battleboard-Seite (die ist login-geschützt).

| Feld | Bedeutung |
| --- | --- |
| `deaths` | Tode in den letzten 30 Tagen (max. 40 gezählt, `partial` markiert die Obergrenze) |
| `zvz` | davon ZvZ-Tode |
| `deaths7` | Tode in den letzten 7 Tagen |
| `zvz7` | davon ZvZ-Tode |
| `lastDays` | Tage seit dem letzten Tod, `null` = keine Tode erfasst |
| `missing` | Namen, die nicht in der Gilde gefunden wurden (z. B. Twinks) |

**ZvZ-Zahlen (exakt):** Der Worker liest die Players-Tabelle direkt von der öffentlichen Gildenseite:

```text
GET /guilds/europe/<guildId>?view=players&minMass=15&maxMass=29&window=30d
```

Die Tabelle steckt serverseitig im HTML (`"players":[{ name, battles, kills, deaths, killFame, lastSeenMs }]`) und wird per `parseGuildPlayers` ausgelesen. Damit sind Kills, Tode, Battles und K/D **identisch mit der Players-Seite** – gegengeprüft: Relgok 10/0/1, PDragonyx 8/9/3, Amayana 7/0/1.

Fenster: `7d`, `30d`, `90d`, `all` – genau die Werte, die die Seite anbietet (daher 7/30/90/Alles statt 14 Tage).

Die **Todesliste** (Killer, Waffe, IP) kommt aus den Battle-Killfeeds (`/api/dev/battle-board/battle/events`), gefiltert auf dasselbe Fenster.

**Doppelte Ereignisse:** Die Spieler-Endpunkte liefern bei `offset` teils dieselben Einträge erneut. `fetchPlayerEvents` dedupliziert deshalb über `EventId` – sonst würden „Alle"-Zahlen mehrfach gezählt.

Gewichtung im Gehirn (max. ±10 Punkte, damit Wünsche dominieren):

| Signal | Punkte |
| --- | --- |
| letzter Tod ≤ 7 Tage | +6 |
| ≤ 14 Tage | +3 |
| älter als 30 Tage | −5 |
| je **ZvZ**-Tod in 30 Tagen | −0,5 (max. −6) |

Das ist bewusst **Aktivität plus leichte Vorsicht**, keine Bestrafung: Tanks sterben systembedingt häufiger als Longbows. Angezeigt wird die ZvZ-Zahl als `† 4 ZvZ · zuletzt vor 3 Tagen`, grün bis 7 Tage, orange bis 30, grau danach.

**Cache und Drosselung:** Der Worker hält Mitglieder 12 h und Tode pro Spieler 12 h im vorhandenen KV (`FEEDBACK_TF`). Beim ersten Abruf fragt er die API sequenziell mit 700 ms Abstand (die API antwortet sonst mit 429), danach kommt alles aus dem Cache. Nur die angemeldeten Spieler werden abgefragt, maximal 60 pro Aufruf.

**Gilde:** `p9uAFij9ReO0BhIhHlVa8g` (The-Fallen, EU), hinterlegt als `RB_GUILD_ID` in `index.html`.

## Gilde-Tab

`#admin-guild` listet alle Mitglieder alphabetisch (mit Suchfeld). Ein Klick auf einen Namen lädt die letzten Tode.

Oben im Detailbereich zwei Umschalter:

| Schalter | Wirkung |
| --- | --- |
| **ZvZ / Gesamt** | filtert die Todesliste (ZvZ-Tode vs. alle Tode) |
| **7 T / 30 T / 90 T / Alles** | Zeitraum für Liste und Auswertung |

Darunter steht die Auswertung für den gewählten Zeitraum, immer für beide Welten:

```
letzte 30 Tage   Tode  Kills  K/D
ZvZ                 4     12  3,00
Alle                9     25  2,78
```

Farben: **Tode rot**, **Kills grün**, K/D **grün ab 1,5**, **orange ab 1,0**, darunter **rot** (ohne Tode grau).

| Spalte | Inhalt |
| --- | --- |
| Datum | Zeitpunkt des Todes |
| wann | relativ („heute", „vor 3 Tagen") |
| Gebiet | `OPEN_WORLD`, … plus `ZvZ`-Marke |
| getötet von | Spielername + Gilde |
| Waffe | Waffe des Opfers aus `Equipment.MainHand` |
| IP | durchschnittliche Item Power |

Datenquelle: `/guild` (Mitglieder, 12 h im KV) und `/deaths/detail` (bis 40 Tode und 40 Kills, 12 h Cache). Beim ersten Aufruf pro Spieler bis zu 8 API-Seiten, danach sofort.

Grenzen: Die API kennt nur Tode/Kills, keine Heilung oder Assistenz; `KillArea` ist die einzige Ortsangabe. „Gesamt" umfasst die geladenen Einträge (max. 40 je Art), nicht die komplette Historie. Namen müssen exakt dem In-Game-Namen entsprechen – Twinks erscheinen nicht in der Gildenliste.

## Statistik-Tab (`#admin-stats`)

Zwei Ansichten, beide mit Textfilter und Tode-Filter (mind. 1/2/3/5):

- **Übersicht** – alle Spieler aus der Players-Tabelle für 7/30/90/Alles: Battles, Kills, Tode, K/D, Fame, zuletzt gesehen. Klick auf den Spaltenkopf sortiert, standardmäßig Tode absteigend.
- **Letzte 3 Tage** – Tode je Spieler aus den ZvZ-Battles der letzten 72 Stunden. Markierung: `erhöht` ab 2 Toden, `häufig gestorben` ab 4 Toden.

Datenquelle: `/guildstats` (Players-Tabelle) und `/guildrecent` (Battle-Aggregation). Beides liegt 12 h im KV; „Daten aktualisieren" sendet `force=1` und holt sofort neu. Die 3-Tage-Auswertung verarbeitet höchstens 40 Battles pro Aufruf, um das Subrequest-Limit der Free-Instanz (50) nicht zu reißen; die Battle-Daten selbst bleiben 30 Tage im Cache.

## Worker: was du ändern musst

**`Worker/worker.js` ist ab jetzt der komplette Worker** – Feedback, Editor, Roster, Discord und Tode in einer Datei. Zum Aktualisieren wird sie komplett kopiert, nichts mehr zusammengeklebt. `Worker/roster.js` bleibt nur als Modul-Referenz liegen.

1. Cloudflare Dashboard → dein Worker → **Edit code** (oder `wrangler`).
2. Alles markieren, löschen und den Inhalt von `Worker/worker.js` einfügen.
3. **Deploy**.
4. Prüfen:

   ```text
   GET /roster?event=<64-hex>&key=<mod-key>      → JSON
   GET /guild?guild=<id>&key=<mod-key>           → Mitgliederliste
   GET /deaths/detail?guild=<id>&name=<name>&key=<mod-key>
   GET /guildstats?guild=<id>&window=30d&key=<mod-key>   → alle Spieler
   GET /guildrecent?guild=<id>&key=<mod-key>             → Tode der letzten 3 Tage
   GET /alerts?guild=<id>&key=<mod-key>                  → Todes-Erinnerung prüfen
   ```

   Ohne `key` muss überall `401 unauthorized` kommen. `&force=1` umgeht den 12-h-Cache (Button „Daten aktualisieren" im Statistik-Tab).

Kein neues KV, kein Durable Object, keine neuen Bindings (die Tode nutzen `FEEDBACK_TF` als Cache).

<details><summary>Ältere Variante: nur die Routen ergänzen</summary>

Falls du doch nur die Funktionen übernehmen willst:

```js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/roster') return handleRoster(request, env, url);
    if (url.pathname === '/notify') return handleNotify(request, env, url);
    if (url.pathname === '/deaths') return handleDeaths(request, env, url);
    if (url.pathname === '/guild') return handleGuild(request, env, url);
    if (url.pathname === '/deaths/detail') return handleDeathDetail(request, env, url);
    // ... bestehender Code (Feedback, /content)
  }
}
```

</details>

**Bindings:** `MOD_KEY`, `DISCORD_TOKEN` und `FEEDBACK_TF` sind vorhanden. `DISCORD_CHANNEL_ID` muss auf den Zielkanal gesetzt sein (Feedback, Anmeldungen, Todes-Erinnerung und Pin). `DISCORD_USER_ID` bleibt optional als DM-Fallback. `ALERT_GUILD` ist optional. Zusätzlich im Dashboard unter **Triggers** einen Cron-Trigger `*/5 * * * *` anlegen, damit die Todes-Erinnerung ohne offene Seite läuft.

**CORS:** Der Worker antwortet mit `Access-Control-Allow-Origin: *` wie der bisherige Code; der Mod-Key bleibt der Riegel. Dadurch funktioniert die Seite auch von `file://` und localhost.

## Warum Polling und kein Push

- AlbionZvZ liefert öffentlich `GET /api/events/public/<token>/roster` (~4 KB) und `…/assignments/ops?sinceSeq=` (~400 B Delta).
- Es gibt **keinen** CORS-Header und keinen WebSocket/SSE-Kanal – der Browser darf nicht direkt, und Push ist nicht verfügbar.
- Deshalb: Worker holt die Daten, die Seite fragt den Worker alle 5 Minuten. Das ist derselbe Weg, den AlbionZvZ selbst nutzt.
- Der Worker cacht die Event-Seite (Rollen + Comp) 5 Minuten, damit nicht bei jedem Poll 800 KB HTML geladen werden.

## Zahlen neben den Rollen

Die Badges zeigen **Einsätze auf der Rolle**, nicht Albion-Mastery:

- Quelle ist die eigene Historie `hist[rolle]`, `+1` pro bestätigtem Einsatz.
- „Historie +1" im Kopf der Comp leistet das im Prototyp; später kann das beim Abschließen automatisch passieren.
- Start ist leer. Nach drei bis vier Events sind die Zahlen belastbar.
- AlbionZvZ zeigt ähnliche Zahlen nur dem eingeloggten Nutzer; sie sind nicht öffentlich abrufbar (geprüft: `/roster` enthält keine Zähler).

## In `index.html` geändert

| Stelle | Zeile | Änderung |
| --- | --- | --- |
| Konstanten | 279 | `ROSTER_ENDPOINT` neben `FEEDBACK_ENDPOINT` |
| CSS | 185–275 | `.rb-*`, `main.rb-wide`, breites Layout nur für diese Seite |
| Editor-Filter | 744 | `admin-roster` von der Editor-Seitenliste ausgenommen |
| Seitenleiste | 1401 | Link „Roster-Brain" im Admin-Block |
| `go()` | 1434 | `main` bekommt auf dieser Seite die Klasse `rb-wide` |
| Modul | 1486–2196 | Engine, Picker, Live-Polling, Historie |
| Registrierung | 2198 | `P['admin-roster']`, `I['admin-roster']` |

Die Engine arbeitet zweistufig (erst Party 1 + 2, dann Reserve), setzt den Caller fest und lässt Slots lieber leer, als jemanden auf eine fremde Rolle zu zwingen. Details im Abschnitt „Das Gehirn" unten.

## Datenmodell (Worker-Antwort)

```json
{
  "event": { "title": "…", "startsAt": "…", "status": "open", "shotCaller": "Relgok" },
  "parties": [
    { "title": "Party 1", "slots": [ { "weapons": ["1H Mace"], "player": "Relgok" } ] }
  ],
  "players": [
    { "name": "d0bb1.", "prefs": ["Carving", "Longbow"], "tentative": false, "note": "" }
  ],
  "playstyles": { "Occult (Beam Spiked)": "support" }
}
```

`weapons` kann zwei Einträge haben (Doppel-Slots „Longbow / Demonfang"); die gewählte Waffe wird clientseitig als `pick` gespeichert.

## Das Gehirn – Regeln

1. **Haupt-Comp** (Party 1 + 2) optimal per Ungarischer Methode füllen.
2. **Reserve** nur aus den Übriggebliebenen und nur mit echtem Wunsch oder Historie.

| Signal | Gewicht |
| --- | --- |
| 1. Wunsch / 2. / 3. / 4.–6. | 105 / 84 / 66 / 50–24 |
| gleiche Rollenfamilie | 48 → 14 |
| Historie auf der Waffe | +2,4 pro Einsatz (max. 12) |
| Historie in der Rollenfamilie | +0,8 pro Einsatz (max. 25) |
| Anteil der Rolle an der Gesamthistorie | +26 × Anteil |
| tentative | −22 |
| keine Historie | −5 |

- Schwellen: **18** Punkte in der Haupt-Comp, **60** in der Reserve.
- Der Caller ist gesetzt und löst keine Konflikte aus.
- Dummy-Spalten erlauben leere Slots.
- Rollen außerhalb der Comp (Occult, Heron, Hoj, Infernal Staff, Riftglaive, Lifecursed) werden über `playstyle` der Familie zugeordnet.

## Grenzen / offen

1. **Historie liegt im Browser** (`localStorage`). Zwei Moderatoren haben getrennte Zahlen; für gemeinsame Historie später ein KV-Binding.
2. **Kein Multi-Moderator-Sync** – die Live-Abfrage liest AlbionZvZ, nicht die Änderungen eines zweiten Callers.
3. **Kein Zurückschreiben** nach AlbionZvZ: Das ginge nur mit deiner Login-Session und ist bewusst nicht eingebaut. Übertragung per Kopiervorlage.
4. **Token manuell** – kein Event-Picker; der Link wird eingefügt.
5. **Polling-Intervall 5 Minuten** – bei Bedarf im Modul (`setInterval(..., 300000)`) anpassbar.

## Testprotokoll

- Worker lokal gegen die echte Event-Seite: 401 ohne Key, 403 bei fremdem Origin, 200 mit korrektem CORS; 12 Spieler, 60 Slots (51 aktiv), 141 Playstyles aufgelöst.
- `index.html`: `node --check` OK; Headless-Chromium mit gestubbter Worker-Antwort:
  - 12 Spielerkarten, 60 Slots, Statuszeile gesetzt
  - Build setzt alle 12, Caller auf Slot 1
  - Historie-Badges erscheinen und werden gespeichert
  - Live-Schalter an/aus
  - Navigation zu `#start` und zurück: Seite rendert erneut, `rb-wide` wird korrekt entfernt
- Rahmen-Fix: leere Slots haben 1 px Rand, links 3 px Farbbalken.
- Auto-Modus im Headless-Test: startet an, weist ohne Klick 12 Spieler zu, schaltet bei manuellem × ab, baut nach erneutem Einschalten sofort, erkennt im Poll einen 13. Spieler und baut automatisch nach.
- Discord im Headless-Test: erste Meldung mit 12 Änderungen und Link, kein Doppelversand bei unverändertem Build, neuer Spieler löst genau eine Meldung mit einer Zeile aus, ausgeschalteter Schalter verhindert den Versand.
- Gilde-Tab im Headless-Test: Mitgliederliste, Klick lädt Details, 5 Tode als Tabelle, Waffe lesbar (T8_MAIN_MACE → MACE), Suche filtert, keine JS-Fehler.
- Worker `handleGuild`/`handleDeathDetail`: 200 mit sortierter Liste, 404 bei unbekanntem Namen, KV-Cache ohne erneuten API-Request.
- ZvZ: Worker zählt Tode mit `groupMemberCount >= 10` bzw. `numberOfParticipants >= 10`; Testdaten 4 Tode (2 ZvZ) → `zvz: 2`, `zvz7: 2`.
- ZvZ über Battle-IDs: Stub mit Battles 111/222/333 und Toden 111, 999, 222, null, 333, 111 … → 6 von 10 als ZvZ, `zvzSource: battles`, `zvzBattles: 3`.
- Players-Tabelle: `parseGuildPlayers` liest 48 Spieler aus der echten Seite; Relgok 10/0/1, PDragonyx 8/9/3, Amayana 7/0/1 – identisch mit der Seite.
- Dedupe: Spieler-Endpunkt liefert dieselbe Seite bei jedem Offset → `fetchPlayerEvents` gibt 10 statt 40 Ereignisse zurück.
- Farben im Gilde-Tab: Tode `rb-red`, Kills `rb-green`, K/D 0,50 rot, 1,00 orange, 3,00 grün; ZvZ-Hinweis „15–29 Masse".
- Gilde-Tab: Umschalter ZvZ/Alle und 7/14/30/Gesamt, K/D 2/1 = 0,50 und 3/3 = 1,00, Gesamt 4/3 = 0,75.
- Roster: nur ein Abruf in 8 s (5-Minuten-Intervall), beim Öffnen keine DM, nach einer neuen Anmeldung genau eine DM mit dem neuen Namen.
