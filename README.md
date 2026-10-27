# NEON NEXUS

Ein futuristisches Survivor-Spiel im Stil von Brotato und Vampire Survivors, gemacht vor allem fürs Handy.

**Spielen:** https://sadomasupilami.github.io/raphi-game/

## Features

- **Steuerung:** Ein Joystick erscheint dort, wo der Daumen den Bildschirm berührt. Alle Waffen zielen und feuern automatisch. Mit dem **Dash**-Knopf (am PC Leertaste) weicht man kurz und unverwundbar aus.
- **20 Wellen:** Welle 10 hat einen Zwischenboss (WÄCHTER), Welle 20 den Endboss (OMEGA-KERN). Nach dem Sieg kann man im Endlos-Modus weiterspielen.
- **4 Arenen:** Neon-Stadt, Kryo-Labor (rutschiges Eis), Schrott-Fabrik (Förderbänder) und Reaktorkern (Plasma-Felder). Die Arena wechselt alle 5 Wellen.
- **4 Bosse:** Schwarm-Mutter (Welle 5), Wächter (10), Laser-Titan (15) und Omega-Kern (20).
- **Begleiter:** Sammel-Drohne, Heil-Bot, Schild-Satellit und Geschütz-Drohne, maximal 2 gleichzeitig.
- **Wellen-Modifikatoren:** einzelne Wellen sind besonders, z. B. Turbo, Panzerung, Schwarm, Explosiv oder Elite-Jagd.
- **4 Elemente und 6 Reaktionen:** 🔥 Feuer, ❄️ Eis, ⚡ Blitz und 🌀 Void. Ein zweites Element auf einem markierten Gegner löst eine Reaktion aus.
- **Ultimate-Fähigkeiten:** Jeder Charakter hat eine eigene Spezialattacke, die sich durch Kills auflädt (goldener Knopf, am PC Q).
- **Waffen-Evolution:** Eine Stufe-IV-Waffe plus das passende Item wird zu einer von 8 legendären Waffen, z. B. Sonnenklinge oder Gewittersturm.
- **Spektakel:** Zeitlupe und Kamera-Zoom bei Boss-Auftritt und Boss-Tod, Glitch-Effekt bei Treffern, Bildschirmblitze und Licht bei Explosionen.
- **16 Waffen:** Nah- und Fernkampf, darunter Orbit-Splitter, Drohne, Bumerang und Napalm. Jede hat 4 Stufen, und zwei gleiche Waffen verschmelzen zur nächsten.
- **Über 30 Items:** darunter Spezialeffekte wie Detonator, Prisma-Linse, Notfall-Protokoll, Zinsen, Dornen und Magnetpuls.
- **12 Gegnertypen:** darunter Schildträger, Teleporter, Laser-Türme und Heiler, plus 2 Bosse.
- **10 Charaktere:** 6 davon werden über Erfolge freigeschaltet, darunter ZERO (keine Waffen, rammt Gegner), HYDRA (12 Waffenplätze) und GLITCH (Waffen werden jede Welle neu gemischt).
- **4 Spielmodi:**
  - Kampagne
  - Boss-Rush (nur Bosse, dazwischen Shop)
  - Tägliche Herausforderung (jeden Tag für alle gleicher Charakter, gleiche Startwaffe und zwei Besonderheiten)
  - Zeitangriff (5 Minuten, so viele Kills wie möglich)
- **Fortschritt:** 13 Erfolge, ein Logbuch mit Statistiken und allen Entdeckungen, ein Tutorial beim ersten Start und ein Highscore pro Schwierigkeit.
- **Lesbarkeit:** Pfeile am Rand zeigen Boss, Elites und Kapseln außerhalb der Sicht. Explosionen und Laser werden vorher angekündigt.
- **Soundtrack:** 8 eigene Songs, komplett live synthetisiert. Die Kampfmusik wechselt alle 5 Wellen und wird dabei schneller und härter:

  | Wellen | Song | Tempo |
  |---|---|---|
  | 1–4 | „Overdrive“ | 138 BPM |
  | 5–9 | „Hyperdrive“ | 146 BPM |
  | 10 (Zwischenboss) | „Alarmstufe Rot“ | 150 BPM |
  | 11–14 | „Blackout“ | 152 BPM, industriell |
  | 15–19 | „Overclock“ | 160 BPM, mit Tonart-Rückung im zweiten Drop |
  | 20 (Endboss) | „Kernschmelze“ | 172 BPM, mit Halftime-Teil |

  Dazu kommen „Neon-Skyline“ im Menü und „Schwarzmarkt“ im Shop. Bass und Flächen pumpen mit der Kickdrum (Sidechain), dazu gibt es Echo und Hall. Die Musik wird mit mehr Gegnern dichter, und in Pause und Level-Up klingt sie gedämpft.
- **Technik:** Grafik und Sound werden komplett im Code erzeugt, ohne externe Assets.
  - Das Spiel lässt sich als App installieren und ist offline spielbar (Service Worker).
  - Auf langsamen Handys schaltet es automatisch auf sparsame Grafik.

## Lokal starten

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

## Deployment

Jeder Push auf `main` wird per GitHub Actions (`.github/workflows/pages.yml`) auf GitHub Pages veröffentlicht.
Falls nötig, unter **Settings → Pages → Source** einmalig „GitHub Actions“ auswählen.

**Automatische Updates:** Beim Deployment bekommt jede Datei die Commit-ID als `?v=…` angehängt, und es wird eine `version.json` erzeugt.
Das Spiel prüft sie beim Start, alle 60 Sekunden und beim Zurückkehren in die App, jeweils am Cache vorbei.
Gibt es eine neue Version, lädt das Spiel sofort neu, wenn man im Menü ist. Während einer Runde erscheint nur ein Hinweis, und der Neustart folgt nach der Runde.
So muss man nicht die 10 Minuten abwarten, die GitHub Pages Dateien im Cache hält. Die aktuelle Version steht unten im Hauptmenü.

## Struktur

| Datei | Inhalt |
|---|---|
| `js/data.js` | Waffen, Items, Gegner, Charaktere, Balancing |
| `js/game.js` | Spiellogik (Kampf, Elemente, Wellen, Shop) |
| `js/render.js` | Canvas-Rendering |
| `js/sprites.js` | Vorgerenderte Neon-Sprites |
| `js/main.js` | Menüs, HUD, Shop-UI, Logbuch, Tutorial, Spielschleife |
| `js/progress.js` | Erfolge, Freischaltungen, Gesamtstatistik |
| `sw.js` | Service Worker (offline spielbar) |
| `js/input.js` | Touch-Joystick und Tastatur |
| `js/audio.js` | Synthetisierte Soundeffekte |
| `js/music.js` | Soundtrack: Synthesizer, Effekte und Sequencer mit 8 Songs |
