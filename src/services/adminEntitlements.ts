import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import {
  getCurrentOrbiDocEntitlement,
  isOrbiDocOwner,
  type OrbiDocPlan,
  type OrbiDocRole,
} from './entitlements';

export interface AdminEntitlementRecord {
  uid: string;
  email: string;
  plan: OrbiDocPlan;
  role: OrbiDocRole;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
  source: 'firebase-console' | 'stripe' | 'google-play' | 'manual' | 'none';
  premiumUntil: string | null;
  features: string[];
  updatedAt: string | null;
}

async function assertOwner() {
  const user = auth.currentUser;
  if (!user?.uid) throw new Error('Entre em uma conta owner do OrbiDoc.');
  const entitlement = await getCurrentOrbiDocEntitlement();
  if (!isOrbiDocOwner(entitlement)) throw new Error('Esta operação exige o papel owner do OrbiDoc.');
  return user;
}

export async function listOrbiDocEntitlements(): Promise<AdminEntitlementRecord[]> {
  await assertOwner();
  const snapshot = await getDocs(collection(db, 'entitlements'));
  return snapshot.docs.map((item) => {
    const data = item.data();
    return {
      uid: item.id,
      email: typeof data.email === 'string' ? data.email : '',
      plan: data.plan === 'premium' || data.plan === 'supreme' ? data.plan : 'free',
      role: data.role === 'owner' || data.role === 'admin' ? data.role : 'user',
      status: data.status === 'active' || data.status === 'trialing' || data.status === 'past_due' || data.status === 'canceled' ? data.status : 'none',
      source: data.source === 'stripe' || data.source === 'google-play' || data.source === 'firebase-console' || data.source === 'manual' ? data.source : 'none',
      premiumUntil: typeof data.premiumUntil === 'string' ? data.premiumUntil : null,
      features: Array.isArray(data.features) ? data.features.filter((entry): entry is string => typeof entry === 'string') : [],
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
    };
  }).sort((left, right) => left.email.localeCompare(right.email) || left.uid.localeCompare(right.uid));
}

export async function upsertOrbiDocEntitlement(input: {
  uid: string;
  email?: string;
  plan: OrbiDocPlan;
  role?: OrbiDocRole;
  status?: AdminEntitlementRecord['status'];
  premiumUntil?: string | null;
  features?: string[];
}) {
  const owner = await assertOwner();
  const uid = input.uid.trim();
  if (!uid) throw new Error('Informe o UID Firebase do usuário.');

  const role = input.role || 'user';
  const plan = role === 'owner' ? 'supreme' : input.plan;
  const payload = {
    email: String(input.email || '').trim().toLowerCase(),
    plan,
    role,
    status: input.status || (plan === 'free' && role === 'user' ? 'none' : 'active'),
    source: 'manual',
    premiumUntil: input.premiumUntil || null,
    features: [...new Set((input.features || []).map((item) => item.trim()).filter(Boolean))],
    updatedAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'entitlements', uid), payload, { merge: true });
  await addDoc(collection(db, 'admin_audit'), {
    actorUid: owner.uid,
    actorEmail: owner.email || null,
    action: 'entitlement.upsert',
    targetUid: uid,
    targetEmail: payload.email || null,
    plan: payload.plan,
    role: payload.role,
    createdAt: serverTimestamp(),
  });
}

export async function revokeOrbiDocEntitlement(uidInput: string) {
  const owner = await assertOwner();
  const uid = uidInput.trim();
  if (!uid) throw new Error('Informe o UID a revogar.');
  if (uid === owner.uid) throw new Error('Para evitar bloqueio acidental, remova o próprio owner somente pelo Firebase Console.');
  await deleteDoc(doc(db, 'entitlements', uid));
  await addDoc(collection(db, 'admin_audit'), {
    actorUid: owner.uid,
    actorEmail: owner.email || null,
    action: 'entitlement.revoke',
    targetUid: uid,
    createdAt: serverTimestamp(),
  });
}
