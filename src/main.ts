// Outfit statt Inter: geometrische Grotesk in der Familie von Circular, und
// sie steht neben der Wortmarke ohne Bruch. Latin-Subset — deutsche Umlaute
// und ß liegen darin, latin-ext wäre Ballast.
import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-500.css';
import '@fontsource/outfit/latin-600.css';

import './styles.css';
import { initHoverClips } from './hover-video';

initHoverClips();

/**
 * Einblenden beim Scrollen.
 *
 * IntersectionObserver statt Scroll-Listener: kein Handler, der bei jedem
 * Frame läuft. Die Staffelung ist eine CSS-Variable, damit die Verzögerung
 * im Stylesheet bleibt und nicht in JavaScript verteilt wird.
 */
function initReveal(): void {
  const items = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
  if (items.length === 0) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (const el of items) el.classList.add('is-in');
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      // Die sichtbar gewordenen Elemente einer Gruppe nacheinander zünden.
      // Gedeckelt bei sechs, damit die Gesamtstaffelung unter ~250ms bleibt —
      // sonst wirkt das letzte Element nachgereicht statt choreografiert.
      let step = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        el.style.setProperty('--i', String(Math.min(step, 5)));
        el.classList.add('is-in');
        observer.unobserve(el);
        step += 1;
      }
    },
    // Etwas vor der Unterkante zünden, damit die Bewegung fertig ist, wenn
    // das Element mittig steht.
    // threshold 0: sobald irgendein Teil den Rand berührt. Bei 0.15 zünden
    // Elemente, die höher als der Viewport sind, nie zuverlässig.
    { rootMargin: '0px 0px -6% 0px', threshold: 0 },
  );

  for (const el of items) observer.observe(el);
}

/** Trennlinie unter dem Kopf erst zeigen, wenn wirklich gescrollt wurde. */
function initStickyHeader(): void {
  const top = document.querySelector<HTMLElement>('.top');
  if (!top) return;

  // Ein 1px-Sentinel am Seitenanfang: verlässt er den Viewport, ist der Kopf
  // geklebt. Auch das ohne Scroll-Listener.
  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;';
  document.body.prepend(sentinel);

  new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting) top.removeAttribute('data-stuck');
      else top.setAttribute('data-stuck', '');
    },
    { threshold: 0 },
  ).observe(sentinel);
}

/** Der Überfahren-Hinweis hat seine Aufgabe erfüllt, sobald er einmal griff. */
function initCues(): void {
  for (const view of document.querySelectorAll<HTMLElement>('[data-clip]')) {
    view.addEventListener(
      'pointerenter',
      () => {
        for (const cue of document.querySelectorAll<HTMLElement>('[data-cue]')) {
          cue.dataset.spent = '';
        }
      },
      { once: true },
    );
  }
}

/**
 * Vollbild für die Galerie.
 *
 * <dialog> übernimmt Fokusfalle, Esc und Backdrop; hier bleibt nur, das
 * hochauflösende Bild einzuhaengen. Die große Datei wird erst beim Klick
 * geladen — nebeneinander reicht die kleine Fassung.
 */
function initLightbox(): void {
  const box = document.querySelector<HTMLDialogElement>('#lightbox');
  const img = box?.querySelector<HTMLImageElement>('.lightbox__img');
  const cap = box?.querySelector<HTMLElement>('.lightbox__cap');
  if (!box || !img || !cap || typeof box.showModal !== 'function') return;

  for (const shot of document.querySelectorAll<HTMLButtonElement>('.shot')) {
    shot.addEventListener('click', () => {
      img.src = shot.dataset.full ?? '';
      img.alt = shot.dataset.alt ?? '';
      cap.textContent = shot.dataset.caption ?? '';
      box.showModal();
    });
  }

  // Klick auf den Backdrop schließt: das Ereignis trifft dann den Dialog
  // selbst, nicht das Bild darin.
  box.addEventListener('click', (event) => {
    if (event.target === box) box.close();
  });
  box.querySelector('[data-close]')?.addEventListener('click', () => box.close());

  // Die große Datei wieder freigeben, sonst hält der Browser bis zu drei
  // Vollauflösungen im Speicher.
  box.addEventListener('close', () => {
    img.removeAttribute('src');
  });
}

initReveal();
initStickyHeader();
initCues();
initLightbox();
