import { useEffect, useState } from 'react';
import './App.css';
import PatientRegistration from './PatientRegistration';
import PatientEditModal from './PatientEditModal';
import PatientRecordsModal from './PatientRecordsModal';
import BillingTab from './BillingTab';
import WhatsAppSettings from './WhatsAppSettings';
import WhatsAppModal from './WhatsAppModal';
import PrescriptionModal from './PrescriptionModal';
import LabResultModal from './LabResultModal';
import LoginScreen from './LoginScreen';
import ManageTab from './ManageTab';
import TodayTab from './TodayTab';
import ToothRow from './ToothRow';
import Icon from './icons';

// ── Role permissions (shared by all devices, stored on the server) ───────────
export const PERMISSION_FEATURES = [
  { key: 'editPatients',   label: 'Add / Edit / Delete Patients' },
  { key: 'appointments',   label: 'Appointments' },
  { key: 'billing',        label: 'Billing' },
  { key: 'medicalRecords', label: 'Medical Records' },
  { key: 'prescriptions',  label: 'Prescription Pad', premium: true },
  { key: 'labResults',     label: 'Lab Results', premium: true },
  { key: 'whatsapp',       label: 'WhatsApp Messaging' },
];

export const DEFAULT_ROLE_PERMS = {
  Doctor:       { editPatients: true,  appointments: true,  billing: true,  medicalRecords: true,  prescriptions: true,  labResults: true,  whatsapp: true  },
  Receptionist: { editPatients: true,  appointments: true,  billing: true,  medicalRecords: false, prescriptions: false, labResults: false, whatsapp: true  },
  Nurse:        { editPatients: false, appointments: false, billing: false, medicalRecords: true,  prescriptions: false, labResults: true,  whatsapp: false },
};

// The server enforces these too; the app uses them to decide what to show.
export async function fetchRolePerms() {
  try {
    const r = await fetch('/api/settings/role-permissions');
    return r.ok ? await r.json() : { perms: DEFAULT_ROLE_PERMS, saved: false };
  } catch { return { perms: DEFAULT_ROLE_PERMS, saved: false }; }
}

export async function saveRolePerms(perms) {
  const r = await fetch('/api/settings/role-permissions', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(perms),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not save permissions.');
  return (await r.json()).perms;
}

// Earlier versions kept permissions in each browser. The first time an admin
// signs in after the update, carry that browser's settings over to the server.
async function migrateLocalRolePerms(serverState) {
  let local = null;
  try { local = JSON.parse(localStorage.getItem('rolePermissions')); } catch { /* ignore */ }
  if (!local || serverState.saved) return serverState.perms;
  const merged = {};
  for (const role of Object.keys(DEFAULT_ROLE_PERMS)) merged[role] = { ...serverState.perms[role], ...(local[role] || {}) };
  try {
    const perms = await saveRolePerms(merged);
    localStorage.removeItem('rolePermissions');
    return perms;
  } catch { return serverState.perms; }
}

// Admin always has full access; other roles read from stored perms
export function can(rolePerms, role, feature) {
  if (role === 'Admin') return true;
  return rolePerms[role]?.[feature] ?? false;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

const DEFAULT_CLINIC = {
  workDays: [1, 2, 3, 4, 5],
  startHour: '09', startPeriod: 'AM',
  endHour:   '05', endPeriod:   'PM',
  slotMinutes: 30,
  slotMode: 'clinic', // 'clinic' | 'periods'
  periods: {
    morning:   { startHour: '09', startPeriod: 'AM', endHour: '12', endPeriod: 'PM', enabled: true },
    afternoon: { startHour: '12', startPeriod: 'PM', endHour: '05', endPeriod: 'PM', enabled: true },
    evening:   { startHour: '05', startPeriod: 'PM', endHour: '09', endPeriod: 'PM', enabled: true },
  },
};

const PERIOD_DEFS = [
  { key: 'morning',   label: 'Morning'   },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening',   label: 'Evening'   },
];

function loadClinicConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('clinicConfig'));
    if (!saved) return DEFAULT_CLINIC;
    return {
      ...DEFAULT_CLINIC,
      ...saved,
      periods: { ...DEFAULT_CLINIC.periods, ...(saved.periods || {}) },
    };
  } catch { return DEFAULT_CLINIC; }
}

function toMinutes(hour, period) {
  let h = parseInt(hour, 10);
  if (period === 'AM' && h === 12) h = 0;
  if (period === 'PM' && h !== 12) h += 12;
  return h * 60;
}

