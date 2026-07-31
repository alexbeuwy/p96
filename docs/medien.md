# Medien

Eine Ansicht, ein Clip. Die Dateinamen sind in `index.html` verdrahtet — wer
die gleichen Namen benutzt, muss kein HTML anfassen.

| Standbild | Clip |
| --- | --- |
| `eingang.jpg` | `eingang.webm` + `eingang.mp4` |

Fehlt der Clip, bleibt die Seite beim Standbild stehen — sie bricht nicht.

---

## Die eine Regel

**Frame 0 des Clips muss exakt das Standbild sein.** Übergeblendet wird von
Bild auf Video; unterscheiden sich die beiden, sieht man den Sprung statt der
Bewegung.

Das ist kein theoretischer Hinweis. Das ursprünglich gelieferte
`P96-Office-Eingang_02 Vertikale Lamellen.jpg` und `view2-video.mp4` waren
zwei **verschiedene** Renderings: im JPG fehlte der Schriftzug „Hector
Stiftungen", und der Bildausschnitt war enger. Gemessen lagen sie bei RMS 22,9
auseinander — beim Hover wäre plötzlich die Beschriftung erschienen und das
Bild gesprungen.

Deshalb wird das Standbild **aus dem Clip extrahiert**, nie separat geliefert:

```bash
ffmpeg -i view2-video.mp4 -vframes 1 -q:v 2 eingang.jpg
```

Danach lagen die beiden bei RMS 2,0 — das ist reines JPEG-Rauschen.

## Seitenverhältnis

Steht an einer Stelle: `--shot-aspect` in `src/styles.css`, aktuell
`1664 / 1244` (das Format des Clips). Standbild und Clip müssen es teilen.

Wer neue Clips mit KI erzeugt: **Zielformat zuerst festlegen, Rendering darauf
zuschneiden, dann generieren.** Gibt man ein 4:3-Bild in ein Modell, das 16:9
ausgibt, kommt ein Beschnitt zurück — und die Regel oben ist gebrochen, bevor
die erste Sekunde läuft. Ebenso „Enhance", „Upscale" und „Auto-Reframe"
ausschalten; jedes davon schreibt Frame 0 neu.

## Schleife oder Kamerafahrt

Der aktuelle Clip ist eine **Kamerafahrt**: Frame 0 steht nah am Haus, am Ende
ist die Kamera zurückgefahren, dazu bewegen sich Radfahrer und Passanten. So
etwas darf **nicht** schleifen — das `<video>` trägt deshalb kein `loop`. Es
läuft einmal und bleibt auf dem letzten Frame stehen; beim Verlassen blendet
es zurück aufs Standbild, beim nächsten Hover beginnt es von vorn.

Wer stattdessen einen endlos laufenden Ambient-Clip will (Wolken, Laub, Licht
— Kamera fest, Menschen und Fahrzeuge eingefroren), braucht eine nahtlose
Schleife. Dann `loop` ins `<video>` und den Clip per Ping-Pong bauen:

```bash
ffmpeg -i "$IN" -filter_complex \
  "[0:v]split[a][b];\
   [b]trim=start_frame=1,setpts=PTS-STARTPTS,reverse,\
      trim=start_frame=1,setpts=PTS-STARTPTS[r];\
   [a][r]concat=n=2:v=1" \
  -an loop.mp4
```

Das doppelte `trim`/`setpts` sieht umständlich aus, ist aber der Unterschied
zwischen einer sauberen und einer zuckenden Schleife. Mit zehn
durchnummerierten Testframes nachgezählt:

```
ohne  →  0 1 2 3 4 5 6 7 8 9 8 8 7 6 5 4 3 2 1 0     doppelte 8, doppelte 0
mit   →  0 1 2 3 4 5 6 7 8 9 8 7 6 5 4 3 2 1        sauber
```

Ping-Pong funktioniert nur ohne gerichtete Bewegung — ein Radfahrer, der die
halbe Zeit rückwärts fährt, fällt sofort auf.

## Kodieren

```bash
ffmpeg -i "$IN" -an -c:v libx264 -profile:v high -crf 23 -preset slow \
  -movflags +faststart eingang.mp4

ffmpeg -i "$IN" -an -c:v libvpx-vp9 -crf 33 -b:v 0 -row-mt 1 eingang.webm
```

`-movflags +faststart` schiebt den Index an den Dateianfang — ohne das lädt
Safari erst die ganze Datei, bevor der erste Frame erscheint, und der Hover
fühlt sich träge an.

Aus 7,7 MB Quellmaterial wurden so 1,0 MB WebM und 1,6 MB MP4. Zielgröße:
unter 4 MB. Geladen wird ohnehin erst beim ersten Hover (`preload="none"`),
aber ein 20-MB-Clip macht auch dann eine spürbare Pause.

## Gegenprobe

```bash
npm run dev
```

Über die Ansicht fahren und auf zwei Dinge achten: Springt das Bild im Moment
des Einblendens? Dann stimmt Frame 0 nicht. Zuckt es bei einem `loop`-Clip
regelmäßig? Dann schließt die Schleife nicht.

`npm test` prüft das Verhalten drumherum automatisch — dass nichts vor dem
Hover geladen wird, dass der Clip beim Verlassen pausiert und zurückspult,
dass `prefers-reduced-motion` alles abschaltet und ein fehlender Clip auf das
Standbild zurückfällt.

## Hochladen

```bash
cp .env.example .env.local   # Storage-Key eintragen (Repo-Wurzel)
npm run media:push
```

Landet unter `https://storage.bunnycdn.com/beuwy/P96/`. **Case beachten:**
Bunny-Pfade sind case-sensitiv, der Ordner heißt `P96`. Damit die Seite von
dort liest, im Vercel-Dashboard `VITE_MEDIA_BASE` auf die Pull-Zone-URL setzen
— siehe `.env.production`. Wurde eine Datei ersetzt, die schon live war:
Pull-Zone-Cache im Bunny-Dashboard purgen, sonst läuft der alte Clip bis zum
Ablauf der TTL weiter.

Nur die Dateien, die die Seite anzeigt, gehören dorthin. Die Storage Zone ist
über die Pull Zone öffentlich lesbar — Pläne, Mappen und Studien haben da
nichts zu suchen.
