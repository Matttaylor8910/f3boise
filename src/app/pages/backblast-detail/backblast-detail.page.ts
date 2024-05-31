import {Component, OnInit} from '@angular/core';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {ActivatedRoute} from '@angular/router';
import {marked} from 'marked';
import {BackblastService} from 'src/app/services/backblast.service';
import {UtilService} from 'src/app/services/util.service';
import {Backblast} from 'types';

@Component({
  selector: 'app-backblast-detail',
  templateUrl: './backblast-detail.page.html',
  styleUrls: ['./backblast-detail.page.scss'],
})
export class BackblastDetailPage implements OnInit {
  id: string;
  backblast?: Backblast;

  constructor(
      public readonly utilService: UtilService,
      private readonly route: ActivatedRoute,
      private readonly backblastService: BackblastService,
      private readonly domSanitizer: DomSanitizer,
  ) {
    this.id = this.route.snapshot.params['id'];
  }

  async ngOnInit() {
    this.backblast = await this.backblastService.getBackblast(this.id);
  }

  get moleskine(): SafeHtml {
    if (!this.backblast?.moleskine) return '';

    const parsed = marked(this.backblast.moleskine, {breaks: true}) as string;
    return this.domSanitizer.bypassSecurityTrustHtml(parsed);
  }

  get ao(): string {
    if (!this.backblast?.ao) return '';

    return this.utilService.normalizeName(this.backblast?.ao);
  }
}
