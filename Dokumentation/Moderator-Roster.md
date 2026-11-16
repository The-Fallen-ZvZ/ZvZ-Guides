# Moderator-Roster & Roster-Brain

Stand: 13.11.2026 · **in `Anwendung/index.html` eingebaut** · Worker-Erweiterung liegt bereit.

## Status

| Teil | Zustand |
| --- | --- |
| Ansicht `#admin-roster` | eingebaut, nur mit Mod-Key erreichbar |
| Gilde-Tab `#admin-guild` | eingebaut: alle Mitglieder, Klick zeigt die letzten Tode |
| AlbionZvZ | **bleibt verbindlich** – das Brain liefert nur den Vorschlag und eine Kopiervorlage |
| Worker-Route `/roster` | Code fertig (`Worker/roster.js`), muss noch deployt werden |
| Discord | eine Comp-Nachricht (Party 1 + 2), die bei jeder Änderung aktualisiert wird, Todes-Erinnerung per Cron, optional angepinnter Roster-Link |
| Historie | lokal im Browser (später optional KV) |
| Live-Aktualisierung | Polling jede Stunde (24/Tag), startet beim Öffnen automatisch; Knopf **Aktualisieren** jederzeit |
| Auto-Zuweisung | standardmäßig an: bei Änderungen sofort, sonst höchstens einmal pro Stunde |

## Ablauf im Betrieb

1. Moderatoren-Login → **Roster-Brain** in der Seitenleiste.
2. Event-Token aus dem AlbionZvZ-Link einfügen (`/e/…`) → **Verbinden**.
3. **Live** startet automatisch – neue Anmeldungen erscheinen ohne Reload (Abfrage **jede Stunde**; der Knopf **Aktualisieren** holt sofort neu). Beim Zurückwechseln in den Tab wird nach frühestens 10 Minuten aktualisiert.
4. **Auto** ist standardmäßig an: Das Gehirn weist bei jeder Änderung sofort und sonst höchstens einmal pro Stunde selbst zu. Wer selbst bauen will, schaltet Auto aus – oder greift einfach manuell ein, dann schaltet es sich ab.
5. **Build the Group** – einmaliger Vorschlag mit Begründung, Konflikten, Bank und offenen Slots.
5. Manuell korrigieren: Spieler auf einen Slot ziehen, freien Slot anklicken (nach Passung sortierte Liste), × zum Entfernen.
6. **Kopieren** und das Ergebnis in AlbionZvZ übertragen – dort bleibt die verbindliche Zuweisung.
7. **Historie +1** zählt die aktuelle Zuweisung als einen gespielten Einsatz; die Zahlen wachsen damit.

## Auto-Modus

Der Schalter **Auto** sitzt neben „Build the Group" und merkt sich seinen Zustand.

| Zustand | Verhalten |
| --- | --- |
| **Auto: an** | Weist bei jeder erkannten Änderung sofort zu (neuer/abgemeldeter Spieler, geänderte Wünsche) und sonst höchstens einmal pro Stunde. Beim Öffnen der Seite wird sofort gebaut. |
| **Auto: aus** | Nichts wird automatisch verändert. „Build the Group" bleibt als einmaliger Vorschlag verfügbar. |
| **Manueller Eingriff** | Ziehen, × oder Picker setzt Auto automatisch auf aus und meldet „Auto aus – manuelle Zuweisung". So wird eine korrigierte Gruppe nicht beim nächsten Poll überschrieben. |

Damit ist der Ablauf: Moderatoren-Login → Seite öffnen (Live + Auto laufen) → Ergebnis in AlbionZvZ übertragen. Ohne offene Seite wird nichts zugewiesen – es gibt keinen Server-Job, der im Hintergrund arbeitet.

## Rollen-Ziele (Party-Aufbau)

Der Build setzt **pro Rolle nur so viele Slots**, wie die Vorgabe für die aktuelle Anmeldezahl sagt. Alles darüber bleibt offen – dadurch rutschen Spieler auf ihre **2. oder 3. Wunschrolle**, statt dass alle auf ihrer 1. Wahl sitzen und Heiler/Tanks fehlen.

| Angemeldet | Heiler | Tanks | Support | DPS | Caller | Summe |
| --- | --- | --- | --- | --- | --- | --- |
| 10–15 | 4 | 3 | 2 | 4 | 1 | 14 |
| 15–20 | 5 | 4 | 4 | 6 | 1 | 20 |
| 20–25 | 6 | 6 | 5 | 7 | 1 | 25 |
| 25–30 | 7 | 7 | 6 | 9 | 1 | 30 |

