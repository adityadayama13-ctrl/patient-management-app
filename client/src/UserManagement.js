import { useEffect, useState } from 'react';
import './UserManagement.css';

const ROLES = ['Admin', 'Doctor', 'Receptionist', 'Nurse'];
const ROLE_COLORS = { Admin: 'role-admin', Doctor: 'role-doctor', Receptionist: 'role-receptionist', Nurse: 'role-nurse' };
const EMPTY_FORM = { name: '', username: '', password: '', role: 'Receptionist', active: true };

export default function UserManagement({ currentUser }) {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) setUsers(await res.json());
    } finally { setLoading(false); }
  }
  useEffect(() => { fetchUsers(); }, []);

  function startAdd() {
    setEditing(null); setForm(EMPTY_FORM); setError(''); setShowForm(true);
  }
  function startEdit(u) {
    setEditing(u);
    setForm({ name: u.name, username: u.username, password: '', role: u.role, active: u.active });
    setError(''); setShowForm(true);
  }
  function cancel() { setShowForm(false); setEditing(null); setError(''); }

  async function handleSave(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const body = { name: form.name, username: form.username, role: form.role, active: form.active };
      if (form.password) body.password = form.password;
      if (!editing && !form.password) { setError('Password is required for new users.'); return; }

      const url    = editing ? `/api/users/${editing.id}` : '/api/users';
      const method = editing ? 'PUT' : 'POST';
      if (!editing) body.password = form.password;

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(editing ? 'User updated.' : 'User created.');
      setTimeout(() => setSuccess(''), 2500);
      setShowForm(false); setEditing(null);
      fetchUsers();
    } finally { setSaving(false); }
  }

  async function handleDelete(u) {
    if (!window.confirm(`Delete user "${u.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    fetchUsers();
  }

  async function toggleActive(u) {
    if (u.id === currentUser.id) { alert("You can't deactivate your own account."); return; }
    await fetch(`/api/users/${u.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !u.active }),
    });
    fetchUsers();
  }

  return (
    <section className="card">
      <div className="um-header">
        <h2>User Management</h2>
        <button className="um-add-btn" onClick={startAdd}>+ Add User</button>
      </div>

      {success && <div className="um-success">{success}</div>}

      {showForm && (
        <form onSubmit={handleSave} className="um-form">
          <div className="um-form-title">{editing ? 'Edit User' : 'New User'}</div>
          {error && <div className="um-error">{error}</div>}
          <div className="um-form-row">
            <div className="um-field">
              <label>Full Name</label>
              <input value={form.name} placeholder="Dr. Jane Smith" required
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="um-field">
              <label>Username</label>
              <input value={form.username} placeholder="janesmith" required
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
            </div>
          </div>
          <div className="um-form-row">
            <div className="um-field">
              <label>{editing ? 'New Password (leave blank to keep)' : 'Password'}</label>
              <input type="password" value={form.password}
                placeholder={editing ? 'Leave blank to keep current' : 'Set a password'}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required={!editing} />
            </div>
            <div className="um-field">
              <label>Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          {editing && (
            <label className="um-active-toggle">
              <input type="checkbox" checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              Account active
            </label>
          )}
          <div className="um-form-actions">
            <button type="button" className="secondary" onClick={cancel}>Cancel</button>
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Update' : 'Create User'}</button>
          </div>
        </form>
      )}

      {loading ? <p className="um-empty">Loading…</p> : (
        <table className="um-table">
          <thead>
            <tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className={!u.active ? 'um-row-inactive' : ''}>
                <td>
                  {u.name}
                  {u.id === currentUser.id && <span className="um-you-badge">you</span>}
                </td>
                <td className="um-username">{u.username}</td>
                <td><span className={`um-role-badge ${ROLE_COLORS[u.role] || ''}`}>{u.role}</span></td>
                <td>
                  <button className={u.active ? 'um-status-btn active' : 'um-status-btn inactive'}
                    onClick={() => toggleActive(u)}
                    disabled={u.id === currentUser.id}>
                    {u.active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td>
                  <button className="btn-edit" onClick={() => startEdit(u)}>Edit</button>
                  {u.id !== currentUser.id && (
                    <button className="btn-delete" onClick={() => handleDelete(u)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="um-role-guide">
        <div className="um-role-guide-title">Role Permissions</div>
        <div className="um-role-grid">
          {[
            { role: 'Admin',        perms: 'Full access — all modules, settings & user management' },
            { role: 'Doctor',       perms: 'Patients, appointments, medical records, prescriptions, lab results' },
            { role: 'Receptionist', perms: 'Patients, appointments, billing, WhatsApp' },
            { role: 'Nurse',        perms: 'View patients, medical records, lab results' },
          ].map(({ role, perms }) => (
            <div key={role} className="um-role-row">
              <span className={`um-role-badge ${ROLE_COLORS[role]}`}>{role}</span>
              <span className="um-role-perm">{perms}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
