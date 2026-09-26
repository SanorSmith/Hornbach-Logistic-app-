import { useCallback, useEffect, useState } from 'react';
import { useDialog } from '../hooks/useDialog';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Store,
  Plus,
  LogOut,
  KeyRound,
  MapPin,
  Phone,
  Users,
  CircleDot,
  Building2,
  UserPlus,
  Pencil,
  Power,
  Trash2,
  X,
  Copy,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { fetchFacilityOverview, updateFacility, FacilityOverview, FacilityAdmin } from '../lib/facilities';
import { createFacility, createFacilityAdmin, deleteAppUser, deleteFacility, NewAdmin, NewFacility } from '../lib/adminUsers';
import { facilityLabel } from '../lib/access';

type Credentials = { facility: string; email: string; password?: string; warning?: string };

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500';

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
    </label>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const dialogRef = useDialog(true, onClose);
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1} aria-label={title} className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 focus:outline-none">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-800" aria-label="Stäng">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const emptyFacility: NewFacility = { code: '', name: '', location: '', address: '', phone: '' };
const emptyAdmin: NewAdmin = { email: '', full_name: '', password: '' };

function AdminFields({ admin, onChange }: { admin: NewAdmin; onChange: (admin: NewAdmin) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Namn" required>
        <input
          className={inputClass}
          value={admin.full_name}
          onChange={(e) => onChange({ ...admin, full_name: e.target.value })}
          required
        />
      </Field>
      <Field label="E-post (inloggning)" required>
        <input
          type="email"
          className={inputClass}
          value={admin.email}
          onChange={(e) => onChange({ ...admin, email: e.target.value })}
          required
        />
      </Field>
      <Field label="Tillfälligt lösenord" hint="Lämna tomt för att generera ett. Admin måste byta det vid första inloggningen.">
        <input
          type="text"
          className={inputClass}
          value={admin.password}
          minLength={8}
          onChange={(e) => onChange({ ...admin, password: e.target.value })}
          autoComplete="new-password"
        />
      </Field>
    </div>
  );
}

function NewFacilityModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Credentials) => void }) {
  const [facility, setFacility] = useState(emptyFacility);
  const [admin, setAdmin] = useState(emptyAdmin);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await createFacility(facility, { ...admin, password: admin.password || undefined });
      const label = facilityLabel(facility);
      onCreated({
        facility: label,
        email: admin.email.trim().toLowerCase(),
        password: result.temporary_password,
        warning: result.admin_error
          ? `Butiken skapades men admin-kontot kunde inte skapas: ${result.admin_error}. Lägg till admin från butikskortet.`
          : undefined,
      });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Registrera ny butik" onClose={onClose}>
      <form onSubmit={submit} className="space-y-6">
        <section className="space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Store size={18} /> Butiksinformation
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Butiksnr" required>
              <input
                className={inputClass}
                value={facility.code}
                onChange={(e) => setFacility({ ...facility, code: e.target.value })}
                placeholder="773"
                pattern="[0-9A-Za-z\-]{1,12}"
                required
              />
            </Field>
            <div className="col-span-2">
              <Field label="Namn" required>
                <input
                  className={inputClass}
                  value={facility.name}
                  onChange={(e) => setFacility({ ...facility, name: e.target.value })}
                  placeholder="Kungens Kurva"
                  required
                />
              </Field>
            </div>
          </div>
          <Field label="Ort">
            <input
              className={inputClass}
              value={facility.location}
              onChange={(e) => setFacility({ ...facility, location: e.target.value })}
            />
          </Field>
          <Field label="Adress">
            <input
              className={inputClass}
              value={facility.address}
              onChange={(e) => setFacility({ ...facility, address: e.target.value })}
            />
          </Field>
          <Field label="Telefon">
            <input
              className={inputClass}
              value={facility.phone}
              onChange={(e) => setFacility({ ...facility, phone: e.target.value })}
            />
          </Field>
          <p className="text-xs text-gray-500">
            Butiken får 60 röda punkter (RP-001 – RP-060) och samma avdelningar som den första butiken.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <UserPlus size={18} /> Butikens admin
          </h3>
          <AdminFields admin={admin} onChange={setAdmin} />
        </section>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border hover:bg-gray-50">
            Avbryt
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Skapar…' : 'Skapa butik och admin'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AddAdminModal({
  facility,
  onClose,
  onCreated,
}: {
  facility: FacilityOverview;
  onClose: () => void;
  onCreated: (c: Credentials) => void;
}) {
  const [admin, setAdmin] = useState(emptyAdmin);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await createFacilityAdmin(facility.id, { ...admin, password: admin.password || undefined });
      onCreated({
        facility: facilityLabel(facility),
        email: admin.email.trim().toLowerCase(),
        password: result.temporary_password,
      });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Ny admin – ${facilityLabel(facility)}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-6">
        <AdminFields admin={admin} onChange={setAdmin} />
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border hover:bg-gray-50">
            Avbryt
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Skapar…' : 'Skapa admin'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditFacilityModal({
  facility,
  onClose,
  onSaved,
}: {
  facility: FacilityOverview;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: facility.name,
    location: facility.location ?? '',
    address: facility.address ?? '',
    phone: facility.phone ?? '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateFacility(facility.id, {
        name: form.name.trim(),
        location: form.location.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
      });
      toast.success('Butiken uppdaterad');
      onSaved();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Redigera butik ${facility.code}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Namn" required>
          <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Ort">
          <input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </Field>
        <Field label="Adress">
          <input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <Field label="Telefon">
          <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-3 pt-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border hover:bg-gray-50">
            Avbryt
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Sparar…' : 'Spara'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CredentialsModal({ credentials, onClose }: { credentials: Credentials; onClose: () => void }) {
  const copy = async () => {
    const text = `Butik: ${credentials.facility}\nE-post: ${credentials.email}\nTillfälligt lösenord: ${credentials.password}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Kopierat');
    } catch {
      toast.error('Kunde inte kopiera');
    }
  };

  return (
    <Modal title="Klart" onClose={onClose}>
      <div className="space-y-4">
        {credentials.warning ? (
          <div className="flex gap-2 p-3 rounded-lg bg-amber-50 text-amber-800 text-sm">
            <AlertTriangle size={18} className="shrink-0" />
            {credentials.warning}
          </div>
        ) : (
          <>
            <p className="text-gray-700">
              Admin-kontot för <strong>{credentials.facility}</strong> är skapat. Admin måste byta lösenord vid
              första inloggningen.
            </p>
            <dl className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
              <div className="flex gap-2">
                <dt className="text-gray-500 w-28">E-post</dt>
                <dd className="font-mono">{credentials.email}</dd>
              </div>
              {credentials.password && (
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-28">Lösenord</dt>
                  <dd className="font-mono">{credentials.password}</dd>
                </div>
              )}
            </dl>
            {credentials.password && (
              <p className="text-xs text-gray-500">Lösenordet visas bara nu. Skicka det till admin på ett säkert sätt.</p>
            )}
          </>
        )}
        <div className="flex justify-end gap-3">
          {credentials.password && !credentials.warning && (
            <button onClick={copy} className="flex items-center gap-1 px-4 py-2 rounded-lg border hover:bg-gray-50">
              <Copy size={16} /> Kopiera
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
            Stäng
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteFacilityModal({
  facility,
  onClose,
  onDeleted,
}: {
  facility: FacilityOverview;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const matches = typed.trim().toLowerCase() === facility.code.toLowerCase();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matches) return;
    setDeleting(true);
    try {
      const result = await deleteFacility(facility.id, typed.trim());
      toast.success(`${facilityLabel(facility)} raderades (${result.users} användare, ${result.photos} bilder)`);
      if (result.auth_cleanup_failed) {
        toast.error(`${result.auth_cleanup_failed} inloggningskonton kunde inte raderas`);
      }
      onDeleted();
    } catch (error) {
      toast.error((error as Error).message);
      setDeleting(false);
    }
  };

  return (
    <Modal title={`Radera ${facilityLabel(facility)}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex gap-2 p-3 rounded-lg bg-red-50 text-red-800 text-sm">
          <AlertTriangle size={18} className="shrink-0" />
          <div>
            Allt i butiken raderas permanent och kan inte återställas: {facility.user_count} användare (även deras
            inloggning), {facility.point_count} punkter, {facility.department_count} avdelningar, all historik,
            rapporter och bilder.
            <br />
            Vill du bara pausa butiken, använd <strong>Stäng butik</strong> i stället.
          </div>
        </div>
        <Field label={`Skriv butiksnumret ${facility.code} för att bekräfta`} required>
          <input
            className={inputClass}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoFocus
          />
        </Field>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border hover:bg-gray-50">
            Avbryt
          </button>
          <button
            type="submit"
            disabled={!matches || deleting}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'Raderar…' : 'Radera butiken permanent'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AdminRow({ admin, onDelete }: { admin: FacilityAdmin; onDelete: () => void }) {
  return (
    <li className="flex items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">{admin.full_name}</p>
        <p className="text-xs text-gray-500 truncate">{admin.email}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!admin.is_active ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">Inaktiv</span>
        ) : admin.must_change_password ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Ej inloggad än</span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">Aktiv</span>
        )}
        {admin.is_active && (
          <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-600" title="Ta bort admin">
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </li>
  );
}

