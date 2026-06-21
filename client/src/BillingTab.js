import { useState, useEffect, useCallback } from 'react';
import './BillingTab.css';
import { printBill } from './printBill';

const EMPTY_BILL = {
  patientId: '', appointmentId: '', medicalRecordId: '',
  billDate: new Date().toISOString().slice(0, 10),
  type: 'Invoice', status: 'Unpaid',
  items: [], notes: '',
};

const EMPTY_PAYMENT = {
  paymentDate: new Date().toISOString().slice(0, 10),
  amount: '', method: 'Cash', reference: '', notes: '',
};

function fmt(n) {
  return Number(n || 0).toFixed(2);
}

function billTotal(bill) {
  return (bill.items || []).reduce((s, i) => s + Number(i.amount || 0), 0);
}

function billPaid(bill) {
  return (bill.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
}

function StatusBadge({ type, status }) {
  const cls = type === 'Estimate' ? 'badge-estimate'
    : status === 'Paid'    ? 'badge-paid'
    : status === 'Partial' ? 'badge-partial'
    : 'badge-unpaid';
  return <span className={`bill-badge ${cls}`}>{type === 'Estimate' ? 'Estimate' : status}</span>;
}

// ── Bill Form ─────────────────────────────────────────────────────────────────
function BillForm({ patients, services, initial, onSaved, onCancel }) {
  const [form, setForm] = useState(initial ? {
    patientId: initial.patientId || '',
    appointmentId: initial.appointmentId || '',
    medicalRecordId: initial.medicalRecordId || '',
    billDate: initial.billDate || EMPTY_BILL.billDate,
    type: initial.type || 'Invoice',
    status: initial.status || 'Unpaid',
    items: initial.items ? [...initial.items] : [],
    notes: initial.notes || '',
  } : { ...EMPTY_BILL });

  const [appointments, setAppointments] = useState([]);
  const [records, setRecords] = useState([]);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!form.patientId) { setAppointments([]); setRecords([]); return; }
    fetch(`/api/appointments?patientId=${form.patientId}`)
      .then(r => r.ok ? r.json() : []).then(setAppointments).catch(() => setAppointments([]));
    fetch(`/api/patients/${form.patientId}/records`)
      .then(r => r.ok ? r.json() : []).then(setRecords).catch(() => setRecords([]));
  }, [form.patientId]);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  function addCatalogItem(svc) {
    setForm(f => ({ ...f, items: [...f.items, { description: svc.name, amount: Number(svc.price) }] }));
    setCatalogOpen(false);
  }

  function addCustomItem() {
    setForm(f => ({ ...f, items: [...f.items, { description: '', amount: '' }] }));
  }

  function updateItem(idx, field, value) {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: field === 'amount' ? value : value };
      return { ...f, items };
    });
  }

  function removeItem(idx) {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  const total = form.items.reduce((s, i) => s + Number(i.amount || 0), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.patientId) { setError('Patient is required.'); return; }
    if (!form.billDate)  { setError('Bill date is required.'); return; }
    if (form.items.length === 0) { setError('Add at least one item.'); return; }
    setError(''); setSaving(true);
    const url    = initial?.id ? `/api/bills/${initial.id}` : '/api/bills';
    const method = initial?.id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, appointmentId: form.appointmentId || null, medicalRecordId: form.medicalRecordId || null }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error || 'Save failed.'); return; }
    onSaved();
  }

  return (
    <form className="bill-form" onSubmit={handleSubmit}>
      {error && <p className="reg-error">{error}</p>}

      <div className="bill-form-row">
        <div className="bill-field">
          <label>Patient *</label>
          <select value={form.patientId} onChange={e => set('patientId', e.target.value)} required>
            <option value="">Select patient</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
          </select>
        </div>
        <div className="bill-field">
          <label>Bill Date *</label>
          <input type="date" value={form.billDate} onChange={e => set('billDate', e.target.value)} />
        </div>
        <div className="bill-field">
          <label>Type</label>
          <select value={form.type} onChange={e => set('type', e.target.value)}>
            <option>Invoice</option>
            <option>Estimate</option>
          </select>
        </div>
      </div>

      {form.patientId && (
        <div className="bill-form-row">
          <div className="bill-field">
            <label>Appointment <span className="bill-optional">(optional)</span></label>
            <select value={form.appointmentId} onChange={e => set('appointmentId', e.target.value)}>
              <option value="">None</option>
              {appointments.map(a => (
                <option key={a.id} value={a.id}>
                  {new Date(a.date).toLocaleDateString()} — {a.reason || 'Appointment'}
                </option>
              ))}
            </select>
          </div>
          <div className="bill-field">
            <label>Visit Record <span className="bill-optional">(optional)</span></label>
            <select value={form.medicalRecordId} onChange={e => set('medicalRecordId', e.target.value)}>
              <option value="">None</option>
              {records.map(r => (
                <option key={r.id} value={r.id}>
                  {r.visitDate} — {r.diagnosis || r.chiefComplaint || 'Visit'}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Line items */}
      <div className="bill-items-section">
        <div className="bill-items-header">
          <span className="bill-section-title">Line Items</span>
          <div className="bill-items-actions">
            <div className="bill-catalog-wrap">
              <button type="button" className="btn-catalog" onClick={() => setCatalogOpen(o => !o)}>
                + From Catalog
              </button>
              {catalogOpen && (
                <div className="bill-catalog-dropdown">
                  {services.length === 0
                    ? <p className="bill-catalog-empty">No services in catalog yet.</p>
                    : services.map(s => (
                      <button key={s.id} type="button" className="bill-catalog-item" onClick={() => addCatalogItem(s)}>
                        <span>{s.name}</span>
                        <span className="bill-catalog-price">₹{fmt(s.price)}</span>
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
            <button type="button" className="btn-custom-item" onClick={addCustomItem}>+ Custom Item</button>
          </div>
        </div>

        {form.items.length === 0
          ? <p className="bill-empty-items">No items yet — add from catalog or create a custom item.</p>
          : (
          <table className="bill-items-table">
            <thead>
              <tr><th>Description</th><th>Amount (₹)</th><th></th></tr>
            </thead>
            <tbody>
              {form.items.map((item, idx) => (
                <tr key={idx}>
                  <td>
                    <input value={item.description}
                      onChange={e => updateItem(idx, 'description', e.target.value)}
                      placeholder="Service / item description" />
                  </td>
                  <td>
                    <input type="number" min="0" step="0.01" value={item.amount}
                      onChange={e => updateItem(idx, 'amount', e.target.value)}
                      placeholder="0.00" className="bill-amount-input" />
                  </td>
                  <td>
                    <button type="button" className="bill-remove-item" onClick={() => removeItem(idx)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="bill-total-row">
          <span>{form.type === 'Estimate' ? 'Estimated Total' : 'Total'}</span>
          <span className="bill-total-amount">₹{fmt(total)}</span>
        </div>
      </div>

      <div className="bill-field">
        <label>Notes</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="Payment terms, instructions…" rows={2} />
      </div>

      <div className="bill-form-footer">
        <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" disabled={saving}>{saving ? 'Saving…' : (initial?.id ? 'Update' : `Create ${form.type}`)}</button>
      </div>
    </form>
  );
}

// ── Payment Panel ─────────────────────────────────────────────────────────────
function PaymentPanel({ bill, onClose, onUpdated }) {
  const [form, setForm] = useState({ ...EMPTY_PAYMENT });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const total  = billTotal(bill);
  const paid   = billPaid(bill);
  const balance = total - paid;

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleAddPayment(e) {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) { setError('Enter a valid amount.'); return; }
    setError(''); setSaving(true);
    const res = await fetch(`/api/bills/${bill.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error || 'Failed.'); return; }
    setForm({ ...EMPTY_PAYMENT });
    onUpdated();
  }

  async function handleDeletePayment(id) {
    if (!window.confirm('Remove this payment?')) return;
    const res = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
    if (!res.ok) { setError('Failed to remove payment.'); return; }
    onUpdated();
  }

  return (
    <div className="reg-overlay">
      <div className="reg-modal pay-modal">
        <div className="reg-header">
          <h2>Payments — Bill #{bill.id}</h2>
          <button className="reg-close" onClick={onClose} type="button">✕</button>
        </div>

        <div className="pay-summary">
          <div className="pay-summary-item"><span>Total</span><strong>₹{fmt(total)}</strong></div>
          <div className="pay-summary-item"><span>Paid</span><strong className="pay-green">₹{fmt(paid)}</strong></div>
          <div className="pay-summary-item"><span>Balance</span><strong className={balance > 0 ? 'pay-red' : 'pay-green'}>₹{fmt(balance)}</strong></div>
          <StatusBadge type={bill.type} status={bill.status} />
        </div>

        {/* Payment history */}
        <div className="pay-history">
          {(!bill.payments || bill.payments.length === 0)
            ? <p className="empty pay-pad">No payments recorded yet.</p>
            : bill.payments.map(p => (
              <div key={p.id} className="pay-entry">
                <div className="pay-entry-left">
                  <span className="pay-entry-date">{p.paymentDate}</span>
                  <span className={`pay-method pay-method-${(p.method || 'other').toLowerCase()}`}>{p.method || 'Other'}</span>
                  {p.reference && <span className="pay-ref">#{p.reference}</span>}
                  {p.notes && <span className="pay-notes">{p.notes}</span>}
                </div>
                <div className="pay-entry-right">
                  <span className="pay-entry-amount">₹{fmt(p.amount)}</span>
                  <button type="button" className="pay-delete" onClick={() => handleDeletePayment(p.id)}>✕</button>
                </div>
              </div>
            ))
          }
        </div>

        {/* Add payment form */}
        {balance > 0 && (
          <form className="pay-add-form" onSubmit={handleAddPayment}>
            <div className="pay-form-title">Log Payment</div>
            {error && <p className="reg-error">{error}</p>}
            <div className="bill-form-row">
              <div className="bill-field">
                <label>Date</label>
                <input type="date" value={form.paymentDate} onChange={e => set('paymentDate', e.target.value)} />
              </div>
              <div className="bill-field">
                <label>Amount (₹)</label>
                <input type="number" min="0.01" step="0.01" value={form.amount}
                  onChange={e => set('amount', e.target.value)} placeholder={fmt(balance)} />
              </div>
              <div className="bill-field">
                <label>Method</label>
                <select value={form.method} onChange={e => set('method', e.target.value)}>
                  <option>Cash</option><option>Card</option><option>UPI</option><option>Other</option>
                </select>
              </div>
            </div>
            <div className="bill-form-row">
              <div className="bill-field">
                <label>Reference <span className="bill-optional">(optional)</span></label>
                <input value={form.reference} onChange={e => set('reference', e.target.value)} placeholder="Txn ID / cheque no." />
              </div>
              <div className="bill-field">
                <label>Notes <span className="bill-optional">(optional)</span></label>
                <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="" />
              </div>
            </div>
            <div className="bill-form-footer">
              <div />
              <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Record Payment'}</button>
            </div>
          </form>
        )}
        {balance <= 0 && <p className="pay-paid-msg">✓ Fully paid</p>}
      </div>
    </div>
  );
}

// ── Main Billing Tab ──────────────────────────────────────────────────────────
export default function BillingTab({ patients }) {
  const [bills, setBills]         = useState([]);
  const [services, setServices]   = useState([]);
  const [view, setView]           = useState('list'); // 'list' | 'new' | 'edit'
  const [editingBill, setEditing] = useState(null);
  const [paymentBill, setPayment] = useState(null);
  const [filter, setFilter]       = useState('all'); // 'all' | 'Estimate' | 'Invoice' | 'Unpaid' | 'Partial' | 'Paid'
  const [search, setSearch]       = useState('');

  const fetchBills    = useCallback(() =>
    fetch('/api/bills').then(r => r.ok ? r.json() : []).then(setBills).catch(() => setBills([])), []);
  const fetchServices = useCallback(() =>
    fetch('/api/services').then(r => r.ok ? r.json() : []).then(setServices).catch(() => setServices([])), []);

  useEffect(() => { fetchBills(); fetchServices(); }, [fetchBills, fetchServices]);

  async function handleConvert(bill) {
    if (!window.confirm('Convert this estimate to an invoice?')) return;
    const res = await fetch(`/api/bills/${bill.id}/convert`, { method: 'POST' });
    if (!res.ok) { alert((await res.json()).error || 'Conversion failed.'); return; }
    fetchBills();
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this bill?')) return;
    const res = await fetch(`/api/bills/${id}`, { method: 'DELETE' });
    if (!res.ok) { alert('Failed to delete bill.'); return; }
    fetchBills();
  }

  function patientName(bill) {
    if (bill.Patient) return `${bill.Patient.firstName} ${bill.Patient.lastName}`;
    const p = patients.find(p => p.id === bill.patientId);
    return p ? `${p.firstName} ${p.lastName}` : '—';
  }

  const filtered = bills.filter(b => {
    if (filter === 'Estimate' && b.type !== 'Estimate') return false;
    if (filter === 'Invoice'  && b.type !== 'Invoice')  return false;
    if (['Unpaid','Partial','Paid'].includes(filter) && b.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = patientName(b).toLowerCase();
      if (!name.includes(q) && !String(b.id).includes(q)) return false;
    }
    return true;
  });

  if (view === 'new' || view === 'edit') {
    return (
      <div className="bill-form-card card">
        <div className="bill-form-header">
          <h2>{view === 'new' ? 'New Bill' : `Edit Bill #${editingBill?.id}`}</h2>
        </div>
        <BillForm
          patients={patients}
          services={services}
          initial={view === 'edit' ? editingBill : null}
          onSaved={() => { fetchBills(); setView('list'); setEditing(null); }}
          onCancel={() => { setView('list'); setEditing(null); }}
        />
      </div>
    );
  }

  return (
    <>
      <div className="bill-toolbar">
        <div className="bill-filters">
          {['all','Estimate','Invoice','Unpaid','Partial','Paid'].map(f => (
            <button key={f} type="button"
              className={filter === f ? 'bill-filter active' : 'bill-filter'}
              onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
        <div className="bill-toolbar-right">
          <input className="patient-search" placeholder="Search patient or bill #…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <button onClick={() => { setEditing(null); setView('new'); }}>+ New Bill</button>
        </div>
      </div>

      <div className="card">
        <h2>Bills ({filtered.length})</h2>
        {filtered.length === 0
          ? <p className="empty">No bills found.</p>
          : (
          <table className="bill-table">
            <thead>
              <tr>
                <th>#</th><th>Patient</th><th>Date</th>
                <th>Total</th><th>Paid</th><th>Balance</th>
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const total   = billTotal(b);
                const paid    = billPaid(b);
                const balance = total - paid;
                return (
                  <tr key={b.id}>
                    <td className="bill-id">#{b.id}</td>
                    <td>{patientName(b)}</td>
                    <td>{b.billDate}</td>
                    <td>₹{fmt(total)}</td>
                    <td className="pay-green">₹{fmt(paid)}</td>
                    <td className={balance > 0 ? 'pay-red' : 'pay-green'}>₹{fmt(balance)}</td>
                    <td><StatusBadge type={b.type} status={b.status} /></td>
                    <td className="bill-actions">
                      {b.type === 'Estimate' && (
                        <button className="btn-convert" onClick={() => handleConvert(b)}>→ Invoice</button>
                      )}
                      {b.type === 'Invoice' && b.status !== 'Paid' && (
                        <button className="btn-pay" onClick={() => setPayment(b)}>Pay</button>
                      )}
                      {b.type === 'Invoice' && b.status === 'Paid' && (
                        <button className="btn-pay-view" onClick={() => setPayment(b)}>View</button>
                      )}
                      <button className="btn-print" onClick={() => printBill(b, patientName(b))}>Print</button>
                      <button className="btn-edit" onClick={() => { setEditing(b); setView('edit'); }}>Edit</button>
                      <button className="btn-delete" onClick={() => handleDelete(b.id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {paymentBill && (
        <PaymentPanel
          bill={paymentBill}
          onClose={() => setPayment(null)}
          onUpdated={() => {
            fetchBills();
            fetch(`/api/bills/${paymentBill.id}`)
              .then(r => r.ok ? r.json() : null)
              .then(data => { if (data) setPayment(data); })
              .catch(() => {});
          }}
        />
      )}
    </>
  );
}
