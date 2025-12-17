import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {Challenge} from 'types';

@Injectable({providedIn: 'root'})
export class ChallengesService {
  private readonly COLLECTION_NAME = 'challenges';

  constructor(private readonly firestore: AngularFirestore) {}

  /**
   * Create a new challenge
   * @param challenge The challenge data to create
   * @returns Promise that resolves with the created challenge ID
   */
  async createChallenge(challenge: Omit<Challenge, 'id'|'createdAt'>):
      Promise<string> {
    const challengeData = {
      ...challenge,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    const docRef = await this.firestore.collection(this.COLLECTION_NAME)
                       .add(challengeData);
    return docRef.id;
  }

  /**
   * Get all challenges
   * @returns Observable of all challenges
   */
  getChallenges(): Observable<Challenge[]> {
    return this.firestore
        .collection<Challenge>(
            this.COLLECTION_NAME, ref => ref.orderBy('createdAt', 'desc'))
        .snapshotChanges()
        .pipe(
            map(actions => actions.map(a => {
              const data = a.payload.doc.data();
              const id = a.payload.doc.id;
              return {id, ...data} as Challenge;
            })),
        );
  }

  /**
   * Get a single challenge by ID
   * @param id The challenge ID
   * @returns Observable of the challenge
   */
  getChallenge(id: string): Observable<Challenge|undefined> {
    return this.firestore.collection<Challenge>(this.COLLECTION_NAME)
        .doc(id)
        .valueChanges()
        .pipe(
            map(data => data ? {id, ...data} as Challenge : undefined),
        );
  }

  /**
   * Update an existing challenge
   * @param id The challenge ID
   * @param challenge The updated challenge data
   * @returns Promise that resolves when the update is complete
   */
  async updateChallenge(
      id: string,
      challenge: Omit<Challenge, 'id'|'createdAt'|'createdBy'>): Promise<void> {
    await this.firestore.collection(this.COLLECTION_NAME)
        .doc(id)
        .update(challenge);
  }
}
