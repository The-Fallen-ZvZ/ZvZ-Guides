# Code-Landkarte

Index der Anwendung `Anwendung/index.html`, damit Änderungen ohne komplettes Durchlesen möglich sind. Zeilennummern beziehen sich auf Stand `ff20334` (11.11.2026, v1.71.02, 1.394 Zeilen).

> Nach größeren Änderungen verschieben sich die Zeilen. Die Karte wird dann neu erzeugt.

## Grobe Gliederung

| Bereich | Zeilen | Inhalt |
| --- | --- | --- |
| `<script>` (Kopf) | 4–28 | Theme-Bootstrap aus `localStorage`, läuft vor dem ersten Rendern |
| `<style>` | 29–184 | gesamtes CSS (~78 Regeln), Theme über CSS-Variablen |
| Markup | 185–221 | Splash, Sidebar, Container, Feedback-Modal, Buttons |
| `<script>` (Haupt) | 222–1394 | Einstellungen, Feedback, Editor, Daten, Views, Navigation |

## Ablauf & Navigation

| Zeile | Element | Zweck |
| --- | --- | --- |
| 759 | `closeSplash()` | Titelbild ausblenden |
| 760 | `$`, `A` | Kurzformen für `querySelector` / `querySelectorAll` |
| 761 | `T(h, r)` | Tabellen-HTML erzeugen |
| 762 | `L(a)` | Listen-HTML erzeugen |
| 763 | `D(t, b, o, s, i)` | einklappbares `<details>` – Grundbaustein aller Inhalte |
| 1300 | `getText(id)` | Seite als Klartext für den Suchindex |
| 1301 | `X` | Suchindex über alle Seiten |
| 1302 | `nv`, `m` | Referenzen auf Navigation und Hauptcontainer |
| 1304 | `renderSidebar()` | Menü links aufbauen, Admin-Punkte nur bei Login |
| 1335 | `go()` | Routing über `location.hash`; rendert `P[id]` oder `customContent[id]` und ruft `I[id]()` |
| 1388 | `#settings-btn` | setzt `location.hash = '#settings'` |

## Seiten-Renderer (`P`, ab Zeile 898)

| Zeile | Key | Seite |
| --- | --- | --- |
| 899 | `start` | Startseite mit Hero |
| 900 | `admin` | Moderatorenbereich (Übersicht) |
| 901 | `admin-feedback` | Feedback-Übersicht |
| 902 | `admin-editor` | Live-Editor |
| 903 | `admin-brainstorm` | Brainstorm (Waffen & BMs), bettet das Google Sheet ein |
| 909 | `settings` | verweist auf `renderSettings()` (426) |
| 910 | `basics` | ZvZ-Basics |
| 935 | `comps` | Comps inkl. Composition-Link |
| 954 | `buffs` | Buffs und Debuffs |
| 962 | `disarray` | Disarray inkl. Rechner |
| 967 | `rollen` | Rollen (Intro mit AlbionZvZ-Link) |
| 976 | `weapons-bms` | Waffen & Battlemounts (rendert über `renderWeaponsContent()`) |
| 1001 | `videos` | Erklärvideos |
| 1017 | `erweitert` | Erweiterte Ansicht |
| 1031 | `glossar` | Call-Glossar |
| 1032 | `castles` | Castles (TODO-Status) |
| 1033 | `terris` | Territories (TODO-Status) |
| 1034 | `outposts` | Outposts (TODO-Status) |
| 1035 | `open-world` | Open World |
| 1036 | `regeln` | Regelwerk |
| 1037 | `lootsplit` | Lootsplit & Regear |
| 1045 | `review` | Nachbesprechung |
| 1052 | `vod` | VODs |
| 1053 | `changelog` | Changelog & Ideen mit Download-Buttons |
| 1143 | `renderWeaponsContent()` | Aufbau des Waffen-/BM-Bereichs |

## Init-Funktionen (`I`, ab Zeile 1151)

Laufen nach dem Rendern einer Seite – für Rechner, Formulare, Logs.

