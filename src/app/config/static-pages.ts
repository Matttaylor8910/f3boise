/**
 * Routes that are public marketing pages for the website rather than part of
 * the stats app: they get no app chrome, and pinning one to the home screen
 * keeps opening the website instead of the app.
 */
export const STATIC_PAGES = ['/', '/fng', '/workouts'];

export function isStaticPage(url: string): boolean {
  return STATIC_PAGES.includes(url.split('?')[0].split('#')[0]);
}
