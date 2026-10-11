import { useEffect, useMemo, useState } from 'react';
import Icon from './icons';
import './DentalChart.css';

// Keys must match DENTAL_CONDITIONS in dental.js. `code` is drawn on the tooth
// so the chart doesn't rely on colour alone.
export const CONDITIONS = [
  { key: 'sound',     label: 'Sound',              code: '',   tone: 'sound' },
  { key: 'caries',    label: 'Caries',             code: 'C',  tone: 'danger' },
  { key: 'filled',    label: 'Filled',             code: 'F',  tone: 'accent' },
  { key: 'rct',       label: 'Root canal treated', code: 'R',  tone: 'accent' },
  { key: 'crown',     label: 'Crown',              code: 'Cr', tone: 'warning' },
  { key: 'bridge',    label: 'Bridge',             code: 'B',  tone: 'warning' },
  { key: 'implant',   label: 'Implant',            code: 'I',  tone: 'success' },
  { key: 'missing',   label: 'Missing',            code: '',   tone: 'missing' },
  { key: 'extract',   label: 'To extract',         code: 'X',  tone: 'danger' },
  { key: 'fractured', label: 'Fractured',          code: 'Fr', tone: 'danger' },
  { key: 'mobile',    label: 'Mobile',             code: 'M',  tone: 'warning' },
  { key: 'impacted',  label: 'Impacted',           code: 'Im', tone: 'muted' },
];
const CONDITION_BY_KEY = Object.fromEntries(CONDITIONS.map(c => [c.key, c]));

// FDI numbering, drawn as the dentist faces the patient: the patient's right is on the left.
const range = (from, to) => {
  const step = from <= to ? 1 : -1;
  return Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => String(from + i * step));
};
const ARCHES = {
  permanentUpper: [range(18, 11), range(21, 28)],
  primaryUpper:   [range(55, 51), range(61, 65)],
  primaryLower:   [range(85, 81), range(71, 75)],
  permanentLower: [range(48, 41), range(31, 38)],
};
const ROWS = {
  Adult: [['permanentUpper', 'upper'], ['permanentLower', 'lower']],
  Child: [['primaryUpper', 'upper'], ['primaryLower', 'lower']],
  Mixed: [['permanentUpper', 'upper'], ['primaryUpper', 'upper'], ['primaryLower', 'lower'], ['permanentLower', 'lower']],
};

const QUADRANT = { 1: 'Upper right', 2: 'Upper left', 3: 'Lower left', 4: 'Lower right', 5: 'Upper right', 6: 'Upper left', 7: 'Lower left', 8: 'Lower right' };
const PERMANENT_NAMES = ['central incisor', 'lateral incisor', 'canine', 'first premolar', 'second premolar', 'first molar', 'second molar', 'third molar (wisdom tooth)'];
const PRIMARY_NAMES = ['central incisor', 'lateral incisor', 'canine', 'first molar', 'second molar'];

export function toothName(tooth) {
  const q = Number(tooth[0]), p = Number(tooth[1]);
  const primary = q >= 5;
  return `${QUADRANT[q]} ${(primary ? PRIMARY_NAMES : PERMANENT_NAMES)[p - 1]}${primary ? ' (milk tooth)' : ''}`;
}

function defaultDentition(dateOfBirth) {
  if (!dateOfBirth) return 'Adult';
  const age = (Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 86400000);
  if (age < 6) return 'Child';
  if (age < 13) return 'Mixed';
  return 'Adult';
}

// ── Tooth drawing ─────────────────────────────────────────────────────────────
// Drawn crown-up in a 28x50 box; upper teeth are flipped so crowns meet in the middle.
const W = 28, H = 50;

