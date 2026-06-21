// Escapes user content before injecting into HTML to prevent XSS
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getClinicProfile() {
  try {
    const p = JSON.parse(localStorage.getItem('clinicProfile')) || {};
    const contactParts = [p.phone, p.email, p.website].filter(Boolean);
    return {
      name:          p.name               || 'Your Clinic Name',
      tagline:       p.tagline             || '',
      contact:       contactParts.join('  ·  '),
      doctorName:    p.doctorName          || '',
      doctorQual:    p.doctorQualification || '',
      regNumber:     p.registrationNumber  || '',
      currency:      p.currency            || '₹',
      footerMessage: p.footerMessage       || 'Thank you for your trust in us.',
      logo:          p.logo                || '',
      logoType:      p.logoType            || 'logo',
    };
  } catch {
    return { name: 'Your Clinic Name', tagline: '', contact: '', doctorName: '', doctorQual: '',
             regNumber: '', currency: '₹', footerMessage: 'Thank you for your trust in us.', logo: '', logoType: 'logo' };
  }
}

export function printBill(bill, patientName) {
  const clinic = getClinicProfile();
  const { currency } = clinic;
  const items    = Array.isArray(bill.items)    ? bill.items    : [];
  const payments = Array.isArray(bill.payments) ? bill.payments : [];
  const total    = items.reduce((s, i)    => s + Number(i.amount || 0), 0);
  const paid     = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const balance  = total - paid;
  const fmt      = n => `${currency}${Number(n || 0).toFixed(2)}`;
  const isEst    = bill.type === 'Estimate';

  const [statusLabel, statusColor, statusBg] = isEst
    ? ['ESTIMATE',          '#553c9a', '#e9d8fd']
    : bill.status === 'Paid'
      ? ['PAID',            '#276749', '#c6f6d5']
      : bill.status === 'Partial'
        ? ['PARTIALLY PAID','#c05621', '#feebc8']
        : ['UNPAID',        '#c53030', '#fed7d7'];

  const itemRows = items.map((i, idx) => `
    <tr class="${idx % 2 === 1 ? 'alt' : ''}">
      <td>${esc(i.description) || '—'}</td>
      <td class="num">${fmt(i.amount)}</td>
    </tr>`).join('');

  const payRows = payments.length > 0 ? `
    <div class="section-title" style="margin-top:1.75rem">Payment History</div>
    <table class="pay-table">
      <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th class="num">Amount</th></tr></thead>
      <tbody>
        ${payments.map((p, idx) => {
          const method = p.method || 'other';
          return `
        <tr class="${idx % 2 === 1 ? 'alt' : ''}">
          <td>${esc(p.paymentDate)}</td>
          <td><span class="method-pill method-${esc(method.toLowerCase())}">${esc(method)}</span></td>
          <td>${esc(p.reference) || '—'}</td>
          <td class="num">${fmt(p.amount)}</td>
        </tr>`;
        }).join('')}
      </tbody>
    </table>` : '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${isEst ? 'Estimate' : 'Invoice'} #${bill.id} — ${esc(patientName)}</title>
  <style>
    @page { margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #1a202c;
      font-size: 13px;
      background: #fff;
    }

    .page { max-width: 760px; margin: 0 auto; padding: 0; }

    .header-band {
      background: #1a365d; color: #fff;
      padding: 2rem 2.5rem;
      display: flex; justify-content: space-between; align-items: flex-start;
    }
    .header-left { display: flex; align-items: flex-start; gap: 1.25rem; }
    .clinic-logo { width: 72px; height: 72px; object-fit: contain; border-radius: 8px; background: rgba(255,255,255,0.12); padding: 4px; flex-shrink: 0; }
    .clinic-banner { width: 100%; height: 96px; object-fit: cover; display: block; }
    .clinic-name    { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.01em; line-height: 1.1; }
    .clinic-tagline { font-size: 0.78rem; color: #90cdf4; margin-top: 0.3rem; font-weight: 400; }
    .clinic-doctor  { font-size: 0.82rem; color: #bee3f8; margin-top: 0.4rem; font-weight: 600; }
    .clinic-reg     { font-size: 0.72rem; color: #90cdf4; margin-top: 0.2rem; }
    .bill-type-block { text-align: right; }
    .bill-type-label { font-size: 1.3rem; font-weight: 800; letter-spacing: 0.08em; color: #bee3f8; }
    .bill-number    { font-size: 0.82rem; color: #90cdf4; margin-top: 0.25rem; }

    .status-ribbon {
      background: ${statusBg}; color: ${statusColor};
      text-align: center; padding: 0.4rem;
      font-size: 0.75rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
    }

    .body { padding: 2rem 2.5rem; }

    .meta-grid {
      display: flex; gap: 0; border: 1px solid #e2e8f0;
      border-radius: 8px; overflow: hidden; margin-bottom: 1.75rem;
    }
    .meta-cell { flex: 1; padding: 0.9rem 1.1rem; border-right: 1px solid #e2e8f0; }
    .meta-cell:last-child { border-right: none; }
    .meta-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #a0aec0; margin-bottom: 0.3rem; }
    .meta-value { font-size: 0.95rem; font-weight: 700; color: #2d3748; }

    .section-title { font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #718096; margin-bottom: 0.5rem; }

    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 0.55rem 0.75rem; background: #1a365d; color: #bee3f8; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
    td { padding: 0.55rem 0.75rem; color: #2d3748; }
    tr.alt td { background: #f7fafc; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }

    .totals-block { margin-top: 0.75rem; border-top: 2px solid #1a365d; padding-top: 0.6rem; display: flex; flex-direction: column; align-items: flex-end; gap: 0.3rem; }
    .total-line { display: flex; gap: 2.5rem; font-size: 0.9rem; color: #4a5568; min-width: 260px; justify-content: space-between; }
    .total-line.grand { font-size: 1.1rem; font-weight: 800; color: #1a365d; border-top: 1px solid #e2e8f0; padding-top: 0.5rem; margin-top: 0.2rem; }
    .total-line .amt { font-variant-numeric: tabular-nums; text-align: right; }
    .paid-amt { color: #276749; }
    .bal-amt  { color: ${balance > 0 ? '#c53030' : '#276749'}; font-weight: 800; }

    .pay-table th { background: #2d3748; color: #e2e8f0; }
    .method-pill { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 9999px; font-size: 0.72rem; font-weight: 700; }
    .method-cash  { background: #c6f6d5; color: #276749; }
    .method-card  { background: #bee3f8; color: #2b6cb0; }
    .method-upi   { background: #e9d8fd; color: #553c9a; }
    .method-other { background: #e2e8f0; color: #4a5568; }

    .notes-block { margin-top: 1.75rem; padding: 0.9rem 1.1rem; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; font-size: 0.85rem; color: #744210; white-space: pre-wrap; }
    .notes-block strong { display: block; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: #a0aec0; margin-bottom: 0.3rem; }

    .footer-band { background: #f7fafc; border-top: 1px solid #e2e8f0; padding: 1rem 2.5rem; display: flex; justify-content: space-between; align-items: center; margin-top: 2.5rem; font-size: 0.75rem; color: #a0aec0; }
    .footer-thank { font-weight: 600; color: #4a5568; }

    @media print {
      .page { max-width: 100%; }
      button { display: none; }
    }
  </style>
</head>
<body>
<div class="page">

  ${clinic.logo && clinic.logoType === 'banner'
    ? `<img src="${clinic.logo}" alt="Clinic banner" class="clinic-banner" />`
    : ''}

  <div class="header-band">
    <div class="header-left">
      ${clinic.logo && clinic.logoType === 'logo' ? `<img src="${clinic.logo}" alt="Logo" class="clinic-logo" />` : ''}
      <div>
        <div class="clinic-name">${esc(clinic.name)}</div>
        ${clinic.tagline    ? `<div class="clinic-tagline">${esc(clinic.tagline)}</div>` : ''}
        ${clinic.contact    ? `<div class="clinic-tagline">${esc(clinic.contact)}</div>` : ''}
        ${clinic.doctorName ? `<div class="clinic-doctor">${esc(clinic.doctorName)}${clinic.doctorQual ? ` &mdash; ${esc(clinic.doctorQual)}` : ''}</div>` : ''}
        ${clinic.regNumber  ? `<div class="clinic-reg">Reg. No: ${esc(clinic.regNumber)}</div>` : ''}
      </div>
    </div>
    <div class="bill-type-block">
      <div class="bill-type-label">${isEst ? 'ESTIMATE' : 'INVOICE'}</div>
      <div class="bill-number">#${bill.id}</div>
    </div>
  </div>

  <div class="status-ribbon">${statusLabel}</div>

  <div class="body">
    <div class="meta-grid">
      <div class="meta-cell">
        <div class="meta-label">Billed To</div>
        <div class="meta-value">${esc(patientName)}</div>
      </div>
      <div class="meta-cell">
        <div class="meta-label">${isEst ? 'Estimate Date' : 'Invoice Date'}</div>
        <div class="meta-value">${esc(bill.billDate)}</div>
      </div>
      ${bill.appointmentId ? `
      <div class="meta-cell">
        <div class="meta-label">Appointment</div>
        <div class="meta-value">#${bill.appointmentId}</div>
      </div>` : ''}
      ${bill.medicalRecordId ? `
      <div class="meta-cell">
        <div class="meta-label">Visit Record</div>
        <div class="meta-value">#${bill.medicalRecordId}</div>
      </div>` : ''}
    </div>

    <div class="section-title">Services</div>
    <table>
      <thead><tr><th>Description</th><th class="num">Amount</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="totals-block">
      <div class="total-line grand">
        <span class="lbl">${isEst ? 'Estimated Total' : 'Total'}</span>
        <span class="amt">${fmt(total)}</span>
      </div>
      ${!isEst ? `
      <div class="total-line">
        <span class="lbl">Amount Paid</span>
        <span class="amt paid-amt">${fmt(paid)}</span>
      </div>
      <div class="total-line grand">
        <span class="lbl">Balance Due</span>
        <span class="amt bal-amt">${fmt(balance)}</span>
      </div>` : ''}
    </div>

    ${payRows}

    ${bill.notes ? `<div class="notes-block"><strong>Notes</strong>${esc(bill.notes)}</div>` : ''}
  </div>

  <div class="footer-band">
    <span class="footer-thank">${esc(clinic.footerMessage)}</span>
    <span>Please retain this ${isEst ? 'estimate' : 'document'} for your records.</span>
  </div>

</div>
<script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=820,height=960');
  if (!win) {
    alert('Print blocked by browser. Please allow pop-ups for this site and try again.');
    return;
  }
  win.document.write(html);
  win.document.close();
}
