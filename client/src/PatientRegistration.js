import { useState } from 'react';
import './PatientRegistration.css';

const STEPS = [
  { title: 'Personal Info',     icon: '👤' },
  { title: 'Contact Details',   icon: '📞' },
  { title: 'Emergency Contact', icon: '🚨' },
  { title: 'Medical Info',      icon: '🏥' },
];

const EMPTY = {
  firstName: '', lastName: '', dateOfBirth: '', gender: '', bloodType: '',
  phone: '', email: '', address: '',
  emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: '',
  allergies: '', currentMedications: '', medicalConditions: '',
};

export default function PatientRegistration({ onClose, onSaved }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  function validateStep() {
    if (step === 0) {
      if (!form.firstName.trim()) return 'First name is required.';
      if (!form.lastName.trim())  return 'Last name is required.';
      if (!form.dateOfBirth)      return 'Date of birth is required.';
      if (!form.gender)           return 'Gender is required.';
    }
    return '';
  }

  function next() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setStep(s => s + 1);
  }

  function back() { setError(''); setStep(s => s - 1); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, bloodType: form.bloodType || null }),
    });
    setSubmitting(false);
    if (!res.ok) { setError((await res.json()).error || 'Something went wrong.'); return; }
    setDone(true);
    onSaved();
  }

  if (done) return (
    <div className="reg-overlay">
      <div className="reg-modal">
        <div className="reg-success">
          <div className="reg-success-icon">✅</div>
          <h2>Patient Registered!</h2>
          <p>{form.firstName} {form.lastName} has been successfully registered.</p>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="reg-overlay">
      <div className="reg-modal">
        {/* Header */}
        <div className="reg-header">
          <h2>Patient Registration</h2>
          <button className="reg-close" onClick={onClose} type="button">✕</button>
        </div>

        {/* Step indicator */}
        <div className="reg-steps">
          {STEPS.map((s, i) => (
            <div key={i} className={`reg-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
              <div className="reg-step-circle">{i < step ? '✓' : s.icon}</div>
              <span className="reg-step-label">{s.title}</span>
              {i < STEPS.length - 1 && <div className="reg-step-line" />}
            </div>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="reg-form">
          {error && <p className="reg-error">{error}</p>}

          {/* Step 0 — Personal Info */}
          {step === 0 && (
            <div className="reg-fields">
              <div className="reg-row">
                <div className="reg-field">
                  <label>First Name *</label>
                  <input value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="First name" />
                </div>
                <div className="reg-field">
                  <label>Last Name *</label>
                  <input value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Last name" />
                </div>
              </div>
              <div className="reg-row">
                <div className="reg-field">
                  <label>Date of Birth *</label>
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
                  <label>Blood Type</label>
                  <select value={form.bloodType} onChange={e => set('bloodType', e.target.value)}>
                    <option value="">Select blood type</option>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown'].map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 1 — Contact Details */}
          {step === 1 && (
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

          {/* Step 2 — Emergency Contact */}
          {step === 2 && (
            <div className="reg-fields">
              <div className="reg-row">
                <div className="reg-field">
                  <label>Contact Name</label>
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
                  <label>Contact Phone</label>
                  <input value={form.emergencyContactPhone} onChange={e => set('emergencyContactPhone', e.target.value)} placeholder="Phone number" />
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Medical Info */}
          {step === 3 && (
            <div className="reg-fields">
              <div className="reg-field">
                <label>Known Allergies</label>
                <textarea value={form.allergies} onChange={e => set('allergies', e.target.value)}
                  placeholder="e.g. Penicillin, Peanuts, Latex" rows={2} />
              </div>
              <div className="reg-field">
                <label>Current Medications</label>
                <textarea value={form.currentMedications} onChange={e => set('currentMedications', e.target.value)}
                  placeholder="e.g. Metformin 500mg, Lisinopril 10mg" rows={2} />
              </div>
              <div className="reg-field">
                <label>Existing Medical Conditions</label>
                <textarea value={form.medicalConditions} onChange={e => set('medicalConditions', e.target.value)}
                  placeholder="e.g. Type 2 Diabetes, Hypertension" rows={2} />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="reg-actions">
            {step > 0 && (
              <button type="button" className="secondary" onClick={back}>← Back</button>
            )}
            <div className="reg-step-counter">{step + 1} / {STEPS.length}</div>
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={next}>Next →</button>
            ) : (
              <button type="submit" disabled={submitting}>
                {submitting ? 'Registering…' : 'Register Patient'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
