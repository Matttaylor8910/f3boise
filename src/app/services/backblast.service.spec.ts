import { TestBed } from '@angular/core/testing';

import { BackblastService } from './backblast.service';

describe('BackblastService', () => {
  let service: BackblastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BackblastService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
