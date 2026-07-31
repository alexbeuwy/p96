# P96 — Wohnbebauung am Hang

Einseitige Pitch-Seite. Drei Renderings, die beim Überfahren in eine
Videoschleife übergehen und beim Verlassen wieder zum Standbild werden.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # Typecheck + statischer Build nach dist/
npm test           # Verhalten des Hover-Effekts im echten Browser
```

`npm test` braucht einmalig `npx playwright install chromium`.

## Stack

Vite + TypeScript, sonst nichts. Kein Framework — die Seite besteht aus drei
Bildern, drei Videos und ungefähr 150 Zeilen Logik. React hätte hier mehr
Laufzeit gekostet als die gesamte Seite wiegt.

Die Inhalte stehen als normales HTML in `index.html`. Wer Text, Zahlen oder
Bildunterschriften ändern will, muss kein JavaScript anfassen.

## Wie der Effekt funktioniert

`src/hover-video.ts`. Drei Entscheidungen, die den Unterschied machen:

**Das Standbild ist ein echtes `<img>`, das Video liegt darüber.** Das Video
wird erst eingeblendet, wenn es tatsächlich `playing` meldet — nicht wenn der
Zeiger ankommt. Sonst sieht man den schwarzen ersten Frame oder ein Ruckeln
beim Dekodieren, und die Illusion ist weg.

**Videos werden erst beim ersten Hover geladen.** Die `<source>`-Elemente
tragen `data-src` statt `src`. Drei Clips zu je 4 MB beim Seitenaufruf würden
genau das kaputtmachen, was die Seite leisten soll: in einer Präsentation
sofort da sein.

**Beim Verlassen wird erst nach der Ausblendung pausiert.** Andernfalls friert
der letzte sichtbare Frame mitten in der Überblendung ein und liest sich als
Fehler.

Dazu drei Fälle, die eine Hover-Lösung sonst übersieht:

- **Touch** kennt kein Hover. Auf dem Handy spielt der Clip, der gerade mittig
  im Bild steht (`IntersectionObserver`).
- **`prefers-reduced-motion`** schaltet den Effekt komplett ab — er *ist*
  Bewegung, hier gibt es nichts abzuschwächen. Dann bleiben drei Standbilder.
- **Fehlender oder kaputter Clip** fällt auf das Standbild zurück. Die Seite
  sieht dann ruhiger aus, aber nie defekt.

`--clip-fade` in `src/styles.css` und `FADE_MS` in `src/hover-video.ts` müssen
denselben Wert haben.

## Medien

Die aktuellen Dateien in `public/media/` sind Platzhalter, damit die Seite
sofort läuft. Zum Austauschen siehe `public/media/README.md` — dort stehen die
Dateinamen, die ffmpeg-Kommandos und die eine Regel, auf die es ankommt: **das
Standbild muss der erste Frame des Clips sein.**

## Hosting über Bunny

Lokal kommen die Medien aus `public/media/` (`.env`), im Produktionsbuild aus
der Pull Zone (`.env.production`). Nur die Basis-URL unterscheidet sich, das
Markup ist identisch.

```bash
cp .env.example .env.local     # Storage-Key eintragen
npm run media:push             # public/media/ → storage.bunnycdn.com/beuwy/p96/
```

Vor dem ersten Deploy in `.env.production` die Pull-Zone-Domain eintragen.

> **Zum Schlüssel:** Der Storage-Key ist das Passwort für die gesamte Zone —
> damit kann man alles lesen, überschreiben und löschen. Er gehört in
> `.env.local` (nicht versioniert) und nie in eine `VITE_`-Variable, weil die
> in das Browser-Bundle eingebaut wird. Wenn der Schlüssel je in einem Chat,
> Ticket oder Screenshot gelandet ist: im Bunny-Dashboard zurücksetzen.

## Schriften

Instrument Serif und Inter werden über `@fontsource` selbst ausgeliefert. Kein
Request an Google — bei einem deutschen Kunden ist das nicht Optimierung,
sondern DSGVO (LG München I, 3 O 17493/20). Nebeneffekt: funktioniert auch
ohne Netz im Besprechungsraum.
