import {Component} from '@angular/core';

const ADD_EVENT_URL = 'https://forms.gle/18XCU2naNH7D1Hcp8';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.page.html',
  styleUrls: ['./calendar.page.scss'],
})
export class CalendarPage {
  addEvent() {
    window.open(ADD_EVENT_URL, '_blank');
  }
}
