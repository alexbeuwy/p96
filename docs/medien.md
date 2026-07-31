# Medien

Drei Renderings, drei Clips. Die Dateinamen sind in `index.html` verdrahtet —
wer die gleichen Namen benutzt, muss kein HTML anfassen.

| Slot | Standbild | Clip |
| --- | --- | --- |
| 01 Straße | `01-strasse.jpg` | `01-strasse.webm` + `01-strasse.mp4` |
| 02 Eingang | `02-eingang.jpg` | `02-eingang.webm` + `02-eingang.mp4` |
| 03 Vorplatz | `03-vorplatz.jpg` | `03-vorplatz.webm` + `03-vorplatz.mp4` |

Die aktuellen Dateien sind Platzhalter. Fehlt ein Clip, bleibt die Kachel beim
Standbild stehen — die Seite bricht nicht.

---

## Die zwei Regeln, an denen der Effekt hängt

**1. Frame 0 des Clips muss exakt das Standbild sein.** Übergeblendet wird von
Bild auf Video; unterscheiden sich die beiden, sieht man den Sprung statt der
Bewegung.

**2. Der Clip muss nahtlos schleifen.** Er läuft in `loop`. Wenn das letzte
Frame nicht zum ersten passt, zuckt es bei jedem Durchlauf.

---

## Clips mit KI erzeugen

### Zuerst: Seitenverhältnis festlegen

Der häufigste Fehler. Die Renderings sind 4:3, die meisten Videomodelle geben
16:9 aus. Wer ein 4:3-Bild hineingibt und 16:9 herausbekommt, hat einen
Beschnitt — und damit ist Regel 1 gebrochen, bevor die erste Sekunde läuft.

Also in dieser Reihenfolge:

1. Zielformat wählen (die Seite steht auf **16:9**, `--shot-aspect` in
   `src/styles.css`)
2. Renderings **auf dieses Format zuschneiden**
3. Das zugeschnittene Bild als Standbild speichern
4. **Dasselbe** zugeschnittene Bild in die KI geben

Wer lieber bei 4:3 bleibt: `--shot-aspect: 4 / 3;` setzen und ein Modell
wählen, das 4:3 ausgibt. Nur nicht mischen.

### Image-to-Video, nicht Text-to-Video

Nur Image-to-Video garantiert, dass das Eingangsbild das erste Frame ist.
Text-to-Video erzeugt ein neues Bild — Regel 1 ist damit unerfüllbar.

Falls das Werkzeug „Enhance", „Upscale" oder „Auto-Reframe" anbietet:
**ausschalten.** Jede dieser Optionen verändert Frame 0.

### Kamera still, nur Atmosphäre bewegen

Architekturrenderings vertragen keine großen KI-Kamerafahrten — Fassaden
biegen sich, Fensterprofile verlaufen, Bäume wachsen aus der Wand. Und für
diesen Effekt braucht es sie auch nicht: das Bild soll *aufwachen*, nicht
wegfahren.

Bewegen darf sich:

- Wolken, langsam
- Laub und Sträucher in leichtem Wind
- Licht, das minimal wandert; Reflexe auf nasser Fahrbahn
- Fensterlicht, das kaum merklich atmet (gut bei Dämmerung, Shot 02 und 03)

Stillstehen muss:

- **Kamera** — kein Push-in, kein Orbit, kein Zoom
- **Das Gebäude** in jeder Kante
- **Menschen, Autos, Fahrräder** (siehe unten)

Prompt-Baustein, der sich bewährt:

> static locked-off camera, no camera movement, architectural rendering stays
> perfectly still, only subtle ambient motion: slow drifting clouds, gentle
> leaf movement in a light breeze, soft shifting light. People and vehicles
> remain completely still. No zoom, no pan, no parallax.

### Warum Menschen und Fahrzeuge einfrieren müssen

Für die nahtlose Schleife ist **Ping-Pong** (vorwärts, dann rückwärts) der
zuverlässigste Weg: Anfang und Ende sind dann zwangsläufig identisch. Das
funktioniert aber nur, solange sich nichts gerichtet bewegt. Ein Radfahrer,
der die Hälfte der Zeit rückwärts fährt, fällt sofort auf; wehendes Laub
nicht.

