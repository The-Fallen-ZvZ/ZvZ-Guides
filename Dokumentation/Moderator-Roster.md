# Moderator-Roster & Roster-Brain

Stand: 13.11.2026 · **in `Anwendung/index.html` eingebaut** · Worker-Erweiterung liegt bereit.

## Status

| Teil | Zustand |
| --- | --- |
| Ansicht `#admin-roster` | eingebaut, nur mit Mod-Key erreichbar |
| AlbionZvZ | **bleibt verbindlich** – das Brain liefert nur den Vorschlag und eine Kopiervorlage |
| Worker-Route `/roster` | Code fertig (`Worker/roster.js`), muss noch deployt werden |
| Historie | lokal im Browser (später optional KV) |
| Live-Aktualisierung | Polling alle 5 s über den Worker |

## Ablauf im Betrieb

1. Moderatoren-Login → **Roster-Brain** in der Seitenleiste.
2. Event-Token aus dem AlbionZvZ-Link einfügen (`/e/…`) → **Verbinden**.
3. **Live: an** – neue Anmeldungen erscheinen ohne Reload (≤ 5 s).
4. **Build the Group** – Vorschlag mit Begründung, Konflikten, Bank und offenen Slots.
5. Manuell korrigieren: Spieler auf einen Slot ziehen, freien Slot anklicken (nach Passung sortierte Liste), × zum Entfernen.
6. **Kopieren** und das Ergebnis in AlbionZvZ übertragen – dort bleibt die verbindliche Zuweisung.
7. **Historie +1** zählt die aktuelle Zuweisung als einen gespielten Einsatz; die Zahlen wachsen damit.

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

4. Prüfen, dass die Bindung **`MOD_KEY`** existiert (nutzt du schon fürs Feedback).
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