function toothShape(tooth) {
  const p = Number(tooth[1]);
  const primary = Number(tooth[0]) >= 5;
  const kind = p <= 2 ? 'incisor' : p === 3 ? 'canine' : (!primary && p <= 5) ? 'premolar' : 'molar';
  const crownW = { incisor: p === 1 ? 13 : 11.5, canine: 12.5, premolar: 15, molar: 21 }[kind] * (primary ? 0.86 : 1);
  const x0 = (W - crownW) / 2;
  const crown = `M${x0} 7.5Q${x0} 3 ${x0 + 4.5} 3H${x0 + crownW - 4.5}Q${x0 + crownW} 3 ${x0 + crownW} 7.5V15Q${x0 + crownW} 19 ${x0 + crownW - 3} 19H${x0 + 3}Q${x0} 19 ${x0} 15Z`;
  const tip = kind === 'canine' ? 48 : primary ? 40 : 45;
  let roots;
  let canals;
  if (kind === 'molar') {
    const l = x0 + 1.5, r = x0 + crownW - 1.5, mid = W / 2;
    roots = `M${l} 18L${l + 2.5} ${tip - 2}Q${l + 4} ${tip} ${l + 5.5} ${tip - 2}L${mid - 0.8} 19Z` +
            `M${r} 18L${r - 2.5} ${tip - 2}Q${r - 4} ${tip} ${r - 5.5} ${tip - 2}L${mid + 0.8} 19Z`;
    canals = `M${l + 3.3} 20L${l + 4} ${tip - 4}M${r - 3.3} 20L${r - 4} ${tip - 4}`;
  } else {
    const rw = crownW * 0.62, c = W / 2;
    roots = `M${c - rw / 2} 18L${c - 1.4} ${tip - 1.5}Q${c} ${tip + 1} ${c + 1.4} ${tip - 1.5}L${c + rw / 2} 18Z`;
    canals = `M${c} 20L${c} ${tip - 3}`;
  }
  return { crown, roots, canals };
}

