export interface FirebaseIdentity {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  isOwner: boolean;
}

// Accept only claims from an ID token already verified by the Admin SDK.
// Request-body identity and a previous user's cookie must never grant roles.
export function getFirebaseIdentity(claims: any, ownerEmail: string): FirebaseIdentity | null {
  if (typeof claims?.uid !== 'string' || !claims.uid.trim() ||
      typeof claims.email !== 'string' || !claims.email.trim() ||
      claims.firebase?.sign_in_provider === 'anonymous') {
    return null;
  }
  const email = claims.email.trim().toLowerCase();
  const emailVerified = claims.email_verified === true;
  return {
    uid: claims.uid,
    email,
    displayName: typeof claims.name === 'string' ? claims.name : '',
    emailVerified,
    isOwner: emailVerified && email === ownerEmail.toLowerCase(),
  };
}

// Invalidate legacy JWTs, including anonymous sessions minted by the old body
// email fallback. New sessions always carry an explicit verified-email boolean.
export function hasTrustedSessionRoles(claims: any, ownerEmail: string): boolean {
  if (typeof claims?.emailVerified !== 'boolean') return false;
  if (!claims?.isOwner && !claims?.isAdmin) return true;
  return claims.emailVerified === true &&
    typeof claims.email === 'string' &&
    claims.email.toLowerCase() === ownerEmail.toLowerCase();
}
