import { useState, useEffect, useRef } from 'react';
import './PatientRegistration.css';
import './PatientRecordsModal.css';

const EMPTY = {
  visitDate: '', doctorName: '', chiefComplaint: '',
  diagnosis: '', prescription: '',
  treatmentPlanned: '', treatmentDone: '',
  vitalsBP: '', vitalsWeight: '', vitalsTemp: '',
  followUpDate: '', clinicalNotes: '',
};

// Groups services by category for the picker dropdown
function groupByCategory(services) {
  return services.reduce((acc, s) => {
    const cat = s.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});
}

// Inline catalog picker — clicking a service appends it to the textarea
function CatalogPicker({ services, onSelect }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = search
    ? services.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) ||
                           (s.category || '').toLowerCase().includes(search.toLowerCase()))
    : services;

  const groups = groupByCategory(filtered);

  return (
    <div className="rec-catalog-wrap" ref={ref}>
      <button type="button" className="rec-catalog-btn" onClick={() => setOpen(o => !o)}>
        + From Catalog
      </button>
      {open && (
        <div className="rec-catalog-dropdown">
          <input
            className="rec-catalog-search"
            placeholder="Search services…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <div className="rec-catalog-list">
            {Object.entries(groups).map(([cat, svcs]) => (
              <div key={cat}>
                <div className="rec-catalog-cat">{cat}</div>
                {svcs.map(s => (
                  <button key={s.id} type="button" className="rec-catalog-item"
                    onClick={() => { onSelect(s); setOpen(false); setSearch(''); }}>
                    <span className="rec-catalog-name">{s.name}</span>
                    <span className="rec-catalog-price">₹{Number(s.price).toLocaleString()}</span>
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && <p className="rec-catalog-empty">No services match.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// Renders selected service tags above the textarea
function TreatmentField({ label, fieldKey, value, onChange, services }) {
  // Parse tags from leading lines like "• Service Name (₹price)\n"
  const TAG_RE = /^• .+$/;
  const lines = value.split('\n');
  const tagLines = [];
  const textLines = [];
  let tagsEnded = false;
  for (const line of lines) {
    if (!tagsEnded && TAG_RE.test(line)) tagLines.push(line);
    else { tagsEnded = true; if (line || textLines.length) textLines.push(line); }
  }

  function addService(svc) {
    const tag = `• ${svc.name} (₹${Number(svc.price).toLocaleString()})`;
    const existing = tagLines.join('\n');
    const text = textLines.join('\n');
    const newVal = [existing ? existing + '\n' + tag : tag, text].filter(Boolean).join('\n');
    onChange(newVal);
  }

  function removeTag(idx) {
    const newTags = tagLines.filter((_, i) => i !== idx);
    const text = textLines.join('\n');
    onChange([...newTags, text].filter(Boolean).join('\n'));
  }

  return (
    <div className="reg-field">
      <div className="rec-field-header">
        <label>{label}</label>
        <CatalogPicker services={services} onSelect={addService} />
      </div>
      {tagLines.length > 0 && (
        <div className="rec-tags">
          {tagLines.map((t, i) => (
            <span key={i} className="rec-tag">
              {t.replace(/^• /, '')}
              <button type="button" className="rec-tag-remove" onClick={() => removeTag(i)}>×</button>
            </span>
          ))}
        </div>
      )}
      <textarea
        value={textLines.join('\n')}
        onChange={e => {
          const tags = tagLines.join('\n');
          onChange(tags ? tags + '\n' + e.target.value : e.target.value);
        }}
        placeholder={`Additional notes for ${label.toLowerCase()}…`}
        rows={2}
      />
    </div>
  );
}

function RecordForm({ initial, patientId, services, onSaved, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.visitDate) { setError('Visit date is required.'); return; }
    setError(''); setSaving(true);
    const url    = initial?.id ? `/api/records/${initial.id}` : `/api/patients/${patientId}/records`;
    const method = initial?.id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error || 'Save failed.'); return; }
    onSaved();
  }

  return (
    <form className="rec-form" onSubmit={handleSubmit}>
      {error && <p className="reg-error">{error}</p>}

      <div className="rec-section-title">Visit Info</div>
      <div className="reg-row">
        <div className="reg-field">
          <label>Visit Date *</label>
          <input type="date" value={form.visitDate} onChange={e => set('visitDate', e.target.value)} />
        </div>
        <div className="reg-field">
          <label>Attending Doctor</label>
          <input value={form.doctorName} onChange={e => set('doctorName', e.target.value)} placeholder="Dr. Name" />
        </div>
      </div>
      <div className="reg-field">
        <label>Chief Complaint</label>
        <input value={form.chiefComplaint} onChange={e => set('chiefComplaint', e.target.value)}
          placeholder="Reason for visit (in patient's words)" />
      </div>

      <div className="rec-section-title">Vital Signs</div>
      <div className="reg-row">
        <div className="reg-field">
          <label>Blood Pressure</label>
          <input value={form.vitalsBP} onChange={e => set('vitalsBP', e.target.value)} placeholder="e.g. 120/80 mmHg" />
        </div>
        <div className="reg-field">
          <label>Weight</label>
          <input value={form.vitalsWeight} onChange={e => set('vitalsWeight', e.target.value)} placeholder="e.g. 72 kg" />
        </div>
        <div className="reg-field">
          <label>Temperature</label>
          <input value={form.vitalsTemp} onChange={e => set('vitalsTemp', e.target.value)} placeholder="e.g. 98.6 °F" />
        </div>
      </div>

      <div className="rec-section-title">Diagnosis & Treatment</div>
      <div className="reg-field">
        <label>Diagnosis</label>
        <textarea value={form.diagnosis} onChange={e => set('diagnosis', e.target.value)}
          placeholder="Conditions diagnosed at this visit" rows={2} />
      </div>
      <div className="reg-field">
        <label>Prescription</label>
        <textarea value={form.prescription} onChange={e => set('prescription', e.target.value)}
          placeholder="Medications prescribed, dosage, duration" rows={2} />
      </div>
      <div className="reg-row">
        <TreatmentField label="Treatment Planned" fieldKey="treatmentPlanned"
          value={form.treatmentPlanned} onChange={v => set('treatmentPlanned', v)} services={services} />
        <TreatmentField label="Treatment Done" fieldKey="treatmentDone"
          value={form.treatmentDone} onChange={v => set('treatmentDone', v)} services={services} />
      </div>

      <div className="rec-section-title">Follow-up & Notes</div>
      <div className="reg-row">
        <div className="reg-field">
          <label>Follow-up Date</label>
          <input type="date" value={form.followUpDate} onChange={e => set('followUpDate', e.target.value)} />
        </div>
      </div>
      <div className="reg-field">
        <label>Clinical Notes</label>
        <textarea value={form.clinicalNotes} onChange={e => set('clinicalNotes', e.target.value)}
          placeholder="Additional observations, test results, referrals…" rows={3} />
      </div>

      <div className="reg-actions" style={{ marginTop: '0.5rem' }}>
        <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
        <div />
        <button type="submit" disabled={saving}>{saving ? 'Saving…' : (initial?.id ? 'Update Record' : 'Save Record')}</button>
      </div>
    </form>
  );
}

function RecordCard({ record, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  const hasVitals = record.vitalsBP || record.vitalsWeight || record.vitalsTemp;
  const hasTreatment = record.treatmentPlanned || record.treatmentDone;

  return (
    <div className="rec-card">
      <div className="rec-card-header" onClick={() => setExpanded(x => !x)}>
        <div className="rec-card-meta">
          <span className="rec-date">{record.visitDate}</span>
          {record.doctorName && <span className="rec-doctor">Dr. {record.doctorName}</span>}
          {record.chiefComplaint && <span className="rec-complaint">{record.chiefComplaint}</span>}
        </div>
        <div className="rec-card-actions">
          <button type="button" className="btn-edit rec-btn"
            onClick={e => { e.stopPropagation(); onEdit(record); }}>Edit</button>
          <button type="button" className="btn-delete rec-btn"
            onClick={e => { e.stopPropagation(); onDelete(record.id); }}>Delete</button>
          <span className="rec-chevron">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="rec-card-body">
          {record.diagnosis && (
            <div className="rec-detail-row">
              <span className="rec-detail-label">Diagnosis</span>
              <span className="rec-detail-value">{record.diagnosis}</span>
            </div>
          )}
          {record.prescription && (
            <div className="rec-detail-row">
              <span className="rec-detail-label">Prescription</span>
              <span className="rec-detail-value">{record.prescription}</span>
            </div>
          )}
          {hasTreatment && (
            <div className="rec-treatment-grid">
              {record.treatmentPlanned && (
                <div className="rec-treatment-box">
                  <div className="rec-treatment-title">Treatment Planned</div>
                  <div>{record.treatmentPlanned}</div>
                </div>
              )}
              {record.treatmentDone && (
                <div className="rec-treatment-box rec-treatment-done">
                  <div className="rec-treatment-title">Treatment Done</div>
                  <div>{record.treatmentDone}</div>
                </div>
              )}
            </div>
          )}
          {hasVitals && (
            <div className="rec-vitals">
              {record.vitalsBP     && <span className="rec-vital"><b>BP</b> {record.vitalsBP}</span>}
              {record.vitalsWeight && <span className="rec-vital"><b>Wt</b> {record.vitalsWeight}</span>}
              {record.vitalsTemp   && <span className="rec-vital"><b>Temp</b> {record.vitalsTemp}</span>}
            </div>
          )}
          {record.followUpDate && (
            <div className="rec-detail-row">
              <span className="rec-detail-label">Follow-up</span>
              <span className="rec-detail-value rec-followup">{record.followUpDate}</span>
            </div>
          )}
          {record.clinicalNotes && (
            <div className="rec-detail-row">
              <span className="rec-detail-label">Notes</span>
              <span className="rec-detail-value">{record.clinicalNotes}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PatientRecordsModal({ patient, onClose }) {
  const [records, setRecords] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'add' | 'edit'
  const [editingRecord, setEditingRecord] = useState(null);

  useEffect(() => {
    fetchRecords();
    fetch('/api/services')
      .then(r => r.ok ? r.json() : []).then(setServices).catch(() => setServices([]));
  }, []);

  async function fetchRecords() {
    setLoading(true);
    try {
      const res = await fetch(`/api/patients/${patient.id}/records`);
      if (res.ok) setRecords(await res.json());
    } catch { /* retain empty list on network error */ }
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this record?')) return;
    const res = await fetch(`/api/records/${id}`, { method: 'DELETE' });
    if (!res.ok) { alert('Failed to delete record.'); return; }
    fetchRecords();
  }

  function handleEdit(record) {
    setEditingRecord(record);
    setView('edit');
  }

  function handleSaved() {
    fetchRecords();
    setView('list');
    setEditingRecord(null);
  }

  return (
    <div className="reg-overlay">
      <div className="reg-modal rec-modal">
        <div className="reg-header">
          <h2>Medical Records — {patient.firstName} {patient.lastName}</h2>
          <button className="reg-close" onClick={onClose} type="button">✕</button>
        </div>

        {view === 'list' && (
          <div className="rec-list-view">
            <div className="rec-list-toolbar">
              <span className="rec-count">{records.length} record{records.length !== 1 ? 's' : ''}</span>
              <button type="button" onClick={() => setView('add')}>+ Add Record</button>
            </div>
            {loading
              ? <p className="empty rec-pad">Loading…</p>
              : records.length === 0
                ? <p className="empty rec-pad">No records yet. Add the first visit record.</p>
                : records.map(r => (
                  <RecordCard key={r.id} record={r}
                    onEdit={handleEdit}
                    onDelete={handleDelete} />
                ))
            }
          </div>
        )}

        {(view === 'add' || view === 'edit') && (
          <RecordForm
            initial={view === 'edit' ? editingRecord : null}
            patientId={patient.id}
            services={services}
            onSaved={handleSaved}
            onCancel={() => { setView('list'); setEditingRecord(null); }}
          />
        )}
      </div>
    </div>
  );
}