Deshalb: Personen und Fahrzeuge stehen lassen und die Schleife per Ping-Pong
bauen. Das ist auch der Grund, warum in den Renderings vorhandene
Bewegungsunschärfe (Lichtspuren, laufende Passanten) unangetastet bleiben
darf — sie ist Teil des Standbilds, nicht der Animation.

### Länge

4–6 Sekunden reichen. Nach Ping-Pong werden daraus 8–12 Sekunden, und länger
schaut ohnehin niemand auf eine Kachel.

---

## Kodieren

`ffmpeg` vorausgesetzt. `$IN` ist die Datei aus der KI, `$SLUG` z. B.
`01-strasse`.

```bash
# 1. Standbild = allererstes Frame des Clips (nicht separat exportieren!)
ffmpeg -i "$IN" -vframes 1 -q:v 2 "$SLUG.jpg"

# 2. Ping-Pong: vorwärts + rückwärts, damit die Schleife nahtlos schließt.
ffmpeg -i "$IN" -filter_complex \
  "[0:v]split[a][b];\
   [b]trim=start_frame=1,setpts=PTS-STARTPTS,reverse,\
      trim=start_frame=1,setpts=PTS-STARTPTS[r];\
   [a][r]concat=n=2:v=1" \
  -an "$SLUG-loop.mp4"

# 3. MP4 (H.264) — die Universalfassung
ffmpeg -i "$SLUG-loop.mp4" -an -vf "scale=1920:-2" \
  -c:v libx264 -profile:v high -crf 23 -preset slow \
  -movflags +faststart "$SLUG.mp4"

# 4. WebM (VP9) — deutlich kleiner, wird von Chrome/Firefox bevorzugt
ffmpeg -i "$SLUG-loop.mp4" -an -vf "scale=1920:-2" \
  -c:v libvpx-vp9 -crf 33 -b:v 0 -row-mt 1 "$SLUG.webm"
```

Das doppelte `trim`/`setpts` in Schritt 2 sieht umständlich aus, ist aber der
Unterschied zwischen einer sauberen und einer zuckenden Schleife. Mit zehn
durchnummerierten Testframes nachgezählt:

```
ohne  →  0 1 2 3 4 5 6 7 8 9 8 8 7 6 5 4 3 2 1 0     doppelte 8, doppelte 0
mit   →  0 1 2 3 4 5 6 7 8 9 8 7 6 5 4 3 2 1        sauber
```

Ohne den Zusatz steht das Frame am Umkehrpunkt zweimal, und das letzte Frame
ist mit dem ersten identisch — also zweimal ein sichtbarer Hänger pro
Durchlauf.

`-movflags +faststart` schiebt den Index an den Dateianfang — ohne das lädt
Safari erst die ganze Datei, bevor der erste Frame erscheint, und der Hover
fühlt sich träge an.

Zielgröße pro Clip: unter 4 MB. Geladen wird ohnehin erst beim ersten Hover
(`preload="none"`), aber ein 20-MB-Clip macht auch dann eine spürbare Pause.

### Gegenprobe

```bash
npm run dev
```

Über eine Kachel fahren und auf zwei Dinge achten: Springt das Bild im Moment
des Einblendens? Dann stimmt Frame 0 nicht. Zuckt es alle paar Sekunden? Dann
schließt die Schleife nicht.

---

## Hochladen

```bash
cp .env.example .env.local   # Storage-Key eintragen (Repo-Wurzel)
npm run media:push
```

Landet unter `https://storage.bunnycdn.com/beuwy/p96/`. Damit die Seite von
dort liest, im Vercel-Dashboard `VITE_MEDIA_BASE` auf die Pull-Zone-URL setzen
— siehe `.env.production`. Wurde eine Datei ersetzt, die schon live war:
Pull-Zone-Cache im Bunny-Dashboard purgen, sonst läuft der alte Clip bis zum
Ablauf der TTL weiter.

Nur diese sechs Dateien gehören dorthin. Die Storage Zone ist über die Pull
Zone öffentlich lesbar — Pläne, Mappen und Studien haben da nichts zu suchen.
