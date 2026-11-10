import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {Challenge, ChallengeCustomMetric, ChallengeLog, ChallengeParticipant} from 'types';

@Injectable({providedIn: 'root'})
export class ChallengesService {
  private readonly COLLECTION_NAME = 'challenges';
  private readonly PARTICIPANTS_COLLECTION = 'challenge_participants';
  private readonly LOGS_COLLECTION = 'challenge_logs';

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
   * Delete a challenge and all its participants
   * @param id The challenge ID
   * @returns Promise that resolves when deletion is complete
   */
  async deleteChallenge(id: string): Promise<void> {
    // Delete all participants first
    const participantsQuery = await this.firestore
                                  .collection<ChallengeParticipant>(
                                      this.PARTICIPANTS_COLLECTION,
                                      ref => ref.where('challengeId', '==', id))
                                  .get()
                                  .toPromise();

    if (participantsQuery && !participantsQuery.empty) {
      const deletePromises =
          participantsQuery.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);
    }

    // Delete everything PAX logged against it
    const logsQuery = await this.firestore
                          .collection<ChallengeLog>(
                              this.LOGS_COLLECTION,
                              ref => ref.where('challengeId', '==', id))
                          .get()
                          .toPromise();
    if (logsQuery && !logsQuery.empty) {
      await Promise.all(logsQuery.docs.map(doc => doc.ref.delete()));
    }

    // Delete the challenge
    await this.firestore.collection(this.COLLECTION_NAME).doc(id).delete();
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

  /**
   * Every check-in PAX have posted against a challenge's custom metrics
   * @param challengeId The challenge ID
   * @returns Observable of all log entries
   */
  getLogs(challengeId: string): Observable<ChallengeLog[]> {
    return this.firestore
        .collection<ChallengeLog>(
            this.LOGS_COLLECTION,
            ref => ref.where('challengeId', '==', challengeId))
        .valueChanges({idField: 'id'});
  }

  /**
   * Post a check-in: what one PAX did on a day. Amounts add to anything he
   * already checked in for that day.
   * @param values Metric id to amount; zero and empty amounts are dropped
   * @param createdBy Who is posting: the PAX himself or the challenge creator
   */
  async addCheckIn(
      challengeId: string, userId: string, paxName: string|undefined,
      date: string, values: {[metricId: string]: number}, note: string,
      createdBy: string): Promise<void> {
    const kept: {[metricId: string]: number} = {};
    for (const metricId of Object.keys(values)) {
      if (values[metricId] > 0) kept[metricId] = values[metricId];
    }
    const log: Omit<ChallengeLog, 'id'> = {
      challengeId,
      userId,
      date,
      values: kept,
      createdBy,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    // Firestore rejects undefined, so only carry what was given
    if (paxName) log.paxName = paxName;
    if (note.trim()) log.note = note.trim();
    await this.firestore.collection(this.LOGS_COLLECTION).add(log);
  }

  /**
   * Change a check-in: the day, the amounts (which replace, not add), the
   * note. The PAX himself or the challenge creator may do this.
   */
  async updateCheckIn(
      id: string, date: string, values: {[metricId: string]: number},
      note: string, updatedBy: string,
      owner?: {userId: string, paxName?: string}): Promise<void> {
    const kept: {[metricId: string]: number} = {};
    for (const metricId of Object.keys(values)) {
      if (values[metricId] > 0) kept[metricId] = values[metricId];
    }
    const changes: {[field: string]: unknown} = {
      date,
      values: kept,
      note: note.trim() ? note.trim() :
                          firebase.firestore.FieldValue.delete(),
      updatedBy,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    // the creator may hand a check-in to the PAX it was really for
    if (owner) {
      changes['userId'] = owner.userId;
      changes['paxName'] = owner.paxName ??
          firebase.firestore.FieldValue.delete();
    }
    await this.firestore.collection(this.LOGS_COLLECTION).doc(id).update(
        changes);
  }

  /** Remove a check-in posted by mistake. */
  async deleteCheckIn(id: string): Promise<void> {
    await this.firestore.collection(this.LOGS_COLLECTION).doc(id).delete();
  }

  /**
   * Each PAX's score on every custom metric: the sum of what he checked in
   * for a 'total' metric, the number of distinct days he checked in for a
   * 'days' metric, 1 for a 'done' metric he has checked in at all. Days
   * outside the challenge and metrics since removed are ignored.
   * @returns Lowercased user id to (metric id to score)
   */
  customMetricTotals(challenge: Challenge, logs: ChallengeLog[]):
      Map<string, {[metricId: string]: number}> {
    const metrics: ChallengeCustomMetric[] = challenge.customMetrics ?? [];
    const totals = new Map<string, {[metricId: string]: number}>();
    const daysSeen = new Set<string>();

    for (const log of logs) {
      if (log.date < challenge.startDate || log.date > challenge.endDate) {
        continue;
      }
      const user = log.userId.toLowerCase();
      for (const metric of metrics) {
        const value = log.values?.[metric.id];
        if (!(value > 0)) continue;
        const scores = totals.get(user) ?? {};
        totals.set(user, scores);
        if (metric.type === 'done') {
          scores[metric.id] = 1;
        } else if (metric.type === 'days') {
          const day = `${user}|${metric.id}|${log.date}`;
          if (daysSeen.has(day)) continue;
          daysSeen.add(day);
          scores[metric.id] = (scores[metric.id] ?? 0) + 1;
        } else {
          // keep float sums like 3.1 + 3.1 from showing as 6.199999
          scores[metric.id] =
              Math.round(((scores[metric.id] ?? 0) + value) * 100) / 100;
        }
      }
    }
    return totals;
  }

  /** Display names for every metric a challenge tracks, in column order. */
  metricColumns(challenge: Challenge):
      Array<{key: string; label: string; goal?: number; custom: boolean}> {
    const columns:
        Array<{key: string; label: string; goal?: number; custom: boolean}> =
            [];
    const builtIn: Array<['bds'|'uniqueAos'|'qs'|'doubleDowns', string]> = [
      ['bds', '# of BDs'],
      ['uniqueAos', '# of AOs'],
      ['qs', '# of Qs'],
      ['doubleDowns', '# of DDs'],
    ];
    for (const [key, label] of builtIn) {
      if (challenge.metrics?.[key]) {
        columns.push(
            {key, label, goal: challenge.goals?.[key], custom: false});
      }
    }
    for (const metric of challenge.customMetrics ?? []) {
      columns.push({
        key: metric.id,
        label: metric.name,
        // a yes/no is complete the moment it's done
        goal: metric.type === 'done' ? 1 : metric.goal,
        custom: true,
      });
    }
    return columns;
  }
}