- **Kleinere Gruppen:** Die Tabelle **ist** der Plan – nicht auf die Kopfzahl gekürzt. Bei 12 Angemeldeten stehen 14 Plätze drin, zwei bleiben offen; genau daran sieht man, welche Rollen noch fehlen. Bei 0 Anmeldungen zeigt die Nachricht den vollen 10–15er-Plan.
- **Rollen-Gruppen:** `Healer` → Heiler, `Tank` → Tank, `Support` → Support, `Support DPS` / `Clap DD` / `Brawl DD` / `Battlemount` → DPS, der Caller-Slot der Party 1 zählt separat.
- **Gleichmäßig auf beide Parteien:** Die Slots werden reihum aus Party 1 und Party 2 genommen (Heiler #1 aus P1, Heiler #1 aus P2, Heiler #2 aus P1 …), damit keine Partei alles aufsaugt.
- **Wünsche:** Exakter Wunsch ⇒ 105/84/66/50/36/24 Punkte (1.–6. Wahl). Gleiche Rollen-Familie (z. B. `Spiked Gauntlets` auf einem `Longbow`-Slot) ⇒ 48/38/28/20/14. Gleiche Rollen-Gruppe (z. B. `Spiked Gauntlets` auf `Carving`, beides DPS) ⇒ 40/30/22/16/12. Danach zählen Historie und Todesdaten.
- **Reserve-Parties** (ab Party 3) bleiben unbegrenzt; dort landet nur, wer die Rolle ausdrücklich will.
- **Anpassen:** Tabelle `QUOTA_TABLE` und Zuordnung `ROLE_GROUP` im Roster-Modul (`Anwendung/index.html`). Die Werte gelten als Obergrenze – manuell ziehen kann man weiterhin alles.

## Discord-Benachrichtigungen

Der Schalter **Discord** (neben „Historie +1") steuert, ob die Comp-Nachricht gepflegt wird; Standard ist an.

Alle Meldungen gehen in den Kanal aus `DISCORD_CHANNEL_ID` (Feedback, Comp, Todes-Erinnerung). Ist keine Kanal-ID gesetzt, fällt der Worker auf DMs an `DISCORD_USER_ID` zurück.

**Eine Nachricht pro Event, die aktualisiert wird** (seit 2026-11-16):

````
**THE-FALLEN · ZVZ Test Event**
Stand 16.11., 14:32 · 18 angemeldet
```
Party 1                        │ Party 2
Call 1H Mace          DerJoker │ Tank Dreadstorm
Tank HeavyMace        Pinsel   │ Tank Stillgaze
Tank Earthrune                 │ Heal Exalted
Heal Exalted          Boerse   │ Heal Tank Hallowfall
Heal 1H Holy                   │ Supp Grovekeeper
Heal 1H Nature                 │ DPS  Carving
Supp Locus            Relgok   │ DPS  Damnation
Supp Rootbound                 │ DPS  Shadowcaller
Supp Oathkeepers               │ DPS  Demonfang
DPS  Spiked Gauntlets Amayana  │ DPS  Galatine Pair
DPS  Permafrost                │ DPS  Riftglaive
DPS  Longbow                   │ Tank Heron
DPS  Dawnsong
```

**Alternativen**
```
Heal Exalted          Gast1
DPS  Longbow          Bank1
```

Besetzt: Heiler 4 · Tanks 4 · Support 3 · DPS 6 · Caller 1
Neu: **Boerse**
````

- **Beim ersten Mal wird gepostet**, danach ausschließlich dieselbe Nachricht editiert (`PATCH /channels/{id}/messages/{msg}`). Die Nachrichten-ID liegt im KV unter `rb:compmsg:<kanal>:ev-<token>`.
- **Beim Verbinden eines neuen Events** wird die Nachricht sofort angelegt – auch mit **0 Anmeldungen**. Dann stehen alle Rollen ohne Namen da, und man sieht beim Auffüllen, welche Rolle noch fehlt.
- **Komplette Comp:** Es werden **alle Slots** von Party 1 und Party 2 gelistet, belegt oder nicht. Freie Plätze bleiben einfach in der Namensspalte leer (kein „offen", kein Platzhalter).
- **Kein Spam:** Die Seite schickt nur, wenn sich der Text geändert hat; zwischen zwei Edits liegen mindestens 20 s (`COMP_MIN_GAP_MS`). Wird die Nachricht im Discord gelöscht, legt der Worker sie beim nächsten Aufruf neu an.
- **Schmal gehalten:** Party 1 und Party 2 stehen in einem Code-Block nebeneinander (feste Spalten, keine Breite zum Scrollen). Rollen kurz (`Call`, `Tank`, `Heal`, `Supp`, `DPS`, `BM`), Waffen ohne Klammerzusatz (`Galatine Pair` statt `Galatine Pair (Offtimer)`), lange Namen werden auf 18 Zeichen gekürzt. Gesamtbreite rund 60–65 Zeichen.
- **Alternativen** (Reserve-Parties und nicht eingeplante Spieler) stehen darunter, gleiche Spalten. Bei den nicht eingeplanten Spielern steht die 1. Wunschrolle; ohne Wunsch `Bank`.
- **Kein `Ziel`-Block** – die Vorgabe steckt in der Anzahl der Rollen-Slots. `Besetzt` zeigt den Ist-Stand je Rolle.
- **Neu-Zeile** erscheint nur, wenn seit dem letzten Edit jemand dazugekommen ist; die Änderungen werden zusätzlich im Panel **Änderungen** gespiegelt (`/changes`).
- **Takt (seit 2026-11-16):** Die Seite fragt **1x pro Stunde** ab (24 Abfragen am Tag); der Knopf **Aktualisieren** holt jederzeit sofort neu. Der Cron prüft ebenfalls höchstens 1x pro Stunde (`CRON_MIN_GAP_MS`), auch wenn der Trigger im Dashboard noch auf 5 Minuten steht.
- **Entfernt am 2026-11-16:** `type:"flush"`, `type:"reset"`, `?demo=1` bei `/alerts`, `?send=1` bei `/health`, der Discord-Test-Knopf, der Knopf „Wartende senden" und die separate „Neue Anmeldung"-Nachricht.

**Link anpinnen:** Der Button „Link anpinnen" postet den Roster-Link in `DISCORD_CHANNEL_ID` und pinnt die Nachricht. Dafür braucht der Bot `MANAGE_MESSAGES` im Kanal. Ohne die Variable meldet die Seite „DISCORD_CHANNEL_ID fehlt".

## Spieler manuell eintragen

Wer sich nicht bei AlbionZvZ angemeldet hat (Nachrücker, Vertretung, Gast), lässt sich direkt im Roster ergänzen. Der Knopf **+ Spieler** im Panel **Angemeldet** öffnet die Auswahl:

- **Aus der Gilde:** Liste aller Gildenmitglieder (über `/guild`, 10 Minuten zwischengespeichert), Suchfeld darüber. Ein Klick auf einen Namen trägt ihn sofort ein – der Dialog bleibt offen, damit mehrere nacheinander gehen
- **Nicht in der Gilde:** unten den Namen eintippen, optional Wunschrollen (Komma, max. 6) und **tentative**, dann **Eintragen**
- Bereits eingetragene Spieler (angemeldet oder manuell) fehlen in der Gildenliste; ein Duplikat wird abgelehnt

| Verhalten | Details |
| --- | --- |
| Kennzeichnung | Badge `manuell` am Eintrag, Entfernen über `×` (Slot wird dabei frei) |
| Polls | Der Eintrag bleibt bei jedem Datenabruf erhalten, auch wenn AlbionZvZ ihn nicht listet |
| Discord | Manuelle Einträge lösen **keine** Anmeldungs-Nachricht aus und fehlen deshalb im Änderungs-Spiegel – sie sind keine Albion-Anmeldung |
| Später offiziell angemeldet | Sobald der Name in den AlbionZvZ-Daten auftaucht, übernimmt die Seite die offiziellen Wunschrollen; der manuelle Merker fällt weg |
| Speicherung | pro Event-Token im Browser (`tf-rb-manual`) – nicht geräteübergreifend, andere Moderatoren sehen den Eintrag nicht |
| Ohne Mod-Key | Der Dialog meldet „Nicht als Moderator angemeldet." – die Gildenliste kommt nur mit gültigem Key |

## Änderungs-Spiegel auf der Seite

Unter der Comp sitzt das Panel **Änderungen** (volle Breite). Es zeigt dieselben Zeilen, die als Discord-Nachricht rausgehen – mit Uhrzeit, Spieler, alter/neuer Rolle und Status:

| Status | Bedeutung |
| --- | --- |
| `gesendet` | Nachricht ist im Kanal |
| `gemerkt` | 5-Minuten-Sperre aktiv, Text liegt in der Warteschlange |
| `schon gemeldet` | identischer Text war schon raus, kein zweiter Versand |
| `Sperre` | Versand durch die Sperre abgelehnt |
| `fehlgeschlagen` | Discord hat den Versand abgelehnt (Token/Kanal prüfen) |

- **Quelle:** `GET /changes?event=<64-hex>&limit=40&key=<mod-key>` – der Worker speichert die letzten 40 Meldungen pro Event 7 Tage (`rb:notifylog:<kanal>:<scope>`).
- **Wann aktualisiert:** beim Poll (höchstens alle 30 s), direkt nach jeder Meldung und über den Knopf **Aktualisieren**.
- **Fallback:** Solange der Worker `/changes` noch nicht kennt (alter Deploy), zeigt das Panel die im Browser gemerkten Meldungen (`tf-rb-changes`) mit Hinweis. Nach dem Deploy verschwindet der Hinweis.
- **Ältere Einträge** aus der Zeit vor `2026-11-15` enthalten nur die Anzahl der Änderungen, keine Namen – sie erscheinen als „n Änderungen (älterer Eintrag)".

## Todes-Erinnerung im Kanal

Der Cron-Trigger (`0 * * * *`) prüft die **letzten 3 ZvZ-Battles**. Wer in einem dieser Battles **mindestens 2 Tode** hat, löst eine Nachricht aus:

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

**Prüfen:**

```
# Trockenlauf: was würde gemeldet, ohne zu senden
GET /alerts?guild=<id>&key=<mod-key>&notify=0&force=1
#    Antwort: details[] mit name, deaths, kills, battleId, time, mass

# Merker eines Spielers löschen, damit die nächste Prüfung wieder meldet
GET /alerts?guild=<id>&key=<mod-key>&reset=1&name=<Spieler>
```

`?demo=1` (Beispielnachricht) wurde am 2026-11-16 entfernt.

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

**Bindings:** `MOD_KEY`, `DISCORD_TOKEN` und `FEEDBACK_TF` sind vorhanden. `DISCORD_CHANNEL_ID` muss auf den Zielkanal gesetzt sein (Feedback, Anmeldungen, Todes-Erinnerung und Pin). `DISCORD_USER_ID` bleibt optional als DM-Fallback. `ALERT_GUILD` ist optional. Zusätzlich im Dashboard unter **Triggers** einen Cron-Trigger `0 * * * *` anlegen (stündlich), damit die Todes-Erinnerung ohne offene Seite läuft. Der Worker selbst bremst zusätzlich auf einen Lauf pro Stunde (`CRON_MIN_GAP_MS`), ein versehentlicher 5-Minuten-Trigger ist damit unschädlich.

**CORS:** Der Worker antwortet mit `Access-Control-Allow-Origin: *` wie der bisherige Code; der Mod-Key bleibt der Riegel. Dadurch funktioniert die Seite auch von `file://` und localhost.

## Warum Polling und kein Push

- AlbionZvZ liefert öffentlich `GET /api/events/public/<token>/roster` (~4 KB) und `…/assignments/ops?sinceSeq=` (~400 B Delta).
- Es gibt **keinen** CORS-Header und keinen WebSocket/SSE-Kanal – der Browser darf nicht direkt, und Push ist nicht verfügbar.
- Deshalb: Worker holt die Daten, die Seite fragt den Worker jede Stunde (24 Abfragen/Tag). Das ist derselbe Weg, den AlbionZvZ selbst nutzt.
- Der Worker cacht die Event-Seite (Rollen + Comp) 5 Minuten, damit nicht bei jedem Abruf 800 KB HTML geladen werden.

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
5. **Polling-Intervall 1 Stunde** (`LIVE_MS` im Modul) – Auto-Build höchstens 1x pro Stunde. Ein Verlassen **und** Wiederkommen innerhalb eines Intervalls ist nicht erkennbar; der Tab-Wechsel fragt erst nach 10 Minuten neu ab.

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
