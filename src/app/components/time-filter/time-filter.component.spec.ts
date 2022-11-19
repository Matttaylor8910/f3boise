import {async, ComponentFixture, TestBed} from '@angular/core/testing';
import {IonicModule} from '@ionic/angular';

import {TimeFilterComponent} from './time-filter.component';

describe('TimeFilterComponent', () => {
  let component: TimeFilterComponent;
  let fixture: ComponentFixture<TimeFilterComponent>;

  beforeEach(async(() => {
    TestBed
        .configureTestingModule({
          declarations: [TimeFilterComponent],
          imports: [IonicModule.forRoot()]
        })
        .compileComponents();

    fixture = TestBed.createComponent(TimeFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
