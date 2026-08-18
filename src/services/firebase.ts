import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  deleteDoc,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export interface FirestoreDocument {
  id: string;
  title: string;
  content: string;
  docType: string;
  userEmail?: string;
  userId?: string;
  theme?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreUserSettings {
  userEmail: string;
  themeMode: string;
  themePreset: string;
  accentColor: string;
  fontFamily: string;
  fontSize: string;
  autoSaveEnabled: boolean;
  autoSaveDelayMs: number;
  updatedAt: string;
}

function currentIdentity() {
  const user = auth.currentUser;
  if (!user?.uid || !user.email) return null;
  return { uid: user.uid, email: user.email };
}

/** Save to cloud only for a real authenticated Firebase user. Local-first callers can treat false as "not synced". */
export async function saveDocumentToFirestore(documentData: FirestoreDocument): Promise<boolean> {
  const identity = currentIdentity();
  if (!identity) return false;

  try {
    const docRef = doc(db, 'documents', documentData.id);
    await setDoc(docRef, {
      ...documentData,
      userId: identity.uid,
      userEmail: identity.email,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('Firestore saveDocument error:', err);
    return false;
  }
}

/** Load only the authenticated user's documents. The email argument is retained for API compatibility but ignored. */
export async function loadDocumentsFromFirestore(_userEmail?: string): Promise<FirestoreDocument[]> {
  const identity = currentIdentity();
  if (!identity) return [];

  try {
    const docsRef = collection(db, 'documents');
    const q = query(docsRef, where('userId', '==', identity.uid));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    } as FirestoreDocument));
  } catch (err) {
    console.warn('Firestore loadDocuments error:', err);
    return [];
  }
}

export async function deleteDocumentFromFirestore(docId: string): Promise<boolean> {
  const identity = currentIdentity();
  if (!identity) return false;

  try {
    const docRef = doc(db, 'documents', docId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return true;

    const data = snapshot.data();
    const ownsDocument = data.userId === identity.uid
      || (!data.userId && data.userEmail === identity.email);
    if (!ownsDocument) return false;

    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn('Firestore deleteDocument error:', err);
    return false;
  }
}

export async function saveUserSettingsToFirestore(settings: FirestoreUserSettings): Promise<boolean> {
  const identity = currentIdentity();
  if (!identity) return false;

  try {
    const docRef = doc(db, 'user_settings', identity.uid);
    await setDoc(docRef, {
      ...settings,
      userEmail: identity.email,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('Firestore saveUserSettings error:', err);
    return false;
  }
}

export async function loadUserSettingsFromFirestore(_userEmail?: string): Promise<FirestoreUserSettings | null> {
  const identity = currentIdentity();
  if (!identity) return null;

  try {
    const currentRef = doc(db, 'user_settings', identity.uid);
    const currentSnap = await getDoc(currentRef);
    if (currentSnap.exists()) return currentSnap.data() as FirestoreUserSettings;

    // Read-only compatibility with the previous email-derived settings ID.
    const legacyKey = identity.email.replace(/[^a-zA-Z0-9]/g, '_');
    const legacySnap = await getDoc(doc(db, 'user_settings', legacyKey));
    return legacySnap.exists() ? legacySnap.data() as FirestoreUserSettings : null;
  } catch (err) {
    console.warn('Firestore loadUserSettings error:', err);
    return null;
  }
}

export function subscribeToDocuments(
  _userEmail: string | undefined,
  callback: (docs: FirestoreDocument[]) => void
) {
  const identity = currentIdentity();
  if (!identity) {
    callback([]);
    return () => {};
  }

  try {
    const docsRef = collection(db, 'documents');
    const q = query(docsRef, where('userId', '==', identity.uid));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreDocument)));
    }, (error) => {
      console.warn('Firestore documents subscription error:', error);
    });
  } catch (e) {
    console.warn('Firestore subscription failed:', e);
    return () => {};
  }
}
