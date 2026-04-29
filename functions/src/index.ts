import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";

admin.initializeApp();

const PENDING_ROLES_COLLECTION = "pendingRoleAssignments";
const USER_PROFILES_COLLECTION = "userProfiles";

/**
 * On first sign-in, check whether a pending role assignment exists for this
 * user's email and merge it into their userProfiles document.
 *
 * This enables email-first provisioning: admins/nantans can assign roles to a
 * Pax before they have ever signed into the app.
 */
export const mergePendingRoles = functionsV1.auth.user().onCreate(
  async (user) => {
    const email = user.email?.toLowerCase().trim();
    if (!email) return;

    const db = admin.firestore();
    const pendingRef = db.collection(PENDING_ROLES_COLLECTION).doc(email);
    const pendingSnap = await pendingRef.get();

    if (!pendingSnap.exists) return;

    const pendingData = pendingSnap.data();
    if (!pendingData) return;

    const rawPending = pendingData["roles"];
    const pendingRoles: string[] =
      Array.isArray(rawPending) ? [...rawPending] : [];

    if (pendingRoles.length === 0) {
      await pendingRef.delete();
      return;
    }

    const profileRef =
      db.collection(USER_PROFILES_COLLECTION).doc(user.uid);
    const profileSnap = await profileRef.get();
    const profileData = profileSnap.data();
    const rawExisting = profileData?.["roles"];
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
      `Merged pending roles for ${email} into uid ${user.uid}`,
      {roles: merged});
  });
