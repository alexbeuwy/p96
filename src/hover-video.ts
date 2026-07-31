/**
 * Turns a still rendering into a looping clip on hover.
 *
 * The still is always a real <img>, and the <video> sits on top of it at
 * opacity 0. We only fade the video in once it actually reports `playing`,
 * so the viewer never sees a black frame, a decode stutter, or the poster
 * snapping back — the clip appears to be the still coming alive.
 *
 * Video bytes are not fetched until the first hover: <source> elements carry
 * `data-src`, and we promote them to `src` on intent. Three renderings at
 * ~4 MB each would otherwise dominate the initial load of a page whose whole
 * job is to look instant in a pitch meeting.
 */

/** How long the still→clip crossfade runs. Keep in sync with --clip-fade in styles.css. */
const FADE_MS = 420;

/** Pointer must rest on the card this long before we spend bandwidth. */
const INTENT_DELAY_MS = 90;

type ClipState = 'idle' | 'loading' | 'playing' | 'unavailable';

class HoverClip {
  private readonly root: HTMLElement;
  private readonly video: HTMLVideoElement;
  private state: ClipState = 'idle';
  private sourcesAttached = false;
  private intentTimer: number | undefined;
  private resetTimer: number | undefined;

  constructor(root: HTMLElement, video: HTMLVideoElement) {
    this.root = root;
    this.video = video;

    // A clip with no encoded sources yet (or a 404) must never look broken:
    // we drop back to the still and stop trying.
    this.video.addEventListener('error', this.markUnavailable);
    this.video.addEventListener('playing', this.handlePlaying);
  }

  /** True once we know this card can never show motion — used to drop listeners. */
  get isUnavailable(): boolean {
    return this.state === 'unavailable';
  }

  enter = (): void => {
    if (this.isUnavailable) return;
    window.clearTimeout(this.resetTimer);
    window.clearTimeout(this.intentTimer);
    this.intentTimer = window.setTimeout(this.start, INTENT_DELAY_MS);
  };

  leave = (): void => {
    window.clearTimeout(this.intentTimer);
    if (this.state !== 'playing' && this.state !== 'loading') return;

    this.root.dataset.clip = 'idle';
    this.state = 'idle';

    // Pause *after* the fade, otherwise the last visible frame freezes
    // mid-crossfade and reads as a glitch.
    this.resetTimer = window.setTimeout(() => {
      this.video.pause();
      this.video.currentTime = 0;
    }, FADE_MS);
  };

  private start = (): void => {
    if (this.isUnavailable || this.state === 'playing') return;

    if (!this.sourcesAttached) {
      const sources = this.video.querySelectorAll<HTMLSourceElement>('source[data-src]');
      if (sources.length === 0) {
        this.markUnavailable();
        return;
      }
      for (const source of sources) {
        source.src = source.dataset.src ?? '';
        source.removeAttribute('data-src');
      }
      this.sourcesAttached = true;
      this.video.load();
    }

    this.state = 'loading';

    // Autoplay policies reject muted playback far less often than audible
    // playback, but a rejection is still normal (e.g. Low Power Mode) and
    // must not throw — the still is a perfectly good fallback.
    void this.video.play().catch(() => {
      if (this.state === 'loading') this.state = 'idle';
    });
  };

  private handlePlaying = (): void => {
    // A `playing` event can arrive after the pointer already left.
    if (this.state !== 'loading') return;
    this.state = 'playing';
    this.root.dataset.clip = 'playing';
  };

  private markUnavailable = (): void => {
    this.state = 'unavailable';
    this.root.dataset.clip = 'idle';
  };

  destroy(): void {
    window.clearTimeout(this.intentTimer);
    window.clearTimeout(this.resetTimer);
    this.video.removeEventListener('error', this.markUnavailable);
    this.video.removeEventListener('playing', this.handlePlaying);
  }
}

export function initHoverClips(scope: ParentNode = document): () => void {
  // `prefers-reduced-motion` is a hard stop, not a softening: the entire
  // effect is motion, so we simply leave three still renderings on the page.
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches) return () => {};

  const cards = scope.querySelectorAll<HTMLElement>('[data-clip]');
  const clips: HoverClip[] = [];
  const teardown: Array<() => void> = [];

  for (const card of cards) {
    const video = card.querySelector<HTMLVideoElement>('video');
    if (!video) continue;
    clips.push(new HoverClip(card, video));
  }

  // Hover is not a thing on touch. Rather than leave phone visitors with
  // three inert stills, we play whichever card is centred in the viewport.
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');

  const attachHover = (): void => {
    clips.forEach((clip, i) => {
      const card = cards[i];
      if (!card) return;
      card.addEventListener('pointerenter', clip.enter);
      card.addEventListener('pointerleave', clip.leave);
      // Keyboard users tabbing to the card's link get the same reveal.
      card.addEventListener('focusin', clip.enter);
      card.addEventListener('focusout', clip.leave);
      teardown.push(() => {
        card.removeEventListener('pointerenter', clip.enter);
        card.removeEventListener('pointerleave', clip.leave);
        card.removeEventListener('focusin', clip.enter);
        card.removeEventListener('focusout', clip.leave);
      });
    });
  };

  const attachScroll = (): void => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Array.prototype.indexOf.call(cards, entry.target);
          const clip = clips[index];
          if (!clip) continue;
          if (entry.isIntersecting) clip.enter();
          else clip.leave();
        }
      },
      { threshold: 0.6 },
    );
    for (const card of cards) observer.observe(card);
    teardown.push(() => observer.disconnect());
  };

  const apply = (): void => {
    while (teardown.length > 0) teardown.pop()?.();
    if (canHover.matches) attachHover();
    else attachScroll();
  };

  apply();
  // A laptop docked to a touchscreen, or a tablet gaining a trackpad, flips
  // this mid-session.
  canHover.addEventListener('change', apply);

  return () => {
    canHover.removeEventListener('change', apply);
    while (teardown.length > 0) teardown.pop()?.();
    for (const clip of clips) clip.destroy();
  };
}
