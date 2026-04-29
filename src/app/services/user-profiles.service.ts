import {Injectable, OnDestroy} from '@angular/core';
import {AngularFirestore} from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';
import {Observable, of, Subscription} from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  map,
  switchMap,
  take,
} from 'rxjs/operators';

import {emailIsAdminBootstrap} from 'src/app/config/privileged-users';
import {rolesGrantAdminAccess} from 'src/app/services/user-permissions.service';

import {AuthService} from './auth.service';

export const USER_PROFILES_COLLECTION = 'userProfiles';
export const PENDING_ROLES_COLLECTION = 'pendingRoleAssignments';

export interface PendingRoleAssignment {
  email: string;
  displayName: string|null;
  roles: string[];
  assignedAt: firebase.firestore.Timestamp|null;
  assignedByUid: string|null;
}

/** Simple (non-parameterised) role ids that the admin UI manages via checkboxes.
 *  Nantan / AOQ are parameterised and managed separately. */
export const SIMPLE_ROLE_OPTIONS = [
  {id: 'admin', label: 'Administrator'},
] as const;

export type SimpleRoleId = (typeof SIMPLE_ROLE_OPTIONS)[number]['id'];

export interface UserProfile {
  uid: string;
  email: string|null;
  displayName: string|null;
  photoURL: string|null;
  roles: string[];
  updatedAt: firebase.firestore.Timestamp|null;
  lastSeenAt: firebase.firestore.Timestamp|null;
}

@Injectable({providedIn: 'root'})
export class UserProfilesService implements OnDestroy {
  private readonly subs = new Subscription();

  constructor(
      private readonly auth: AuthService,
      private readonly firestore: AngularFirestore,
  ) {
    this.subs.add(
        this.auth.authState$.subscribe(u => {
          void this.touchCurrentUserProfile(u);
        }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  /**
   * Tracks sign-ins: merge-writes identity + lastSeen so we can list accounts
   * in admin (does not wipe `roles`).
   */
  private async touchCurrentUserProfile(u: firebase.User|null): Promise<void> {
    if (!u) return;
    const uid = u.uid;
    await this.firestore.doc(`${USER_PROFILES_COLLECTION}/${uid}`).set(
        {
          email: u.email ?? null,
          displayName: u.displayName ?? null,
          photoURL: u.photoURL ?? null,
          lastSeenAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
    );
  }

  watchAllProfiles(): Observable<UserProfile[]> {
    return this.firestore
        .collection<UserProfile>(USER_PROFILES_COLLECTION,
            ref => ref.orderBy('email', 'asc'))
        .snapshotChanges()
        .pipe(
            map(actions => actions.map(a => ({
                                         uid: a.payload.doc.id,
                                         ...this.normalizeFields(
                                             a.payload.doc.data() as unknown as
                                                 Record<string, unknown>,
                                             a.payload.doc.id),
                                       }))),
        );
  }

  getProfile$(uid: string): Observable<UserProfile|null> {
    return this.firestore.doc(`${USER_PROFILES_COLLECTION}/${uid}`)
        .valueChanges()
        .pipe(map(data => {
          if (!data || typeof data !== 'object') return null;
          return {
            uid,
            ...this.normalizeFields(data as Record<string, unknown>, uid),
          };
        }));
  }

  getProfileTakeOne$(uid: string): Observable<UserProfile|null> {
    return this.getProfile$(uid).pipe(take(1));
  }

  private normalizeFields(data: Record<string, unknown>, uid: string):
      Omit<UserProfile, 'uid'> {
    return {
      email: (data['email'] as string|undefined) ?? null,
      displayName: (data['displayName'] as string|undefined) ?? null,
      photoURL: (data['photoURL'] as string|undefined) ?? null,
      roles: Array.isArray(data['roles']) ?
          [...(data['roles'] as string[])] :
          [],
      updatedAt:
          (data['updatedAt'] as firebase.firestore.Timestamp|undefined) ??
          null,
      lastSeenAt:
          (data['lastSeenAt'] as firebase.firestore.Timestamp|undefined) ??
          null,
    };
  }

  async setRoles(uid: string, roles: string[]): Promise<void> {
    const sorted = [...new Set(roles)].sort((a, b) => a.localeCompare(b));
    await this.firestore.doc(`${USER_PROFILES_COLLECTION}/${uid}`).set(
        {
          roles: sorted,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
    );
  }

  /**
   * Write a pending role assignment keyed by normalized email.
   * A Cloud Function merges this into `userProfiles/{uid}` on first sign-in.
   */
  async setPendingRoles(
      email: string,
      roles: string[],
      assignedByUid: string,
      displayName?: string,
      ): Promise<void> {
    const normalized = email.toLowerCase().trim();
    const sorted = [...new Set(roles)].sort((a, b) => a.localeCompare(b));
    await this.firestore.doc(`${PENDING_ROLES_COLLECTION}/${normalized}`).set({
      email: normalized,
      displayName: displayName ?? null,
      roles: sorted,
      assignedAt: firebase.firestore.FieldValue.serverTimestamp(),
      assignedByUid,
    });
  }

  watchAllPendingAssignments(): Observable<PendingRoleAssignment[]> {
    return this.firestore
        .collection<PendingRoleAssignment>(PENDING_ROLES_COLLECTION)
        .snapshotChanges()
        .pipe(
            map(actions => actions.map(a => {
              const d = a.payload.doc.data() as unknown as Record<string, unknown>;
              return {
                email: (d['email'] as string|undefined) ??
                    a.payload.doc.id,
                displayName:
                    (d['displayName'] as string|null|undefined) ?? null,
                roles: Array.isArray(d['roles']) ?
                    [...(d['roles'] as string[])] :
                    [],
                assignedAt:
                    (d['assignedAt'] as
                         firebase.firestore.Timestamp|undefined) ??
                    null,
                assignedByUid:
                    (d['assignedByUid'] as string|null|undefined) ?? null,
              } as PendingRoleAssignment;
            })),
        );
  }

  getPendingAssignment$(email: string): Observable<PendingRoleAssignment|null> {
    const normalized = email.toLowerCase().trim();
    return this.firestore.doc(`${PENDING_ROLES_COLLECTION}/${normalized}`)
        .valueChanges()
        .pipe(map(data => {
          if (!data || typeof data !== 'object') return null;
          const d = data as Record<string, unknown>;
          return {
            email: (d['email'] as string|undefined) ?? normalized,
            displayName: (d['displayName'] as string|null|undefined) ?? null,
            roles: Array.isArray(d['roles']) ? [...(d['roles'] as string[])] :
                                               [],
            assignedAt:
                (d['assignedAt'] as firebase.firestore.Timestamp|undefined) ??
                null,
            assignedByUid:
                (d['assignedByUid'] as string|null|undefined) ?? null,
          };
        }));
  }

  /** Sidebar / nav: bootstrap superadmin email or admin / Nantan / AOQ role */
  readonly canAccessAdminPage$: Observable<boolean> =
      this.auth.authState$.pipe(
          filter((u): u is firebase.User => !!u?.uid),
          distinctUntilChanged((a, b) => a.uid === b.uid),
          switchMap(user => {
            if (emailIsAdminBootstrap(user.email ?? undefined)) {
              return of(true);
            }
            return this.getProfile$(user.uid).pipe(
                map(p => rolesGrantAdminAccess(p?.roles ?? [])),
            );
          }),
          distinctUntilChanged(),
      );
}
