import { useEffect, useState, useCallback, useRef } from 'react';
import './LabResultModal.css';

const COMMON_TESTS = [
  'Complete Blood Count (CBC)', 'Lipid Profile', 'Blood Glucose (Fasting)',
  'Blood Glucose (PP)', 'HbA1c', 'Liver Function Test (LFT)',
  'Kidney Function Test (KFT)', 'Thyroid Profile (TSH/T3/T4)',
  'Urine Routine', 'Serum Electrolytes', 'Vitamin D', 'Vitamin B12',
  'Iron Studies', 'Uric Acid', 'CRP / ESR', 'Other',
];

const EMPTY_PARAM = { name: '', value: '', unit: '', low: '', high: '', isAbnormal: false };

function today() { return new Date().toISOString().slice(0, 10); }

function autoFlag(param) {
  const v = parseFloat(param.value);
  const lo = parseFloat(param.low);
  const hi = parseFloat(param.high);
  if (isNaN(v)) return param.isAbnormal;
  if (!isNaN(lo) && v < lo) return true;
  if (!isNaN(hi) && v > hi) return true;
  if (!isNaN(lo) && !isNaN(hi)) return false;
  return param.isAbnormal;
}

function printLabSlip(lab, patient) {
  let profileRaw = {};
  try { profileRaw = JSON.parse(localStorage.getItem('clinicProfile')) || {}; } catch {}

  const abnormalCount = (lab.parameters || []).filter(p => p.isAbnormal).length;

  const paramRows = (lab.parameters || []).map((p, i) => `
    <tr class="${p.isAbnormal ? 'abnormal-row' : ''}">
      <td>${i + 1}</td>
      <td>${p.isAbnormal ? '<span class="flag">⚠</span> ' : ''}<strong>${p.name}</strong></td>
      <td class="${p.isAbnormal ? 'abn-val' : ''}">${p.value}</td>
      <td>${p.unit || ''}</td>
      <td>${p.low && p.high ? `${p.low} – ${p.high}` : p.low ? `≥ ${p.low}` : p.high ? `≤ ${p.high}` : '—'}</td>
      <td>${p.isAbnormal ? '<span class="badge-abn">ABNORMAL</span>' : '<span class="badge-ok">Normal</span>'}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Lab Report – ${patient.firstName} ${patient.lastName}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:11pt;color:#111;background:#fff;padding:16mm 18mm}
.header{display:flex;align-items:flex-start;gap:12px;padding-bottom:8px}
.clinic{flex:1}.clinic-name{font-size:15pt;font-weight:700}
.clinic-sub{font-size:9pt;color:#555;margin-top:2px}
.doctor{text-align:right}.doctor-name{font-size:11pt;font-weight:700}
.doctor-sub{font-size:8.5pt;color:#555}
hr{border:none;border-top:2px solid #333;margin:6px 0}
.meta{display:flex;flex-wrap:wrap;gap:12px;background:#f6f6f6;border:1px solid #ddd;border-radius:5px;padding:7px 12px;margin-bottom:10px;font-size:9.5pt}
.meta-item{display:flex;flex-direction:column}
.meta-label{font-size:7.5pt;text-transform:uppercase;letter-spacing:.05em;color:#777}
.meta-value{font-weight:600}
.test-title{font-size:13pt;font-weight:700;margin-bottom:6px}
.test-lab{font-size:9pt;color:#555;margin-bottom:10px}
table{width:100%;border-collapse:collapse;font-size:10pt;margin-bottom:12px}
th{border-bottom:2px solid #333;padding:5px 6px;text-align:left;font-size:8pt;text-transform:uppercase;letter-spacing:.05em;background:#f9f9f9}
td{padding:5px 6px;border-bottom:1px solid #e0e0e0;vertical-align:middle}
.abnormal-row td{background:#fff5f5}
.abn-val{color:#c0392b;font-weight:700}
.flag{color:#e74c3c;margin-right:3px}
.badge-abn{background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;border-radius:3px;padding:1px 5px;font-size:8pt;font-weight:700}
.badge-ok{background:#dcfce7;color:#166534;border:1px solid #86efac;border-radius:3px;padding:1px 5px;font-size:8pt}
.summary{margin-bottom:10px;font-size:10pt}
.summary-abn{color:#c0392b;font-weight:700}
.notes-box{border-top:1px dashed #bbb;padding-top:8px;font-size:9.5pt;margin-bottom:16px}
.footer{display:flex;justify-content:flex-end;margin-top:24px}
.sig{text-align:center;min-width:160px}
.sig-line{border-top:1px solid #333;margin-bottom:5px}
.sig-name{font-weight:700;font-size:10pt}
.sig-qual{font-size:8.5pt;color:#555}
</style></head><body>
<div class="header">
  ${profileRaw.logo && profileRaw.logoType === 'logo' ? `<img src="${profileRaw.logo}" style="width:56px;height:56px;object-fit:contain"/>` : ''}
  <div class="clinic">
    <div class="clinic-name">${profileRaw.name || 'Clinic'}</div>
    ${profileRaw.tagline ? `<div class="clinic-sub">${profileRaw.tagline}</div>` : ''}
    ${profileRaw.phone ? `<div class="clinic-sub">&#128222; ${profileRaw.phone}</div>` : ''}
  </div>
  <div class="doctor">
    <div class="doctor-name">${profileRaw.doctorName || ''}</div>
    ${profileRaw.doctorQualification ? `<div class="doctor-sub">${profileRaw.doctorQualification}</div>` : ''}
    ${profileRaw.registrationNumber ? `<div class="doctor-sub">Reg: ${profileRaw.registrationNumber}</div>` : ''}
  </div>
</div>
<hr/>
<div class="meta">
  <div class="meta-item"><span class="meta-label">Patient</span><span class="meta-value">${patient.firstName} ${patient.lastName}</span></div>
  <div class="meta-item"><span class="meta-label">Age / Gender</span><span class="meta-value">${patient.dateOfBirth ? new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear() + ' yrs' : '—'} / ${patient.gender || '—'}</span></div>
  ${patient.phone ? `<div class="meta-item"><span class="meta-label">Phone</span><span class="meta-value">${patient.phone}</span></div>` : ''}
  <div class="meta-item"><span class="meta-label">Test Date</span><span class="meta-value">${lab.testDate}</span></div>
</div>
<div class="test-title">${lab.testName}</div>
${lab.labName ? `<div class="test-lab">Lab / Facility: ${lab.labName}</div>` : ''}
${abnormalCount > 0 ? `<div class="summary">&#9888; <span class="summary-abn">${abnormalCount} abnormal value${abnormalCount > 1 ? 's' : ''} flagged</span></div>` : ''}
<table>
  <thead><tr><th>#</th><th>Parameter</th><th>Value</th><th>Unit</th><th>Reference Range</th><th>Status</th></tr></thead>
  <tbody>${paramRows}</tbody>
</table>
${lab.notes ? `<div class="notes-box"><strong>Notes:</strong><br/>${lab.notes}</div>` : ''}
<div class="footer">
  <div class="sig">
    <div class="sig-line"></div>
    <div class="sig-name">${profileRaw.doctorName || ''}</div>
    ${profileRaw.doctorQualification ? `<div class="sig-qual">${profileRaw.doctorQualification}</div>` : ''}
  </div>
</div>
</body></html>`;

  const win = window.open('', '_blank', 'width=820,height=700');
  if (!win) { alert('Popup blocked — please allow popups for this site and try again.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export default function LabResultModal({ patient, onClose }) {
  const [view, setView]             = useState('list');
  const [labs, setLabs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState(null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [expanded, setExpanded]     = useState(null);
  const fileRef = useRef();

  const [form, setForm] = useState({
    testDate: today(), labName: '', testName: '', parameters: [{ ...EMPTY_PARAM }], notes: '',
  });
  const [attachment, setAttachment] = useState(null); // File object

  const fetchLabs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/patients/${patient.id}/labs`);
      if (res.ok) setLabs(await res.json());
      else console.error('Fetch labs failed:', res.status);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [patient.id]);

  useEffect(() => { fetchLabs(); }, [fetchLabs]);

  function startNew() {
    setEditing(null);
    setForm({ testDate: today(), labName: '', testName: '', parameters: [{ ...EMPTY_PARAM }], notes: '' });
    setAttachment(null);
    setError('');
    setView('form');
  }

  function startEdit(lab) {
    setEditing(lab);
    setForm({
      testDate:   lab.testDate,
      labName:    lab.labName || '',
      testName:   lab.testName,
      parameters: lab.parameters?.length ? lab.parameters : [{ ...EMPTY_PARAM }],
      notes:      lab.notes || '',
    });
    setAttachment(null);
    setError('');
    setView('form');
  }

  // Parameter helpers
  function setParam(i, patch) {
    const parameters = form.parameters.map((p, idx) => {
      if (idx !== i) return p;
      const updated = { ...p, ...patch };
      updated.isAbnormal = autoFlag(updated);
      return updated;
    });
    setForm(f => ({ ...f, parameters }));
  }
  function toggleManualAbnormal(i) {
    setForm(f => ({
      ...f,
      parameters: f.parameters.map((p, idx) =>
        idx === i ? { ...p, isAbnormal: !p.isAbnormal } : p
      ),
    }));
  }
  function addParam()      { setForm(f => ({ ...f, parameters: [...f.parameters, { ...EMPTY_PARAM }] })); }
  function removeParam(i)  { setForm(f => ({ ...f, parameters: f.parameters.filter((_, idx) => idx !== i) })); }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.testName.trim()) { setError('Test name is required.'); return; }
    if (!form.testDate)        { setError('Test date is required.'); return; }
    setSaving(true); setError('');
    try {
      const fd = new FormData();
      fd.append('testDate',   form.testDate);
      fd.append('labName',    form.labName);
      fd.append('testName',   form.testName);
      fd.append('parameters', JSON.stringify(form.parameters));
      fd.append('notes',      form.notes);
      if (attachment) fd.append('attachment', attachment);

      const url    = editing ? `/api/labs/${editing.id}` : `/api/patients/${patient.id}/labs`;
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, body: fd });
      if (!res.ok) {
        const text = await res.text();
        let msg = `Save failed (${res.status})`;
        try { msg = JSON.parse(text).error || msg; } catch { msg += ': ' + text.slice(0, 120); }
        setError(msg); return;
      }
      await fetchLabs();
      setView('list');
    } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this lab result?')) return;
    await fetch(`/api/labs/${id}`, { method: 'DELETE' });
    fetchLabs();
  }

  async function removeAttachment(lab) {
    await fetch(`/api/labs/${lab.id}/attachment`, { method: 'DELETE' });
    fetchLabs();
  }

  const abnormalCount = (lab) => (lab.parameters || []).filter(p => p.isAbnormal).length;

  // ── Form ────────────────────────────────────────────────────────────────────
  if (view === 'form') return (
    <div className="lab-overlay">
      <div className="lab-modal">
        <div className="lab-modal-header">
          <div>
            <div className="lab-modal-title">{editing ? 'Edit Lab Result' : 'New Lab Result'}</div>
            <div className="lab-modal-sub">{patient.firstName} {patient.lastName}</div>
          </div>
          <button className="lab-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSave} className="lab-form">
          {error && <div className="lab-error">{error}</div>}

          <div className="lab-form-row">
            <div className="lab-field">
              <label>Test Date</label>
              <input type="date" value={form.testDate} required
                onChange={e => setForm(f => ({ ...f, testDate: e.target.value }))} />
            </div>
            <div className="lab-field">
              <label>Test / Panel Name</label>
              <input list="common-tests" value={form.testName} placeholder="e.g. CBC, Lipid Profile"
                onChange={e => setForm(f => ({ ...f, testName: e.target.value }))} required />
              <datalist id="common-tests">
                {COMMON_TESTS.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div className="lab-field">
              <label>Lab / Facility (optional)</label>
              <input value={form.labName} placeholder="e.g. Apollo Diagnostics"
                onChange={e => setForm(f => ({ ...f, labName: e.target.value }))} />
            </div>
          </div>

          {/* Parameters table */}
          <div className="lab-params-section">
            <div className="lab-params-header">
              <span className="lab-section-label">Test Parameters</span>
              <button type="button" className="lab-add-param" onClick={addParam}>+ Add Row</button>
            </div>
            <div className="lab-params-wrap">
              <table className="lab-params-table">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Value</th>
                    <th>Unit</th>
                    <th>Ref Low</th>
                    <th>Ref High</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {form.parameters.map((p, i) => (
                    <tr key={i} className={p.isAbnormal ? 'param-row-abnormal' : ''}>
                      <td><input value={p.name} placeholder="e.g. Haemoglobin"
                        onChange={e => setParam(i, { name: e.target.value })} /></td>
                      <td><input value={p.value} placeholder="e.g. 10.5"
                        onChange={e => setParam(i, { value: e.target.value })} /></td>
                      <td><input value={p.unit} placeholder="g/dL"
                        onChange={e => setParam(i, { unit: e.target.value })} /></td>
                      <td><input value={p.low} placeholder="12"
                        onChange={e => setParam(i, { low: e.target.value })} /></td>
                      <td><input value={p.high} placeholder="17"
                        onChange={e => setParam(i, { high: e.target.value })} /></td>
                      <td>
                        <button type="button"
                          className={p.isAbnormal ? 'param-badge abnormal' : 'param-badge normal'}
                          onClick={() => toggleManualAbnormal(i)}
                          title="Click to toggle">
                          {p.isAbnormal ? '⚠ Abnormal' : '✓ Normal'}
                        </button>
                      </td>
                      <td>{form.parameters.length > 1 &&
                        <button type="button" className="lab-remove-param" onClick={() => removeParam(i)}>✕</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="lab-auto-flag-hint">Status auto-flags when value is outside Ref Low–High. Click badge to override.</p>
          </div>

          <div className="lab-field">
            <label>Notes / Comments</label>
            <textarea value={form.notes} rows={2} placeholder="e.g. Patient fasting for 12 hours."
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {/* File attachment */}
          <div className="lab-field">
            <label>Attach File (PDF / image, max 20 MB)</label>
            <div className="lab-file-row">
              <input type="file" ref={fileRef} accept=".pdf,image/*"
                style={{ display: 'none' }}
                onChange={e => setAttachment(e.target.files[0] || null)} />
              <button type="button" className="lab-file-btn" onClick={() => fileRef.current.click()}>
                📎 {attachment ? attachment.name : editing?.attachmentName ? 'Replace file' : 'Choose file'}
              </button>
              {attachment && (
                <button type="button" className="lab-file-clear" onClick={() => { setAttachment(null); fileRef.current.value = ''; }}>✕</button>
              )}
              {!attachment && editing?.attachmentName && (
                <span className="lab-existing-file">
                  Current: <a href={editing.attachmentPath} target="_blank" rel="noreferrer">{editing.attachmentName}</a>
                </span>
              )}
            </div>
          </div>

          <div className="lab-form-actions">
            <button type="button" className="secondary" onClick={() => setView('list')}>Cancel</button>
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Update' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );

  // ── List ────────────────────────────────────────────────────────────────────
  return (
    <div className="lab-overlay">
      <div className="lab-modal">
        <div className="lab-modal-header">
          <div>
            <div className="lab-modal-title">Lab Results</div>
            <div className="lab-modal-sub">{patient.firstName} {patient.lastName}</div>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            <button className="lab-new-btn" onClick={startNew}>+ New Result</button>
            <button className="lab-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="lab-list">
          {loading && <p className="lab-empty">Loading…</p>}
          {!loading && labs.length === 0 && (
            <div className="lab-empty-state">
              <div className="lab-empty-icon">🧪</div>
              <p>No lab results yet for this patient.</p>
              <button onClick={startNew}>Add First Lab Result</button>
            </div>
          )}

          {labs.map(lab => {
            const abn = abnormalCount(lab);
            const isOpen = expanded === lab.id;
            return (
              <div key={lab.id} className={`lab-card${abn > 0 ? ' lab-card-has-abnormal' : ''}`}>
                <div className="lab-card-top">
                  <div className="lab-card-left" onClick={() => setExpanded(isOpen ? null : lab.id)} style={{ cursor: 'pointer' }}>
                    <span className="lab-card-date">{lab.testDate}</span>
                    <span className="lab-card-name">{lab.testName}</span>
                    {lab.labName && <span className="lab-card-lab">{lab.labName}</span>}
                    <div className="lab-card-badges">
                      {abn > 0
                        ? <span className="lab-badge-abnormal">⚠ {abn} Abnormal</span>
                        : lab.parameters?.length > 0
                          ? <span className="lab-badge-normal">✓ All Normal</span>
                          : null}
                      {lab.attachmentName && <span className="lab-badge-file">📎 {lab.attachmentName}</span>}
                    </div>
                  </div>
                  <div className="lab-card-actions">
                    <button className="lab-btn-print" onClick={() => printLabSlip(lab, patient)}>🖨 Print</button>
                    <button className="lab-btn-edit" onClick={() => startEdit(lab)}>Edit</button>
                    <button className="lab-btn-delete" onClick={() => handleDelete(lab.id)}>Delete</button>
                    <button className="lab-btn-expand" onClick={() => setExpanded(isOpen ? null : lab.id)}>
                      {isOpen ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="lab-card-detail">
                    {lab.parameters?.length > 0 && (
                      <table className="lab-detail-table">
                        <thead>
                          <tr><th>Parameter</th><th>Value</th><th>Unit</th><th>Reference</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                          {lab.parameters.map((p, i) => (
                            <tr key={i} className={p.isAbnormal ? 'detail-row-abnormal' : ''}>
                              <td>{p.name}</td>
                              <td className={p.isAbnormal ? 'detail-val-abnormal' : ''}><strong>{p.value}</strong></td>
                              <td>{p.unit}</td>
                              <td>{p.low && p.high ? `${p.low} – ${p.high}` : p.low ? `≥ ${p.low}` : p.high ? `≤ ${p.high}` : '—'}</td>
                              <td>
                                {p.isAbnormal
                                  ? <span className="status-abnormal">⚠ Abnormal</span>
                                  : <span className="status-normal">✓ Normal</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {lab.notes && <div className="lab-card-notes"><strong>Notes:</strong> {lab.notes}</div>}
                    {lab.attachmentPath && (
                      <div className="lab-card-attachment">
                        <strong>Attachment:</strong>{' '}
                        {lab.attachmentType?.startsWith('image/') ? (
                          <a href={lab.attachmentPath} target="_blank" rel="noreferrer">
                            <img src={lab.attachmentPath} alt={lab.attachmentName} className="lab-thumb" />
                          </a>
                        ) : (
                          <a href={lab.attachmentPath} target="_blank" rel="noreferrer" className="lab-file-link">
                            📄 {lab.attachmentName}
                          </a>
                        )}
                        <button className="lab-remove-file" onClick={() => removeAttachment(lab)}>Remove</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
