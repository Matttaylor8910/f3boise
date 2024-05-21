import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BackblastService } from 'src/app/services/backblast.service';
import { Backblast } from 'types';
import { marked } from 'marked';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { UtilService } from 'src/app/services/util.service';

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

    const parsed = marked(this.backblast.moleskine) as string;
    return this.domSanitizer.bypassSecurityTrustHtml(parsed);
  }

  get ao(): string {
    if (!this.backblast?.ao) return '';

    return this.utilService.normalizeName(this.backblast?.ao);
  }
}
