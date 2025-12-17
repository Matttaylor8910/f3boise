import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {Challenge, ChallengeParticipant} from 'types';

@Injectable({providedIn: 'root'})
export class ChallengesService {
  private readonly COLLECTION_NAME = 'challenges';
  private readonly PARTICIPANTS_COLLECTION = 'challenge_participants';

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

  /**
   * Join a challenge
   * @param challengeId The challenge ID
   * @param userId The user ID (email or UID)
   * @param paxName Optional PAX name
   * @returns Promise that resolves with the participant ID
   */
  async joinChallenge(challengeId: string, userId: string, paxName?: string):
      Promise<string> {
    // Check if user is already a participant using a direct query
    const existingQuery =
        await this.firestore
            .collection<ChallengeParticipant>(
                this.PARTICIPANTS_COLLECTION,
                ref => ref.where('challengeId', '==', challengeId)
                           .where('userId', '==', userId)
                           .limit(1))
            .get()
            .toPromise();

    if (existingQuery && !existingQuery.empty) {
      // User is already a participant, return existing ID
      return existingQuery.docs[0].id;
    }

    const participant: Omit<ChallengeParticipant, 'id'> = {
      challengeId,
      userId,
      paxName,
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await this.firestore.collection(this.PARTICIPANTS_COLLECTION)
                       .add(participant);
    return docRef.id;
  }

  /**
   * Get a participant for a specific challenge and user
   * @param challengeId The challenge ID
   * @param userId The user ID
   * @returns Observable of the participant or undefined
   */
  getParticipant(challengeId: string, userId: string):
      Observable<ChallengeParticipant|undefined> {
    return this.firestore
        .collection<ChallengeParticipant>(
            this.PARTICIPANTS_COLLECTION,
            ref => ref.where('challengeId', '==', challengeId)
                       .where('userId', '==', userId)
                       .limit(1))
        .valueChanges()
        .pipe(
            map(participants => {
              if (participants.length === 0) return undefined;
              return participants[0];
            }),
        );
  }

  /**
   * Get all participants for a challenge
   * @param challengeId The challenge ID
   * @returns Observable of all participants
   */
  getParticipants(challengeId: string): Observable<ChallengeParticipant[]> {
    return this.firestore
        .collection<ChallengeParticipant>(
            this.PARTICIPANTS_COLLECTION,
            ref => ref.where('challengeId', '==', challengeId)
                       .orderBy('joinedAt', 'asc'))
        .snapshotChanges()
        .pipe(
            map(actions => actions.map(a => {
              const data = a.payload.doc.data();
              const id = a.payload.doc.id;
              return {id, ...data} as ChallengeParticipant;
            })),
        );
  }

  /**
   * Withdraw from a challenge (remove participant)
   * @param challengeId The challenge ID
   * @param userId The user ID
   * @returns Promise that resolves when withdrawal is complete
   */
  async withdrawFromChallenge(challengeId: string, userId: string):
      Promise<void> {
    await this.removeParticipant(challengeId, userId);
  }

  /**
   * Remove a participant from a challenge (can be called by creator or the
   * participant themselves)
   * @param challengeId The challenge ID
   * @param userId The user ID of the participant to remove
   * @returns Promise that resolves when removal is complete
   */
  async removeParticipant(challengeId: string, userId: string): Promise<void> {
    // Find the participant document
    const participantQuery =
        await this.firestore
            .collection<ChallengeParticipant>(
                this.PARTICIPANTS_COLLECTION,
                ref => ref.where('challengeId', '==', challengeId)
                           .where('userId', '==', userId)
                           .limit(1))
            .get()
            .toPromise();

    if (participantQuery && !participantQuery.empty) {
      const participantDoc = participantQuery.docs[0];
      await participantDoc.ref.delete();
    } else {
      throw new Error('Participant not found');
    }
  }
}
