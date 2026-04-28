import {Injectable} from '@angular/core';
import {CanActivate, Router} from '@angular/router';
import {Observable} from 'rxjs';
import {map, take} from 'rxjs/operators';
import {AuthService} from 'src/app/services/auth.service';

const ALLOWED_EMAILS = new Set(['taylor.matt777@gmail.com']);

@Injectable({providedIn: 'root'})
export class MapGuard implements CanActivate {
  constructor(
      private readonly auth: AuthService,
      private readonly router: Router,
  ) {}

  canActivate(): Observable<boolean> {
    return this.auth.authState$.pipe(
        take(1),
        map(user => {
          if (user && ALLOWED_EMAILS.has(user.email)) {
            return true;
          }
          this.router.navigateByUrl('/');
          return false;
        }),
    );
  }
}
