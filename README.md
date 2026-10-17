# Zauberwürfel-Löser

Eine statische Website, die einen 3×3-Zauberwürfel Schritt für Schritt löst.

1. **Farben eingeben** – am drehbaren 3D-Würfel: Farbe in der Palette wählen, dann auf die Felder klicken.
   Der Würfel wird mit Weiß oben und Grün vorne gehalten; die Mittelsteine sind fest.
2. **Prüfen** – die Eingabe wird auf Gültigkeit geprüft (Farbanzahl, unmögliche Kanten/Ecken,
   gekippte Kante, verdrehte Ecke, vertauschte Teile). Fehlerhafte Felder blinken.
3. **Lösen** – wahlweise mit der **Anfängermethode** (Schicht für Schicht, mit Erklärung je Phase)
   oder als **kürzeste Lösung** (Kociemba-Algorithmus, ca. 20 Züge). Die Züge werden im 3D-Würfel
   animiert; Vor/Zurück/Abspielen und Geschwindigkeit sind einstellbar (auch per Pfeiltasten/Leertaste).

Ein Zustand kann per URL vorbelegt werden: `index.html#` gefolgt von 54 Farbbuchstaben
(`W Y G B R O`, `_` = leer) in der Reihenfolge Oben, Rechts, Vorne, Unten, Links, Hinten.

## Lokal starten

Kein Build nötig. `index.html` kann direkt im Browser geöffnet werden, oder:

```
python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen.

## Aufbau

- `js/model.js` – Würfelmodell, Züge, Gültigkeitsprüfung
- `js/beginner.js` – Löser nach der Anfängermethode
- `js/view.js` – 3D-Darstellung und Animation (Three.js)
- `js/app.js` – Bedienoberfläche
- `vendor/` – [Three.js](https://threejs.org) r149 und [cube.js](https://github.com/ldez/cubejs) 1.3.2 (beide MIT-Lizenz)
