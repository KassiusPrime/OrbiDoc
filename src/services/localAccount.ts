import type { OrbiDocAuthUser } from './firebase';

const ACCOUNT_KEY = 'orbidoc_local_account_v1';
const SESSION_KEY = 'orbidoc_local_account_session_v1';
const EVENT = 'orbidoc:local-account';
const ITERATIONS = 310_000;

type LocalAccountRecord = {
  uid: string;
  email: string;
  displayName: string;
  salt: string;
  passwordHash: string;
  iterations: number;
  createdAt: string;
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

function readRecord(): LocalAccountRecord | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed?.uid || !parsed?.email || !parsed?.salt || !parsed?.passwordHash) return null;
    return parsed as LocalAccountRecord;
  } catch {
    return null;
  }
}

function toUser(record: LocalAccountRecord): OrbiDocAuthUser {
  return {
    uid: record.uid,
    email: record.email,
    displayName: record.displayName,
    photoURL: null,
    emailVerified: true,
    isAnonymous: false,
    source: 'local',
  };
}

function announce() {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: getCurrentLocalOrbiDocUser() }));
}

export function hasLocalOrbiDocAccount() {
  return Boolean(readRecord());
}

export function getCurrentLocalOrbiDocUser(): OrbiDocAuthUser | null {
  const record = readRecord();
  if (!record || localStorage.getItem(SESSION_KEY) !== record.uid) return null;
  return toUser(record);
}

export async function createLocalOrbiDocAccount(name: string, email: string, password: string) {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (cleanName.length < 2) throw new Error('Informe seu nome com pelo menos 2 caracteres.');
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) throw new Error('Digite um endereço de e-mail válido.');
  if (password.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
  if (readRecord()) throw new Error('Este aparelho já possui uma conta local OrbiDoc. Entre nela ou exclua-a antes de criar outra.');

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const record: LocalAccountRecord = {
    uid: `local-${crypto.randomUUID()}`,
    email: cleanEmail,
    displayName: cleanName,
    salt: bytesToBase64(salt),
    passwordHash: await derivePassword(password, salt, ITERATIONS),
    iterations: ITERATIONS,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(record));
  localStorage.setItem(SESSION_KEY, record.uid);
  announce();
  return toUser(record);
}

export async function signInLocalOrbiDocAccount(email: string, password: string) {
  const record = readRecord();
  if (!record) throw new Error('Nenhuma conta local foi criada neste aparelho.');
  if (record.email !== email.trim().toLowerCase()) throw new Error('E-mail ou senha incorretos.');
  const hash = await derivePassword(password, base64ToBytes(record.salt), record.iterations || ITERATIONS);
  if (hash !== record.passwordHash) throw new Error('E-mail ou senha incorretos.');
  localStorage.setItem(SESSION_KEY, record.uid);
  announce();
  return toUser(record);
}

export function signOutLocalOrbiDocAccount() {
  localStorage.removeItem(SESSION_KEY);
  announce();
}

export async function deleteLocalOrbiDocAccount(password: string) {
  const record = readRecord();
  if (!record) return;
  const hash = await derivePassword(password, base64ToBytes(record.salt), record.iterations || ITERATIONS);
  if (hash !== record.passwordHash) throw new Error('Senha local incorreta.');
  localStorage.removeItem(ACCOUNT_KEY);
  localStorage.removeItem(SESSION_KEY);
  announce();
}

export function subscribeToLocalOrbiDocAccount(callback: (user: OrbiDocAuthUser | null) => void) {
  const listener = () => callback(getCurrentLocalOrbiDocUser());
  callback(getCurrentLocalOrbiDocUser());
  window.addEventListener(EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}
