import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  OAuthCredential
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
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';
import { GoogleUserProfile } from '../types';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfigJson) : getApp();

// Initialize Auth & Firestore with custom database ID
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

export const db = firebaseConfigJson.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfigJson.firestoreDatabaseId) 
  : getFirestore(app);

/**
 * Sign in using Firebase Google Auth popup
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
      picture: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'Google')}&background=4f46e5&color=fff`,
      accessToken: accessToken || 'firebase_token_' + user.uid,
      expiresAt: Date.now() + 86400 * 30 * 1000,
    };

    // Store user session profile in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastLogin: serverTimestamp(),
    }, { merge: true });

    return { profile, credentialAccessToken: accessToken };
  } catch (err: any) {
    console.error('Firebase Google Login Error:', err);
    throw new Error(err.message || 'Erro ao realizar login Google com Firebase.');
  }
}

/**
 * Sign out from Firebase
 */
export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

/**
 * Listen to Auth State changes
 */
export function onFirebaseAuthStateChanged(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Save user document/file to Firestore for Cloud Persistence
 */
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

/**
 * Sync / Load user documents from Firestore
 */
export async function getUserDocumentsFromFirestore(userEmail: string) {
  try {
    const q = query(collection(db, 'documents'), where('userEmail', '==', userEmail));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('Error fetching documents from Firestore:', e);
    return [];
  }
}

/**
 * Save user settings to Firestore
 */
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

/**
 * Get user settings from Firestore
 */
export async function getUserSettingsFromFirestore(userEmail: string) {
  try {
    const docRef = doc(db, 'user_settings', userEmail);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (e) {
    console.warn('Error getting user settings:', e);
  }
  return null;
}
