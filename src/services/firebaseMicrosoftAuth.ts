import {
  browserLocalPersistence,
  OAuthProvider,
  setPersistence,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import { isOrbiDocNativeRuntime } from '../lib/nativeRuntime';
import { auth, type OrbiDocAuthUser } from './firebase';

const microsoftProvider = () => {
  const provider = new OAuthProvider('microsoft.com');
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

export function getFriendlyMicrosoftAuthError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  const messages: Record<string, string> = {
    'auth/operation-not-allowed': 'O login Microsoft ainda não foi habilitado no Firebase Authentication deste projeto.',
    'auth/unauthorized-domain': 'O domínio atual do OrbiDoc não está autorizado para login Microsoft.',
    'auth/popup-blocked': 'O navegador bloqueou a janela da Microsoft. Permita pop-ups para o OrbiDoc e tente novamente.',
    'auth/popup-closed-by-user': 'A janela da Microsoft foi fechada antes da autenticação terminar.',
    'auth/cancelled-popup-request': 'Outra tentativa de autenticação já estava em andamento.',
    'auth/account-exists-with-different-credential': 'Já existe uma conta com este e-mail usando outro método. Entre pelo método original antes de vincular a Microsoft.',
    'auth/network-request-failed': 'Não foi possível acessar Microsoft/Firebase. Verifique a conexão.',
    'auth/too-many-requests': 'Muitas tentativas de autenticação em pouco tempo. Aguarde alguns minutos e tente novamente.',
  };
  return messages[code] || (error instanceof Error ? error.message : 'Não foi possível entrar com Microsoft.');
}

export function isCurrentOrbiDocMicrosoftUser() {
  return Boolean(auth.currentUser?.providerData.some((provider) => provider.providerId === 'microsoft.com'));
}

/**
 * Web/PWA Microsoft sign-in foundation. Firebase still requires the provider to be enabled
 * with the Microsoft Client ID/Secret and redirect domain in both consoles before this is exposed in UI.
 */
export async function signInOrbiDocWithMicrosoft(): Promise<OrbiDocAuthUser> {
  if (isOrbiDocNativeRuntime()) {
    throw new Error('O login Microsoft nativo será liberado após registrar o fluxo OAuth do Android. Use Web/PWA ou e-mail/senha neste build.');
  }
  try {
    await setPersistence(auth, browserLocalPersistence);
    const credential = await signInWithPopup(auth, microsoftProvider());
    return mapAuthUser(credential.user);
  } catch (error) {
    throw new Error(getFriendlyMicrosoftAuthError(error));
  }
}
