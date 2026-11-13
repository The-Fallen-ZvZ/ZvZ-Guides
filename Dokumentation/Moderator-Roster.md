# Moderator-Roster & Roster-Brain

Stand: 13.11.2026 · **in `Anwendung/index.html` eingebaut** · Worker-Erweiterung liegt bereit.

## Status

| Teil | Zustand |
| --- | --- |
| Ansicht `#admin-roster` | eingebaut, nur mit Mod-Key erreichbar |
| Gilde-Tab `#admin-guild` | eingebaut: alle Mitglieder, Klick zeigt die letzten Tode |
| AlbionZvZ | **bleibt verbindlich** – das Brain liefert nur den Vorschlag und eine Kopiervorlage |
| Worker-Route `/roster` | Code fertig (`Worker/roster.js`), muss noch deployt werden |
| Discord | DM bei jeder Änderung, optional angepinnter Roster-Link |
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

Ablauf: Nach jedem Build vergleicht die Seite die Zuweisung mit dem zuletzt gemeldeten Stand (`tf-rb-notified`, pro Event). Nur echte Änderungen erzeugen eine Nachricht:

```
**Roster-Update** · ZVZ-Builds ZVZ Test Event
Anmeldung von: **Pinsel** → Locus
Anmeldung von: **Boerse** → Tank Hallowfall

Manuell anpassen: https://the-fallen-zvz.github.io/ZvZ-Guides/#admin-roster
```

- **Ein Spieler = eine Zeile**, mehrere Änderungen gebündelt in einer DM (max. 20, Rest gekürzt).
- **Nur wenn sich jemand neu angemeldet hat.** Reine Rollenverschiebungen (z. B. nach einer Historienänderung) lösen keine DM aus. Wer innerhalb der 5 Minuten dazukommt, landet in derselben Nachricht.
- **Beim ersten Öffnen keine DM** – die Erstbelegung ist keine neue Anmeldung.
- **Wer den Slot verlässt**, wird als „hat den Slot verlassen" gemeldet.
- **Kein Doppelversand:** gleicher Spieler + gleiche Rolle wird nicht erneut geschickt; erst eine neue Rolle löst wieder aus.
- **Nur bei geänderten Daten** – ein Poll ohne Änderung schickt nichts.
- **Fehler werden nicht als gesendet markiert**, der nächste Build versucht es erneut.

**Link anpinnen:** Der Button „Link anpinnen" postet den Roster-Link in `DISCORD_CHANNEL_ID` und pinnt die Nachricht. Dafür braucht der Bot `MANAGE_MESSAGES` im Kanal. Ohne die Variable meldet die Seite „DISCORD_CHANNEL_ID fehlt".

Hinweis: DMs selbst lassen sich in Discord nicht anpinnen – deshalb DM für Updates, Kanal-Pin für den Link.

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

**ZvZ-Erkennung (exakt):** Der Worker holt die ZvZ-Battles der Gilde über `GET /api/guild-profile/battles` (AlbionZvZ, öffentlich) mit **Masse 15–29** und `massMode=guild`. Für jede dieser Battles lädt er `GET /api/dev/battle-board/battle/events?server=europe&battleId=…` – dort stehen `playerStats` (Kills/Deaths je Spieler) und der komplette `killFeed` (Killer, Opfer, Waffe, IP, Zeit).

Damit sind Kills, Tode und K/D **identisch mit der Players-Tabelle auf AlbionZvZ** (gleiche Quelle, gleicher Filter). Gegengeprüft: Relgok 10 Battles / 0 Kills / 1 Death, PDragonyx 8/9/3, Amayana 7/0/1 – exakte Übereinstimmung.

**Cache:** Battles sind unveränderlich und werden 30 Tage im KV gehalten (`rb:battle2:<id>`), die Battle-Liste 12 h (`rb:zvz:<guild>`). Der erste Aufruf für 30 Tage lädt ~10 Battles (rund 5 s), danach kommt alles aus dem Cache.

**„Alle"** (nicht-ZvZ) kommt weiterhin aus den Spieler-Endpunkten und ist dort auf die letzten ~40 Ereignisse begrenzt – deshalb der Hinweis unter der Tabelle.

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
| **7 T / 14 T / 30 T / Gesamt** | Zeitraum für Liste und Auswertung |

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
   ```

   Ohne `key` muss überall `401 unauthorized` kommen.

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

**Bindings:** `MOD_KEY`, `DISCORD_TOKEN`, `DISCORD_USER_ID` sind vorhanden; optional `DISCORD_CHANNEL_ID` für den Pin. `FEEDBACK_TF` dient als Cache – es kommt nichts Neues dazu.

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
- Farben im Gilde-Tab: Tode `rb-red`, Kills `rb-green`, K/D 0,50 rot, 1,00 orange, 3,00 grün; ZvZ-Hinweis „15–29 Masse".
- Gilde-Tab: Umschalter ZvZ/Alle und 7/14/30/Gesamt, K/D 2/1 = 0,50 und 3/3 = 1,00, Gesamt 4/3 = 0,75.
- Roster: nur ein Abruf in 8 s (5-Minuten-Intervall), beim Öffnen keine DM, nach einer neuen Anmeldung genau eine DM mit dem neuen Namen.
