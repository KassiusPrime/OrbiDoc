import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  OAuthCredential,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';
import { GoogleUserProfile } from '../types';
import { saveGoogleUser } from '../services/googleAuthDrive';

const app = !getApps().length ? initializeApp(firebaseConfigJson) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export const db = firebaseConfigJson.firestoreDatabaseId
  ? getFirestore(app, firebaseConfigJson.firestoreDatabaseId)
  : getFirestore(app);

/**
 * Sign in with Firebase Google Auth and keep the real Google OAuth credential
 * available to Drive features. No fabricated access token is created.
 */
export async function signInWithGoogleFirebase(): Promise<{ profile: GoogleUserProfile; credentialAccessToken?: string }> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const credential = GoogleAuthProvider.credentialFromResult(result) as OAuthCredential | null;
    const accessToken = credential?.accessToken || '';

    const profile: GoogleUserProfile = {
      id: user.uid,
      name: user.displayName || user.email?.split('@')[0] || 'Usuário Google',
      email: user.email || '',
      picture: user.photoURL || undefined,
      accessToken,
      // Google OAuth access tokens are short lived. Use a conservative window so
      // stale credentials are never treated as valid Drive sessions.
      expiresAt: Date.now() + 55 * 60 * 1000,
    };

    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastLogin: serverTimestamp(),
    }, { merge: true });

    if (accessToken && profile.email) {
      saveGoogleUser(profile);
    }

    return { profile, credentialAccessToken: accessToken || undefined };
  } catch (err: any) {
    console.error('Firebase Google Login Error:', err);
    throw new Error(err?.message || 'Erro ao realizar login Google com Firebase.');
  }
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export function onFirebaseAuthStateChanged(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function saveUserDocumentToFirestore(userId: string, userEmail: string, documentData: any) {
  try {
    const docRef = doc(collection(db, 'documents'));
    const payload = {
      ...documentData,
      userId,
      userEmail,
      updatedAt: new Date().toISOString(),
      createdAt: documentData.createdAt || new Date().toISOString(),
    };
    await setDoc(docRef, payload, { merge: true });
    return docRef.id;
  } catch (e) {
    console.warn('Error saving document to Firestore:', e);
  }
}

export async function getUserDocumentsFromFirestore(userEmail: string) {
  try {
    const q = query(collection(db, 'documents'), where('userEmail', '==', userEmail));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
  } catch (e) {
    console.warn('Error fetching documents from Firestore:', e);
    return [];
  }
}

export async function saveUserSettingsToFirestore(userEmail: string, settings: any) {
  try {
    const docRef = doc(db, 'user_settings', userEmail);
    await setDoc(docRef, {
      userEmail,
      ...settings,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (e) {
    console.warn('Error saving user settings:', e);
  }
}

export async function getUserSettingsFromFirestore(userEmail: string) {
  try {
    const docRef = doc(db, 'user_settings', userEmail);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn('Error getting user settings:', e);
    return null;
  }
}
