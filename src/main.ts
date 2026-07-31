// Only the cuts actually used: regular + italic display, regular/medium body.
// Latin subset only — deutsche Umlaute und ß liegen darin, latin-ext wäre
// rund 160 kB Schriftdaten für Zeichen, die auf dieser Seite nicht vorkommen.
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';

import './styles.css';
import { initHoverClips } from './hover-video';

initHoverClips();

// The "hover for motion" line is scaffolding for the first few seconds. Once
// the viewer has discovered the effect once, it retires itself.
const hint = document.querySelector<HTMLElement>('[data-hint]');
if (hint) {
  const retire = (): void => {
    hint.dataset.spent = '';
  };
  for (const shot of document.querySelectorAll('[data-clip]')) {
    shot.addEventListener('pointerenter', retire, { once: true });
  }
}
