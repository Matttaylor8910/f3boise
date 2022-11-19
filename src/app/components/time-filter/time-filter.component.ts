import {Component, EventEmitter, Input, Output} from '@angular/core';

@Component({
  selector: 'app-time-filter',
  templateUrl: './time-filter.component.html',
  styleUrls: ['./time-filter.component.scss'],
})
export class TimeFilterComponent {
  @Input() tabs: string[] = [];
  @Input() selectedTab?: string;

  @Output() tabChange = new EventEmitter<string>();
}
