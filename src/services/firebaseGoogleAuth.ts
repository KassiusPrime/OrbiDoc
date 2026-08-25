import {
  browserLocalPersistence,
  deleteUser,
  GoogleAuthProvider,
  reauthenticateWithPopup,
  setPersistence,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import { isOrbiDocNativeRuntime } from '../lib/nativeRuntime';
import { auth, db, type OrbiDocAuthUser } from './firebase';

const googleProvider = () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
};

const mapAuthUser = (user: User): OrbiDocAuthUser => ({
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
  photoURL: user.photoURL,
  emailVerified: user.emailVerified,
  isAnonymous: user.isAnonymous,
});

function authCode(error: unknown) {
  return typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
}

export function getFriendlyGoogleAuthError(error: unknown): string {
  const code = authCode(error);
  const messages: Record<string, string> = {
    'auth/operation-not-allowed': 'O login com Google ainda não foi habilitado no Firebase Authentication deste projeto.',
    'auth/unauthorized-domain': 'O domínio atual do OrbiDoc não está autorizado para login com Google no Firebase.',
    'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Permita pop-ups para o OrbiDoc e tente novamente.',
    'auth/popup-closed-by-user': 'A janela de login do Google foi fechada antes da autenticação terminar.',
    'auth/cancelled-popup-request': 'Outra tentativa de login com Google já estava em andamento.',
    'auth/account-exists-with-different-credential': 'Já existe uma conta com este e-mail usando outro método. Entre com o método original e vincule o Google depois.',
    'auth/network-request-failed': 'Não foi possível acessar o Google/Firebase. Verifique sua conexão e tente novamente.',
    'auth/too-many-requests': 'Muitas tentativas de autenticação em pouco tempo. Aguarde alguns minutos e tente novamente.',
  };
  return messages[code] || (error instanceof Error ? error.message : 'Não foi possível entrar com Google.');
}

export function isCurrentOrbiDocGoogleUser() {
  return Boolean(auth.currentUser?.providerData.some((provider) => provider.providerId === 'google.com'));
}

/**
 * Authenticates the OrbiDoc Firebase identity with Google only.
 * This intentionally requests no Google Drive scope; Drive remains a separate optional connection.
 */
export async function signInOrbiDocWithGoogle(): Promise<OrbiDocAuthUser> {
  if (isOrbiDocNativeRuntime()) {
    throw new Error('O login Google nativo no APK exige registrar o app Android e a impressão SHA no Firebase. Use e-mail/senha no APK por enquanto; Google já funciona na Web/PWA.');
  }

  try {
    await setPersistence(auth, browserLocalPersistence);
    const credential = await signInWithPopup(auth, googleProvider());
    return mapAuthUser(credential.user);
  } catch (error) {
    throw new Error(getFriendlyGoogleAuthError(error));
  }
}

async function ownedReferences(collectionName: string, uid: string, email: string): Promise<DocumentReference[]> {
  const references = new Map<string, DocumentReference>();
  const current = await getDocs(query(collection(db, collectionName), where('userId', '==', uid)));
  current.docs.forEach((snapshot) => references.set(snapshot.ref.path, snapshot.ref));

  const legacy = await getDocs(query(collection(db, collectionName), where('userEmail', '==', email)));
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

/** Reauthenticates a Google-only OrbiDoc account and removes its cloud records before deleting Firebase Auth. */
export async function deleteOrbiDocGoogleAccountAndCloudData() {
  const user = auth.currentUser;
  if (!user || user.isAnonymous || !user.email) throw new Error('Entre novamente com Google para excluir a conta OrbiDoc.');
  if (!isCurrentOrbiDocGoogleUser()) throw new Error('Esta conta não usa Google como método de autenticação.');
  if (isOrbiDocNativeRuntime()) throw new Error('Reautenticação Google nativa ainda depende da configuração Android do Firebase.');

  try {
    await reauthenticateWithPopup(user, googleProvider());

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
    throw new Error(getFriendlyGoogleAuthError(error));
  }
}
