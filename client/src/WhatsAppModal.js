import { useState } from 'react';
import './WhatsAppModal.css';

const TYPES = [
  { key: 'follow_up', label: 'Follow-up Reminder', templateKey: 'followUpTemplate',
    desc: 'Remind patient of their upcoming or pending follow-up visit.' },
  { key: 'birthday',  label: 'Birthday Wish',       templateKey: 'birthdayTemplate',
    desc: 'Send a warm birthday greeting to the patient.' },
];

export default function WhatsAppModal({ patient, onClose }) {
  const [type, setType] = useState('follow_up');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const name = `${patient.firstName} ${patient.lastName}`;

  async function handleSend() {
    if (!patient.phone) { setResult({ ok: false, msg: 'No phone number on file for this patient.' }); return; }
    setSending(true); setResult(null);
    try {
      const cfgRes = await fetch('/api/whatsapp/config');
      if (!cfgRes.ok) { setResult({ ok: false, msg: 'Could not load WhatsApp config. Check settings.' }); setSending(false); return; }
      const cfg = await cfgRes.json();
      const selected = TYPES.find(t => t.key === type);
      const templateName = cfg[selected.templateKey];
      if (!templateName) { setResult({ ok: false, msg: 'Template name not configured. Check WhatsApp Settings.' }); setSending(false); return; }

      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: patient.phone, templateName, params: [name] }),
      });
      const data = await res.json();
      setResult(res.ok ? { ok: true, msg: `Message sent to ${patient.phone}` } : { ok: false, msg: data.error });
    } catch {
      setResult({ ok: false, msg: 'Network error. Please check your connection.' });
    }
    setSending(false);
  }

  return (
    <div className="reg-overlay">
      <div className="reg-modal wa-modal">
        <div className="reg-header">
          <h2>Send WhatsApp — {name}</h2>
          <button className="reg-close" onClick={onClose} type="button">✕</button>
        </div>

        <div className="wa-modal-body">
          {!patient.phone && (
            <div className="wa-no-phone">
              No phone number on file for this patient. Please edit the patient profile first.
            </div>
          )}

          <div className="wa-modal-label">Message Type</div>
          <div className="wa-type-list">
            {TYPES.map(t => (
              <button key={t.key} type="button"
                className={`wa-type-card${type === t.key ? ' active' : ''}`}
                onClick={() => { setType(t.key); setResult(null); }}>
                <span className="wa-type-title">{t.label}</span>
                <span className="wa-type-desc">{t.desc}</span>
              </button>
            ))}
          </div>

          <div className="wa-modal-label" style={{ marginTop: '1rem' }}>Sending to</div>
          <div className="wa-phone-display">
            <span className="wa-phone-icon">📱</span>
            <span>{patient.phone || '—'}</span>
          </div>

          {result && (
            <div className={result.ok ? 'wa-result-ok' : 'wa-result-err'}>{result.msg}</div>
          )}

          <div className="wa-modal-actions">
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
            <button type="button" onClick={handleSend}
              disabled={sending || !patient.phone}>
              {sending ? 'Sending…' : '📤 Send WhatsApp'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
