import { TestBed } from '@angular/core/testing';

import { PaxService } from './pax.service';

describe('PaxService', () => {
  let service: PaxService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PaxService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
