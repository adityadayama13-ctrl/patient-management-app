import { useState, useEffect } from 'react';
import './WhatsAppSettings.css';

const OCCASIONS = [
  { label: '🎉 New Year',  template: 'happy_new_year' },
  { label: '🪔 Diwali',    template: 'happy_diwali' },
  { label: '🎄 Christmas', template: 'happy_christmas' },
  { label: '☪️ Eid',       template: 'eid_mubarak' },
  { label: '🎨 Holi',      template: 'happy_holi' },
  { label: '🎊 Navratri',  template: 'happy_navratri' },
  { label: '✏️ Custom',    template: '' },
];

function BroadcastSection() {
  const [templateName, setTemplateName]           = useState('');
  const [includePatientName, setIncludePatientName] = useState(true);
  const [filter, setFilter]                       = useState({ gender: '', minAge: '', maxAge: '' });
  const [previewCount, setPreviewCount]           = useState(null);
  const [previewing, setPreviewing]               = useState(false);
  const [sending, setSending]                     = useState(false);
  const [result, setResult]                       = useState(null);
  const [error, setError]                         = useState('');

  function buildFilter() {
    const f = {};
    if (filter.gender)  f.gender  = filter.gender;
    if (filter.minAge)  f.minAge  = Number(filter.minAge);
    if (filter.maxAge)  f.maxAge  = Number(filter.maxAge);
    return f;
  }

  async function handlePreview() {
    setPreviewing(true); setPreviewCount(null); setError('');
    try {
      const res = await fetch('/api/whatsapp/broadcast/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter: buildFilter() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Preview failed.'); } else { setPreviewCount(data.count); }
    } catch { setError('Cannot reach server.'); }
    setPreviewing(false);
  }

  async function handleSend() {
    if (!templateName.trim()) { setError('Template name is required.'); return; }
    if (previewCount === null) { setError('Click "Preview Recipients" first.'); return; }
    if (previewCount === 0)   { setError('No patients match the current filter.'); return; }
    if (!window.confirm(`Send "${templateName}" to ${previewCount} patient${previewCount !== 1 ? 's' : ''}?\n\nThis will send immediately and cannot be undone.`)) return;
    setError(''); setSending(true); setResult(null);
    try {
      const res = await fetch('/api/whatsapp/broadcast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateName: templateName.trim(), includePatientName, filter: buildFilter() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Broadcast failed.'); } else { setResult(data); }
    } catch { setError('Cannot reach server.'); }
    setSending(false);
  }

  function resetFilter() {
    setFilter({ gender: '', minAge: '', maxAge: '' });
    setPreviewCount(null);
  }

  return (
    <section className="card wa-broadcast-card">
      <div className="wa-broadcast-head">
        <h2>Broadcast Message</h2>
        <span className="wa-bulk-badge">Bulk Send</span>
      </div>
      <p className="wa-broadcast-desc">
        Send a festival greeting or announcement to all (or filtered) patients at once.
        The template must be pre-approved in your Meta Business Manager.
      </p>

      <div className="setting-divider">Occasion Presets</div>
      <div className="wa-occasion-grid">
        {OCCASIONS.map(o => (
          <button key={o.label} type="button"
            className={`wa-occasion-btn${templateName === o.template && o.template ? ' active' : ''}`}
            onClick={() => { if (o.template) { setTemplateName(o.template); setPreviewCount(null); } }}>
            {o.label}
          </button>
        ))}
      </div>

      <div className="setting-divider">Template</div>
      <div className="setting-row">
        <label className="setting-label">Template Name</label>
        <input style={{ maxWidth: 280 }} placeholder="e.g. happy_diwali"
          value={templateName}
          onChange={e => { setTemplateName(e.target.value); setPreviewCount(null); }} />
      </div>
      <div className="setting-row">
        <label className="setting-label">Patient Name</label>
        <label className="wa-toggle">
          <input type="checkbox" checked={includePatientName}
            onChange={e => setIncludePatientName(e.target.checked)} />
          <span className="wa-slider" />
          <span className="wa-toggle-label">{includePatientName ? 'Pass as {{1}}' : 'Not included'}</span>
        </label>
        <span className="wa-hint">Enable if your template uses &#123;&#123;1&#125;&#125; for the patient's name</span>
      </div>

      <div className="setting-divider">
        Filter Recipients
        <button type="button" className="wa-reset-filter" onClick={resetFilter}>Reset</button>
      </div>
      <div className="wa-filter-row">
        <div className="wa-filter-field">
          <label>Gender</label>
          <select value={filter.gender}
            onChange={e => { setFilter(f => ({ ...f, gender: e.target.value })); setPreviewCount(null); }}>
            <option value="">All genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="wa-filter-field">
          <label>Min Age</label>
          <input type="number" min="0" max="120" placeholder="Any"
            value={filter.minAge}
            onChange={e => { setFilter(f => ({ ...f, minAge: e.target.value })); setPreviewCount(null); }} />
        </div>
        <div className="wa-filter-field">
          <label>Max Age</label>
          <input type="number" min="0" max="120" placeholder="Any"
            value={filter.maxAge}
            onChange={e => { setFilter(f => ({ ...f, maxAge: e.target.value })); setPreviewCount(null); }} />
        </div>
      </div>

      {error && <p className="wa-broadcast-error">{error}</p>}

      {result && (
        <div className={`wa-broadcast-result ${result.failed > 0 ? 'partial' : 'success'}`}>
          <strong>Broadcast complete:</strong> {result.sent} sent, {result.failed} failed out of {result.total}.
          {result.errors?.length > 0 && (
            <ul className="wa-broadcast-err-list">
              {result.errors.map((e, i) => <li key={i}><b>{e.patient}:</b> {e.error}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="wa-broadcast-actions">
        <button type="button" className="secondary" onClick={handlePreview} disabled={previewing}>
          {previewing ? 'Counting…' : 'Preview Recipients'}
        </button>
        {previewCount !== null && (
          <span className="wa-preview-count">
            {previewCount === 0
              ? 'No patients match this filter'
              : `${previewCount} patient${previewCount !== 1 ? 's' : ''} will receive this message`}
          </span>
        )}
        <button type="button" className="wa-send-btn" onClick={handleSend}
          disabled={sending || !templateName.trim()}>
          {sending ? 'Sending…' : '📣 Send Broadcast'}
        </button>
      </div>
    </section>
  );
}

const DEFAULTS = {
  phoneNumberId: '', accessToken: '', followUpTemplate: 'follow_up_reminder',
  birthdayTemplate: 'birthday_wish', languageCode: 'en', enabled: false,
};

export default function WhatsAppSettings() {
  const [cfg, setCfg] = useState(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    fetch('/api/whatsapp/config')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setCfg(c => ({ ...c, ...data })); })
      .catch(() => {});
  }, []);

  function set(k, v) { setCfg(c => ({ ...c, [k]: v })); }

  async function handleSave(e) {
    e.preventDefault();
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) { alert('Failed to save WhatsApp settings. Please try again.'); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { alert('Network error. Could not save settings.'); }
  }

  async function handleTest() {
    setTesting(true); setTestResult(null);
    try {
      await fetch('/api/whatsapp/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      const res = await fetch('/api/whatsapp/test', { method: 'POST' });
      const data = await res.json();
      setTestResult(res.ok ? { ok: true, msg: `Connected — ${data.name}` } : { ok: false, msg: data.error });
    } catch {
      setTestResult({ ok: false, msg: 'Network error. Could not reach server.' });
    }
    setTesting(false);
  }

  return (<>
    <section className="card">
      <h2>WhatsApp Business</h2>
      <div className="wa-info-box">
        <b>Setup steps:</b>
        <ol>
          <li>Go to <b>Meta for Developers → WhatsApp → Getting Started</b></li>
          <li>Copy your <b>Phone Number ID</b> and generate a <b>permanent System User token</b></li>
          <li>Submit two message templates to Meta for approval (names below)</li>
          <li>Paste credentials here and click <b>Test Connection</b></li>
        </ol>
      </div>

      <form onSubmit={handleSave} className="form">

        <div className="setting-divider">Connection</div>
        <div className="setting-row">
          <label className="setting-label">Enable</label>
          <label className="wa-toggle">
            <input type="checkbox" checked={cfg.enabled} onChange={e => set('enabled', e.target.checked)} />
            <span className="wa-slider" />
            <span className="wa-toggle-label">{cfg.enabled ? 'On' : 'Off'}</span>
          </label>
        </div>
        <div className="setting-row">
          <label className="setting-label">Phone Number ID</label>
          <input style={{ maxWidth: 300 }} placeholder="From Meta Developer Console"
            value={cfg.phoneNumberId} onChange={e => set('phoneNumberId', e.target.value)} />
        </div>
        <div className="setting-row">
          <label className="setting-label">Access Token</label>
          <input style={{ maxWidth: 400 }} placeholder="Permanent System User token"
            value={cfg.accessToken} onChange={e => set('accessToken', e.target.value)} />
        </div>
        <div className="setting-row">
          <label className="setting-label">Language Code</label>
          <input style={{ maxWidth: 100 }} placeholder="en"
            value={cfg.languageCode} onChange={e => set('languageCode', e.target.value)} />
          <span className="wa-hint">e.g. en, en_US, hi</span>
        </div>

        <div className="setting-divider">Message Templates</div>
        <div className="wa-template-note">
          Template names must match what you submitted to Meta for approval exactly.
        </div>
        <div className="setting-row">
          <label className="setting-label">Follow-up Template</label>
          <input style={{ maxWidth: 280 }} placeholder="follow_up_reminder"
            value={cfg.followUpTemplate} onChange={e => set('followUpTemplate', e.target.value)} />
        </div>
        <div className="wa-template-sample">
          Sample body: <em>"Hello &#123;&#123;1&#125;&#125;, this is a reminder for your follow-up visit at our clinic today. Please call us to confirm. — Dr. Team"</em>
        </div>
        <div className="setting-row">
          <label className="setting-label">Birthday Template</label>
          <input style={{ maxWidth: 280 }} placeholder="birthday_wish"
            value={cfg.birthdayTemplate} onChange={e => set('birthdayTemplate', e.target.value)} />
        </div>
        <div className="wa-template-sample">
          Sample body: <em>"Happy Birthday &#123;&#123;1&#125;&#125;! 🎂 Wishing you great health and happiness. — Your Clinic Team"</em>
        </div>

        <div className="setting-divider">Scheduler</div>
        <div className="wa-schedule-info">
          <span className="wa-badge">Daily 9:00 AM IST</span>
          Automatically sends follow-up reminders (patients with today's follow-up date) and birthday wishes.
        </div>

        <div className="form-actions" style={{ marginTop: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="submit">Save</button>
          <button type="button" className="secondary" onClick={handleTest} disabled={testing || !cfg.phoneNumberId}>
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          {saved && <span className="saved-msg">Saved!</span>}
          {testResult && (
            <span className={testResult.ok ? 'wa-test-ok' : 'wa-test-err'}>{testResult.msg}</span>
          )}
        </div>
      </form>
    </section>
    <BroadcastSection />
  </>);
}
