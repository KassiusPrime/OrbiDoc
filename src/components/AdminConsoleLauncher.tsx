import React, { useEffect, useMemo, useState } from 'react';
import {
  IconPlus as Plus,
  IconRefresh as Refresh,
  IconShieldCheck as ShieldCheck,
  IconTrash as Trash,
  IconUser as User,
  IconX as X,
} from '@tabler/icons-react';
import {
  listOrbiDocEntitlements,
  revokeOrbiDocEntitlement,
  upsertOrbiDocEntitlement,
  type AdminEntitlementRecord,
} from '../services/adminEntitlements';
import {
  FREE_ENTITLEMENT,
  isOrbiDocOwner,
  subscribeToOrbiDocEntitlement,
  type OrbiDocEntitlement,
  type OrbiDocPlan,
  type OrbiDocRole,
} from '../services/entitlements';

const emptyForm = {
  uid: '',
  email: '',
  plan: 'premium' as OrbiDocPlan,
  role: 'user' as OrbiDocRole,
  premiumUntil: '',
  features: '',
};

export const AdminConsoleLauncher: React.FC = () => {
  const [entitlement, setEntitlement] = useState<OrbiDocEntitlement>(FREE_ENTITLEMENT);
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<AdminEntitlementRecord[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => subscribeToOrbiDocEntitlement(setEntitlement), []);
  const owner = isOrbiDocOwner(entitlement);

  const summary = useMemo(() => ({
    premium: records.filter((item) => item.plan === 'premium').length,
    supreme: records.filter((item) => item.plan === 'supreme' || item.role === 'owner').length,
    owner: records.filter((item) => item.role === 'owner').length,
  }), [records]);

  const refresh = async () => {
    if (!owner) return;
    setBusy(true);
    setMessage('');
    try {
      setRecords(await listOrbiDocEntitlements());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os entitlements.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (open && owner) void refresh();
  }, [open, owner]);

  useEffect(() => {
    if (!owner) setOpen(false);
  }, [owner]);

  if (!owner) return null;

  const save = async () => {
    setBusy(true);
    setMessage('');
    try {
      await upsertOrbiDocEntitlement({
        uid: form.uid,
        email: form.email,
        plan: form.plan,
        role: form.role,
        premiumUntil: form.premiumUntil || null,
        features: form.features.split(',').map((item) => item.trim()).filter(Boolean),
      });
      setForm(emptyForm);
      setMessage('Entitlement atualizado com auditoria registrada.');
      setRecords(await listOrbiDocEntitlements());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar o entitlement.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (uid: string) => {
    setBusy(true);
    setMessage('');
    try {
      await revokeOrbiDocEntitlement(uid);
      setMessage('Entitlement revogado.');
      setRecords(await listOrbiDocEntitlements());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível revogar o entitlement.');
    } finally {
      setBusy(false);
    }
  };

  const edit = (record: AdminEntitlementRecord) => {
    setForm({
      uid: record.uid,
      email: record.email,
      plan: record.plan,
      role: record.role,
      premiumUntil: record.premiumUntil || '',
      features: record.features.join(', '),
    });
  };

  return <>
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="fixed z-[74] right-3 bottom-[142px] lg:right-4 lg:bottom-20 h-11 px-3.5 rounded-2xl bg-[#080D18] dark:bg-white text-white dark:text-[#080D18] shadow-xl border border-white/10 dark:border-slate-200 text-[9px] font-black inline-flex items-center gap-2"
      aria-label="Abrir Console Supreme"
      title="Console Supreme do proprietário"
    ><ShieldCheck className="w-4 h-4" /> SUPREME</button>

    {open && <div className="fixed inset-0 z-[190] bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="orbidoc-admin-title">
      <div className="w-full max-w-5xl max-h-[94dvh] rounded-t-[28px] sm:rounded-[28px] bg-white dark:bg-[#101827] border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col">
        <header className="shrink-0 p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#3157F6]/10 text-[#3157F6] flex items-center justify-center"><ShieldCheck className="w-5 h-5" /></div>
          <div className="min-w-0 flex-1"><div className="text-[9px] font-black uppercase tracking-[0.15em] text-[#3157F6]">OrbiDoc Supreme</div><h2 id="orbidoc-admin-title" className="text-sm font-black">Console do proprietário</h2><p className="text-[9px] text-slate-500">Privilégios derivados do Firestore; nenhum e-mail de administrador fica hard-coded no cliente.</p></div>
          <button type="button" onClick={() => setOpen(false)} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center" aria-label="Fechar console"><X className="w-4 h-4" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Premium" value={summary.premium} />
            <Metric label="Supreme" value={summary.supreme} />
            <Metric label="Owners" value={summary.owner} />
          </div>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between gap-3"><div><h3 className="text-xs font-black">Conceder ou editar acesso</h3><p className="mt-0.5 text-[9px] text-slate-500">Use o UID exibido no Firebase Authentication. O primeiro owner deve ser criado pelo Firebase Console.</p></div><Plus className="w-4 h-4 text-[#3157F6]" /></div>
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <AdminField label="UID Firebase" value={form.uid} onChange={(uid) => setForm((current) => ({ ...current, uid }))} placeholder="UID do usuário" />
              <AdminField label="E-mail de referência" value={form.email} onChange={(email) => setForm((current) => ({ ...current, email }))} placeholder="usuario@exemplo.com" />
              <label><span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Plano</span><select value={form.plan} onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value as OrbiDocPlan }))} className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-[10px]"><option value="free">Free</option><option value="premium">Premium</option><option value="supreme">Supreme</option></select></label>
              <label><span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Papel</span><select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as OrbiDocRole }))} className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-[10px]"><option value="user">Usuário</option><option value="admin">Admin</option><option value="owner">Owner</option></select></label>
              <AdminField label="Premium até (ISO, opcional)" value={form.premiumUntil} onChange={(premiumUntil) => setForm((current) => ({ ...current, premiumUntil }))} placeholder="2027-08-25T23:59:59Z" />
              <AdminField label="Features extras" value={form.features} onChange={(features) => setForm((current) => ({ ...current, features }))} placeholder="feature.a, feature.b" />
            </div>
            <button type="button" disabled={busy || !form.uid.trim()} onClick={() => void save()} className="mt-3 h-10 px-4 rounded-xl bg-[#3157F6] text-white text-[10px] font-black disabled:opacity-40">{busy ? 'Salvando…' : 'Salvar entitlement'}</button>
            {message && <div role="status" className="mt-3 rounded-xl bg-slate-100 dark:bg-slate-900 px-3 py-2 text-[9px] font-semibold">{message}</div>}
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800"><div><h3 className="text-xs font-black">Entitlements</h3><p className="text-[9px] text-slate-500">Fonte de verdade para Free, Premium e Supreme.</p></div><button type="button" disabled={busy} onClick={() => void refresh()} className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-[9px] font-black inline-flex items-center gap-1.5"><Refresh className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> Atualizar</button></div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {records.length === 0 && <div className="p-6 text-center text-[10px] text-slate-500">Nenhum entitlement encontrado. Crie o primeiro owner pelo Firebase Console para inicializar o sistema.</div>}
              {records.map((record) => <div key={record.uid} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center shrink-0"><User className="w-4 h-4" /></div>
                <div className="min-w-0 flex-1"><div className="text-[10px] font-black truncate">{record.email || record.uid}</div><div className="text-[8px] text-slate-400 truncate">{record.uid}</div></div>
                <div className="flex items-center gap-1.5"><span className="px-2 py-1 rounded-lg bg-[#3157F6]/10 text-[#3157F6] text-[8px] font-black uppercase">{record.plan}</span><span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 text-[8px] font-black uppercase">{record.role}</span></div>
                <div className="flex gap-2"><button type="button" onClick={() => edit(record)} className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[8px] font-black">Editar</button>{record.role !== 'owner' && <button type="button" disabled={busy} onClick={() => void revoke(record.uid)} className="h-8 px-2.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 text-[8px] font-black inline-flex items-center gap-1"><Trash className="w-3 h-3" /> Revogar</button>}</div>
              </div>)}
            </div>
          </section>
        </div>
      </div>
    </div>}
  </>;
};

const Metric: React.FC<{ label: string; value: number }> = ({ label, value }) => <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3"><div className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</div><div className="mt-1 text-xl font-black">{value}</div></div>;

const AdminField: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder?: string }> = ({ label, value, onChange, placeholder }) => <label><span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete="off" className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-[10px] outline-none focus:border-[#3157F6]" /></label>;
