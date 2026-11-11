# Code-Landkarte

Index der Anwendung `Anwendung/index.html`, damit Änderungen ohne komplettes Durchlesen möglich sind. Zeilennummern beziehen sich auf den aktuellen Stand (11.11.2026, v1.71.02, 1.422 Zeilen, 186.663 Bytes).

> Nach größeren Änderungen verschieben sich die Zeilen. Die Karte wird dann neu erzeugt.

## Grobe Gliederung

| Bereich | Zeilen | Inhalt |
| --- | --- | --- |
| `<script>` (Kopf) | 4–28 | Theme-Bootstrap aus `localStorage`, läuft vor dem ersten Rendern |
| `<style>` | 29–184 | gesamtes CSS (~78 Regeln), Theme über CSS-Variablen |
| Markup | 185–221 | Splash, Sidebar, Container, Feedback-Modal, Buttons |
| `<script>` (Haupt) | 222–1422 | Einstellungen, Feedback, Editor, Daten, Views, Navigation |

## Ablauf & Navigation

| Zeile | Element | Zweck |
| --- | --- | --- |
| 758 | `closeSplash()` | Titelbild ausblenden |
| 759 | `$`, `A` | Kurzformen für `querySelector` / `querySelectorAll` |
| 760 | `T(h, r)` | Tabellen-HTML erzeugen |
| 761 | `L(a)` | Listen-HTML erzeugen |
| 762 | `D(t, b, o, s, i)` | einklappbares `<details>` – Grundbaustein aller Inhalte |
| 1328 | `getText(id)` | Seite als Klartext für den Suchindex |
| 1329 | `X` | Suchindex über alle Seiten |
| 1330 | `nv`, `m` | Referenzen auf Navigation und Hauptcontainer |
| 1332 | `renderSidebar()` | Menü links aufbauen, Admin-Punkte nur bei Login |
| 1363 | `go()` | Routing über `location.hash`; rendert `P[id]` oder `customContent[id]` und ruft `I[id]()` |
| 1416 | `#settings-btn` | setzt `location.hash = '#settings'` |

## Moderator-Zugang

| Zeile | Element | Zweck |
| --- | --- | --- |
| 764 | `isAdmin` | Status aus `sessionStorage` |
| 765 | `adminLogin()` | **einzige** Abfrage: Mod-Key einmal eingeben, per `GET /?key=…` prüfen, in `sessionStorage.feedbackModKey` merken |
| 795 | `adminLogout()` | löscht `isAdmin` und `feedbackModKey` |

## Seiten-Renderer (`P`, ab Zeile 926)

| Zeile | Key | Seite |
| --- | --- | --- |
| 927 | `start` | Startseite mit Hero |
| 928 | `admin` | Moderatorenbereich |
| 929 | `admin-feedback` | Feedback-Übersicht |
| 930 | `admin-editor` | Live-Editor |
| 931 | `admin-brainstorm` | Brainstorm (Google Sheet) |
| 937 | `settings` | verweist auf `renderSettings()` (426) |
| 938 | `basics` | ZvZ-Basics |
| 963 | `comps` | Comps inkl. Composition-Link |
| 982 | `buffs` | Buffs und Debuffs |
| 990 | `disarray` | Disarray inkl. Rechner |
| 995 | `rollen` | Rollen (Intro mit AlbionZvZ-Link) |
| 1004 | `weapons-bms` | Waffen & Battlemounts (`renderWeaponsContent()` 1171) |
| 1029 | `videos` | Erklärvideos |
| 1045 | `erweitert` | Erweiterte Ansicht |
| 1059 | `glossar` | Call-Glossar |
| 1060 | `castles` | Castles (TODO-Status) |
| 1061 | `terris` | Territories (TODO-Status) |
| 1062 | `outposts` | Outposts (TODO-Status) |
| 1063 | `open-world` | Open World |
| 1064 | `regeln` | Regelwerk |
| 1065 | `lootsplit` | Lootsplit & Regear |
| 1073 | `review` | Nachbesprechung |
| 1080 | `vod` | VODs |
| 1081 | `changelog` | Changelog & Ideen mit Download-Buttons |

## Init-Funktionen (`I`, ab Zeile 1179)

| Zeile | Key | Funktion |
| --- | --- | --- |
| 1180 | `settings` | `initSettings()` (475) |
| 1181 | `admin-editor` | `initAdminEditor()` (675) |
| 1182 | `basics` | Party-Größen-Umschalter |
| 1183 | `comps` | Comp-Umschalter |
| 1184 | `buffs` | Buff-/Debuff-Rechner |
| 1196 | `disarray` | Disarray-Rechner (`HS`, `BM_DATA`) |
| 1242 | `weapons-bms` | Waffen-/BM-Interaktion |
| 1281 | `admin-feedback` | `initAdminFeedback()` (607) |
| 1282 | `lootsplit` | Lootsplit-Rechner |
| 1283 | `review` | Nachbesprechung (`review_data`, `review_logs`) |
| 1317 | `changelog` | Download-Buttons, Filter |

## Einstellungen

