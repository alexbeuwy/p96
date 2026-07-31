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
sofort läuft. Zum Austauschen siehe `docs/medien.md` — dort stehen die
Dateinamen, die ffmpeg-Kommandos und die eine Regel, auf die es ankommt: **das
Standbild muss der erste Frame des Clips sein.**

## Deploy über Vercel

Vercel erkennt Vite von selbst — Build `npm run build`, Output `dist`, sonst
nichts einzustellen. Es sind **keine** Environment Variables nötig, damit der
erste Deploy funktioniert: der Storage-Key wird nur lokal vom Upload-Skript
gebraucht, nie beim Build.

Jeder Push auf den Production Branch baut neu; danach reicht ein Refresh im
Browser. Pushes auf andere Branches erzeugen Preview-Deploys unter eigener
URL — praktisch zum Gegenlesen, aber die Produktions-URL ändert sich dadurch
nicht.

## Medien-Auslieferung

Standardmäßig kommen die Medien aus dem Build selbst (`public/media/` →
`dist/media/`), lokal wie in Produktion. Das funktioniert sofort und ohne
Bunny.

Sobald die echten Clips auf Bunny liegen, wird im Vercel-Dashboard unter
Settings → Environment Variables gesetzt:

```
VITE_MEDIA_BASE = https://<pull-zone>.b-cdn.net/p96     (Scope: Production)
```

Das überschreibt `.env.production` beim Build. Umschalten und Zurückschalten
kostet damit keinen Commit, und ein Rollback bei klemmender Pull Zone ist ein
Klick.

```bash
cp .env.example .env.local     # Storage-Key eintragen
npm run media:push             # public/media/ → storage.bunnycdn.com/beuwy/p96/
```

Standbilder (~25 kB) dürfen im Repo bleiben. Die echten Clips (~4 MB pro
Stück) gehören auf Bunny: Git ist kein Videohosting, und Vercel rechnet
ausgehenden Traffic mit ab.

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
