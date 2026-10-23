/**
 * iPhone Duo's outer display is wider and shorter than other iPhones, so iOS
 * moves the status bar, the Dynamic Island and native apps' tab bars and
 * toolbars into a vertical rail along the right edge. A home-screen web app
 * can't draw in that rail: iOS hands the page the column beside it (382×678pt
 * on launch-day firmware) with the home-indicator inset at the bottom and no
 * status bar at the top. Safari has no media query or API that names the
 * device, so this watches for that signature and marks `<html>` with
 * `side-rail` whenever it holds, letting the tab bar stand up along the same
 * edge as the system rail instead of eating the little vertical space left.
 *
 * The signature is deliberately strict so no other iPhone matches it:
 *  - an installed (standalone) web app on an iPhone, in portrait
 *  - a home indicator inset at the bottom (rules out the 16:9 iPhone SE and 8,
 *    whose viewports have the same proportions)
 *  - no status bar inset at the top (every Face ID iPhone has one in portrait)
 *  - a safe-area box about 0.6 as wide as it is tall (Face ID iPhones are
 *    about 0.51, the Duo's inner display in portrait about 0.78)
 */
export const SIDE_RAIL_CLASS = 'side-rail';

interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function readSafeAreaInsets(): Insets {
  const probe = document.createElement('div');
  probe.style.cssText = [
    'position:fixed',
    'visibility:hidden',
    'pointer-events:none',
    'top:env(safe-area-inset-top,0px)',
    'right:env(safe-area-inset-right,0px)',
    'bottom:env(safe-area-inset-bottom,0px)',
    'left:env(safe-area-inset-left,0px)',
  ].join(';');
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const px = (value: string) => parseFloat(value) || 0;
  const insets = {
    top: px(style.top),
    right: px(style.right),
    bottom: px(style.bottom),
    left: px(style.left),
  };
  probe.remove();
  return insets;
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & {standalone?: boolean};
  return nav.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
}

/** True when the viewport looks like iPhone Duo's outer display. */
export function hasSideRail(): boolean {
  if (!/iPhone/i.test(navigator.userAgent) || !isStandalone()) return false;

  const width = window.innerWidth;
  const height = window.innerHeight;
  if (!(height > width) || width >= 1024) return false;

  const insets = readSafeAreaInsets();
  if (insets.bottom <= 0 || insets.top > 0) return false;

  const safeWidth = width - insets.left - insets.right;
  const safeHeight = height - insets.top - insets.bottom;
  const ratio = safeWidth / safeHeight;
  return ratio >= 0.55 && ratio <= 0.65;
}

/**
 * Keeps `html.side-rail` in step with the viewport. Folding the phone open,
 * rotating it or changing display zoom all fire resize, which is the only
 * signal Safari gives for any of them.
 */
export function watchSideRail(): void {
  const update = () => {
    document.documentElement.classList.toggle(SIDE_RAIL_CLASS, hasSideRail());
  };
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  window.matchMedia('(display-mode: standalone)')
      .addEventListener('change', update);
  update();
}
