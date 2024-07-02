import { Component, Input, OnInit } from '@angular/core';
import { Backblast } from 'types';

@Component({
  selector: 'app-backblast-grid',
  templateUrl: './backblast-grid.component.html',
  styleUrls: ['./backblast-grid.component.scss'],
})
export class BackblastGridComponent implements OnInit {
  @Input() backblasts?: Backblast[];

  constructor() { }

  ngOnInit() {}

  trackByBackblast(_index: number, backblast: Backblast) {
    return `${backblast.ao}_${backblast.date}`;
  }
}
