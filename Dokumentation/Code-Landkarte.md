# Code-Landkarte

Index der Anwendung `Anwendung/index.html`, damit Änderungen ohne komplettes Durchlesen möglich sind. Zeilennummern beziehen sich auf den aktuellen Stand (11.11.2026, v1.71.02, 1.421 Zeilen, 186.508 Bytes).

> Nach größeren Änderungen verschieben sich die Zeilen. Die Karte wird dann neu erzeugt.

## Grobe Gliederung

| Bereich | Zeilen | Inhalt |
| --- | --- | --- |
| `<script>` (Kopf) | 4–28 | Theme-Bootstrap aus `localStorage`, läuft vor dem ersten Rendern |
| `<style>` | 29–184 | gesamtes CSS (~78 Regeln), Theme über CSS-Variablen |
| Markup | 185–221 | Splash, Sidebar, Container, Feedback-Modal, Buttons |
| `<script>` (Haupt) | 222–1421 | Einstellungen, Feedback, Editor, Daten, Views, Navigation |

## Ablauf & Navigation

| Zeile | Element | Zweck |
| --- | --- | --- |
| 757 | `closeSplash()` | Titelbild ausblenden |
| 758 | `$`, `A` | Kurzformen für `querySelector` / `querySelectorAll` |
| 759 | `T(h, r)` | Tabellen-HTML erzeugen |
| 760 | `L(a)` | Listen-HTML erzeugen |
| 761 | `D(t, b, o, s, i)` | einklappbares `<details>` – Grundbaustein aller Inhalte |
| 1327 | `getText(id)` | Seite als Klartext für den Suchindex |
| 1328 | `X` | Suchindex über alle Seiten |
| 1329 | `nv`, `m` | Referenzen auf Navigation und Hauptcontainer |
| 1331 | `renderSidebar()` | Menü links aufbauen, Admin-Punkte nur bei Login |
| 1362 | `go()` | Routing über `location.hash`; rendert `P[id]` oder `customContent[id]` und ruft `I[id]()` |
| 1415 | `#settings-btn` | setzt `location.hash = '#settings'` |

## Moderator-Zugang

| Zeile | Element | Zweck |
| --- | --- | --- |
| 763 | `isAdmin` | Status aus `sessionStorage` |
| 764 | `adminLogin()` | **einzige** Abfrage: Mod-Key einmal eingeben, per `GET /feedback?key=…` gegen `MOD_KEY` im Worker prüfen, dann in `sessionStorage.feedbackModKey` merken |
| 794 | `adminLogout()` | löscht `isAdmin` **und** `feedbackModKey` |

Feedback und Live-Editor fragen kein Passwort mehr ab – sie nutzen `sessionStorage.feedbackModKey` und zeigen sonst den Hinweis „Bitte erneut über den Moderatoren-Login anmelden“.

## Seiten-Renderer (`P`, ab Zeile 925)

| Zeile | Key | Seite |
| --- | --- | --- |
| 926 | `start` | Startseite mit Hero |
| 927 | `admin` | Moderatorenbereich |
| 928 | `admin-feedback` | Feedback-Übersicht |
| 929 | `admin-editor` | Live-Editor |
| 930 | `admin-brainstorm` | Brainstorm (Google Sheet) |
| 936 | `settings` | verweist auf `renderSettings()` (426) |
| 937 | `basics` | ZvZ-Basics |
| 962 | `comps` | Comps inkl. Composition-Link |
| 981 | `buffs` | Buffs und Debuffs |
| 989 | `disarray` | Disarray inkl. Rechner |
| 994 | `rollen` | Rollen (Intro mit AlbionZvZ-Link) |
| 1003 | `weapons-bms` | Waffen & Battlemounts (`renderWeaponsContent()` 1170) |
| 1028 | `videos` | Erklärvideos |
| 1044 | `erweitert` | Erweiterte Ansicht |
| 1058 | `glossar` | Call-Glossar |
| 1059 | `castles` | Castles (TODO-Status) |
| 1060 | `terris` | Territories (TODO-Status) |
| 1061 | `outposts` | Outposts (TODO-Status) |
| 1062 | `open-world` | Open World |
| 1063 | `regeln` | Regelwerk |
| 1064 | `lootsplit` | Lootsplit & Regear |
| 1072 | `review` | Nachbesprechung |
| 1079 | `vod` | VODs |
| 1080 | `changelog` | Changelog & Ideen mit Download-Buttons |

