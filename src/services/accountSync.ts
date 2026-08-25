import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, type OrbiDocAuthUser } from './firebase';

const THEME_KEY = 'orbidoc_theme_v2';
const PREFS_UPDATED_KEY = 'orbidoc_account_prefs_updated_v1';

export interface OrbiDocSyncedPreferences {
  themeMode: 'light' | 'dark';
  updatedAt: string;
}

const nowIso = () => new Date().toISOString();

const readLocalPreferences = (): OrbiDocSyncedPreferences => {
  const stored = localStorage.getItem(THEME_KEY);
  const themeMode: 'light' | 'dark' = stored === 'dark' ? 'dark' : 'light';
  return {
    themeMode,
    updatedAt: localStorage.getItem(PREFS_UPDATED_KEY) || '1970-01-01T00:00:00.000Z',
  };
};

const applyLocalPreferences = (preferences: OrbiDocSyncedPreferences) => {
  localStorage.setItem(THEME_KEY, preferences.themeMode);
  localStorage.setItem(PREFS_UPDATED_KEY, preferences.updatedAt);
  document.documentElement.classList.toggle('dark', preferences.themeMode === 'dark');
  document.documentElement.style.colorScheme = preferences.themeMode;
  window.dispatchEvent(new CustomEvent('orbidoc:preferences-synced', { detail: preferences }));
};

export async function upsertOrbiDocUserProfile(user: OrbiDocAuthUser) {
  if (!user.uid || user.isAnonymous) return false;
  try {
    const reference = doc(db, 'users', user.uid);
    const existing = await getDoc(reference);
    await setDoc(reference, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
      updatedAt: nowIso(),
      lastSeenAt: nowIso(),
      ...(existing.exists() ? {} : { createdAt: nowIso() }),
    }, { merge: true });
    return true;
  } catch (error) {
    console.warn('OrbiDoc profile sync failed:', error);
    return false;
  }
}

export async function syncOrbiDocPreferences(user: OrbiDocAuthUser) {
  if (!user.uid || user.isAnonymous || !user.email) return null;
  try {
    const reference = doc(db, 'user_settings', user.uid);
    const remoteSnapshot = await getDoc(reference);
    const local = readLocalPreferences();
    const remote = remoteSnapshot.exists() ? remoteSnapshot.data() as Partial<OrbiDocSyncedPreferences> & { userEmail?: string } : null;
    const remoteUpdated = remote?.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
    const localUpdated = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;

    if (remote?.themeMode && (remote.themeMode === 'light' || remote.themeMode === 'dark') && remoteUpdated > localUpdated) {
      const next: OrbiDocSyncedPreferences = { themeMode: remote.themeMode, updatedAt: remote.updatedAt || nowIso() };
      applyLocalPreferences(next);
      return next;
    }

    const nextUpdatedAt = localUpdated > 0 ? local.updatedAt : nowIso();
    await setDoc(reference, {
      userEmail: user.email,
      themeMode: local.themeMode,
      themePreset: 'orbital-azure',
      accentColor: '#3157F6',
      fontFamily: 'Inter',
      fontSize: 'normal',
      autoSaveEnabled: true,
      autoSaveDelayMs: 900,
      updatedAt: nextUpdatedAt,
    }, { merge: true });
    if (!localUpdated) localStorage.setItem(PREFS_UPDATED_KEY, nextUpdatedAt);
    return { themeMode: local.themeMode, updatedAt: nextUpdatedAt };
  } catch (error) {
    console.warn('OrbiDoc preferences sync failed:', error);
    return null;
  }
}

export async function pushCurrentThemePreference() {
  const user = auth.currentUser;
  if (!user?.uid || !user.email || user.isAnonymous) return false;
  const themeMode: 'light' | 'dark' = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const updatedAt = nowIso();
  localStorage.setItem(THEME_KEY, themeMode);
  localStorage.setItem(PREFS_UPDATED_KEY, updatedAt);
  try {
    await setDoc(doc(db, 'user_settings', user.uid), {
      userEmail: user.email,
      themeMode,
      themePreset: 'orbital-azure',
      accentColor: '#3157F6',
      fontFamily: 'Inter',
      fontSize: 'normal',
      autoSaveEnabled: true,
      autoSaveDelayMs: 900,
      updatedAt,
    }, { merge: true });
    return true;
  } catch (error) {
    console.warn('OrbiDoc theme push failed:', error);
    return false;
  }
}
