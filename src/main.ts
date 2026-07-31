// Eine Schrift genügt: die Wortmarke ist eine geometrische Grotesk, Inter
// steht daneben ohne Bruch. Latin-Subset — deutsche Umlaute und ß liegen darin.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';

import './styles.css';
import { initHoverClips } from './hover-video';

initHoverClips();

// Der Hinweis ist Gerüst für die ersten Sekunden. Wer die Bewegung einmal
// ausgelöst hat, braucht ihn nicht mehr.
const hint = document.querySelector<HTMLElement>('[data-hint]');
if (hint) {
  for (const view of document.querySelectorAll('[data-clip]')) {
    view.addEventListener(
      'pointerenter',
      () => {
        hint.dataset.spent = '';
      },
      { once: true },
    );
  }
}