function ToothGlyph({ tooth, upper, condition }) {
  const { crown, roots, canals } = toothShape(tooth);
  const cond = CONDITION_BY_KEY[condition] || CONDITION_BY_KEY.sound;
  const flip = upper ? `translate(0 ${H}) scale(1 -1)` : undefined;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tooth-glyph" aria-hidden="true" focusable="false">
      <g transform={flip}>
        <path d={roots} className={`tg-root${condition === 'implant' ? ' tg-implant' : ''}`} />
        {condition === 'rct' && <path d={canals} className="tg-canal" />}
        <path d={crown} className="tg-crown" />
      </g>
      {cond.code && (
        <text x={W / 2} y={upper ? H - 11 : 11} className="tg-code" textAnchor="middle" dominantBaseline="central">{cond.code}</text>
      )}
      {condition === 'extract' && (
        <path d={`M4 ${upper ? 8 : 4}L24 ${upper ? 46 : 42}M24 ${upper ? 8 : 4}L4 ${upper ? 46 : 42}`} className="tg-cross" />
      )}
    </svg>
  );
}

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function money(currency, n) {
  return `${currency}${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

// ── Selected tooth panel ──────────────────────────────────────────────────────
function ToothPanel({ tooth, history, treatments, services, currency, onRecord, onDeleteEntry, onPlan, onSetStatus, onRemovePlan }) {
  const current = history[0]?.condition || 'sound';
  const [draft, setDraft] = useState(current);
  const [note, setNote] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setDraft(current); setNote(''); setServiceId(''); setPrice(''); setError(''); }, [tooth, current]);

  const servicesByCategory = useMemo(() => {
    const groups = new Map();
    for (const s of services) {
      const cat = s.category || 'Other';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(s);
    }
    return [...groups.entries()];
  }, [services]);

  async function run(fn) {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  function chooseService(id) {
    setServiceId(id);
    const s = services.find(x => String(x.id) === id);
    setPrice(s ? String(Number(s.price)) : '');
  }

  const service = services.find(s => String(s.id) === serviceId);

  return (
    <section className="tooth-panel" aria-labelledby="tooth-panel-title">
      <div className="tooth-panel-head">
        <div>
          <h3 id="tooth-panel-title">Tooth {tooth}</h3>
          <p className="tooth-panel-sub">{toothName(tooth)}</p>
        </div>
        <span className={`cond-pill tone-${CONDITION_BY_KEY[current].tone}`}>{CONDITION_BY_KEY[current].label}</span>
      </div>

      {error && <div className="dc-error" role="alert">{error}</div>}

      <div className="tooth-panel-grid">
        <div>
          <h4>Condition</h4>
          <div className="cond-options" role="radiogroup" aria-label={`Condition of tooth ${tooth}`}>
            {CONDITIONS.map(c => (
              <button
                key={c.key} type="button" role="radio" aria-checked={draft === c.key}
                className={`cond-option tone-${c.tone}${draft === c.key ? ' is-on' : ''}`}
                onClick={() => setDraft(c.key)}
              >
                <span className="cond-swatch" aria-hidden="true">{c.code}</span>{c.label}
              </button>
            ))}
          </div>
          <label className="dc-field">
            <span>Note (optional)</span>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. distal caries, sensitive to cold" />
          </label>
          <button
            type="button" disabled={busy || (draft === current && !note.trim())}
            onClick={() => run(() => onRecord(draft, note))}
          >
            Save condition
          </button>

          {history.length > 0 && (
            <>
              <h4 className="dc-subhead">History</h4>
              <ul className="cond-history">
                {history.map(h => (
                  <li key={h.id}>
                    <div>
                      <span className="cond-history-label">{CONDITION_BY_KEY[h.condition]?.label || h.condition}</span>
                      <span className="cond-history-meta">{fmtDate(h.createdAt)}{h.recordedBy ? `, ${h.recordedBy}` : ''}</span>
                      {h.note && <span className="cond-history-note">{h.note}</span>}
                    </div>
                    <button type="button" className="dc-icon-btn" aria-label={`Delete this ${CONDITION_BY_KEY[h.condition]?.label || ''} entry`} title="Delete entry"
                      onClick={() => window.confirm('Delete this history entry?') && run(() => onDeleteEntry(h.id))}>
                      <Icon name="trash" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div>
          <h4>Treatment on this tooth</h4>
          {treatments.length === 0 ? (
            <p className="dc-muted">Nothing planned yet.</p>
          ) : (
            <ul className="tooth-plan">
              {treatments.map(t => (
                <li key={t.id}>
                  <div>
                    <span className="tooth-plan-name">{t.name}</span>
                    <span className="tooth-plan-meta">{money(currency, t.price)}{t.billId ? ', on an estimate' : ''}</span>
                  </div>
                  <div className="tooth-plan-actions">
                    {t.status === 'Done' ? (
                      <>
                        <span className="dc-state dc-state-done">Done {fmtDate(t.doneAt)}</span>
                        <button type="button" className="link-btn dc-undo" onClick={() => run(() => onSetStatus(t.id, 'Planned'))}>Undo</button>
                      </>
                    ) : (
                      <button type="button" className="secondary dc-small" onClick={() => run(() => onSetStatus(t.id, 'Done'))}><Icon name="check" size={15} /> Mark done</button>
                    )}
                    {!t.billId && (
                      <button type="button" className="dc-icon-btn" aria-label={`Remove ${t.name}`} title="Remove from plan"
                        onClick={() => run(() => onRemovePlan(t.id))}>
                        <Icon name="trash" size={16} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="plan-form">
            <label className="dc-field">
              <span>Plan a treatment</span>
              <select value={serviceId} onChange={e => chooseService(e.target.value)}>
                <option value="">Choose from the service list…</option>
                {servicesByCategory.map(([cat, list]) => (
                  <optgroup key={cat} label={cat}>
                    {list.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="dc-field dc-price">
              <span>Price</span>
              <input type="number" min="0" step="1" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} />
            </label>
            <button
              type="button" className="secondary" disabled={busy || !service || price === ''}
              onClick={() => run(async () => { await onPlan(service, price); setServiceId(''); setPrice(''); })}
            >
              <Icon name="plus" size={16} /> Add to plan
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Chart ─────────────────────────────────────────────────────────────────────
async function send(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

export default function DentalChart({ patient, services, canBilling, currency = '₹' }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [estimateMsg, setEstimateMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setData(await send(`/api/patients/${patient.id}/dental`, 'GET'));
    } catch (e) { setError(e.message); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [patient.id]);

  const dentition = data?.dentition || defaultDentition(patient.dateOfBirth);

  const historyByTooth = useMemo(() => {
    const map = new Map();
    for (const c of data?.conditions || []) {
      if (!map.has(c.tooth)) map.set(c.tooth, []);
      map.get(c.tooth).push(c);
    }
    return map;
  }, [data]);

  const plan = useMemo(() => data?.treatments || [], [data]);
  const openPlanTeeth = useMemo(() => new Set(plan.filter(t => t.status !== 'Done').map(t => t.tooth)), [plan]);
  const billable = plan.filter(t => t.status === 'Planned' && !t.billId);
  const pickedTotal = billable.filter(t => picked.has(t.id)).reduce((s, t) => s + Number(t.price), 0);

  async function setDentition(value) {
    setError('');
    try {
      await send(`/api/patients/${patient.id}/dental/dentition`, 'PUT', { dentition: value });
      setData(d => ({ ...d, dentition: value }));
      setSelected(null);
    } catch (e) { setError(e.message); }
  }

  async function addToEstimate() {
    setBusy(true); setError(''); setEstimateMsg('');
    try {
      const ids = billable.filter(t => picked.has(t.id)).map(t => t.id);
      await send(`/api/patients/${patient.id}/dental/estimate`, 'POST', { treatmentIds: ids });
      setPicked(new Set());
      setEstimateMsg(`Estimate created for ${money(currency, pickedTotal)}. Open Billing to print it or turn it into an invoice.`);
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  function togglePick(id) {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (!data) {
    return <div className="dc-wrap">{error ? <div className="dc-error" role="alert">{error}</div> : <p className="dc-muted">Loading the chart…</p>}</div>;
  }

  const legend = CONDITIONS.filter(c => c.key !== 'sound');

  return (
    <div className="dc-wrap">
      <div className="dc-toolbar">
        <div className="dc-seg" role="radiogroup" aria-label="Teeth to show">
          {['Adult', 'Child', 'Mixed'].map(d => (
            <button key={d} type="button" role="radio" aria-checked={dentition === d}
              className={dentition === d ? 'is-on' : ''} onClick={() => dentition !== d && setDentition(d)}>
              {d === 'Adult' ? 'Adult teeth' : d === 'Child' ? 'Milk teeth' : 'Mixed'}
            </button>
          ))}
        </div>
        <p className="dc-hint">Select a tooth to record its condition or plan treatment.</p>
      </div>

      {error && <div className="dc-error" role="alert">{error}</div>}

      <div className="dc-chart" role="group" aria-label="Dental chart">
        <div className="dc-side-labels" aria-hidden="true"><span>Patient's right</span><span>Patient's left</span></div>
        {ROWS[dentition].map(([arch, jaw], i) => (
          <div key={arch} className={`dc-arch dc-${jaw}${ROWS[dentition][i + 1]?.[1] === 'lower' && jaw === 'upper' ? ' dc-bite' : ''}`}>
            {ARCHES[arch].map((half, h) => (
              <div key={h} className={`dc-half dc-half-${h === 0 ? 'right' : 'left'}`}
                data-label={`${jaw === 'upper' ? 'Upper' : 'Lower'} ${h === 0 ? 'right' : 'left'}${arch.startsWith('primary') ? ', milk teeth' : ''}`}>
                {half.map(tooth => {
                  const history = historyByTooth.get(tooth) || [];
                  const condition = history[0]?.condition || 'sound';
                  const cond = CONDITION_BY_KEY[condition];
                  const planned = openPlanTeeth.has(tooth);
                  const label = `Tooth ${tooth}, ${toothName(tooth)}: ${cond.label}${planned ? ', treatment planned' : ''}`;
                  return (
                    <button
                      key={tooth} type="button"
                      className={`tooth-btn tone-${cond.tone}${selected === tooth ? ' is-selected' : ''}`}
                      aria-pressed={selected === tooth} aria-label={label} title={label}
                      onClick={() => setSelected(s => (s === tooth ? null : tooth))}
                    >
                      {jaw === 'upper' && <span className="tooth-num">{tooth}{planned && <i className="plan-dot" />}</span>}
                      <ToothGlyph tooth={tooth} upper={jaw === 'upper'} condition={condition} />
                      {jaw === 'lower' && <span className="tooth-num">{tooth}{planned && <i className="plan-dot" />}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      <ul className="dc-legend" aria-label="Key">
        {legend.map(c => (
          <li key={c.key}><span className={`cond-swatch tone-${c.tone}`} aria-hidden="true">{c.code}</span>{c.label}</li>
        ))}
        <li><i className="plan-dot" aria-hidden="true" />Treatment planned</li>
      </ul>

      {selected && (
        <ToothPanel
          tooth={selected}
          history={historyByTooth.get(selected) || []}
          treatments={plan.filter(t => t.tooth === selected)}
          services={services}
          currency={currency}
          onRecord={async (condition, note) => {
            await send(`/api/patients/${patient.id}/dental/conditions`, 'POST', { tooth: selected, condition, note });
            await load();
          }}
          onDeleteEntry={async id => { await send(`/api/dental/conditions/${id}`, 'DELETE'); await load(); }}
          onPlan={async (service, price) => {
            await send(`/api/patients/${patient.id}/dental/treatments`, 'POST', {
              tooth: selected, serviceId: service.id, name: service.name, price: Number(price),
            });
            await load();
          }}
          onSetStatus={async (id, status) => { await send(`/api/dental/treatments/${id}`, 'PUT', { status }); await load(); }}
          onRemovePlan={async id => { await send(`/api/dental/treatments/${id}`, 'DELETE'); await load(); }}
        />
      )}

      <section className="dc-plan" aria-labelledby="dc-plan-title">
        <div className="dc-plan-head">
          <h3 id="dc-plan-title">Treatment plan</h3>
          {canBilling && billable.length > 0 && (
            <button type="button" disabled={busy || picked.size === 0} onClick={addToEstimate}>
              {picked.size === 0 ? 'Add to estimate' : `Add ${picked.size} to estimate (${money(currency, pickedTotal)})`}
            </button>
          )}
        </div>
        {estimateMsg && <div className="dc-success" role="status">{estimateMsg}</div>}
        {plan.length === 0 ? (
          <p className="dc-muted">No treatment planned. Select a tooth to plan treatment.</p>
        ) : (
          <ul className="dc-plan-list">
            {plan.map(t => {
              const canPick = canBilling && t.status === 'Planned' && !t.billId;
              const state = t.status === 'Done' ? 'done' : t.billId ? 'billed' : 'planned';
              return (
                <li key={t.id} className="dc-plan-row">
                  {canBilling && (
                    <input
                      type="checkbox" aria-label={`Add ${t.name} on tooth ${t.tooth} to the estimate`}
                      disabled={!canPick} checked={picked.has(t.id)} onChange={() => togglePick(t.id)}
                    />
                  )}
                  <button type="button" className="dc-plan-tooth" onClick={() => setSelected(t.tooth)} aria-label={`Show tooth ${t.tooth}`}>{t.tooth}</button>
                  <span className="dc-plan-name">{t.name}</span>
                  <span className="dc-plan-price">{money(currency, t.price)}</span>
                  <span className={`dc-state dc-state-${state}`}>
                    {state === 'done' ? `Done ${fmtDate(t.doneAt)}` : state === 'billed' ? 'On estimate' : 'Planned'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
