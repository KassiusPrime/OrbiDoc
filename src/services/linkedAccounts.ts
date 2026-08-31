import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export type LinkedAccountProvider = 'googleDrive' | 'microsoft' | 'github';

export interface LinkedAccountRecord {
  provider: LinkedAccountProvider;
  accountId: string;
  email?: string;
  displayName?: string;
  login?: string;
  scopes?: string[];
  connectedAt: string;
  updatedAt: string;
}

export type LinkedAccounts = Partial<Record<LinkedAccountProvider, LinkedAccountRecord>>;

const STORAGE_KEY = 'orbidoc_linked_accounts_v1';

function readLocal(): LinkedAccounts {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed as LinkedAccounts : {};
  } catch {
    return {};
  }
}

function writeLocal(accounts: LinkedAccounts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  window.dispatchEvent(new CustomEvent('orbidoc:linked-accounts-change', { detail: accounts }));
}

async function readCloud(): Promise<LinkedAccounts> {
  const user = auth.currentUser;
  if (!user?.uid || user.isAnonymous) return {};
  try {
    const snapshot = await getDoc(doc(db, 'users', user.uid));
    const value = snapshot.data()?.linkedAccounts;
    return value && typeof value === 'object' ? value as LinkedAccounts : {};
  } catch (error) {
    console.warn('OrbiDoc linked-account read failed:', error);
    return {};
  }
}

async function writeCloud(accounts: LinkedAccounts) {
  const user = auth.currentUser;
  if (!user?.uid || user.isAnonymous) return false;
  try {
    await setDoc(doc(db, 'users', user.uid), {
      linkedAccounts: accounts,
      linkedAccountsUpdatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (error) {
    console.warn('OrbiDoc linked-account sync failed:', error);
    return false;
  }
}

export function getLinkedAccounts(): LinkedAccounts {
  return readLocal();
}

/**
 * Links external service identity metadata to the current OrbiDoc workspace.
 * Access/refresh tokens are deliberately excluded: only non-secret account
 * identifiers are synchronized to Firestore. Remote providers are merged first
 * so linking on a second device never erases a provider linked elsewhere.
 */
export async function rememberLinkedAccount(
  provider: LinkedAccountProvider,
  account: Omit<LinkedAccountRecord, 'provider' | 'connectedAt' | 'updatedAt'>,
) {
  const [local, remote] = await Promise.all([Promise.resolve(readLocal()), readCloud()]);
  const previous: LinkedAccounts = { ...remote, ...local };
  const existing = previous[provider];
  const now = new Date().toISOString();
  const next: LinkedAccounts = {
    ...previous,
    [provider]: {
      ...account,
      provider,
      connectedAt: existing?.connectedAt || now,
      updatedAt: now,
    },
  };
  writeLocal(next);
  await writeCloud(next);
  return next;
}

export async function forgetLinkedAccount(provider: LinkedAccountProvider) {
  const [local, remote] = await Promise.all([Promise.resolve(readLocal()), readCloud()]);
  const next: LinkedAccounts = { ...remote, ...local };
  delete next[provider];
  writeLocal(next);
  await writeCloud(next);
  return next;
}

/** Merge provider links remembered for this Firebase UID with this device. */
export async function hydrateLinkedAccounts() {
  const remote = await readCloud();
  const local = readLocal();
  const next: LinkedAccounts = { ...remote, ...local };
  writeLocal(next);
  if (Object.keys(local).length) await writeCloud(next);
  return next;
}
