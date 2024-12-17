import {Injectable} from '@angular/core';
import {CanActivate} from '@angular/router';
import {BackblastService} from 'src/app/services/backblast.service';

@Injectable({providedIn: 'root'})
export class LuckyGuard implements CanActivate {
  constructor(
      private readonly backblastService: BackblastService,
  ) {}

  canActivate(): boolean {
    this.backblastService.goToRandomBackblast();
    return false;
  }
}
