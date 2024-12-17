import {Component, OnInit} from '@angular/core';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {ActivatedRoute, Router} from '@angular/router';
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
      private readonly router: Router,
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

  async goToRandomBackblast() {
    // get and shuffle all backblasts
    const all = await this.backblastService.getAllData();
    this.utilService.shuffleArray(all);

    // then find the first that has a moleskine and route there
    let randomId = '';
    for (const backblast of all) {
      const single = await this.backblastService.getBackblast(backblast.id);
      if (single.moleskine && !single.ao.includes('Ruck')) {
        randomId = single.id;
        break;
      }
    }
    this.router.navigateByUrl(`/backblasts/${randomId}`);
  }
}
