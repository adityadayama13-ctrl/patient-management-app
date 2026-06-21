import { useEffect, useState, useCallback } from 'react';
import './PrescriptionModal.css';

const FREQUENCIES = [
  'Once daily', 'Twice daily', 'Three times daily', 'Four times daily',
  'Every 6 hours', 'Every 8 hours', 'Every 12 hours',
  'At bedtime', 'As needed (SOS)', 'Weekly', 'Other',
];
const INSTRUCTIONS = [
  'Before meals', 'After meals', 'With food', 'With water',
  'At bedtime', 'On empty stomach', 'As directed',
];
const DURATIONS = [
  '1 day', '3 days', '5 days', '7 days', '10 days', '14 days',
  '1 month', '2 months', '3 months', 'Ongoing', 'As needed',
];

const EMPTY_DRUG = { name: '', dosage: '', frequency: 'Twice daily', duration: '5 days', instructions: 'After meals' };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function loadProfile() {
  try { return JSON.parse(localStorage.getItem('clinicProfile')) || {}; } catch { return {}; }
}

function printRxSlip(rx, patient) {
  const profile = loadProfile();

  function age(dob) {
    if (!dob) return '—';
    return new Date().getFullYear() - new Date(dob).getFullYear() + ' yrs';
  }

  const drugRows = (rx.drugs || []).map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${d.name || ''}</strong></td>
      <td>${d.dosage || ''}</td>
      <td>${d.frequency || ''}</td>
      <td>${d.duration || ''}</td>
      <td>${d.instructions || ''}</td>
    </tr>`).join('');

  const logoHtml = (profile.logo && profile.logoType === 'logo')
    ? `<img src="${profile.logo}" style="width:60px;height:60px;object-fit:contain;" />`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Prescription – ${patient.firstName} ${patient.lastName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #111; background: #fff; padding: 20mm 18mm; }
    .header { display: flex; align-items: flex-start; gap: 12px; padding-bottom: 10px; }
    .clinic { flex: 1; }
    .clinic-name { font-size: 16pt; font-weight: 700; }
    .clinic-addr { font-size: 9pt; color: #555; margin-top: 2px; }
    .clinic-contact { font-size: 9pt; color: #444; margin-top: 4px; display: flex; gap: 16px; }
    .doctor { text-align: right; }
    .doctor-name { font-size: 12pt; font-weight: 700; }
    .doctor-qual { font-size: 9pt; color: #555; }
    .doctor-reg  { font-size: 8pt; color: #777; }
    hr { border: none; border-top: 2px solid #333; margin: 8px 0; }
    .meta { display: flex; flex-wrap: wrap; gap: 12px; background: #f6f6f6; border: 1px solid #ddd; border-radius: 5px; padding: 8px 12px; margin-bottom: 10px; font-size: 9.5pt; }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .05em; color: #777; }
    .meta-value { font-weight: 600; }
    .diagnosis { font-size: 10pt; margin-bottom: 10px; }
    .diagnosis b { margin-right: 6px; }
    .rx-sym { font-size: 26pt; font-weight: 700; line-height: 1; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 14px; }
    th { border-bottom: 2px solid #333; padding: 5px 6px; text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: .05em; }
    td { padding: 5px 6px; border-bottom: 1px solid #e0e0e0; }
    tr:nth-child(even) td { background: #fafafa; }
    .notes-box { border-top: 1px dashed #bbb; padding-top: 8px; font-size: 9.5pt; margin-bottom: 16px; }
    .notes-label { font-weight: 700; margin-bottom: 4px; }
    .footer { display: flex; justify-content: flex-end; margin-top: 24px; }
    .sig { text-align: center; min-width: 160px; }
    .sig-line { border-top: 1px solid #333; margin-bottom: 5px; }
    .sig-name { font-weight: 700; font-size: 10pt; }
    .sig-qual  { font-size: 8.5pt; color: #555; }
    @media print { body { padding: 10mm 14mm; } }
  </style>
</head>
<body>
  <div class="header">
    ${logoHtml}
    <div class="clinic">
      <div class="clinic-name">${profile.name || 'Clinic'}</div>
      ${profile.tagline ? `<div class="clinic-addr">${profile.tagline}</div>` : ''}
      ${(profile.phone || profile.email) ? `<div class="clinic-contact">${profile.phone ? `<span>&#128222; ${profile.phone}</span>` : ''}${profile.email ? `<span>&#9993; ${profile.email}</span>` : ''}</div>` : ''}
    </div>
    <div class="doctor">
      <div class="doctor-name">${rx.doctorName || profile.doctorName || ''}</div>
      ${profile.doctorQualification ? `<div class="doctor-qual">${profile.doctorQualification}</div>` : ''}
      ${profile.registrationNumber ? `<div class="doctor-reg">Reg: ${profile.registrationNumber}</div>` : ''}
    </div>
  </div>
  <hr />
  <div class="meta">
    <div class="meta-item"><span class="meta-label">Patient</span><span class="meta-value">${patient.firstName} ${patient.lastName}</span></div>
    <div class="meta-item"><span class="meta-label">Age / Gender</span><span class="meta-value">${age(patient.dateOfBirth)} / ${patient.gender || '—'}</span></div>
    ${patient.phone ? `<div class="meta-item"><span class="meta-label">Phone</span><span class="meta-value">${patient.phone}</span></div>` : ''}
    <div class="meta-item"><span class="meta-label">Date</span><span class="meta-value">${rx.visitDate}</span></div>
  </div>
  ${rx.diagnosis ? `<div class="diagnosis"><b>Diagnosis / Complaint:</b>${rx.diagnosis}</div>` : ''}
  <div class="rx-sym">&#8478;</div>
  <table>
    <thead><tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
    <tbody>${drugRows}</tbody>
  </table>
  ${rx.notes ? `<div class="notes-box"><div class="notes-label">Instructions / Notes:</div><div>${rx.notes}</div></div>` : ''}
  <div class="footer">
    <div class="sig">
      <div class="sig-line"></div>
      <div class="sig-name">${rx.doctorName || profile.doctorName || ''}</div>
      ${profile.doctorQualification ? `<div class="sig-qual">${profile.doctorQualification}</div>` : ''}
    </div>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=800,height=700');
  if (!win) { alert('Popup blocked — please allow popups for this site and try again.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

export default function PrescriptionModal({ patient, onClose }) {
  const profile = loadProfile();

  const [view, setView] = useState('list'); // 'list' | 'form'
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    visitDate: today(),
    doctorName: profile.doctorName || '',
    diagnosis: '',
    drugs: [{ ...EMPTY_DRUG }],
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchRx = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/patients/${patient.id}/prescriptions`);
      if (res.ok) {
        setPrescriptions(await res.json());
      } else {
        const text = await res.text();
        console.error('Fetch prescriptions failed:', res.status, text);
      }
    } catch (e) {
      console.error('Fetch prescriptions error:', e);
    } finally { setLoading(false); }
  }, [patient.id]);

  useEffect(() => { fetchRx(); }, [fetchRx]);

  function startNew() {
    setEditing(null);
    setForm({ visitDate: today(), doctorName: profile.doctorName || '', diagnosis: '', drugs: [{ ...EMPTY_DRUG }], notes: '' });
    setError('');
    setView('form');
  }

  function startEdit(rx) {
    setEditing(rx);
    setForm({
      visitDate: rx.visitDate,
      doctorName: rx.doctorName || '',
      diagnosis: rx.diagnosis || '',
      drugs: rx.drugs?.length ? rx.drugs : [{ ...EMPTY_DRUG }],
      notes: rx.notes || '',
    });
    setError('');
    setView('form');
  }

  async function handleSave(e, shouldPrint = false) {
    e.preventDefault();
    if (!form.visitDate) { setError('Visit date is required.'); return; }
    if (form.drugs.some(d => !d.name.trim())) { setError('All drug rows need a medicine name.'); return; }
    setSaving(true); setError('');
    try {
      const url = editing ? `/api/prescriptions/${editing.id}` : `/api/patients/${patient.id}/prescriptions`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = `Save failed (${res.status}): `;
        try { msg += JSON.parse(text).error || text.slice(0, 200); } catch { msg += text.slice(0, 200); }
        setError(msg);
        return;
      }
      const saved = await res.json();
      await fetchRx();
      setView('list');
      if (shouldPrint) printRxSlip(saved, patient);
    } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this prescription?')) return;
    await fetch(`/api/prescriptions/${id}`, { method: 'DELETE' });
    fetchRx();
  }

  // Drug row helpers
  function setDrug(i, patch) {
    const drugs = form.drugs.map((d, idx) => idx === i ? { ...d, ...patch } : d);
    setForm(f => ({ ...f, drugs }));
  }
  function addDrug() { setForm(f => ({ ...f, drugs: [...f.drugs, { ...EMPTY_DRUG }] })); }
  function removeDrug(i) { setForm(f => ({ ...f, drugs: f.drugs.filter((_, idx) => idx !== i) })); }

  // ── Form view ───────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="rx-overlay">
        <div className="rx-modal">
          <div className="rx-modal-header">
            <div>
              <div className="rx-modal-title">{editing ? 'Edit Prescription' : 'New Prescription'}</div>
              <div className="rx-modal-sub">{patient.firstName} {patient.lastName}</div>
            </div>
            <button className="rx-close" onClick={onClose} type="button">✕</button>
          </div>

          <form onSubmit={handleSave} className="rx-form">
            {error && <div className="rx-error">{error}</div>}

            <div className="rx-form-row">
              <div className="rx-field">
                <label>Visit Date</label>
                <input type="date" value={form.visitDate}
                  onChange={e => setForm(f => ({ ...f, visitDate: e.target.value }))} required />
              </div>
              <div className="rx-field">
                <label>Doctor Name</label>
                <input value={form.doctorName} placeholder={profile.doctorName || 'Doctor name'}
                  onChange={e => setForm(f => ({ ...f, doctorName: e.target.value }))} />
              </div>
            </div>

            <div className="rx-field">
              <label>Diagnosis / Chief Complaint</label>
              <input value={form.diagnosis} placeholder="e.g. Acute pharyngitis, Type 2 Diabetes follow-up"
                onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))} />
            </div>

            {/* Drug rows */}
            <div className="rx-drugs-section">
              <div className="rx-drugs-header">
                <span className="rx-section-label">℞ Medicines</span>
                <button type="button" className="rx-add-drug" onClick={addDrug}>+ Add Medicine</button>
              </div>

              <div className="rx-drugs-table-wrap">
                <table className="rx-drugs-edit-table">
                  <thead>
                    <tr>
                      <th>Medicine / Drug</th>
                      <th>Dosage</th>
                      <th>Frequency</th>
                      <th>Duration</th>
                      <th>Instructions</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.drugs.map((d, i) => (
                      <tr key={i}>
                        <td>
                          <input value={d.name} placeholder="e.g. Amoxicillin"
                            onChange={e => setDrug(i, { name: e.target.value })} />
                        </td>
                        <td>
                          <input value={d.dosage} placeholder="e.g. 500mg"
                            onChange={e => setDrug(i, { dosage: e.target.value })} />
                        </td>
                        <td>
                          <select value={d.frequency} onChange={e => setDrug(i, { frequency: e.target.value })}>
                            {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
                          </select>
                        </td>
                        <td>
                          <select value={d.duration} onChange={e => setDrug(i, { duration: e.target.value })}>
                            {DURATIONS.map(d => <option key={d}>{d}</option>)}
                          </select>
                        </td>
                        <td>
                          <select value={d.instructions} onChange={e => setDrug(i, { instructions: e.target.value })}>
                            {INSTRUCTIONS.map(ins => <option key={ins}>{ins}</option>)}
                          </select>
                        </td>
                        <td>
                          {form.drugs.length > 1 && (
                            <button type="button" className="rx-remove-drug" onClick={() => removeDrug(i)}>✕</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rx-field">
              <label>Additional Notes / Instructions</label>
              <textarea value={form.notes} rows={2}
                placeholder="e.g. Rest advised for 3 days. Review if fever persists."
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="rx-form-actions">
              <button type="button" className="secondary" onClick={() => setView('list')}>Cancel</button>
              <button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Update' : 'Save'}</button>
              <button type="button" className="rx-save-print-btn" disabled={saving}
                onClick={e => handleSave(e, true)}>
                {saving ? 'Saving…' : '🖨 Save & Print'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── List view ───────────────────────────────────────────────────────────────
  return (
    <div className="rx-overlay">
      <div className="rx-modal">
        <div className="rx-modal-header">
          <div>
            <div className="rx-modal-title">Prescriptions</div>
            <div className="rx-modal-sub">{patient.firstName} {patient.lastName}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button onClick={startNew} className="rx-new-btn">+ New Prescription</button>
            <button className="rx-close" onClick={onClose} type="button">✕</button>
          </div>
        </div>

        <div className="rx-list">
          {loading && <p className="rx-empty">Loading…</p>}
          {!loading && prescriptions.length === 0 && (
            <div className="rx-empty-state">
              <div className="rx-empty-icon">📋</div>
              <p>No prescriptions yet for this patient.</p>
              <button onClick={startNew}>Write First Prescription</button>
            </div>
          )}
          {prescriptions.map(rx => (
            <div key={rx.id} className="rx-card">
              <div className="rx-card-top">
                <div className="rx-card-left">
                  <span className="rx-card-date">{rx.visitDate}</span>
                  {rx.doctorName && <span className="rx-card-doctor">{rx.doctorName}</span>}
                  {rx.diagnosis && <span className="rx-card-diagnosis">{rx.diagnosis}</span>}
                </div>
                <div className="rx-card-actions">
                  <button className="rx-btn-print" onClick={() => printRxSlip(rx, patient)}>🖨 Print</button>
                  <button className="rx-btn-edit" onClick={() => startEdit(rx)}>Edit</button>
                  <button className="rx-btn-delete" onClick={() => handleDelete(rx.id)}>Delete</button>
                </div>
              </div>
              <div className="rx-card-drugs">
                {(rx.drugs || []).map((d, i) => (
                  <div key={i} className="rx-drug-pill">
                    <span className="rx-drug-name">{d.name}</span>
                    {d.dosage && <span className="rx-drug-detail">{d.dosage}</span>}
                    <span className="rx-drug-detail">{d.frequency}</span>
                    <span className="rx-drug-detail">× {d.duration}</span>
                  </div>
                ))}
              </div>
              {rx.notes && <div className="rx-card-notes">{rx.notes}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
