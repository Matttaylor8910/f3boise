import {Injectable} from '@angular/core';
import {CanActivate, Router} from '@angular/router';
import {Observable, of} from 'rxjs';
import {map, switchMap, take} from 'rxjs/operators';

import {emailIsAdminBootstrap} from 'src/app/config/privileged-users';
import {AuthService} from 'src/app/services/auth.service';
import {hasAnyStaffRole} from 'src/app/services/user-permissions.service';
import {UserProfilesService} from 'src/app/services/user-profiles.service';

@Injectable({providedIn: 'root'})
export class AdminGuard implements CanActivate {
  constructor(
      private readonly auth: AuthService,
      private readonly router: Router,
      private readonly profiles: UserProfilesService,
  ) {}

  canActivate(): Observable<boolean> {
    return this.auth.authState$.pipe(
        take(1),
        switchMap(user => {
          if (!user?.uid) return of(false);
          if (emailIsAdminBootstrap(user.email ?? undefined)) return of(true);
          return this.profiles.getProfileTakeOne$(user.uid).pipe(
              map(profile => hasAnyStaffRole(profile?.roles ?? [])),
          );
        }),
        map(allowed => {
          if (!allowed) {
            this.router.navigateByUrl('/');
          }
          return allowed;
        }),
    );
  }
}
