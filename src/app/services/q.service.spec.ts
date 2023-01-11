import { TestBed } from '@angular/core/testing';

import { QService } from './q.service';

describe('QService', () => {
  let service: QService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(QService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
