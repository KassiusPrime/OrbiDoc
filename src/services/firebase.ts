import { initializeApp, getApps, getApp } from 'firebase/app';
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
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Get Firestore instance with custom database ID if specified in config
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

/**
 * Save or update a document in Firestore
 */
export async function saveDocumentToFirestore(documentData: FirestoreDocument): Promise<boolean> {
  try {
    const docRef = doc(db, 'documents', documentData.id);
    await setDoc(docRef, {
      ...documentData,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('Firestore saveDocument error:', err);
    return false;
  }
}

/**
 * Load documents from Firestore for a specific user
 */
export async function loadDocumentsFromFirestore(userEmail?: string): Promise<FirestoreDocument[]> {
  try {
    const docsRef = collection(db, 'documents');
    let q = query(docsRef);
    if (userEmail) {
      q = query(docsRef, where('userEmail', '==', userEmail));
    }
    const querySnapshot = await getDocs(q);
    const results: FirestoreDocument[] = [];
    querySnapshot.forEach((docSnap) => {
      results.push({ id: docSnap.id, ...docSnap.data() } as FirestoreDocument);
    });
    return results;
  } catch (err) {
    console.warn('Firestore loadDocuments error:', err);
    return [];
  }
}

/**
 * Delete a document from Firestore
 */
export async function deleteDocumentFromFirestore(docId: string): Promise<boolean> {
  try {
    const docRef = doc(db, 'documents', docId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn('Firestore deleteDocument error:', err);
    return false;
  }
}

/**
 * Save user theme & auto-save settings to Firestore
 */
export async function saveUserSettingsToFirestore(settings: FirestoreUserSettings): Promise<boolean> {
  try {
    const settingKey = settings.userEmail ? settings.userEmail.replace(/[^a-zA-Z0-9]/g, '_') : 'default_user';
    const docRef = doc(db, 'user_settings', settingKey);
    await setDoc(docRef, {
      ...settings,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('Firestore saveUserSettings error:', err);
    return false;
  }
}

/**
 * Load user settings from Firestore
 */
export async function loadUserSettingsFromFirestore(userEmail?: string): Promise<FirestoreUserSettings | null> {
  try {
    const settingKey = userEmail ? userEmail.replace(/[^a-zA-Z0-9]/g, '_') : 'default_user';
    const docRef = doc(db, 'user_settings', settingKey);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as FirestoreUserSettings;
    }
    return null;
  } catch (err) {
    console.warn('Firestore loadUserSettings error:', err);
    return null;
  }
}

/**
 * Realtime listener for documents
 */
export function subscribeToDocuments(
  userEmail: string | undefined,
  callback: (docs: FirestoreDocument[]) => void
) {
  try {
    const docsRef = collection(db, 'documents');
    const q = userEmail ? query(docsRef, where('userEmail', '==', userEmail)) : query(docsRef);
    return onSnapshot(q, (snapshot) => {
      const items: FirestoreDocument[] = [];
      snapshot.forEach((d) => items.push({ id: d.id, ...d.data() } as FirestoreDocument));
      callback(items);
    }, (error) => {
      console.warn('Firestore documents subscription error:', error);
    });
  } catch (e) {
    console.warn('Firestore subscription failed:', e);
    return () => {};
  }
}
