import { Component, Input, OnInit } from '@angular/core';
import { Backblast } from 'types';

@Component({
  selector: 'app-backblast-card',
  templateUrl: './backblast-card.component.html',
  styleUrls: ['./backblast-card.component.scss'],
})
export class BackblastCardComponent implements OnInit {
  @Input() backblast!: Backblast;

  constructor() { }

  ngOnInit() {}

}
