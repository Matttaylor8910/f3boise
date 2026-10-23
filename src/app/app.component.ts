import {Component} from '@angular/core';

import {AppUpdateService} from './services/app-update.service';
import {ManifestService} from './services/manifest.service';
import {disablePageZoom} from './util/page-zoom';
import {watchSideRail} from './util/side-rail';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  readonly showUpdateBanner$ = this.appUpdate.showBanner$;

  constructor(
      private readonly appUpdate: AppUpdateService,
      manifest: ManifestService,
  ) {
    appUpdate.start();
    manifest.start();
    disablePageZoom();
    watchSideRail();
  }
}
