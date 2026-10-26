# NEON NEXUS

Ein futuristisches Survivor-Spiel im Stil von Brotato und Vampire Survivors, gemacht vor allem fürs Handy.

**Spielen:** https://sadomasupilami.github.io/raphi-game/

## Features

- **Steuerung:** Ein Joystick erscheint dort, wo der Daumen den Bildschirm berührt. Alle Waffen zielen und feuern automatisch. Am PC geht es mit WASD oder den Pfeiltasten.
- **20 Wellen:** Welle 10 hat einen Zwischenboss (WÄCHTER), Welle 20 den Endboss (OMEGA-KERN). Nach dem Sieg kann man im Endlos-Modus weiterspielen.
- **4 Elemente:** 🔥 Feuer, ❄️ Eis, ⚡ Blitz und 🌀 Void, jeweils mit eigenem Status-Effekt.
- **6 Element-Reaktionen:** Ein zweites Element auf einem markierten Gegner löst eine Reaktion aus, z. B. Feuer + Eis = Dampfexplosion oder Blitz + Void = Singularität.
- **12 Waffen:** 4 Nahkampf- und 8 Fernkampfwaffen, jeweils mit 4 Stufen. Zwei gleiche Waffen verschmelzen zur nächsten Stufe.
- **Level-Ups und Shop:** Bei jedem Level-Up wählt man ein Upgrade. Alle 2 Wellen öffnet der Schwarzmarkt mit Waffen und Items.
- **Charaktere und Schwierigkeit:** 4 Charaktere (VEX, NYX, BROCK, ECHO) und 3 Schwierigkeitsgrade.
- **Rekorde:** Der Highscore wird im Browser gespeichert.
- **Technik:** Grafik und Sound werden komplett im Code erzeugt, es gibt keine externen Assets. Das Spiel lässt sich als App zum Homescreen hinzufügen.

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
| `js/main.js` | Menüs, HUD, Shop-UI, Spielschleife |
| `js/input.js` | Touch-Joystick und Tastatur |
| `js/audio.js` | Synthetisierte Sounds und Musik |
