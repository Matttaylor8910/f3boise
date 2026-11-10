import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";

admin.initializeApp();

const PENDING_ROLES_COLLECTION = "pendingRoleAssignments";
const USER_PROFILES_COLLECTION = "userProfiles";

/**
 * Move the roles waiting under this email onto the user's profile and
 * consume the pending doc. Does nothing when nothing is pending.
 *
 * Only ever call this for a user whose email is verified: accounts are made
 * with the email the public roster has on file, so until the owner clicks
 * the confirmation link anyone could hold an account under a Nantan's email.
 * @param {string} uid The user's uid
 * @param {string} email The user's verified email
 * @return {Promise<string[]|null>} The merged roles, or null if none pending
 */
async function mergePendingRolesInto(
  uid: string, email: string): Promise<string[] | null> {
  const db = admin.firestore();
  const pendingRef =
    db.collection(PENDING_ROLES_COLLECTION).doc(email.toLowerCase().trim());
  const pendingSnap = await pendingRef.get();
  if (!pendingSnap.exists) return null;

  const pendingData = pendingSnap.data();
  const rawPending = pendingData?.["roles"];
  const pendingRoles: string[] =
    Array.isArray(rawPending) ? [...rawPending] : [];

  if (pendingRoles.length === 0) {
    await pendingRef.delete();
    return null;
  }

  const profileRef = db.collection(USER_PROFILES_COLLECTION).doc(uid);
  const profileSnap = await profileRef.get();
  const rawExisting = profileSnap.data()?.["roles"];
  const existingRoles: string[] =
    Array.isArray(rawExisting) ? [...rawExisting] : [];

  // Merge: union + dedupe + sort
  const merged =
    [...new Set([...existingRoles, ...pendingRoles])].sort(
      (a, b) => a.localeCompare(b));

  await profileRef.set(
    {
      roles: merged,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {merge: true},
  );

  // Delete the consumed pending doc
  await pendingRef.delete();

  functionsV1.logger.info(
    `Merged pending roles for ${email} into uid ${uid}`,
    {roles: merged});
  return merged;
}

/**
 * On first sign-in, check whether a pending role assignment exists for this
 * user's email and merge it into their userProfiles document.
 *
 * This enables email-first provisioning: admins/nantans can assign roles to a
 * Pax before they have ever signed into the app.
 *
 * Email-link sign-ins arrive already verified. A password sign-up does not,
 * so its roles wait until the app calls claimPendingRoles after the owner
 * confirms the email.
 */
export const mergePendingRoles = functionsV1.auth.user().onCreate(
  async (user) => {
    const email = user.email?.toLowerCase().trim();
    if (!email) return;
    if (!user.emailVerified) {
      functionsV1.logger.info(
        `Leaving pending roles for ${email} until the email is verified`);
      return;
    }
    await mergePendingRolesInto(user.uid, email);
  });

/**
 * Called by the app once a password account's email has been confirmed:
 * hands over any roles that were waiting for it. Idempotent.
 */
export const claimPendingRoles = functionsV1.https.onCall(
  async (_data, context) => {
    const auth = context.auth;
    if (!auth) {
      throw new functionsV1.https.HttpsError(
        "unauthenticated", "Sign in first.");
    }
    const email = auth.token.email?.toLowerCase().trim();
    if (!email || auth.token.email_verified !== true) {
      throw new functionsV1.https.HttpsError(
        "failed-precondition", "Confirm your email first.");
    }
    const roles = await mergePendingRolesInto(auth.uid, email);
    return {roles: roles ?? []};
  });
