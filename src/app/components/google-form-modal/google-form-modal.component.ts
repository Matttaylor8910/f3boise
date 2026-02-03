import {Component, Input} from '@angular/core';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {ModalController} from '@ionic/angular';

@Component({
  selector: 'app-google-form-modal',
  templateUrl: './google-form-modal.component.html',
  styleUrls: ['./google-form-modal.component.scss'],
})
export class GoogleFormModalComponent {
  @Input() formUrl: string = '';

  constructor(
      private readonly modalController: ModalController,
      private readonly sanitizer: DomSanitizer,
  ) {}

  get safeFormUrl(): SafeResourceUrl {
    let url = this.formUrl;

    // For docs.google.com URLs, ensure embedded=true is present
    if (url.includes('docs.google.com/forms') &&
        !url.includes('embedded=true')) {
      url = url.includes('?') ? `${url}&embedded=true` : `${url}?embedded=true`;
    }

    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  async dismiss() {
    await this.modalController.dismiss();
  }
}
