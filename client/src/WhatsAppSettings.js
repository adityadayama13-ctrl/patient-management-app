import { useState, useEffect } from 'react';
import './WhatsAppSettings.css';

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

  return (
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
  );
}
