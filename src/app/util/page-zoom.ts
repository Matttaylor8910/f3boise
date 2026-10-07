/**
 * Stops the browser from pinch- or double-tap-zooming the whole app as if it
 * were a web page. The viewport meta already asks for this, but Safari ignores
 * `user-scalable=no` outside of home-screen installs, so we also cancel its
 * proprietary gesture events and any scaled touch move. Elements that handle
 * their own pinch (the Google Map) still receive the touch events and keep
 * zooming themselves.
 */
export function disablePageZoom(): void {
  const cancel = (e: Event) => e.preventDefault();
  const opts: AddEventListenerOptions = {passive: false};
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, cancel, opts);
  }
  document.addEventListener('touchmove', e => {
    // Safari exposes the pinch scale on touch events
    const scale = (e as TouchEvent & {scale?: number}).scale;
    if (scale !== undefined && scale !== 1) e.preventDefault();
  }, opts);
}