export default function SuperAdminPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [facilities, setFacilities] = useState<FacilityOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [addAdminFor, setAddAdminFor] = useState<FacilityOverview | null>(null);
  const [editing, setEditing] = useState<FacilityOverview | null>(null);
  const [deleting, setDeleting] = useState<FacilityOverview | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const load = useCallback(async () => {
    try {
      setFacilities(await fetchFacilityOverview());
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onCreated = (c: Credentials) => {
    setShowNew(false);
    setAddAdminFor(null);
    setCredentials(c);
    load();
  };

  const toggleActive = async (facility: FacilityOverview) => {
    const closing = facility.is_active;
    const question = closing
      ? `Stänga ${facilityLabel(facility)}? Ingen i butiken kan logga in eller se data förrän den öppnas igen. Inget raderas.`
      : `Öppna ${facilityLabel(facility)} igen?`;
    if (!window.confirm(question)) return;
    try {
      await updateFacility(facility.id, { is_active: !closing });
      toast.success(closing ? 'Butiken är stängd' : 'Butiken är öppen');
      load();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const removeAdmin = async (facility: FacilityOverview, admin: FacilityAdmin) => {
    if (!window.confirm(`Ta bort ${admin.full_name} som admin för ${facilityLabel(facility)}?`)) return;
    try {
      const result = await deleteAppUser(admin.id);
      toast.success(result.deactivated ? 'Kontot inaktiverades (har historik)' : 'Kontot raderades');
      load();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 to-indigo-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2 rounded-lg">
              <Store size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Butiker</h1>
              <p className="text-sm text-gray-500">Superadmin · {user?.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => navigate('/change-password')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border hover:bg-gray-50"
            >
              <KeyRound size={16} /> Byt lösenord
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border hover:bg-gray-50"
            >
              <LogOut size={16} /> Logga ut
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <p className="text-gray-600">
            Varje butik har egna användare, punkter, avdelningar och rapporter. Butikens admin skapar butikens
            användare.
          </p>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow"
          >
            <Plus size={18} /> Ny butik
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {facilities.map((facility) => (
              <article
                key={facility.id}
                className={`bg-white rounded-2xl shadow p-6 space-y-4 ${facility.is_active ? '' : 'opacity-70'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      HORNBACH {facilityLabel(facility)}
                    </h2>
                    {(facility.location || facility.address) && (
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <MapPin size={14} />
                        {[facility.address, facility.location].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {facility.phone && (
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Phone size={14} /> {facility.phone}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full shrink-0 ${
                      facility.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {facility.is_active ? 'Öppen' : 'Stängd'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 rounded-lg py-2">
                    <Users size={16} className="mx-auto text-gray-500" />
                    <p className="font-bold text-gray-900">{facility.user_count}</p>
                    <p className="text-xs text-gray-500">Användare</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg py-2">
                    <CircleDot size={16} className="mx-auto text-red-500" />
                    <p className="font-bold text-gray-900">{facility.point_count}</p>
                    <p className="text-xs text-gray-500">Punkter</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg py-2">
                    <Building2 size={16} className="mx-auto text-gray-500" />
                    <p className="font-bold text-gray-900">{facility.department_count}</p>
                    <p className="text-xs text-gray-500">Avdelningar</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-700">Admin</h3>
                  {facility.admins.length === 0 ? (
                    <p className="text-sm text-amber-700 py-2">Ingen admin än – lägg till en.</p>
                  ) : (
                    <ul className="divide-y">
                      {facility.admins.map((admin) => (
                        <AdminRow key={admin.id} admin={admin} onDelete={() => removeAdmin(facility, admin)} />
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <button
                    onClick={() => setAddAdminFor(facility)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50"
                  >
                    <UserPlus size={16} /> Lägg till admin
                  </button>
                  <button
                    onClick={() => setEditing(facility)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50"
                  >
                    <Pencil size={16} /> Redigera
                  </button>
                  <button
                    onClick={() => toggleActive(facility)}
                    className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border ${
                      facility.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-700 hover:bg-green-50'
                    }`}
                  >
                    <Power size={16} /> {facility.is_active ? 'Stäng butik' : 'Öppna butik'}
                  </button>
                  <button
                    onClick={() => setDeleting(facility)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  >
                    <Trash2 size={16} /> Radera
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {showNew && <NewFacilityModal onClose={() => setShowNew(false)} onCreated={onCreated} />}
      {addAdminFor && (
        <AddAdminModal facility={addAdminFor} onClose={() => setAddAdminFor(null)} onCreated={onCreated} />
      )}
      {editing && (
        <EditFacilityModal
          facility={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {deleting && (
        <DeleteFacilityModal
          facility={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            load();
          }}
        />
      )}
      {credentials && <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />}
    </div>
  );
}
