import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/compat/firestore';
import {Observable} from 'rxjs';

import {AuthService} from './auth.service';

interface Favorites {
  [backblastId: string]: boolean;
}

@Injectable({providedIn: 'root'})
export class FavoritesService {
  userId: string|null = null;

  constructor(
      private readonly authService: AuthService,
      private readonly afs: AngularFirestore,
  ) {
    this.authService.currentUser.subscribe(user => {
      if (user === null) {
        this.userId = null;
      } else {
        this.userId = user.uid;
      }
    });
  }

  addFavorite(backblastId: string) {
    if (this.userId === null) return;
    this.afs.collection('favorites')
        .doc(this.userId)
        .set({[backblastId]: true}, {merge: true});
  }

  getMyFavorites(): null|Observable<Favorites|undefined> {
    if (this.userId === null) return null;
    return this.afs.collection<Favorites>('favorites')
        .doc(this.userId)
        .valueChanges();
  }
}
