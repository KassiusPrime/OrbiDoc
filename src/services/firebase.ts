import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
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
  onSnapshot,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const clientConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
};

const firestoreDatabaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId;
const app = !getApps().length ? initializeApp(clientConfig) : getApp();
export const auth = getAuth(app);
auth.languageCode = 'pt-BR';

let persistencePromise: Promise<void> | null = null;
const ensurePersistence = () => {
  if (!persistencePromise) persistencePromise = setPersistence(auth, browserLocalPersistence).catch(() => undefined);
  return persistencePromise;
};

export const db = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);

export interface OrbiDocAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
}

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

const mapAuthUser = (user: User | null): OrbiDocAuthUser | null => user ? {
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
  photoURL: user.photoURL,
  emailVerified: user.emailVerified,
  isAnonymous: user.isAnonymous,
} : null;

export const isOrbiDocAuthConfigured = () => Boolean(clientConfig.apiKey && clientConfig.authDomain && clientConfig.projectId && clientConfig.appId);

export const getCurrentOrbiDocUser = () => mapAuthUser(auth.currentUser);

export const subscribeToOrbiDocAuth = (callback: (user: OrbiDocAuthUser | null) => void) => {
  if (!isOrbiDocAuthConfigured()) {
    callback(null);
    return () => {};
  }
  void ensurePersistence();
  return onAuthStateChanged(auth, (user) => callback(mapAuthUser(user)));
};

export function getFriendlyAuthError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code || '') : '';
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'Este e-mail já possui uma conta OrbiDoc.',
    'auth/invalid-email': 'Digite um endereço de e-mail válido.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/user-disabled': 'Esta conta foi desativada.',
    'auth/user-not-found': 'Conta não encontrada.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/weak-password': 'Use uma senha mais forte.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    'auth/network-request-failed': 'Não foi possível acessar o serviço de autenticação. Verifique sua conexão.',
    'auth/operation-not-allowed': 'O login por e-mail ainda não foi habilitado no Firebase deste projeto.',
    'auth/admin-restricted-operation': 'Este método de login não está habilitado no Firebase deste projeto.',
    'auth/requires-recent-login': 'Por segurança, entre novamente na conta antes de excluí-la.',
  };
  return messages[code] || (error instanceof Error ? error.message : 'Não foi possível concluir a autenticação.');
}

export async function createOrbiDocAccount(name: string, email: string, password: string): Promise<OrbiDocAuthUser> {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (cleanName.length < 2) throw new Error('Informe seu nome com pelo menos 2 caracteres.');
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) throw new Error('Digite um endereço de e-mail válido.');
  if (password.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
  await ensurePersistence();
  try {
    const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    await updateProfile(credential.user, { displayName: cleanName });
    await sendEmailVerification(credential.user).catch(() => undefined);
    return mapAuthUser(auth.currentUser)!;
  } catch (error) {
    throw new Error(getFriendlyAuthError(error));
  }
}

export async function signInOrbiDocAccount(email: string, password: string): Promise<OrbiDocAuthUser> {
  await ensurePersistence();
  try {
    const credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    return mapAuthUser(credential.user)!;
  } catch (error) {
    throw new Error(getFriendlyAuthError(error));
  }
}

export async function signInOrbiDocGuest(): Promise<OrbiDocAuthUser> {
  await ensurePersistence();
  try {
    const credential = await signInAnonymously(auth);
    return mapAuthUser(credential.user)!;
  } catch (error) {
    throw new Error(getFriendlyAuthError(error));
  }
}

export async function signOutOrbiDocAccount() {
  await signOut(auth);
}

export async function resetOrbiDocPassword(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) throw new Error('Digite seu e-mail para receber a recuperação de senha.');
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (error) {
    throw new Error(getFriendlyAuthError(error));
  }
}

export async function resendOrbiDocVerification() {
  if (!auth.currentUser || auth.currentUser.isAnonymous || !auth.currentUser.email) throw new Error('Entre em uma conta com e-mail para verificar o endereço.');
  if (auth.currentUser.emailVerified) return;
  try {
    await sendEmailVerification(auth.currentUser);
  } catch (error) {
    throw new Error(getFriendlyAuthError(error));
  }
}

function currentIdentity() {
  const user = auth.currentUser;
  if (!user?.uid || !user.email) return null;
  return { uid: user.uid, email: user.email };
}

async function ownedReferences(collectionName: string, uid: string, email: string): Promise<DocumentReference[]> {
  const references = new Map<string, DocumentReference>();
  const current = await getDocs(query(collection(db, collectionName), where('userId', '==', uid)));
  current.docs.forEach((snapshot) => references.set(snapshot.ref.path, snapshot.ref));

  const legacy = await getDocs(query(
    collection(db, collectionName),
    where('userEmail', '==', email),
    where('userId', '==', null),
  ));
  legacy.docs.forEach((snapshot) => references.set(snapshot.ref.path, snapshot.ref));
  return [...references.values()];
}

async function deleteReferences(references: DocumentReference[]) {
  for (let offset = 0; offset < references.length; offset += 400) {
    const batch = writeBatch(db);
    references.slice(offset, offset + 400).forEach((reference) => batch.delete(reference));
    await batch.commit();
  }
}

/**
 * Permanently removes the signed-in account and the cloud records currently created by OrbiDoc.
 * Local workspace files are intentionally left on the device so deleting an account never destroys
 * an unsynced document without an explicit local-data action from the user.
 */
export async function deleteOrbiDocAccountAndCloudData(password: string) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous || !user.email) throw new Error('Entre em uma conta OrbiDoc com e-mail para solicitar a exclusão.');
  if (!password) throw new Error('Digite sua senha para confirmar a exclusão permanente.');

  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));

    const [documents, chatSessions] = await Promise.all([
      ownedReferences('documents', user.uid, user.email),
      ownedReferences('chat_sessions', user.uid, user.email),
    ]);
    await deleteReferences([...documents, ...chatSessions]);

    const profileRef = doc(db, 'users', user.uid);
    const settingsRef = doc(db, 'user_settings', user.uid);
    const legacySettingsRef = doc(db, 'user_settings', user.email.replace(/[^a-zA-Z0-9]/g, '_'));
    const [profile, settings, legacySettings] = await Promise.all([
      getDoc(profileRef),
      getDoc(settingsRef),
      getDoc(legacySettingsRef),
    ]);

    const directDeletes: Promise<void>[] = [];
    if (profile.exists()) directDeletes.push(deleteDoc(profileRef));
    if (settings.exists()) directDeletes.push(deleteDoc(settingsRef));
    if (legacySettings.exists() && legacySettings.data().userEmail === user.email) directDeletes.push(deleteDoc(legacySettingsRef));
    await Promise.all(directDeletes);

    await deleteUser(user);
    return { deletedDocuments: documents.length, deletedChatSessions: chatSessions.length };
  } catch (error) {
    throw new Error(getFriendlyAuthError(error));
  }
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
    const ownsDocument = data.userId === identity.uid || (!data.userId && data.userEmail === identity.email);
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
  callback: (docs: FirestoreDocument[]) => void,
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
