import {Component, Input, OnChanges} from '@angular/core';
import {UtilService} from 'src/app/services/util.service';

/** Avatars shown before collapsing into a count. */
const MAX_AVATARS = 5;
/** Up to this many names are spelled out; beyond it the label is a count. */
const MAX_NAMED = 2;

/**
 * Who has HC'd (hard committed) for a beatdown: a short avatar stack and a
 * one-line label, tap to spell out everyone.
 */
@Component({
  selector: 'app-hc-list',
  templateUrl: './hc-list.component.html',
  styleUrls: ['./hc-list.component.scss'],
})
export class HcListComponent implements OnChanges {
  /** PAX names, any casing. */
  @Input() names: string[] = [];

  expanded = false;
  avatars: string[] = [];
  label = '';

  constructor(readonly utilService: UtilService) {}

  ngOnChanges() {
    this.avatars = this.names.slice(0, MAX_AVATARS);
    this.label = this.buildLabel();
  }

  toggle(event: Event) {
    event.stopPropagation();
    this.expanded = !this.expanded;
  }

  private buildLabel(): string {
    if (this.names.length > MAX_NAMED) return `${this.names.length} HC'd`;
    const named = this.names.map(name => this.utilService.normalizeName(name));
    return `${named.join(' & ')} HC'd`;
  }
}
