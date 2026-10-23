/**
 * iPhone Duo's outer display is wider and shorter than other iPhones, so iOS
 * moves the status bar, the Dynamic Island and native apps' tab bars and
 * toolbars into a vertical rail along the right edge. A home-screen web app
 * can't draw in that rail: iOS hands the page the column beside it (382pt of
 * the 466pt-wide display on launch-day firmware). Safari has no media query
 * or API that names the device, so this watches for that shape and marks
 * `<html>` with `side-rail` whenever it holds, letting the tab bar stand up
 * along the same edge as the system rail instead of eating the little
 * vertical space left.
 *
 * The signature is the rail itself: on a touch screen in portrait, the page
 * is narrower than the screen (or carries a side inset), and its safe-area
 * box is about 0.6 as wide as it is tall. No other phone leaves a strip of
 * screen beside a portrait page, and the proportions rule out an iPad split
 * view, whose halves are 0.67 or squarer.
 */
export const SIDE_RAIL_CLASS = 'side-rail';

export interface SideRailReport {
  sideRail: boolean;
  userAgent: string;
  standalone: boolean;
  touch: boolean;
  viewport: {width: number; height: number};
  screen: {width: number; height: number};
  insets: Insets;
  /** Width of the screen beside the page, in CSS px. */
  rail: number;
  /** Safe-area box width over height. */
  ratio: number;
}

interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const MIN_RAIL = 40;
const MIN_RATIO = 0.55;
const MAX_RATIO = 0.64;

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

/** Everything the decision looks at, for the Device info readout. */
export function describeSideRail(): SideRailReport {
  const nav = navigator as Navigator & {standalone?: boolean};
  const width = window.innerWidth;
  const height = window.innerHeight;
  const insets = readSafeAreaInsets();
  // iOS reports the screen in portrait whichever way the phone is held
  const screenWidth = Math.min(screen.width, screen.height);
  const rail = Math.max(0, screenWidth - width) + insets.left + insets.right;
  const safeWidth = width - insets.left - insets.right;
  const safeHeight = height - insets.top - insets.bottom;
  const ratio = safeHeight > 0 ? safeWidth / safeHeight : 0;
  const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  const sideRail = touch && height > width && width < 1024 && rail >= MIN_RAIL &&
      ratio >= MIN_RATIO && ratio <= MAX_RATIO;

  return {
    sideRail,
    userAgent: navigator.userAgent,
    standalone: nav.standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches,
    touch,
    viewport: {width, height},
    screen: {width: screen.width, height: screen.height},
    insets,
    rail,
    ratio: Math.round(ratio * 1000) / 1000,
  };
}

/** True when the viewport looks like iPhone Duo's outer display. */
export function hasSideRail(): boolean {
  return describeSideRail().sideRail;
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
  update();
}
