/**
 * Hard-coded privileged identities until Firestore `userProfiles/{uid}` roles apply.
 * Keep in sync when onboarding new admins.
 */

/** Source list for {@link ADMIN_BOOTSTRAP_EMAILS} (legacy name). */
export const PRIVILEGED_MAP_ACCESS_EMAILS = new Set<string>([
  'taylor.matt777@gmail.com',
]);

/** Can open /admin and edit any user’s roles before role data exists in Firestore. */
export const ADMIN_BOOTSTRAP_EMAILS = new Set<string>(
    Array.from(PRIVILEGED_MAP_ACCESS_EMAILS));

export function emailIsAdminBootstrap(email: string|null|undefined): boolean {
  const e = email?.trim()?.toLowerCase();
  if (!e) return false;
  return [...ADMIN_BOOTSTRAP_EMAILS].some(
      s => s.trim().toLowerCase() === e);
}