## Init-Funktionen (`I`, ab Zeile 1178)

| Zeile | Key | Funktion |
| --- | --- | --- |
| 1179 | `settings` | `initSettings()` (475) |
| 1180 | `admin-editor` | `initAdminEditor()` (674) |
| 1181 | `basics` | Party-Größen-Umschalter |
| 1182 | `comps` | Comp-Umschalter |
| 1183 | `buffs` | Buff-/Debuff-Rechner |
| 1195 | `disarray` | Disarray-Rechner (`HS`, `BM_DATA`) |
| 1241 | `weapons-bms` | Waffen-/BM-Interaktion |
| 1280 | `admin-feedback` | `initAdminFeedback()` (607) |
| 1281 | `lootsplit` | Lootsplit-Rechner |
| 1282 | `review` | Nachbesprechung (`review_data`, `review_logs`) |
| 1316 | `changelog` | Download-Buttons, Filter |

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
| 224 | `FEEDBACK_ENDPOINT` | Worker: Feedback senden/lesen |
| 225 | `CUSTOM_CONTENT_ENDPOINT` | Worker `/content` für bearbeitete Inhalte |
| 536 | `FB_CATS` | Kategorien des Formulars |
| 546 / 560 | `openFeedback()` / `closeFeedback()` | Modal (öffentlich, ohne Key) |
| 607 | `initAdminFeedback()` | Feedback-Liste (Key aus `sessionStorage`) |
| 665 | `customContent` | Overrides aus dem Editor |
| 674 | `initAdminEditor()` | Live-Editor (Key aus `sessionStorage`) |

## Daten & Konstanten

| Zeile | Konstante | Inhalt |
| --- | --- | --- |
| 223 | `BRAINSTORM_SHEET_URL` | Google Sheet für Brainstorm |
| 842 | `HS` | Disarray-Stufen je Spieleranzahl |
| 843 | `BM_DATA` | Battlemounts mit Disarray-Punkten |
| 844 | `PT` | Party-Größen |
| 845 | `MC_TEXT` | Einleitungstext Melee Clap |
| 847 | `SVG_TERR` | SVG-Grafiken für Territorien |
| 854 | `N` | sichtbare Navigation |
| 855 | `N_ALL` | komplette Navigation inkl. Unterseiten |
| 857 | `WEAPON_CATS` | Waffenkategorien, Farbklassen, Waffenlisten |
| 865 | `BM_CATS` | Battlemount-Kategorien |
| 871 | `WEAPON_CONTEXT` | Beschreibung je Waffe |
| 908 | `BM_CONTEXT` | Beschreibung je Battlemount |
| 925 | `P` | Seiten-Renderer |
| 1178 | `I` | Init-Funktionen |

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
| neuer Menüpunkt | `N_ALL` (855), ggf. `N` (854), neue View in `P` (925), optional Init in `I` (1178) |
| Battlemount-Punkte | `BM_DATA` (843), `HS` (842) |
| Waffe ergänzen | `WEAPON_CATS` (857) + `WEAPON_CONTEXT` (871) |
| Glossar-Begriff | `GL_CAT` (796) |
| Feedback-Kategorien | `FB_CATS` (536) |
| Farben/Design | CSS-Variablen im `<style>`-Block (29–184) |
| neue Einstellung | `DEFAULT_SETTINGS` (231), `renderSettings()` (426), `applySettings()` (251) |
| Moderator-Anmeldung | `adminLogin()` (764) |