| Zeile | Element | Zweck |
| --- | --- | --- |
| 230 | `SETTINGS_KEY` | `tf-settings` im `localStorage` |
| 231 | `DEFAULT_SETTINGS` | Theme, Rahmenfarbe/-breite, Radius, Akzent, Schriftgröße |
| 234 | `loadSettings()` | laden |
| 245 | `saveSettings()` | speichern |
| 246–249 | `getEffectiveTheme`, `getDefaultBorderColor`, `getEffectiveBorderColor`, `getEffectiveAccent` | abgeleitete Werte |
| 251 | `applySettings()` | CSS-Variablen setzen |
| 277 / 291 | `hexToHsv()` / `hsvToHex()` | Farbumrechnung |
| 300 | `openColorPicker()` | Farbwähler |
| 422 | `settingRowHTML()` | Zeilenlayout |
| 426 | `renderSettings()` | Einstellungsseite |
| 475 | `initSettings()` | anwenden und verdrahten |

## Feedback & Editor

| Zeile | Element | Zweck |
| --- | --- | --- |
| 224 | `FEEDBACK_ENDPOINT` | Worker-Basis-URL |
| 225 | `CUSTOM_CONTENT_ENDPOINT` | Worker `/content` |
| 536 | `FB_CATS` | Kategorien des Formulars |
| 546 / 560 | `openFeedback()` / `closeFeedback()` | Modal (öffentlich, ohne Key) |
| 607 | `initAdminFeedback()` | Liste per `GET /?key=…` |
| 666 | `customContent` | Overrides aus dem Editor |
| 675 | `initAdminEditor()` | Live-Editor, speichert per `POST /content` |

## Worker-Routen (Cloudflare)

| Route | Methode | Auth | Zweck |
| --- | --- | --- | --- |
| `/` | POST | nein | Feedback einsenden (Discord-DM + KV) |
| `/` | GET `?key=` | **MOD_KEY** | Feedback-Liste (JSON) |
| `/content` | GET | nein | alle bearbeiteten Seiten |
| `/content` | POST | `key` im Body | Seite speichern (`pageId`, `html`) |
| `/content` | DELETE | `key` im Body | Seite zurücksetzen (`pageId`) |

## Daten & Konstanten

| Zeile | Konstante | Inhalt |
| --- | --- | --- |
| 223 | `BRAINSTORM_SHEET_URL` | Google Sheet für Brainstorm |
| 843 | `HS` | Disarray-Stufen je Spieleranzahl |
| 844 | `BM_DATA` | Battlemounts mit Disarray-Punkten |
| 845 | `PT` | Party-Größen |
| 846 | `MC_TEXT` | Einleitungstext Melee Clap |
| 848 | `SVG_TERR` | SVG-Grafiken für Territorien |
| 855 | `N` | sichtbare Navigation |
| 856 | `N_ALL` | komplette Navigation inkl. Unterseiten |
| 858 | `WEAPON_CATS` | Waffenkategorien, Farbklassen, Waffenlisten |
| 866 | `BM_CATS` | Battlemount-Kategorien |
| 872 | `WEAPON_CONTEXT` | Beschreibung je Waffe |
| 909 | `BM_CONTEXT` | Beschreibung je Battlemount |
| 926 | `P` | Seiten-Renderer |
| 1179 | `I` | Init-Funktionen |

## Externe Quellen

| Quelle | Verwendung |
| --- | --- |
| `docs.google.com/spreadsheets/…15bIvKIilpQZ8gCeoDKQvLAUTdTOk1y8v` | Brainstorm-Sheet |
| `cool-morning-ff55.lukashamann4.workers.dev` | Feedback (POST öffentlich, GET nur mit Key) |
| `…workers.dev/content` | Editor-Inhalte (POST/DELETE mit Key) |
| `albionzvz.com/g/the-fallen` (+ `/compositions/…`, `/vods`) | Composition, Sets, VODs |
| `youtube-nocookie.com/embed/Hd-rx34yN5Q` | Erklärvideo |

## Speicher im Browser

| Key | Speicher | Inhalt |
| --- | --- | --- |
| `feedbackModKey` | sessionStorage | Mod-Key, gesetzt beim Login |
| `isAdmin` | sessionStorage | Admin-Sitzung |
| `tf-settings` | localStorage | Einstellungen |
| `th` | localStorage | Theme-Kurzform für den Bootstrap |
| `fb-draft` | localStorage | Entwurf im Feedback-Formular |
| `review_data`, `review_logs` | localStorage | Nachbesprechung |

## Typische Änderungen – wo anfassen?

| Vorhaben | Stelle |
| --- | --- |
| Text auf einer Seite | jeweilige View in `P` (Tabelle oben) |
| neuer Menüpunkt | `N_ALL` (856), ggf. `N` (855), neue View in `P` (926), optional Init in `I` (1179) |
| Battlemount-Punkte | `BM_DATA` (844), `HS` (843) |
| Waffe ergänzen | `WEAPON_CATS` (858) + `WEAPON_CONTEXT` (872) |
| Glossar-Begriff | `GL_CAT` (796) |
| Feedback-Kategorien | `FB_CATS` (536) |
| Farben/Design | CSS-Variablen im `<style>`-Block (29–184) |
| neue Einstellung | `DEFAULT_SETTINGS` (231), `renderSettings()` (426), `applySettings()` (251) |
| Moderator-Anmeldung | `adminLogin()` (765) |