| Zeile | Key | Funktion |
| --- | --- | --- |
| 1152 | `settings` | `initSettings()` (475) |
| 1153 | `admin-editor` | `initAdminEditor()` (675) |
| 1154 | `basics` | Party-Größen-Umschalter |
| 1155 | `comps` | Comp-Umschalter |
| 1156 | `buffs` | Buff-/Debuff-Rechner |
| 1168 | `disarray` | Disarray-Rechner (`HS`, `BM_DATA`) |
| 1214 | `weapons-bms` | Waffen-/BM-Interaktion |
| 1253 | `admin-feedback` | `initAdminFeedback()` (607) |
| 1254 | `lootsplit` | Lootsplit-Rechner |
| 1255 | `review` | Nachbesprechung, speichert in `review_data` / `review_logs` |
| 1289 | `changelog` | Download-Buttons, Filter |

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

## Feedback & Admin

| Zeile | Element | Zweck |
| --- | --- | --- |
| 224 | `FEEDBACK_ENDPOINT` | Cloudflare Worker für Feedback |
| 225 | `CUSTOM_CONTENT_ENDPOINT` | Worker `/content` für bearbeitete Inhalte |
| 536 | `FB_CATS` | Kategorien des Formulars |
| 546 / 560 | `openFeedback()` / `closeFeedback()` | Modal |
| 607 | `initAdminFeedback()` | Feedback-Liste |
| 666 | `customContent` | Overrides aus dem Editor |
| 675 | `initAdminEditor()` | Live-Editor |
| 765 | `isAdmin` | Status aus `sessionStorage` |
| 766 / 767 | `adminLogin()` / `adminLogout()` | Passwortprüfung, Sitzung |

## Daten & Konstanten

| Zeile | Konstante | Inhalt |
| --- | --- | --- |
| 223 | `BRAINSTORM_SHEET_URL` | Google Sheet für Brainstorm |
| 815 | `HS` | Disarray-Stufen je Spieleranzahl |
| 816 | `BM_DATA` | Battlemounts mit Disarray-Punkten |
| 817 | `PT` | Party-Größen |
| 818 | `MC_TEXT` | Einleitungstext Melee Clap |
| 820 | `SVG_TERR` | SVG-Grafiken für Territorien |
| 827 | `N` | sichtbare Navigation |
| 828 | `N_ALL` | komplette Navigation inkl. Unterseiten |
| 830 | `WEAPON_CATS` | Waffenkategorien, Farbklassen, Waffenlisten |
| 838 | `BM_CATS` | Battlemount-Kategorien (Control / Offensive / Support) |
| 844 | `WEAPON_CONTEXT` | Beschreibung je Waffe |
| 881 | `BM_CONTEXT` | Beschreibung je Battlemount |
| 898 | `P` | Seiten-Renderer |
| 1151 | `I` | Init-Funktionen |

## Externe Quellen

| Quelle | Verwendung |
| --- | --- |
| `docs.google.com/spreadsheets/…15bIvKIilpQZ8gCeoDKQvLAUTdTOk1y8v` | Brainstorm-Sheet im Moderatorenbereich |
| `cool-morning-ff55.lukashamann4.workers.dev` | Feedback-Endpunkt |
| `…workers.dev/content` | gespeicherte Editor-Inhalte |
| `albionzvz.com/g/the-fallen` (+ `/compositions/…`, `/vods`) | Composition, Sets, VODs |
| `youtube-nocookie.com/embed/Hd-rx34yN5Q` | Erklärvideo |

## Speicher im Browser

| Key | Speicher | Inhalt |
| --- | --- | --- |
| `tf-settings` | localStorage | Einstellungen |
| `th` | localStorage | Theme-Kurzform für den Bootstrap |
| `fb-draft` | localStorage | Entwurf im Feedback-Formular |
| `review_data`, `review_logs` | localStorage | Nachbesprechung |
| `isAdmin` | sessionStorage | Admin-Sitzung |

## Typische Änderungen – wo anfassen?

| Vorhaben | Stelle |
| --- | --- |
| Text auf einer Seite | jeweilige View in `P` (Tabelle oben) |
| neuer Menüpunkt | `N_ALL` (828), ggf. `N` (827), neue View in `P` (898), optional Init in `I` (1151) |
| Battlemount-Punkte | `BM_DATA` (816), `HS` (815) |
| Waffe ergänzen | `WEAPON_CATS` (830) + `WEAPON_CONTEXT` (844) |
| Glossar-Begriff | `GL_CAT` (769) |
| Feedback-Kategorien | `FB_CATS` (536) |
| Farben/Design | CSS-Variablen im `<style>`-Block (29–184) |
| neue Einstellung | `DEFAULT_SETTINGS` (231), `renderSettings()` (426), `applySettings()` (251) |
