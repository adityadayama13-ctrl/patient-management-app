import { useEffect, useMemo, useState } from 'react';
import Icon from './icons';
import './TodayTab.css';

const TILE_TONES = ['tone-1', 'tone-2', 'tone-3', 'tone-4'];

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function greeting(now) {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function clock(date) {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  return { time: `${h % 12 || 12}:${m}`, period: h >= 12 ? 'pm' : 'am' };
}

function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = Array.from(parts[0] || '?')[0];
  const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] : '';
  return (first + last).toUpperCase();
}

function money(currency, n) {
  return `${currency}${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function registeredLabel(createdAt, now) {
  if (!createdAt) return '';
  const d = new Date(createdAt);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return 'Registered today';
  if (sameDay(d, yesterday)) return 'Registered yesterday';
  return `Registered ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}

function invoiceLabel(billDate) {
  if (!billDate) return 'Invoice';
  const d = new Date(`${String(billDate).slice(0, 10)}T00:00:00`);
  return `Invoice from ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}

function ledeText({ apptCount, dueCount, showAppts, showBills }) {
  const appts = plural(apptCount, 'appointment', 'appointments');
  const bills = plural(dueCount, 'bill is', 'bills are');
  if (showAppts && showBills) {
    if (apptCount === 0 && dueCount === 0) return 'Nothing is scheduled today, and no bills are waiting for payment.';
    if (dueCount === 0) return `You have ${appts} today. No bills are waiting for payment.`;
    if (apptCount === 0) return `No appointments today, and ${bills} waiting for payment.`;
    return `You have ${appts} today, and ${bills} waiting for payment.`;
  }
  if (showAppts) return apptCount === 0 ? 'Nothing is scheduled today.' : `You have ${appts} today.`;
  if (showBills) return dueCount === 0 ? 'No bills are waiting for payment.' : `${plural(dueCount, 'bill is', 'bills are')} waiting for payment.`;
  return 'Here is what is new in your clinic.';
}

export default function TodayTab({
  userName, patients, appointments, canAppointments, canBilling, canEditPatients,
  currency, onRegister, onOpenTab,
}) {
  const [bills, setBills] = useState([]);
  const now = new Date();

  useEffect(() => {
    if (!canBilling) return undefined;
    let cancelled = false;
    fetch('/api/bills')
      .then(r => (r.ok ? r.json() : []))
      .then(data => { if (!cancelled) setBills(Array.isArray(data) ? data : []); })
      .catch(() => { /* server not ready: leave the list empty */ });
    return () => { cancelled = true; };
  }, [canBilling]);

  const patientById = useMemo(() => new Map(patients.map(p => [p.id, p])), [patients]);
  const nameOf = id => {
    const p = patientById.get(id);
    return p ? `${p.firstName} ${p.lastName}` : 'Unknown patient';
  };

  const todays = useMemo(() => appointments
    .filter(a => sameDay(new Date(a.date), now))
    .sort((a, b) => new Date(a.date) - new Date(b.date)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [appointments]);

  const nextId = todays.find(a => a.status === 'Scheduled' && new Date(a.date) >= now)?.id;

  const due = useMemo(() => bills
    .filter(b => b.type === 'Invoice' && (b.status === 'Unpaid' || b.status === 'Partial'))
    .map(b => {
      const total = (b.items || []).reduce((s, i) => s + Number(i.amount || 0), 0);
      const paid = (b.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
      return { bill: b, balance: total - paid };
    })
    .filter(x => x.balance > 0)
    .sort((a, b) => String(a.bill.billDate).localeCompare(String(b.bill.billDate))),
  [bills]);

  const newest = useMemo(() => [...patients]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 3),
  [patients]);

  const firstName = (userName || '').trim().split(/\s+/)[0];

  return (
    <div className="today">
      <div className="page-head">
        <div>
          <h1>{greeting(now)}{firstName ? `, ${firstName}` : ''}</h1>
          <p className="lede">
            {ledeText({ apptCount: todays.length, dueCount: due.length, showAppts: canAppointments, showBills: canBilling })}
          </p>
        </div>
        <div className="page-actions">
          {canAppointments && (
            <button type="button" className="secondary" onClick={() => onOpenTab('appointments')}>Book appointment</button>
          )}
          {canEditPatients && (
            <button type="button" onClick={onRegister}><Icon name="plus" /> Register patient</button>
          )}
        </div>
      </div>

      <div className="today-cols">
        {canAppointments && (
          <section className="card today-panel">
            <div className="panel-head">
              <h2>Today's appointments</h2>
              <button type="button" className="link-btn" onClick={() => onOpenTab('appointments')}>All appointments</button>
            </div>
            {todays.length === 0 ? (
              <p className="today-empty">No appointments are booked for today.</p>
            ) : (
              <ul className="timeline">
                {todays.map(a => {
                  const { time, period } = clock(new Date(a.date));
                  const state = a.status === 'Completed' ? 'done'
                    : a.status === 'Cancelled' ? 'cancel'
                    : a.id === nextId ? 'next' : 'sched';
                  const label = { done: 'Completed', cancel: 'Cancelled', next: 'Up next', sched: 'Scheduled' }[state];
                  return (
                    <li key={a.id} className={`timeline-row${state === 'next' ? ' is-next' : ''}`}>
                      <time>{time}<small>{period}</small></time>
                      <div className="timeline-who">
                        <span className="timeline-name">{nameOf(a.patientId)}</span>
                        <span className="timeline-note">{a.reason || 'No reason added'}</span>
                      </div>
                      <span className={`chip chip-${state}`}>{label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        <div className="today-side">
          {canBilling && (
            <section>
              <div className="panel-head">
                <h2>Waiting for payment</h2>
                <button type="button" className="link-btn" onClick={() => onOpenTab('billing')}>Open billing</button>
              </div>
              {due.length === 0 ? (
                <p className="today-empty">Every invoice is paid.</p>
              ) : (
                <ul className="side-list">
                  {due.slice(0, 4).map(({ bill, balance }) => (
                    <li key={bill.id} className="side-row">
                      <div>
                        <span className="side-name">{bill.Patient ? `${bill.Patient.firstName} ${bill.Patient.lastName}` : nameOf(bill.patientId)}</span>
                        <span className="side-note">{invoiceLabel(bill.billDate)}</span>
                      </div>
                      <div className="amount">{money(currency, balance)}<small>left to pay</small></div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section>
            <div className="panel-head">
              <h2>New patients</h2>
              <button type="button" className="link-btn" onClick={() => onOpenTab('patients')}>See all</button>
            </div>
            {newest.length === 0 ? (
              <p className="today-empty">Registered patients will appear here.</p>
            ) : (
              <ul className="side-list">
                {newest.map(p => {
                  const full = `${p.firstName} ${p.lastName}`;
                  return (
                    <li key={p.id} className="side-row">
                      <div className="person">
                        <span className={`tile ${TILE_TONES[p.id % TILE_TONES.length]}`}>{initials(full)}</span>
                        <div>
                          <span className="side-name">{full}</span>
                          <span className="side-note">{registeredLabel(p.createdAt, now)}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
