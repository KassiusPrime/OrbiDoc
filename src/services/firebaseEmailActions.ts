import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { auth, getFriendlyAuthError } from './firebase';

export type OrbiDocEmailActionMode = 'verifyEmail' | 'resetPassword' | 'recoverEmail';

export interface OrbiDocEmailActionRequest {
  mode: OrbiDocEmailActionMode;
  oobCode: string;
  continueUrl?: string;
  lang?: string;
}

export interface OrbiDocEmailActionPreview {
  mode: OrbiDocEmailActionMode;
  email?: string;
  previousEmail?: string;
}

const supportedModes = new Set<OrbiDocEmailActionMode>(['verifyEmail', 'resetPassword', 'recoverEmail']);

export function parseOrbiDocEmailAction(search = window.location.search): OrbiDocEmailActionRequest {
  const params = new URLSearchParams(search);
  const mode = String(params.get('mode') || '') as OrbiDocEmailActionMode;
  const oobCode = String(params.get('oobCode') || '').trim();
  const continueUrl = params.get('continueUrl') || undefined;
  const lang = params.get('lang') || undefined;

  if (!supportedModes.has(mode)) throw new Error('Este link de autenticação não contém uma ação compatível com o OrbiDoc.');
  if (!oobCode) throw new Error('O código de autenticação não foi encontrado no link. Solicite um novo e-mail e tente novamente.');
  return { mode, oobCode, continueUrl, lang };
}

export function safeOrbiDocContinueUrl(raw?: string) {
  if (!raw) return `${window.location.origin}/`;
  try {
    const target = new URL(raw, window.location.origin);
    if (target.origin !== window.location.origin) return `${window.location.origin}/`;
    return target.toString();
  } catch {
    return `${window.location.origin}/`;
  }
}

export async function previewOrbiDocEmailAction(request: OrbiDocEmailActionRequest): Promise<OrbiDocEmailActionPreview> {
  try {
    if (request.lang) auth.languageCode = request.lang;
    if (request.mode === 'resetPassword') {
      const email = await verifyPasswordResetCode(auth, request.oobCode);
      return { mode: request.mode, email };
    }

    const info = await checkActionCode(auth, request.oobCode);
    return {
      mode: request.mode,
      email: info.data.email ?? undefined,
      previousEmail: 'previousEmail' in info.data ? String(info.data.previousEmail || '') || undefined : undefined,
    };
  } catch (error) {
    throw new Error(getFriendlyEmailActionError(error));
  }
}

export async function completeOrbiDocEmailAction(request: OrbiDocEmailActionRequest, newPassword?: string) {
  try {
    if (request.lang) auth.languageCode = request.lang;
    if (request.mode === 'resetPassword') {
      const password = String(newPassword || '');
      if (password.length < 8) throw new Error('A nova senha precisa ter pelo menos 8 caracteres.');
      await confirmPasswordReset(auth, request.oobCode, password);
      return;
    }

    await applyActionCode(auth, request.oobCode);
    if (auth.currentUser) await auth.currentUser.reload().catch(() => undefined);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('A nova senha')) throw error;
    throw new Error(getFriendlyEmailActionError(error));
  }
}

export function getFriendlyEmailActionError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  const messages: Record<string, string> = {
    'auth/expired-action-code': 'Este link expirou. Volte ao OrbiDoc e solicite um novo e-mail.',
    'auth/invalid-action-code': 'Este link é inválido ou já foi utilizado. Solicite um novo e-mail no OrbiDoc.',
    'auth/user-disabled': 'Esta conta foi desativada.',
    'auth/user-not-found': 'A conta associada a este link não foi encontrada.',
    'auth/weak-password': 'A nova senha não atende à política de segurança configurada no Firebase.',
    'auth/network-request-failed': 'Não foi possível acessar o Firebase. Verifique a conexão e tente novamente.',
  };
  return messages[code] || getFriendlyAuthError(error);
}