function minutesToLabel(mins) {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

function minutesToValue(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function generateSlots(clinic) {
  const c = { ...DEFAULT_CLINIC, ...clinic, periods: { ...DEFAULT_CLINIC.periods, ...(clinic.periods || {}) } };

  if (c.slotMode === 'clinic') {
    // Flat list — all slots within clinic hours, no grouping
    const start = toMinutes(c.startHour, c.startPeriod);
    const end   = toMinutes(c.endHour,   c.endPeriod);
    const all = [];
    for (let t = start; t < end; t += c.slotMinutes)
      all.push({ value: minutesToValue(t), label: minutesToLabel(t) });
    return { all, morning: [], afternoon: [], evening: [] };
  }

  // Period mode — each period is independent; skip disabled ones
  const grouped = { all: [], morning: [], afternoon: [], evening: [] };
  for (const { key } of PERIOD_DEFS) {
    const p = c.periods[key];
    if (p.enabled === false) continue;
    const start = toMinutes(p.startHour, p.startPeriod);
    const end   = toMinutes(p.endHour,   p.endPeriod);
    for (let t = start; t < end; t += c.slotMinutes)
      grouped[key].push({ value: minutesToValue(t), label: minutesToLabel(t) });
  }
  return grouped;
}

// Mini time picker component
function TimePicker({ hourKey, periodKey, value, onChange }) {
  return (
    <div className="time-picker">
      <select value={value[hourKey]} onChange={e => onChange({ ...value, [hourKey]: e.target.value })}>
        {HOURS.map(h => <option key={h}>{h}</option>)}
      </select>
      <span className="time-sep">:</span>
      <span className="time-zero">00</span>
      <select value={value[periodKey]} onChange={e => onChange({ ...value, [periodKey]: e.target.value })}>
        <option>AM</option><option>PM</option>
      </select>
    </div>
  );
}

const DEFAULT_PROFILE = {
  name: '', tagline: '', phone: '', email: '', website: '',
  doctorName: '', doctorQualification: '', registrationNumber: '',
  currency: '₹', footerMessage: 'Thank you for your trust in us.',
  logo: '', logoType: 'logo', // 'logo' | 'banner'
};
function loadProfile() {
  try { return { ...DEFAULT_PROFILE, ...JSON.parse(localStorage.getItem('clinicProfile')) }; }
  catch { return DEFAULT_PROFILE; }
}

// ── License helpers ───────────────────────────────────────────────────────────
export function loadLicense() { return {}; } // kept for import compat; data now comes from DB
export async function fetchLicenseFromDB() {
  try { const r = await fetch('/api/license'); return r.ok ? await r.json() : {}; } catch { return {}; }
}
export function licenseStatus(lic) {
  if (!lic.expiryDate) return { valid: false, daysLeft: null, expired: false, noLicense: true };
  const today = new Date(); today.setHours(0,0,0,0);
  const exp   = new Date(lic.expiryDate); exp.setHours(0,0,0,0);
  const daysLeft = Math.ceil((exp - today) / 86400000);
  return { valid: daysLeft >= 0, daysLeft, expired: daysLeft < 0, noLicense: false };
}

const EMPTY_PATIENT = { firstName: '', lastName: '', dateOfBirth: '', gender: '', phone: '', email: '', address: '' };
const EMPTY_APPT    = { patientId: '', apptDate: '', apptSlot: '', reason: '', notes: '', status: 'Scheduled' };

// `short` is the label used on the phone tab bar, where space is tight.
const TAB_META = [
  { key: 'today',        label: 'Today',        icon: 'today' },
  { key: 'patients',     label: 'Patients',     icon: 'patients' },
  { key: 'appointments', label: 'Appointments', short: 'Visits', icon: 'appointments' },
  { key: 'billing',      label: 'Billing',      icon: 'billing' },
  { key: 'manage',       label: 'Manage',       icon: 'manage',   adminOnly: true },
  { key: 'settings',     label: 'Settings',     icon: 'settings', adminOnly: true },
];

function formatApptDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const h = d.getHours();
  const time = `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
  return `${day}, ${time}`;
}

function formatDob(value) {
  if (!value) return "—";
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function ageFrom(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const beforeBirthday = now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

function initialsOf(first, last) {
  return `${Array.from(first || '')[0] || ''}${Array.from(last || '')[0] || ''}`.toUpperCase() || '?';
}

// "34 years, Female" under a patient's name; skips whatever is missing
function patientSub(p) {
  const age = ageFrom(p.dateOfBirth);
  return [age !== null ? `${age} ${age === 1 ? 'year' : 'years'}` : null, p.gender].filter(Boolean).join(', ') || 'No details added';
}

export default function App() {
  // undefined: still asking the server whether this device is signed in
  const [currentUser, setCurrentUser] = useState(undefined);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null)
      .then(user => { if (!cancelled) setCurrentUser(user); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function onSignedOut() {
      setCurrentUser(prev => {
        if (prev) setNotice('You were signed out because the app was not used for a while, or your account was changed. Please sign in again.');
        return null;
      });
    }
    window.addEventListener('clinic:signed-out', onSignedOut);
    return () => window.removeEventListener('clinic:signed-out', onSignedOut);
  }, []);

  function handleLogin(user) { setNotice(''); setCurrentUser(user); }
  async function handleLogout() {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* already signed out */ }
    setNotice('');
    setCurrentUser(null);
  }

  if (currentUser === undefined) return null;
  if (!currentUser) return <LoginScreen onLogin={handleLogin} notice={notice} />;

  const role = currentUser.role;

  return <AppShell currentUser={currentUser} role={role} onLogout={handleLogout} />;
}

function AppShell({ currentUser, role, onLogout }) {
  const [tab, setTab] = useState('today');
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [patientForm, setPatientForm] = useState(EMPTY_PATIENT);
  const [apptForm, setApptForm] = useState(EMPTY_APPT);
  const [editingPatientId, setEditingPatientId] = useState(null);
  const [editingApptId, setEditingApptId] = useState(null);
  const [patientError, setPatientError] = useState('');
  const [apptError, setApptError] = useState('');
  const [clinic, setClinic] = useState(loadClinicConfig);
  const [showReg, setShowReg] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [recordsPatient, setRecordsPatient] = useState(null);
  const [clinicSaved, setClinicSaved] = useState(false);
  const [slotPeriod, setSlotPeriod] = useState('morning');
  const [profile, setProfile] = useState(loadProfile);
  const [profileSaved, setProfileSaved] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [whatsappPatient, setWhatsappPatient] = useState(null);
  const [rxPatient, setRxPatient] = useState(null);
  const [labPatient, setLabPatient] = useState(null);
  const [rolePerms, setRolePerms] = useState(DEFAULT_ROLE_PERMS);
  const [license, setLicense] = useState({});
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [moreOpen, setMoreOpen] = useState(false);

  // Load license and role permissions from the server on mount
  useEffect(() => { fetchLicenseFromDB().then(setLicense); }, []);
  useEffect(() => {
    fetchRolePerms()
      .then(state => (role === 'Admin' ? migrateLocalRolePerms(state) : state.perms))
      .then(setRolePerms);
  }, [role]);

  // Reload perms/license when Manage tab saves changes
  async function refreshPermsAndLicense() {
    const newPerms = (await fetchRolePerms()).perms;
    const newLic   = await fetchLicenseFromDB();
    setRolePerms(newPerms);
    setLicense(newLic);
    // If the active tab is now hidden, fall back to Today
    const stillVisible = TAB_META
      .filter(t => !t.adminOnly || role === 'Admin')
      .filter(t => t.key !== 'billing'      || can(newPerms, role, 'billing'))
      .filter(t => t.key !== 'appointments' || can(newPerms, role, 'appointments'))
      .map(t => t.key);
    setTab(prev => stillVisible.includes(prev) ? prev : 'today');
  }

  // Premium feature is available only if license is valid AND the feature is licensed
  const licStatus = licenseStatus(license);
  function premiumAvailable(feature) {
    if (licStatus.expired || licStatus.noLicense) return false;
    return license.features?.[feature] !== false; // default true if not explicitly disabled
  }

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  // Keep browser tab title in sync with clinic name from profile
  useEffect(() => {
    document.title = profile.name ? `${profile.name}` : 'Clinic';
  }, [profile.name]);

  useEffect(() => { fetchPatients(); fetchAppointments(); }, []);

  async function fetchPatients() {
    try {
      const res = await fetch('/api/patients');
      if (res.ok) setPatients(await res.json());
    } catch { /* server not yet ready — keep existing state */ }
  }
  async function fetchAppointments() {
    try {
      const res = await fetch('/api/appointments');
      if (res.ok) setAppointments(await res.json());
    } catch { /* server not yet ready — keep existing state */ }
  }

  // --- Patient handlers ---
  async function handlePatientSubmit(e) {
    e.preventDefault(); setPatientError('');
    try {
      const url = editingPatientId ? `/api/patients/${editingPatientId}` : '/api/patients';
      const res = await fetch(url, {
        method: editingPatientId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientForm),
      });
      if (!res.ok) {
        let msg = 'Failed to save patient.';
        try { msg = (await res.json()).error || msg; } catch {}
        setPatientError(msg); return;
      }
      setPatientForm(EMPTY_PATIENT); setEditingPatientId(null); fetchPatients();
    } catch {
      setPatientError('Cannot reach the server. Check your connection and try again.');
    }
  }
  function handlePatientEdit(p) { setEditingPatient(p); }
  async function handlePatientDelete(id) {
    if (!window.confirm('Delete this patient?')) return;
    try {
      const res = await fetch(`/api/patients/${id}`, { method: 'DELETE' });
      if (!res.ok) { alert('Failed to delete patient. They may have linked records or bills.'); return; }
      fetchPatients();
    } catch {
      alert('Cannot reach the server. Check your connection and try again.');
    }
  }

  // --- Appointment handlers ---
  async function handleApptSubmit(e) {
    e.preventDefault(); setApptError('');
    try {
      const date = apptForm.apptSlot ? `${apptForm.apptDate}T${apptForm.apptSlot}` : apptForm.apptDate;
      const url = editingApptId ? `/api/appointments/${editingApptId}` : '/api/appointments';
      const res = await fetch(url, {
        method: editingApptId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...apptForm, date }),
      });
      if (!res.ok) {
        let msg = 'Failed to save appointment.';
        try { msg = (await res.json()).error || msg; } catch {}
        setApptError(msg); return;
      }
      setApptForm(EMPTY_APPT); setEditingApptId(null); fetchAppointments();
    } catch {
      setApptError('Cannot reach the server. Check your connection and try again.');
    }
  }
  function handleApptEdit(a) {
    setEditingApptId(a.id);
    const d = new Date(a.date);
    const apptDate = d.toISOString().slice(0, 10);
    const apptSlot = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    setApptForm({ patientId: a.patientId, apptDate, apptSlot,
      reason: a.reason || '', notes: a.notes || '', status: a.status });
    if (clinic.slotMode === 'periods') {
      const slotMins = d.getHours() * 60 + d.getMinutes();
      const c = { ...DEFAULT_CLINIC, ...clinic, periods: { ...DEFAULT_CLINIC.periods, ...(clinic.periods || {}) } };
      for (const { key } of PERIOD_DEFS) {
        const p = c.periods[key];
        if (slotMins >= toMinutes(p.startHour, p.startPeriod) && slotMins < toMinutes(p.endHour, p.endPeriod)) {
          setSlotPeriod(key); break;
        }
      }
    }
  }
  async function handleApptDelete(id) {
    if (!window.confirm('Delete this appointment?')) return;
    try {
      const res = await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
      if (!res.ok) { alert('Failed to delete appointment.'); return; }
      fetchAppointments();
    } catch {
      alert('Cannot reach the server. Check your connection and try again.');
    }
  }

  // --- Clinic config ---
  function saveProfile(e) {
    e.preventDefault();
    localStorage.setItem('clinicProfile', JSON.stringify(profile));
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  function saveClinic(e) {
    e.preventDefault();
    localStorage.setItem('clinicConfig', JSON.stringify(clinic));
    setClinicSaved(true);
    setTimeout(() => setClinicSaved(false), 2000);
  }
  function toggleDay(day) {
    const days = clinic.workDays.includes(day)
      ? clinic.workDays.filter(d => d !== day)
      : [...clinic.workDays, day].sort();
    setClinic({ ...clinic, workDays: days });
  }
  function setPeriod(key, patch) {
    setClinic({ ...clinic, periods: { ...clinic.periods, [key]: { ...clinic.periods[key], ...patch } } });
  }

  function patientName(id) {
    const p = patients.find(p => p.id === id);
    return p ? `${p.firstName} ${p.lastName}` : '—';
  }

  function isWorkDay(dateStr) {
    if (!dateStr) return true;
    return clinic.workDays.includes(new Date(dateStr + 'T00:00:00').getDay());
  }

  const slotGroups = generateSlots(clinic);
  const visiblePeriods = clinic.slotMode === 'clinic'
    ? []
    : PERIOD_DEFS.filter(p => clinic.periods[p.key]?.enabled !== false && slotGroups[p.key].length > 0);

  const visibleTabs = TAB_META
    .filter(t => !t.adminOnly || role === 'Admin')
    .filter(t => t.key !== 'billing'      || can(rolePerms, role, 'billing'))
    .filter(t => t.key !== 'appointments' || can(rolePerms, role, 'appointments'));
  const activeTabLabel = visibleTabs.find(t => t.key === tab)?.label ?? '';

  // Phone tab bar: everyone's tabs sit in the bar, admin-only tabs live under "More"
  const barTabs = visibleTabs.filter(t => !t.adminOnly);
  const moreTabs = visibleTabs.filter(t => t.adminOnly);
  const moreActive = moreTabs.some(t => t.key === tab);
  const canEditPatients = can(rolePerms, role, 'editPatients');
  const userInitial = (Array.from(currentUser.name || '')[0] || '?').toUpperCase();

  function goTo(key) {
    setTab(key);
    setMoreOpen(false);
    window.scrollTo(0, 0);
  }

  const pageLede = tab === 'patients'
    ? (patients.length === 1 ? '1 patient registered.' : `${patients.length} patients registered.`)
    : tab === 'appointments'
      ? (appointments.length === 1 ? '1 appointment in total.' : `${appointments.length} appointments in total.`)
      : '';

  return (
    <div className="app" data-theme={darkMode ? 'dark' : 'light'}>

      {/* ── Rail (desktop) ── */}
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-brand">
          <div className="sidebar-brand-row">
            {profile.logo && profile.logoType === 'logo'
              ? <img src={profile.logo} alt="Clinic logo" className="sidebar-logo" />
              : <div className="sidebar-logo-placeholder"><Icon name="tooth" size={22} /></div>
            }
            <div className="sidebar-brand-text">
              <span className="sidebar-clinic-name">{profile.name || 'My Clinic'}</span>
              {profile.doctorName && <span className="sidebar-clinic-sub">{profile.doctorName}</span>}
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {visibleTabs.map(({ key, label, icon }) => (
            <button
              key={key}
              className={tab === key ? 'nav-item active' : 'nav-item'}
              onClick={() => goTo(key)}
              aria-current={tab === key ? 'page' : undefined}
            >
              <Icon name={icon} />
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">{userInitial}</div>
            <div className="sidebar-user-text">
              <div className="sidebar-user-name">{currentUser.name}</div>
              <div className="sidebar-user-role">{role}</div>
            </div>
          </div>
          <div className="rail-actions">
            <button type="button" className="rail-btn" onClick={() => setDarkMode(d => !d)}>
              <Icon name={darkMode ? 'sun' : 'moon'} size={18} />
              {darkMode ? 'Light mode' : 'Dark mode'}
            </button>
            <button type="button" className="rail-btn" onClick={onLogout}>
              <Icon name="logout" size={18} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="main-content">

      <div className="main-body">

      {tab === 'today' && (
        <TodayTab
          userName={currentUser.name}
          patients={patients}
          appointments={appointments}
          canAppointments={can(rolePerms, role, 'appointments')}
          canBilling={can(rolePerms, role, 'billing')}
          canEditPatients={canEditPatients}
          currency={profile.currency || '₹'}
          onRegister={() => setShowReg(true)}
          onOpenTab={goTo}
        />
      )}

      {tab !== 'today' && (
        <div className="page-head">
          <div>
            <h1>{activeTabLabel}</h1>
            {pageLede && <p className="lede">{pageLede}</p>}
          </div>
          {tab === 'patients' && (
            <div className="page-actions">
              <label className="search-field">
                <Icon name="search" size={18} />
                <span className="sr-only">Search patients</span>
                <input
                  className="patient-search"
                  placeholder="Search by name, phone or email"
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                />
              </label>
              {canEditPatients && (
                <>
                  <button type="button" className="btn-quick-add" onClick={() => setShowQuickAdd(v => !v)}>
                    {showQuickAdd ? 'Hide quick add' : 'Quick add'}
                  </button>
                  <button type="button" className="btn-register" onClick={() => setShowReg(true)}>
                    <Icon name="plus" /> Register patient
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}


      {/* ── Patients ── */}
      {tab === 'patients' && (
        <>
          {showQuickAdd && can(rolePerms, role, 'editPatients') && (
          <section className="card quick-add-card">
            <h2>{editingPatientId ? 'Edit patient' : 'Quick add patient'}</h2>
            {patientError && <p className="error">{patientError}</p>}
            <form onSubmit={handlePatientSubmit} className="form">
              <div className="form-row">
                <input placeholder="First name" value={patientForm.firstName}
                  onChange={e => setPatientForm({ ...patientForm, firstName: e.target.value })} required />
                <input placeholder="Last name" value={patientForm.lastName}
                  onChange={e => setPatientForm({ ...patientForm, lastName: e.target.value })} required />
              </div>
              <div className="form-row">
                <input type="date" value={patientForm.dateOfBirth}
                  onChange={e => setPatientForm({ ...patientForm, dateOfBirth: e.target.value })} required />
                <select value={patientForm.gender}
                  onChange={e => setPatientForm({ ...patientForm, gender: e.target.value })} required>
                  <option value="">Gender</option>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div className="form-row">
                <input placeholder="Phone" value={patientForm.phone}
                  onChange={e => setPatientForm({ ...patientForm, phone: e.target.value })} />
                <input type="email" placeholder="Email" value={patientForm.email}
                  onChange={e => setPatientForm({ ...patientForm, email: e.target.value })} />
              </div>
              <textarea placeholder="Address" value={patientForm.address} rows={2}
                onChange={e => setPatientForm({ ...patientForm, address: e.target.value })} />
              <div className="form-actions">
                <button type="submit">{editingPatientId ? 'Update' : 'Add patient'}</button>
                {editingPatientId && (
                  <button type="button" className="secondary"
                    onClick={() => { setPatientForm(EMPTY_PATIENT); setEditingPatientId(null); setPatientError(''); }}>Cancel</button>
                )}
              </div>
            </form>
          </section>
          )}
          <section className="card list-card">
            {patients.length === 0 ? (
              <div className="empty-state">
                <ToothRow width={260} />
                <h2>No patients yet</h2>
                <p>Register your first patient to start their record, book visits and create bills.</p>
                {canEditPatients && (
                  <button type="button" onClick={() => setShowReg(true)}><Icon name="plus" /> Register patient</button>
                )}
              </div>
            ) : (() => {
              const filtered = patients.filter(p => {
                const q = patientSearch.toLowerCase();
                return !q ||
                  `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
                  (p.phone  || '').toLowerCase().includes(q) ||
                  (p.email  || '').toLowerCase().includes(q);
              });
              if (filtered.length === 0) return <p className="empty">No patients match "{patientSearch}".</p>;
              const patientActions = (p) => <>
                {can(rolePerms, role, 'medicalRecords') && <button type="button" onClick={() => setRecordsPatient(p)} className="btn-records">Records</button>}
                {canEditPatients && <button type="button" onClick={() => handlePatientEdit(p)} className="btn-edit">Edit</button>}
                {can(rolePerms, role, 'whatsapp') && <button type="button" onClick={() => setWhatsappPatient(p)} className="btn-whatsapp" title="Send WhatsApp message" aria-label="Send WhatsApp message"><Icon name="message" size={18} /></button>}
                {premiumAvailable('prescriptions') && can(rolePerms, role, 'prescriptions') && <button type="button" onClick={() => setRxPatient(p)} className="btn-rx" title="Prescriptions" aria-label="Prescriptions">Rx</button>}
                {premiumAvailable('labResults')    && can(rolePerms, role, 'labResults')    && <button type="button" onClick={() => setLabPatient(p)} className="btn-lab" title="Lab results" aria-label="Lab results"><Icon name="flask" size={18} /></button>}
                {canEditPatients && <button type="button" onClick={() => handlePatientDelete(p.id)} className="btn-delete icon-only" title="Delete patient" aria-label="Delete patient"><Icon name="trash" size={18} /></button>}
              </>;
              return (
                <>
                  {/* Desktop: table */}
                  <div className="patients-table-wrap">
                    <table>
                      <thead><tr><th>Name</th><th>Date of birth</th><th>Phone</th><th>Email</th><th>Actions</th></tr></thead>
                      <tbody>
                        {filtered.map(p => (
                          <tr key={p.id}>
                            <td>
                              <div className="pt-cell">
                                <span className={`tile tone-${(p.id % 4) + 1}`}>{initialsOf(p.firstName, p.lastName)}</span>
                                <div>
                                  <div className="pt-cell-name">{p.firstName} {p.lastName}</div>
                                  <div className="pt-cell-sub">{patientSub(p)}</div>
                                </div>
                              </div>
                            </td>
                            <td>{formatDob(p.dateOfBirth)}</td>
                            <td>{p.phone || '—'}</td><td>{p.email || '—'}</td>
                            <td><div className="row-actions">{patientActions(p)}</div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Tablet / mobile: card grid */}
                  <div className="patients-card-grid">
                    {filtered.map(p => (
                      <div key={p.id} className="pt-card">
                        <div className="pt-card-head">
                          <span className={`tile tone-${(p.id % 4) + 1}`}>{initialsOf(p.firstName, p.lastName)}</span>
                          <div>
                            <div className="pt-card-name">{p.firstName} {p.lastName}</div>
                            <div className="pt-cell-sub">{patientSub(p)}</div>
                          </div>
                        </div>
                        <div className="pt-card-meta">
                          {p.dateOfBirth && <span className="pt-meta-item"><span className="pt-meta-label">Born</span>{formatDob(p.dateOfBirth)}</span>}
                          {p.phone       && <span className="pt-meta-item"><span className="pt-meta-label">Phone</span>{p.phone}</span>}
                          {p.email       && <span className="pt-meta-item"><span className="pt-meta-label">Email</span>{p.email}</span>}
                        </div>
                        <div className="pt-card-actions">{patientActions(p)}</div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </section>
        </>
      )}

      {/* ── Appointments ── */}
      {tab === 'appointments' && (
        <>
          <section className="card">
            <h2>{editingApptId ? 'Edit appointment' : 'Add appointment'}</h2>
            {apptError && <p className="error">{apptError}</p>}
            {patients.length === 0
              ? <p className="empty">Add a patient first before scheduling appointments.</p>
              : (
              <form onSubmit={handleApptSubmit} className="form">
                <div className="form-row">
                  <select value={apptForm.patientId}
                    onChange={e => setApptForm({ ...apptForm, patientId: e.target.value })} required>
                    <option value="">Select patient</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                  </select>
                  <select value={apptForm.status}
                    onChange={e => setApptForm({ ...apptForm, status: e.target.value })}>
                    <option>Scheduled</option><option>Completed</option><option>Cancelled</option>
                  </select>
                </div>
                <div className="form-row">
                  <input type="date" value={apptForm.apptDate}
                    onChange={e => { setApptForm({ ...apptForm, apptDate: e.target.value, apptSlot: '' }); setSlotPeriod('morning'); }} required />
                  {apptForm.apptDate && (
                    isWorkDay(apptForm.apptDate) ? (
                      <div className="slot-picker">
                        {/* Period mode tabs */}
                        {clinic.slotMode === 'periods' && (
                          <div className="slot-period-tabs">
                            {visiblePeriods.map(p => (
                              <button key={p.key} type="button"
                                className={slotPeriod === p.key ? 'slot-tab active' : 'slot-tab'}
                                onClick={() => { setSlotPeriod(p.key); setApptForm({ ...apptForm, apptSlot: '' }); }}>
                                {p.label}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="slot-grid">
                          {(clinic.slotMode === 'clinic' ? slotGroups.all : slotGroups[slotPeriod]).map(s => (
                            <button key={s.value} type="button"
                              className={apptForm.apptSlot === s.value ? 'slot-btn active' : 'slot-btn'}
                              onClick={() => setApptForm({ ...apptForm, apptSlot: s.value })}>
                              {s.label}
                            </button>
                          ))}
                          {(clinic.slotMode === 'clinic' ? slotGroups.all : slotGroups[slotPeriod]).length === 0 && (
                            <p className="empty">No slots available.</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="closed-msg">Clinic closed on {new Date(apptForm.apptDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}s</p>
                    )
                  )}
                </div>
                <div className="form-row">
                  <input placeholder="Reason" value={apptForm.reason}
                    onChange={e => setApptForm({ ...apptForm, reason: e.target.value })} />
                </div>
                <textarea placeholder="Notes" value={apptForm.notes} rows={2}
                  onChange={e => setApptForm({ ...apptForm, notes: e.target.value })} />
                <div className="form-actions">
                  <button type="submit" disabled={apptForm.apptDate && !isWorkDay(apptForm.apptDate)}>
                    {editingApptId ? 'Update' : 'Add appointment'}
                  </button>
                  {editingApptId && (
                    <button type="button" className="secondary"
                      onClick={() => { setApptForm(EMPTY_APPT); setEditingApptId(null); setApptError(''); }}>Cancel</button>
                  )}
                </div>
              </form>
            )}
          </section>
          <section className="card list-card">
            {appointments.length === 0 ? <p className="empty">No appointments yet.</p> : (
              <>
                {/* Desktop: table */}
                <div className="appts-table-wrap">
                  <table>
                    <thead><tr><th>Patient</th><th>Date and time</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {appointments.map(a => (
                        <tr key={a.id}>
                          <td>{patientName(a.patientId)}</td>
                          <td>{formatApptDate(a.date)}</td>
                          <td>{a.reason || '—'}</td>
                          <td><span className={`badge badge-${a.status.toLowerCase()}`}>{a.status}</span></td>
                          <td>
                            <div className="row-actions">
                            <button type="button" onClick={() => handleApptEdit(a)} className="btn-edit">Edit</button>
                              <button type="button" onClick={() => handleApptDelete(a.id)} className="btn-delete icon-only" title="Delete appointment" aria-label="Delete appointment"><Icon name="trash" size={18} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Tablet / mobile: card grid */}
                <div className="appts-card-grid">
                  {appointments.map(a => (
                    <div key={a.id} className="appt-card">
                      <div className="appt-card-top">
                        <span className="appt-card-patient">{patientName(a.patientId)}</span>
                        <span className={`badge badge-${a.status.toLowerCase()}`}>{a.status}</span>
                      </div>
                      <div className="appt-card-date">{formatApptDate(a.date)}</div>
                      {a.reason && <div className="appt-card-reason">{a.reason}</div>}
                      <div className="appt-card-actions">
                        <button type="button" onClick={() => handleApptEdit(a)} className="btn-edit">Edit</button>
                        <button type="button" onClick={() => handleApptDelete(a.id)} className="btn-delete icon-only" title="Delete appointment" aria-label="Delete appointment"><Icon name="trash" size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      )}

      {showReg && (
        <PatientRegistration
          onClose={() => setShowReg(false)}
          onSaved={() => fetchPatients()}
        />
      )}
      {editingPatient && (
        <PatientEditModal
          patient={editingPatient}
          onClose={() => setEditingPatient(null)}
          onSaved={() => fetchPatients()}
        />
      )}
      {recordsPatient && (
        <PatientRecordsModal
          patient={recordsPatient}
          onClose={() => setRecordsPatient(null)}
        />
      )}
      {whatsappPatient && (
        <WhatsAppModal
          patient={whatsappPatient}
          onClose={() => setWhatsappPatient(null)}
        />
      )}
      {rxPatient && (
        <PrescriptionModal
          patient={rxPatient}
          onClose={() => setRxPatient(null)}
        />
      )}
      {labPatient && (
        <LabResultModal
          patient={labPatient}
          onClose={() => setLabPatient(null)}
        />
      )}

      {/* ── Billing ── */}
      {tab === 'billing' && <BillingTab patients={patients} />}

      {/* ── Manage ── */}
      {tab === 'manage' && (
        <ManageTab currentUser={currentUser} onSaved={refreshPermsAndLicense} />
      )}

      {/* ── Settings ── */}
      {tab === 'settings' && (

        <>
        <section className="card">
          <h2>Clinic profile</h2>
          <form onSubmit={saveProfile} className="form">

            {/* Logo / Banner */}
            <div className="setting-divider">Logo or banner</div>
            <div className="setting-row">
              <label className="setting-label">Display type</label>
              <div className="mode-toggle">
                <button type="button"
                  className={profile.logoType === 'logo' ? 'mode-btn active' : 'mode-btn'}
                  onClick={() => setProfile(p => ({ ...p, logoType: 'logo' }))}>
                  Logo
                </button>
                <button type="button"
                  className={profile.logoType === 'banner' ? 'mode-btn active' : 'mode-btn'}
                  onClick={() => setProfile(p => ({ ...p, logoType: 'banner' }))}>
                  Banner
                </button>
              </div>
            </div>
            <div className="setting-row" style={{ alignItems: 'flex-start', gap: '1.25rem' }}>
              {profile.logo ? (
                profile.logoType === 'logo'
                  ? <img src={profile.logo} alt="Clinic logo" className="setting-preview" style={{ width: 80, height: 80 }} />
                  : <img src={profile.logo} alt="Clinic banner" className="setting-preview" style={{ width: 320, height: 72, objectFit: 'cover' }} />
              ) : (
                <div className="setting-preview-empty" style={{ width: profile.logoType === 'banner' ? 320 : 80 }}>
                  No {profile.logoType} yet
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ cursor: 'pointer' }}>
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => setProfile(p => ({ ...p, logo: ev.target.result }));
                      reader.readAsDataURL(file);
                    }} />
                  <span className="btn-upload">Upload {profile.logoType === 'banner' ? 'Banner' : 'Logo'}</span>
                </label>
                {profile.logo && (
                  <button type="button" className="secondary"
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}
                    onClick={() => setProfile(p => ({ ...p, logo: '' }))}>Remove</button>
                )}
                <span className="setting-hint">
                  {profile.logoType === 'logo'
                    ? <>Recommended: <b>200 × 200 px</b> (square). PNG or JPG, shown beside the clinic name on bills and in the app.</>
                    : <>Recommended: <b>1200 × 200 px</b> (wide). PNG or JPG, shown full width above bill content and in the app.</>}
                </span>
              </div>
            </div>

            {/* Identity */}
            <div className="setting-divider">Clinic identity</div>
            <div className="setting-row">
              <label className="setting-label">Clinic name</label>
              <input style={{ maxWidth: 340 }} placeholder="e.g. City Health Clinic"
                value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} />
            </div>
            <div className="setting-row">
              <label className="setting-label">Address</label>
              <input style={{ maxWidth: 420 }} placeholder="123 Main St, City, State – PIN"
                value={profile.tagline} onChange={e => setProfile({ ...profile, tagline: e.target.value })} />
            </div>

            {/* Contact */}
            <div className="setting-divider">Contact</div>
            <div className="setting-row">
              <label className="setting-label">Phone</label>
              <input style={{ maxWidth: 220 }} placeholder="+91 98765 43210"
                value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
            </div>
            <div className="setting-row">
              <label className="setting-label">Email</label>
              <input type="email" style={{ maxWidth: 280 }} placeholder="clinic@example.com"
                value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} />
            </div>
            <div className="setting-row">
              <label className="setting-label">Website</label>
              <input style={{ maxWidth: 300 }} placeholder="www.yourclinic.com"
                value={profile.website} onChange={e => setProfile({ ...profile, website: e.target.value })} />
            </div>

            {/* Doctor */}
            <div className="setting-divider">Doctor or practitioner</div>
            <div className="setting-row">
              <label className="setting-label">Doctor name</label>
              <input style={{ maxWidth: 280 }} placeholder="Dr. Full Name"
                value={profile.doctorName} onChange={e => setProfile({ ...profile, doctorName: e.target.value })} />
            </div>
            <div className="setting-row">
              <label className="setting-label">Qualification</label>
              <input style={{ maxWidth: 280 }} placeholder="MBBS, MD (General Medicine)"
                value={profile.doctorQualification} onChange={e => setProfile({ ...profile, doctorQualification: e.target.value })} />
            </div>
            <div className="setting-row">
              <label className="setting-label">Registration number</label>
              <input style={{ maxWidth: 220 }} placeholder="MCI/State council reg. no."
                value={profile.registrationNumber} onChange={e => setProfile({ ...profile, registrationNumber: e.target.value })} />
            </div>

            {/* Billing */}
            <div className="setting-divider">Billing</div>
            <div className="setting-row">
              <label className="setting-label">Currency symbol</label>
              <input style={{ maxWidth: 80 }} placeholder="₹"
                value={profile.currency} onChange={e => setProfile({ ...profile, currency: e.target.value })} />
            </div>
            <div className="setting-row" style={{ alignItems: 'flex-start' }}>
              <label className="setting-label" style={{ paddingTop: '0.5rem' }}>Bill footer</label>
              <textarea style={{ maxWidth: 420 }} rows={2}
                placeholder="Thank you for your trust in us. Payment due within 7 days."
                value={profile.footerMessage} onChange={e => setProfile({ ...profile, footerMessage: e.target.value })} />
            </div>

            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button type="submit">Save profile</button>
              {profileSaved && <span className="saved-msg">Saved</span>}
            </div>
          </form>
        </section>
        <section className="card">
          <h2>Clinic settings</h2>
          <form onSubmit={saveClinic} className="form">

            {/* Work Days */}
            <div className="setting-row">
              <label className="setting-label">Work days</label>
              <div className="day-toggles">
                {DAYS.map((d, i) => (
                  <button key={i} type="button"
                    className={clinic.workDays.includes(i) ? 'day-btn active' : 'day-btn'}
                    onClick={() => toggleDay(i)}>{d}</button>
                ))}
              </div>
            </div>

            {/* Clinic Hours */}
            <div className="setting-divider">Clinic hours</div>
            <div className="setting-row">
              <label className="setting-label">Opening time</label>
              <TimePicker hourKey="startHour" periodKey="startPeriod" value={clinic}
                onChange={v => setClinic({ ...clinic, startHour: v.startHour, startPeriod: v.startPeriod })} />
            </div>
            <div className="setting-row">
              <label className="setting-label">Closing time</label>
              <TimePicker hourKey="endHour" periodKey="endPeriod" value={clinic}
                onChange={v => setClinic({ ...clinic, endHour: v.endHour, endPeriod: v.endPeriod })} />
            </div>
            <div className="setting-row">
              <label className="setting-label">Slot duration</label>
              <select value={clinic.slotMinutes} style={{ maxWidth: 160 }}
                onChange={e => setClinic({ ...clinic, slotMinutes: Number(e.target.value) })}>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>

            {/* Slot Mode Switch */}
            <div className="setting-divider">Time slot display</div>
            <div className="setting-row">
              <label className="setting-label">Show slots by</label>
              <div className="mode-toggle">
                <button type="button"
                  className={clinic.slotMode === 'clinic' ? 'mode-btn active' : 'mode-btn'}
                  onClick={() => setClinic({ ...clinic, slotMode: 'clinic' })}>
                  Clinic hours
                </button>
                <button type="button"
                  className={clinic.slotMode === 'periods' ? 'mode-btn active' : 'mode-btn'}
                  onClick={() => setClinic({ ...clinic, slotMode: 'periods' })}>
                  Time periods
                </button>
              </div>
            </div>

            {/* Period config — only shown when mode is 'periods' */}
            {clinic.slotMode === 'periods' && (
              <>
                <div className="setting-divider">Time period ranges</div>
                {PERIOD_DEFS.map(({ key, label }) => {
                  const enabled = clinic.periods[key]?.enabled !== false;
                  return (
                    <div key={key} className={`period-setting${enabled ? '' : ' period-disabled'}`}>
                      <div className="period-setting-header">
                        <span className="period-setting-label">{label}</span>
                        <button type="button"
                          className={enabled ? 'period-toggle on' : 'period-toggle off'}
                          onClick={() => setPeriod(key, { enabled: !enabled })}>
                          {enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>
                      {enabled && (
                        <div className="period-setting-times">
                          <span className="period-time-caption">From</span>
                          <TimePicker hourKey="startHour" periodKey="startPeriod"
                            value={clinic.periods[key]}
                            onChange={v => setPeriod(key, { startHour: v.startHour, startPeriod: v.startPeriod })} />
                          <span className="period-time-caption">To</span>
                          <TimePicker hourKey="endHour" periodKey="endPeriod"
                            value={clinic.periods[key]}
                            onChange={v => setPeriod(key, { endHour: v.endHour, endPeriod: v.endPeriod })} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button type="submit">Save settings</button>
              {clinicSaved && <span className="saved-msg">Saved</span>}
            </div>
          </form>
        </section>
        <WhatsAppSettings />
        </>
      )}
      </div>{/* main-body */}
      </div>{/* main-content */}

      {/* ── Tab bar (phone and tablet) ── */}
      <nav className="tabbar" aria-label="Main navigation">
        {barTabs.map(({ key, label, short, icon }) => (
          <button
            key={key}
            type="button"
            className={tab === key ? 'tab active' : 'tab'}
            onClick={() => goTo(key)}
            aria-current={tab === key ? 'page' : undefined}
          >
            <span className="tab-pill"><Icon name={icon} size={21} /></span>
            {short || label}
          </button>
        ))}
        <button
          type="button"
          className={moreOpen || moreActive ? 'tab active' : 'tab'}
          onClick={() => setMoreOpen(o => !o)}
          aria-expanded={moreOpen}
        >
          <span className="tab-pill"><Icon name="more" size={21} /></span>
          More
        </button>
      </nav>

      {moreOpen && (
        <>
          <div className="more-backdrop" onClick={() => setMoreOpen(false)} />
          <div className="more-sheet" role="dialog" aria-label="More options">
            <div className="more-grab" />
            <div className="more-who">
              <div className="avatar">{userInitial}</div>
              <div className="sidebar-user-text">
                <div className="sidebar-user-name">{currentUser.name}</div>
                <div className="sidebar-user-role">{role}</div>
              </div>
            </div>
            {moreTabs.map(({ key, label, icon }) => (
              <button key={key} type="button" className="more-item" onClick={() => goTo(key)}>
                <Icon name={icon} />{label}
              </button>
            ))}
            <button type="button" className="more-item" onClick={() => { setDarkMode(d => !d); setMoreOpen(false); }}>
              <Icon name={darkMode ? 'sun' : 'moon'} />{darkMode ? 'Light mode' : 'Dark mode'}
            </button>
            <button type="button" className="more-item danger" onClick={onLogout}>
              <Icon name="logout" />Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
