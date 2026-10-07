import {Injectable} from '@angular/core';
import {NavigationEnd, Router} from '@angular/router';
import {filter} from 'rxjs';
import {isStaticPage} from 'src/app/config/static-pages';

/** Opens at the stats home: the app proper. */
const APP_MANIFEST = 'manifest.webmanifest';
/** Opens at the landing page: for pins made from the marketing website. */
const SITE_MANIFEST = 'manifest-site.webmanifest';

/**
 * Points the page's web app manifest at the right start URL for wherever the
 * user is when they pin the site. Browsers read the manifest link from the
 * document at install time, so swapping it on navigation decides whether the
 * home-screen icon opens the stats app or the public website.
 */
@Injectable({providedIn: 'root'})
export class ManifestService {
  constructor(private readonly router: Router) {}

  start(): void {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd))
        .subscribe(() => this.apply(this.router.url));
    this.apply(location.pathname);
  }

  private apply(url: string): void {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) return;
    const wanted = isStaticPage(url) ? SITE_MANIFEST : APP_MANIFEST;
    if (link.getAttribute('href') !== wanted) link.setAttribute('href', wanted);
  }
}
