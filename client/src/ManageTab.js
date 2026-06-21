import { useEffect, useState } from 'react';
import { PERMISSION_FEATURES, DEFAULT_ROLE_PERMS, loadRolePerms, loadLicense, licenseStatus } from './App';
import './ManageTab.css';

const ROLES = ['Admin', 'Doctor', 'Receptionist', 'Nurse'];
const NON_ADMIN_ROLES = ['Doctor', 'Receptionist', 'Nurse'];
const ROLE_COLORS = { Admin: 'role-admin', Doctor: 'role-doctor', Receptionist: 'role-receptionist', Nurse: 'role-nurse' };
const EMPTY_USER_FORM = { name: '', username: '', password: '', role: 'Receptionist', active: true };

const PREMIUM_FEATURES = [
  { key: 'prescriptions', label: 'Prescription Pad', desc: 'Write and print prescriptions per visit.' },
  { key: 'labResults',    label: 'Lab Results',      desc: 'Upload lab reports and flag abnormal values.' },
];

// ── Users sub-section ─────────────────────────────────────────────────────────
function UsersSection({ currentUser }) {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(EMPTY_USER_FORM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  async function fetchUsers() {
    setLoading(true);
    try { const r = await fetch('/api/users'); if (r.ok) setUsers(await r.json()); }
    finally { setLoading(false); }
  }
  useEffect(() => { fetchUsers(); }, []);

  function startAdd()  { setEditing(null); setForm(EMPTY_USER_FORM); setError(''); setShowForm(true); }
  function startEdit(u){ setEditing(u); setForm({ name: u.name, username: u.username, password: '', role: u.role, active: u.active }); setError(''); setShowForm(true); }
  function cancel()    { setShowForm(false); setEditing(null); setError(''); }

  async function handleSave(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      if (!editing && !form.password) { setError('Password required for new users.'); return; }
      const body = { name: form.name, username: form.username, role: form.role, active: form.active };
      if (form.password) body.password = form.password;
      const res = await fetch(editing ? `/api/users/${editing.id}` : '/api/users', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(editing ? 'User updated.' : 'User created.'); setTimeout(() => setSuccess(''), 2500);
      cancel(); fetchUsers();
    } catch (err) {
      setError('Network error — could not reach the server.');
    } finally { setSaving(false); }
  }

  async function handleDelete(u) {
    if (!window.confirm(`Delete "${u.name}"?`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
    if (!res.ok) { alert((await res.json()).error); return; }
    fetchUsers();
  }

  async function toggleActive(u) {
    if (u.id === currentUser.id) { alert("You can't deactivate your own account."); return; }
    await fetch(`/api/users/${u.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !u.active }) });
    fetchUsers();
  }

  return (
    <section className="card">
      <div className="mg-section-head">
        <h2>Users</h2>
        <button className="mg-add-btn" onClick={startAdd}>+ Add User</button>
      </div>

      {success && <div className="mg-success">{success}</div>}

      {showForm && (
        <form onSubmit={handleSave} className="mg-form">
          <div className="mg-form-title">{editing ? 'Edit User' : 'New User'}</div>
          {error && <div className="mg-error">{error}</div>}
          <div className="mg-form-row">
            <div className="mg-field"><label>Full Name</label>
              <input value={form.name} required placeholder="Dr. Jane Smith" onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="mg-field"><label>Username</label>
              <input value={form.username} required placeholder="janesmith" onChange={e => setForm(f => ({ ...f, username: e.target.value }))} /></div>
          </div>
          <div className="mg-form-row">
            <div className="mg-field">
              <label>{editing ? 'New Password (blank = keep)' : 'Password'}</label>
              <input type="password" value={form.password} required={!editing}
                placeholder={editing ? 'Leave blank to keep' : 'Set a password'}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="mg-field"><label>Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          {editing && (
            <label className="mg-active-toggle">
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              Account active
            </label>
          )}
          <div className="mg-form-actions">
            <button type="button" className="secondary" onClick={cancel}>Cancel</button>
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      )}

      {loading ? <p className="mg-empty">Loading…</p> : (
        <table className="mg-table">
          <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className={!u.active ? 'mg-row-inactive' : ''}>
                <td>{u.name}{u.id === currentUser.id && <span className="mg-you">you</span>}</td>
                <td className="mg-mono">{u.username}</td>
                <td><span className={`mg-role-badge ${ROLE_COLORS[u.role] || ''}`}>{u.role}</span></td>
                <td>
                  <button className={u.active ? 'mg-status on' : 'mg-status off'}
                    onClick={() => toggleActive(u)} disabled={u.id === currentUser.id}>
                    {u.active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td>
                  <button className="btn-edit" onClick={() => startEdit(u)}>Edit</button>
                  {u.id !== currentUser.id && <button className="btn-delete" onClick={() => handleDelete(u)}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mg-role-legend">
        <div className="mg-legend-title">Role Reference</div>
        {[
          { role: 'Admin',        desc: 'Full access — all modules, settings, users & licensing' },
          { role: 'Doctor',       desc: 'Configurable via Role Permissions below' },
          { role: 'Receptionist', desc: 'Configurable via Role Permissions below' },
          { role: 'Nurse',        desc: 'Configurable via Role Permissions below' },
        ].map(({ role, desc }) => (
          <div key={role} className="mg-legend-row">
            <span className={`mg-role-badge ${ROLE_COLORS[role]}`}>{role}</span>
            <span className="mg-legend-desc">{desc}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Role Permissions sub-section ──────────────────────────────────────────────
function RolePermissionsSection({ onSaved }) {
  const [perms, setPerms] = useState(loadRolePerms);
  const [saved, setSaved] = useState(false);

  function toggle(role, feature) {
    setPerms(p => ({ ...p, [role]: { ...p[role], [feature]: !p[role][feature] } }));
  }

  function resetDefaults() {
    setPerms(DEFAULT_ROLE_PERMS);
  }

  function save() {
    localStorage.setItem('rolePermissions', JSON.stringify(perms));
    setSaved(true); setTimeout(() => setSaved(false), 2000);
    onSaved();
  }

  return (
    <section className="card">
      <div className="mg-section-head">
        <h2>Role Permissions</h2>
        <button className="mg-reset-btn" onClick={resetDefaults} title="Reset to defaults">Reset defaults</button>
      </div>
      <p className="mg-hint">Admin always has full access and cannot be restricted. Changes take effect immediately after Save.</p>

      <div className="rp-table-wrap">
        <table className="rp-table">
          <thead>
            <tr>
              <th className="rp-feature-col">Feature</th>
              <th className="rp-role-col role-admin">Admin</th>
              {NON_ADMIN_ROLES.map(r => (
                <th key={r} className={`rp-role-col ${ROLE_COLORS[r]}`}>{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_FEATURES.map(({ key, label, premium }) => (
              <tr key={key}>
                <td className="rp-feature-label">
                  {label}
                  {premium && <span className="rp-premium-tag">Premium</span>}
                </td>
                {/* Admin — always locked on */}
                <td className="rp-cell">
                  <span className="rp-locked">✓</span>
                </td>
                {NON_ADMIN_ROLES.map(role => (
                  <td key={role} className="rp-cell">
                    <label className="rp-checkbox">
                      <input
                        type="checkbox"
                        checked={perms[role]?.[key] ?? false}
                        onChange={() => toggle(role, key)}
                      />
                      <span className="rp-checkmark" />
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mg-save-row">
        <button className="mg-save-btn" onClick={save}>Save Permissions</button>
        {saved && <span className="mg-saved-msg">Saved!</span>}
      </div>
    </section>
  );
}

// ── Licensing sub-section ─────────────────────────────────────────────────────
function LicensingSection({ onSaved }) {
  const [lic, setLic]     = useState(loadLicense);
  const [saved, setSaved] = useState(false);
  const status = licenseStatus(lic);

  function save(e) {
    e.preventDefault();
    localStorage.setItem('clinicLicense', JSON.stringify(lic));
    setSaved(true); setTimeout(() => setSaved(false), 2000);
    onSaved();
  }

  function statusBadge() {
    if (status.noLicense) return <span className="lic-badge no-lic">No License</span>;
    if (status.expired)   return <span className="lic-badge expired">Expired {Math.abs(status.daysLeft)} days ago</span>;
    if (status.daysLeft <= 30) return <span className="lic-badge warning">Expires in {status.daysLeft} days</span>;
    return <span className="lic-badge active">Active · {status.daysLeft} days remaining</span>;
  }

  return (
    <section className="card">
      <div className="mg-section-head">
        <h2>Licensing</h2>
        {statusBadge()}
      </div>

      {status.expired && (
        <div className="lic-alert expired-alert">
          ⚠ Your license expired on {lic.expiryDate}. Premium features (Prescription Pad, Lab Results) are locked.
          Please renew to restore access.
        </div>
      )}
      {!status.expired && !status.noLicense && status.daysLeft <= 30 && (
        <div className="lic-alert warning-alert">
          ⏳ License expires in {status.daysLeft} day{status.daysLeft !== 1 ? 's' : ''} on {lic.expiryDate}. Contact your provider to renew.
        </div>
      )}

      <form onSubmit={save} className="lic-form">
        <div className="mg-form-row">
          <div className="mg-field">
            <label>Licensed To (Clinic / Doctor Name)</label>
            <input value={lic.licensedTo || ''} placeholder="Dr. Jane Smith — City Clinic"
              onChange={e => setLic(l => ({ ...l, licensedTo: e.target.value }))} />
          </div>
          <div className="mg-field">
            <label>License / Reference Code</label>
            <input value={lic.referenceCode || ''} placeholder="LIC-2024-XXXXX"
              onChange={e => setLic(l => ({ ...l, referenceCode: e.target.value }))} />
          </div>
        </div>
        <div className="mg-form-row">
          <div className="mg-field">
            <label>License Start Date</label>
            <input type="date" value={lic.startDate || ''}
              onChange={e => setLic(l => ({ ...l, startDate: e.target.value }))} />
          </div>
          <div className="mg-field">
            <label>License Expiry Date</label>
            <input type="date" value={lic.expiryDate || ''}
              onChange={e => setLic(l => ({ ...l, expiryDate: e.target.value }))} />
          </div>
        </div>

        <div className="lic-features">
          <div className="mg-field-label">Premium Feature Access</div>
          <p className="mg-hint">Control which premium modules are included in this license. Expired licenses lock all premium features regardless.</p>
          {PREMIUM_FEATURES.map(({ key, label, desc }) => (
            <div key={key} className="lic-feature-row">
              <div>
                <div className="lic-feature-label">{label}</div>
                <div className="lic-feature-desc">{desc}</div>
              </div>
              <button
                type="button"
                className={(lic.features?.[key] !== false) ? 'premium-toggle on' : 'premium-toggle off'}
                onClick={() => setLic(l => ({
                  ...l,
                  features: { ...(l.features || {}), [key]: !(l.features?.[key] !== false) }
                }))}
              >
                {(lic.features?.[key] !== false) ? 'Included' : 'Excluded'}
              </button>
            </div>
          ))}
        </div>

        <div className="mg-save-row">
          <button type="submit" className="mg-save-btn">Save License</button>
          {saved && <span className="mg-saved-msg">Saved!</span>}
        </div>
      </form>
    </section>
  );
}

// ── ManageTab (root) ──────────────────────────────────────────────────────────
export default function ManageTab({ currentUser, onSaved }) {
  return (
    <>
      <UsersSection currentUser={currentUser} />
      <RolePermissionsSection onSaved={onSaved} />
      <LicensingSection onSaved={onSaved} />
    </>
  );
}
