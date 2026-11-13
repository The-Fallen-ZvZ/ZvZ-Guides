# Moderator-Roster & Roster-Brain

Stand: 13.11.2026 · **in `Anwendung/index.html` eingebaut** · Worker-Erweiterung liegt bereit.

## Status

| Teil | Zustand |
| --- | --- |
| Ansicht `#admin-roster` | eingebaut, nur mit Mod-Key erreichbar |
| AlbionZvZ | **bleibt verbindlich** – das Brain liefert nur den Vorschlag und eine Kopiervorlage |
| Worker-Route `/roster` | Code fertig (`Worker/roster.js`), muss noch deployt werden |
| Discord | DM bei jeder Änderung, optional angepinnter Roster-Link |
| Historie | lokal im Browser (später optional KV) |
| Live-Aktualisierung | Polling alle 5 s, startet beim Öffnen automatisch |
| Auto-Zuweisung | standardmäßig an: bei Änderungen sofort, sonst alle 5 Minuten |

## Ablauf im Betrieb

1. Moderatoren-Login → **Roster-Brain** in der Seitenleiste.
2. Event-Token aus dem AlbionZvZ-Link einfügen (`/e/…`) → **Verbinden**.
3. **Live** startet automatisch – neue Anmeldungen erscheinen ohne Reload (≤ 5 s). Beim Zurückwechseln in den Tab wird sofort aktualisiert.
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
| `deaths` | Tode in den letzten 30 Tagen (max. 20 gezählt, `partial` markiert die Obergrenze) |
| `deaths7` | Tode in den letzten 7 Tagen |
| `lastDays` | Tage seit dem letzten Tod, `null` = keine Tode erfasst |
| `missing` | Namen, die nicht in der Gilde gefunden wurden (z. B. Twinks) |

Gewichtung im Gehirn (max. ±10 Punkte, damit Wünsche dominieren):

| Signal | Punkte |
| --- | --- |
| letzter Tod ≤ 7 Tage | +6 |
| ≤ 14 Tage | +3 |
| älter als 30 Tage | −5 |
| je Tod in 30 Tagen | −0,5 (max. −6) |

Das ist bewusst **Aktivität plus leichte Vorsicht**, keine Bestrafung: Tanks sterben systembedingt häufiger als Longbows. Angezeigt wird die Zahl als `† 10 · zuletzt vor 3 Tagen`, grün bis 7 Tage, orange bis 30, grau danach.

**Cache und Drosselung:** Der Worker hält Mitglieder 12 h und Tode pro Spieler 12 h im vorhandenen KV (`FEEDBACK_TF`). Beim ersten Abruf fragt er die API sequenziell mit 700 ms Abstand (die API antwortet sonst mit 429), danach kommt alles aus dem Cache. Nur die angemeldeten Spieler werden abgefragt, maximal 60 pro Aufruf.

**Gilde:** `p9uAFij9ReO0BhIhHlVa8g` (The-Fallen, EU), hinterlegt als `RB_GUILD_ID` in `index.html`.

## Worker: was du ändern musst

Die Datei `Worker/roster.js` enthält eine eigenständige Funktion `handleRoster`. Kein KV, kein Durable Object, keine neuen Bindings.

1. Cloudflare Dashboard → dein Worker → **Edit code** (oder `wrangler`).
2. Inhalt von `Worker/roster.js` an den bestehenden Code anhängen.
3. Im `fetch`-Handler **eine** Zeile ergänzen:

   ```js
   export default {
     async fetch(request, env, ctx) {
       const url = new URL(request.url);
       if (url.pathname === '/roster') return handleRoster(request, env, url);   // <- neu
       if (url.pathname === '/notify') return handleNotify(request, env, url);   // <- neu
       if (url.pathname === '/deaths') return handleDeaths(request, env, url);   // <- neu
       // ... bestehender Code (Feedback, /content)
     }
   }
   ```

   **Ältere Service-Worker-Syntax?** Dann so einhängen:

   ```js
   addEventListener('fetch', event => {
     const url = new URL(event.request.url);
     if (url.pathname === '/roster') {
       event.respondWith(handleRoster(event.request, { MOD_KEY }, url));
       return;
     }
     // ... bestehender Code
   });
   ```

4. Prüfen, dass die Bindung **`MOD_KEY`** existiert (nutzt du schon fürs Feedback). Für den angepinnten Link optional **`DISCORD_CHANNEL_ID`** anlegen; `DISCORD_TOKEN` und `DISCORD_USER_ID` sind bereits da. Die Tode-Route nutzt **`FEEDBACK_TF`** als Cache – die Bindung ist vorhanden, es kommt nichts Neues dazu.
5. Deployen.

**Test nach dem Deploy:**

```text
https://<worker>/roster?event=<64-hex>&key=<mod-key>   -> JSON mit event, parties, players, playstyles
https://<worker>/roster?event=<64-hex>                  -> 401 unauthorized
```

**CORS:** Der Worker erlaubt `https://the-fallen-zvz.github.io`, `http://localhost:8080`, `http://127.0.0.1:8080`, `http://localhost:5500`, `http://127.0.0.1:5500` und `null` (Datei direkt geöffnet). Weitere Origin in `ALLOWED_ORIGINS` ergänzen.

## Warum Polling und kein Push

- AlbionZvZ liefert öffentlich `GET /api/events/public/<token>/roster` (~4 KB) und `…/assignments/ops?sinceSeq=` (~400 B Delta).
- Es gibt **keinen** CORS-Header und keinen WebSocket/SSE-Kanal – der Browser darf nicht direkt, und Push ist nicht verfügbar.
- Deshalb: Worker holt die Daten, die Seite fragt den Worker alle 5 s. Das ist derselbe Weg, den AlbionZvZ selbst nutzt.
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
5. **Polling-Intervall 5 s** – bei Bedarf im Modul (`setInterval(..., 5000)`) anpassbar.

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
