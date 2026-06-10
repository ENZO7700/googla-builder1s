import { FirebaseError } from 'firebase/app';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { firebaseAuth, googleProvider, missingFirebaseEnvVars } from './client';

const firebaseErrorMessages: Record<string, string> = {
  'auth/popup-blocked': 'Google prihlasovacie okno bolo zablokované prehliadačom.',
  'auth/popup-closed-by-user': 'Google prihlásenie bolo zatvorené pred dokončením.',
  'auth/unauthorized-domain': 'Táto doména nie je povolená vo Firebase Authentication. Pridajte localhost a 127.0.0.1 medzi Authorized domains.',
  'auth/operation-not-allowed': 'Google provider nie je povolený vo Firebase Authentication.',
  'auth/invalid-api-key': 'Firebase API key je neplatný alebo chýba.',
};

function toFirebaseAuthError(error: unknown): Error {
  if (error instanceof FirebaseError) {
    return new Error(firebaseErrorMessages[error.code] ?? error.message);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error('Google prihlásenie zlyhalo.');
}

function assertFirebaseConfig() {
  if (missingFirebaseEnvVars.length > 0) {
    throw new Error(`Chýba Firebase konfigurácia: ${missingFirebaseEnvVars.join(', ')}`);
  }

  if (!firebaseAuth) {
    throw new Error('Firebase Authentication nie je inicializovaný.');
  }
}

function shouldUseRedirectFallback(error: unknown) {
  return error instanceof FirebaseError && (
    error.code === 'auth/popup-blocked'
    || error.code === 'auth/cancelled-popup-request'
    || error.code === 'auth/operation-not-supported-in-this-environment'
  );
}

export async function signInWithGoogle(): Promise<User | null> {
  assertFirebaseConfig();

  try {
    if (!firebaseAuth) {
      throw new Error('Firebase Authentication nie je inicializovaný.');
    }

    const credential = await signInWithPopup(firebaseAuth, googleProvider);
    return credential.user;
  } catch (error) {
    if (shouldUseRedirectFallback(error)) {
      if (!firebaseAuth) {
        throw new Error('Firebase Authentication nie je inicializovaný.');
      }

      await signInWithRedirect(firebaseAuth, googleProvider);
      return null;
    }

    throw toFirebaseAuthError(error);
  }
}

export async function getGoogleRedirectResult(): Promise<User | null> {
  assertFirebaseConfig();

  try {
    if (!firebaseAuth) {
      throw new Error('Firebase Authentication nie je inicializovaný.');
    }

    const credential = await getRedirectResult(firebaseAuth);
    return credential?.user ?? null;
  } catch (error) {
    throw toFirebaseAuthError(error);
  }
}

export async function signOutFirebase(): Promise<void> {
  if (missingFirebaseEnvVars.length > 0 || !firebaseAuth) {
    return;
  }

  await signOut(firebaseAuth);
}

export function subscribeToFirebaseAuth(callback: (user: User | null) => void) {
  if (missingFirebaseEnvVars.length > 0 || !firebaseAuth) {
    callback(null);
    return () => undefined;
  }

  return onAuthStateChanged(firebaseAuth, callback);
}

export async function getFirebaseIdToken(): Promise<string | null> {
  if (missingFirebaseEnvVars.length > 0 || !firebaseAuth) {
    return null;
  }

  const user = firebaseAuth.currentUser;
  return user ? user.getIdToken() : null;
}
