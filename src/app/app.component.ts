import {Component} from '@angular/core';

import {AppUpdateService} from './services/app-update.service';
import {ManifestService} from './services/manifest.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  readonly updateReady$ = this.appUpdate.updateReady$;

  constructor(
      private readonly appUpdate: AppUpdateService,
      manifest: ManifestService,
  ) {
    appUpdate.start();
    manifest.start();
  }
}
