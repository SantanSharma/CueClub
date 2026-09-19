/**
 * Stops the page behind an overlay from scrolling.
 *
 * `overflow: hidden` on <body> alone is not enough — the scrolling element is
 * <html>, and iOS Safari ignores both. Pinning the body with `position: fixed`
 * and a negative offset is the technique that holds everywhere; the scroll
 * position is restored on unlock and the scrollbar width is compensated so
 * locking causes no layout shift on desktop.
 *
 * Reference counted so nested overlays (drawer → modal) unlock correctly.
 */
let locks = 0;
let savedScrollY = 0;
let previous: Record<string, string> = {};

export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  if (locks++ > 0) return;

  const body = document.body;
  const html = document.documentElement;
  savedScrollY = window.scrollY;
  const scrollbarWidth = window.innerWidth - html.clientWidth;

  previous = {
    position: body.style.position,
    top: body.style.top,
    width: body.style.width,
    overflow: body.style.overflow,
    paddingRight: body.style.paddingRight,
    htmlOverflow: html.style.overflow,
  };

  html.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${savedScrollY}px`;
  body.style.width = '100%';
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`;
  }
}

export function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  locks = Math.max(0, locks - 1);
  if (locks > 0) return;

  const body = document.body;
  const html = document.documentElement;

  body.style.position = previous['position'] ?? '';
  body.style.top = previous['top'] ?? '';
  body.style.width = previous['width'] ?? '';
  body.style.overflow = previous['overflow'] ?? '';
  body.style.paddingRight = previous['paddingRight'] ?? '';
  html.style.overflow = previous['htmlOverflow'] ?? '';

  window.scrollTo(0, savedScrollY);
}
