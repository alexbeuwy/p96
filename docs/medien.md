# Medien

Drei Renderings, drei Clips. Die Dateinamen sind in `index.html` verdrahtet —
wer die gleichen Namen benutzt, muss kein HTML anfassen.

| Slot | Still (Poster) | Clip |
| --- | --- | --- |
| 01 Zufahrt | `01-zufahrt.jpg` | `01-zufahrt.webm` + `01-zufahrt.mp4` |
| 02 Multicodierte Fläche | `02-multicodierung.jpg` | `02-multicodierung.webm` + `02-multicodierung.mp4` |
| 03 Baumscheiben | `03-baumscheiben.jpg` | `03-baumscheiben.webm` + `03-baumscheiben.mp4` |

Die `.jpg` hier sind Platzhalter, damit die Seite ohne echte Renderings läuft.
Einfach überschreiben. Fehlt ein Clip, bleibt die Kachel beim Still stehen —
die Seite bricht nicht.

## Clips exportieren

Der Effekt lebt davon, dass der Clip **exakt dort anfängt, wo das Still
aufhört**. Also: das Still ist Frame 0 des Clips, nicht ein separater Render.

- **Länge** 4–8 s, nahtlose Schleife (letzter Frame ≈ erster Frame)
- **Auflösung** 1600 px breit reicht; die Kachel wird nie größer dargestellt
- **Kein Ton** — die Clips laufen `muted`, eine Tonspur ist nur Ballast
- **Bewegung sparsam** halten: langsamer Kameraschwenk, Licht, Vegetation,
  Wasser. Harte Schnitte zerstören die Illusion, dass das Bild „aufwacht".

## Kodieren

```bash
# Still = erster Frame des Clips
ffmpeg -i master.mov -vframes 1 -q:v 2 01-zufahrt.jpg

# MP4 (H.264) — die Universalfassung
ffmpeg -i master.mov -an -vf "scale=1600:-2" \
  -c:v libx264 -profile:v high -crf 23 -preset slow \
  -movflags +faststart 01-zufahrt.mp4

# WebM (VP9) — deutlich kleiner, wird von Chrome/Firefox bevorzugt
ffmpeg -i master.mov -an -vf "scale=1600:-2" \
  -c:v libvpx-vp9 -crf 33 -b:v 0 -row-mt 1 01-zufahrt.webm
```

`-movflags +faststart` schiebt den Index an den Dateianfang — ohne das lädt
Safari erst die ganze Datei, bevor der erste Frame erscheint, und der Hover
fühlt sich träge an.

Zielgröße pro Clip: unter 4 MB. Geladen wird ohnehin erst beim ersten Hover
(`preload="none"`), aber ein 20-MB-Clip macht auch dann eine spürbare Pause.

## Hochladen

```bash
cp .env.example .env.local   # Storage-Key eintragen (Repo-Wurzel)
npm run media:push
```

Landet unter `https://storage.bunnycdn.com/beuwy/p96/`. Damit die Seite auch
von dort liest, im Vercel-Dashboard `VITE_MEDIA_BASE` auf die Pull-Zone-URL
setzen — siehe `.env.production`. Wurde eine Datei ersetzt, die schon live war:
Pull-Zone-Cache im Bunny-Dashboard purgen, sonst läuft der alte Clip bis zum
Ablauf der TTL weiter.
