import { useState } from 'react';
import Icon from './icons';
import './PatientRegistration.css';
import './PatientEditModal.css';

const SECTIONS = [
  { key: 'personal',   label: 'Personal info' },
  { key: 'contact',    label: 'Contact details' },
  { key: 'emergency',  label: 'Emergency contact' },
  { key: 'medical',    label: 'Medical info' },
];

export default function PatientEditModal({ patient, onClose, onSaved }) {
  const [section, setSection] = useState('personal');
  const [form, setForm] = useState({
    firstName:               patient.firstName              || '',
    lastName:                patient.lastName               || '',
    dateOfBirth:             patient.dateOfBirth            || '',
    gender:                  patient.gender                 || '',
    bloodType:               patient.bloodType              || '',
    phone:                   patient.phone                  || '',
    email:                   patient.email                  || '',
    address:                 patient.address                || '',
    emergencyContactName:     patient.emergencyContactName     || '',
    emergencyContactPhone:    patient.emergencyContactPhone    || '',
    emergencyContactRelation: patient.emergencyContactRelation || '',
    allergies:               patient.allergies              || '',
    currentMedications:      patient.currentMedications     || '',
    medicalConditions:       patient.medicalConditions      || '',
  });
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.dateOfBirth || !form.gender) {
      setSection('personal');
      setError('First name, last name, date of birth and gender are required.');
      return;
    }
    setError(''); setSaving(true);
    const res = await fetch(`/api/patients/${patient.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error || 'Save failed.'); return; }
    onSaved();
    onClose();
  }

  return (
    <div className="reg-overlay">
      <div className="reg-modal edit-modal">
        {/* Header */}
        <div className="reg-header">
          <h2>Edit {patient.firstName} {patient.lastName}</h2>
          <button className="reg-close" onClick={onClose} type="button" aria-label="Close"><Icon name="close" size={18} /></button>
        </div>

        {/* Section tabs */}
        <div className="edit-tabs">
          {SECTIONS.map(s => (
            <button key={s.key} type="button"
              className={section === s.key ? 'edit-tab active' : 'edit-tab'}
              onClick={() => { setSection(s.key); setError(''); }}>
              {s.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSave} className="reg-form">
          {error && <p className="reg-error">{error}</p>}

          {/* Personal Info */}
          {section === 'personal' && (
            <div className="reg-fields">
              <div className="reg-row">
                <div className="reg-field">
                  <label>First name *</label>
                  <input value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="First name" />
                </div>
                <div className="reg-field">
                  <label>Last name *</label>
                  <input value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Last name" />
                </div>
              </div>
              <div className="reg-row">
                <div className="reg-field">
                  <label>Date of birth *</label>
                  <input type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} />
                </div>
                <div className="reg-field">
                  <label>Gender *</label>
                  <select value={form.gender} onChange={e => set('gender', e.target.value)}>
                    <option value="">Select gender</option>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
              </div>
              <div className="reg-row">
                <div className="reg-field">
                  <label>Blood type</label>
                  <select value={form.bloodType} onChange={e => set('bloodType', e.target.value)}>
                    <option value="">Select blood type</option>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown'].map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Contact Details */}
          {section === 'contact' && (
            <div className="reg-fields">
              <div className="reg-row">
                <div className="reg-field">
                  <label>Phone</label>
                  <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="Phone number" />
                </div>
                <div className="reg-field">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="Email address" />
                </div>
              </div>
              <div className="reg-field">
                <label>Address</label>
                <textarea value={form.address} onChange={e => set('address', e.target.value)} placeholder="Full address" rows={3} />
              </div>
            </div>
          )}

          {/* Emergency Contact */}
          {section === 'emergency' && (
            <div className="reg-fields">
              <div className="reg-row">
                <div className="reg-field">
                  <label>Contact name</label>
                  <input value={form.emergencyContactName} onChange={e => set('emergencyContactName', e.target.value)} placeholder="Full name" />
                </div>
                <div className="reg-field">
                  <label>Relationship</label>
                  <select value={form.emergencyContactRelation} onChange={e => set('emergencyContactRelation', e.target.value)}>
                    <option value="">Select relationship</option>
                    {['Spouse','Parent','Sibling','Child','Friend','Guardian','Other'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="reg-row">
                <div className="reg-field">
                  <label>Contact phone</label>
                  <input value={form.emergencyContactPhone} onChange={e => set('emergencyContactPhone', e.target.value)} placeholder="Phone number" />
                </div>
              </div>
            </div>
          )}

          {/* Medical Info */}
          {section === 'medical' && (
            <div className="reg-fields">
              <div className="reg-field">
                <label>Known allergies</label>
                <textarea value={form.allergies} onChange={e => set('allergies', e.target.value)}
                  placeholder="e.g. Penicillin, Peanuts, Latex" rows={2} />
              </div>
              <div className="reg-field">
                <label>Current medications</label>
                <textarea value={form.currentMedications} onChange={e => set('currentMedications', e.target.value)}
                  placeholder="e.g. Metformin 500mg, Lisinopril 10mg" rows={2} />
              </div>
              <div className="reg-field">
                <label>Existing medical conditions</label>
                <textarea value={form.medicalConditions} onChange={e => set('medicalConditions', e.target.value)}
                  placeholder="e.g. Type 2 Diabetes, Hypertension" rows={2} />
              </div>
            </div>
          )}

          <div className="reg-actions">
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
            <div />
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
