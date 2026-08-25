import { doc, getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';

export type OrbiDocPlan = 'free' | 'premium' | 'supreme';
export type OrbiDocRole = 'user' | 'admin' | 'owner';

export interface OrbiDocEntitlement {
  uid: string | null;
  email: string | null;
  plan: OrbiDocPlan;
  role: OrbiDocRole;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
  source: 'firebase-console' | 'stripe' | 'google-play' | 'manual' | 'none';
  premiumUntil: string | null;
  features: string[];
  updatedAt: string | null;
}

export const ORBIDOC_PREMIUM_FEATURES = [
  'ai.byok',
  'ai.multi-provider',
  'cloud.priority-sync',
  'workspace.pro-templates',
  'export.advanced',
] as const;

export const ORBIDOC_SUPREME_FEATURES = [
  ...ORBIDOC_PREMIUM_FEATURES,
  'admin.console',
  'admin.entitlements',
  'admin.feature-flags',
  'admin.audit',
  '*',
] as const;

export const FREE_ENTITLEMENT: OrbiDocEntitlement = {
  uid: null,
  email: null,
  plan: 'free',
  role: 'user',
  status: 'none',
  source: 'none',
  premiumUntil: null,
  features: [],
  updatedAt: null,
};

function normalizePlan(value: unknown): OrbiDocPlan {
  return value === 'premium' || value === 'supreme' ? value : 'free';
}

function normalizeRole(value: unknown): OrbiDocRole {
  return value === 'owner' || value === 'admin' ? value : 'user';
}

function normalizeEntitlement(uid: string, email: string | null, data?: Record<string, unknown>): OrbiDocEntitlement {
  const plan = normalizePlan(data?.plan);
  const role = normalizeRole(data?.role);
  const premiumUntil = typeof data?.premiumUntil === 'string' ? data.premiumUntil : null;
  const explicitFeatures = Array.isArray(data?.features) ? data.features.filter((item): item is string => typeof item === 'string') : [];
  const inherited = role === 'owner' || plan === 'supreme'
    ? [...ORBIDOC_SUPREME_FEATURES]
    : plan === 'premium'
      ? [...ORBIDOC_PREMIUM_FEATURES]
      : [];

  return {
    uid,
    email: typeof data?.email === 'string' ? data.email : email,
    plan: role === 'owner' ? 'supreme' : plan,
    role,
    status: data?.status === 'active' || data?.status === 'trialing' || data?.status === 'past_due' || data?.status === 'canceled' ? data.status : (plan === 'free' && role === 'user' ? 'none' : 'active'),
    source: data?.source === 'stripe' || data?.source === 'google-play' || data?.source === 'firebase-console' || data?.source === 'manual' ? data.source : 'none',
    premiumUntil,
    features: [...new Set([...inherited, ...explicitFeatures])],
    updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : null,
  };
}

export async function getCurrentOrbiDocEntitlement(): Promise<OrbiDocEntitlement> {
  const user = auth.currentUser;
  if (!user?.uid) return FREE_ENTITLEMENT;
  const snapshot = await getDoc(doc(db, 'entitlements', user.uid));
  return normalizeEntitlement(user.uid, user.email, snapshot.exists() ? snapshot.data() : undefined);
}

export function subscribeToOrbiDocEntitlement(callback: (entitlement: OrbiDocEntitlement) => void): Unsubscribe {
  let stopEntitlement: Unsubscribe = () => {};
  const stopAuth = onAuthStateChanged(auth, (user) => {
    stopEntitlement();
    if (!user?.uid) {
      callback(FREE_ENTITLEMENT);
      return;
    }
    stopEntitlement = onSnapshot(doc(db, 'entitlements', user.uid), (snapshot) => {
      callback(normalizeEntitlement(user.uid, user.email, snapshot.exists() ? snapshot.data() : undefined));
    }, () => callback(normalizeEntitlement(user.uid, user.email)));
  });

  return () => {
    stopEntitlement();
    stopAuth();
  };
}

export function isOrbiDocPremium(entitlement: OrbiDocEntitlement) {
  if (entitlement.role === 'owner' || entitlement.role === 'admin') return true;
  if (entitlement.plan !== 'premium' && entitlement.plan !== 'supreme') return false;
  if (!entitlement.premiumUntil) return entitlement.status === 'active' || entitlement.status === 'trialing';
  const expiresAt = Date.parse(entitlement.premiumUntil);
  return Number.isFinite(expiresAt) && expiresAt > Date.now() && (entitlement.status === 'active' || entitlement.status === 'trialing');
}

export function hasOrbiDocFeature(entitlement: OrbiDocEntitlement, feature: string) {
  return entitlement.features.includes('*') || entitlement.features.includes(feature) || (feature === 'ai.byok' && isOrbiDocPremium(entitlement));
}

export function isOrbiDocOwner(entitlement: OrbiDocEntitlement) {
  return entitlement.role === 'owner';
}
