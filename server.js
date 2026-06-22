require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const { Patient, Appointment, MedicalRecord, Bill, PaymentLog, ServiceCatalog, WhatsappConfig, Prescription, LabResult, User, License } = require('./models');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ── File upload (lab results) ─────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads', 'labs');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const labStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`),
});
const labUpload = multer({ storage: labStorage, limits: { fileSize: 20 * 1024 * 1024 } });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── License (singleton row, id = 1) ──────────────────────────────────────────
app.get('/api/license', async (req, res) => {
  try {
    const row = await License.findByPk(1);
    res.json(row ? row.toJSON() : {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/license', async (req, res) => {
  try {
    const { licensedTo, referenceCode, startDate, expiryDate, features } = req.body;
    const [row] = await License.upsert({ id: 1, licensedTo, referenceCode, startDate: startDate || null, expiryDate: expiryDate || null, features: features || {} });
    res.json(row.toJSON());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET all patients
app.get('/api/patients', async (req, res) => {
  try {
    const patients = await Patient.findAll();
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single patient
app.get('/api/patients/:id', async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create patient
app.post('/api/patients', async (req, res) => {
  try {
    const patient = await Patient.create(req.body);
    res.status(201).json(patient);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update patient
app.put('/api/patients/:id', async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    await patient.update(req.body);
    res.json(patient);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE patient
app.delete('/api/patients/:id', async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    await patient.destroy();
    res.json({ message: 'Patient deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all appointments (optionally filter by patient)
app.get('/api/appointments', async (req, res) => {
  try {
    const where = req.query.patientId ? { patientId: req.query.patientId } : {};
    const appointments = await Appointment.findAll({ where, include: Patient });
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single appointment
app.get('/api/appointments/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id, { include: Patient });
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    res.json(appointment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create appointment
app.post('/api/appointments', async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.body.patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const appointment = await Appointment.create(req.body);
    res.status(201).json(appointment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update appointment
app.put('/api/appointments/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    await appointment.update(req.body);
    res.json(appointment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE appointment
app.delete('/api/appointments/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    await appointment.destroy();
    res.json({ message: 'Appointment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Medical Records ──────────────────────────────────────────────────────────

// GET all records for a patient
app.get('/api/patients/:patientId/records', async (req, res) => {
  try {
    const records = await MedicalRecord.findAll({
      where: { patientId: req.params.patientId },
      order: [['visitDate', 'DESC']],
    });
    res.json(records);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create record
app.post('/api/patients/:patientId/records', async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.params.patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const record = await MedicalRecord.create({ ...req.body, patientId: req.params.patientId });
    res.status(201).json(record);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// PUT update record
app.put('/api/records/:id', async (req, res) => {
  try {
    const record = await MedicalRecord.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    await record.update(req.body);
    res.json(record);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE record
app.delete('/api/records/:id', async (req, res) => {
  try {
    const record = await MedicalRecord.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    await record.destroy();
    res.json({ message: 'Record deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Service Catalog ──────────────────────────────────────────────────────────
app.get('/api/services', async (req, res) => {
  try { res.json(await ServiceCatalog.findAll({ order: [['category'], ['name']] })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/services', async (req, res) => {
  try { res.status(201).json(await ServiceCatalog.create(req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
});
app.put('/api/services/:id', async (req, res) => {
  try {
    const s = await ServiceCatalog.findByPk(req.params.id);
    if (!s) return res.status(404).json({ error: 'Service not found' });
    res.json(await s.update(req.body));
  } catch (err) { res.status(400).json({ error: err.message }); }
});
app.delete('/api/services/:id', async (req, res) => {
  try {
    const s = await ServiceCatalog.findByPk(req.params.id);
    if (!s) return res.status(404).json({ error: 'Service not found' });
    await s.destroy(); res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Bills ────────────────────────────────────────────────────────────────────
app.get('/api/bills', async (req, res) => {
  try {
    const where = req.query.patientId ? { patientId: req.query.patientId } : {};
    const bills = await Bill.findAll({
      where,
      include: [
        { model: Patient },
        { model: PaymentLog, as: 'payments' },
      ],
      order: [['billDate', 'DESC']],
    });
    res.json(bills);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/bills/:id', async (req, res) => {
  try {
    const bill = await Bill.findByPk(req.params.id, {
      include: [{ model: Patient }, { model: PaymentLog, as: 'payments' }],
    });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    res.json(bill);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bills', async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.body.patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const bill = await Bill.create(req.body);
    res.status(201).json(bill);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/bills/:id', async (req, res) => {
  try {
    const bill = await Bill.findByPk(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    await bill.update(req.body);
    res.json(bill);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Convert estimate → invoice
app.post('/api/bills/:id/convert', async (req, res) => {
  try {
    const bill = await Bill.findByPk(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    if (bill.type !== 'Estimate') return res.status(400).json({ error: 'Already an invoice' });
    await bill.update({ type: 'Invoice', status: 'Unpaid' });
    res.json(bill);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/bills/:id', async (req, res) => {
  try {
    const bill = await Bill.findByPk(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    await bill.destroy(); res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Payment Logs ─────────────────────────────────────────────────────────────
app.post('/api/bills/:billId/payments', async (req, res) => {
  try {
    const bill = await Bill.findByPk(req.params.billId, { include: [{ model: PaymentLog, as: 'payments' }] });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    if (bill.type === 'Estimate') return res.status(400).json({ error: 'Cannot log payment on an estimate' });
    const payment = await PaymentLog.create({ ...req.body, billId: bill.id });
    // Recalculate status
    const total = (bill.items || []).reduce((s, i) => s + Number(i.amount), 0);
    const allPayments = [...bill.payments, payment];
    const paid = allPayments.reduce((s, p) => s + Number(p.amount), 0);
    const status = paid <= 0 ? 'Unpaid' : paid >= total ? 'Paid' : 'Partial';
    await bill.update({ status });
    res.status(201).json(payment);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/payments/:id', async (req, res) => {
  try {
    const payment = await PaymentLog.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    const bill = await Bill.findByPk(payment.billId, { include: [{ model: PaymentLog, as: 'payments' }] });
    await payment.destroy();
    if (bill) {
      // Recalculate status after deletion
      const total = (bill.items || []).reduce((s, i) => s + Number(i.amount), 0);
      const remaining = bill.payments.filter(p => p.id !== payment.id);
      const paid = remaining.reduce((s, p) => s + Number(p.amount), 0);
      const status = paid <= 0 ? 'Unpaid' : paid >= total ? 'Paid' : 'Partial';
      await bill.update({ status });
    }
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Prescriptions ────────────────────────────────────────────────────────────

app.get('/api/patients/:patientId/prescriptions', async (req, res) => {
  try {
    const rows = await Prescription.findAll({
      where: { patientId: req.params.patientId },
      order: [['visitDate', 'DESC'], ['createdAt', 'DESC']],
    });
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/patients/:patientId/prescriptions', async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.params.patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const rx = await Prescription.create({ ...req.body, patientId: req.params.patientId });
    res.status(201).json(rx);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/prescriptions/:id', async (req, res) => {
  try {
    const rx = await Prescription.findByPk(req.params.id);
    if (!rx) return res.status(404).json({ error: 'Prescription not found' });
    await rx.update(req.body);
    res.json(rx);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/prescriptions/:id', async (req, res) => {
  try {
    const rx = await Prescription.findByPk(req.params.id);
    if (!rx) return res.status(404).json({ error: 'Prescription not found' });
    await rx.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Lab Results ───────────────────────────────────────────────────────────────

app.get('/api/patients/:patientId/labs', async (req, res) => {
  try {
    const rows = await LabResult.findAll({
      where: { patientId: req.params.patientId },
      order: [['testDate', 'DESC'], ['createdAt', 'DESC']],
    });
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/patients/:patientId/labs', labUpload.single('attachment'), async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.params.patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const params = req.body.parameters ? JSON.parse(req.body.parameters) : [];
    const lab = await LabResult.create({
      patientId:      req.params.patientId,
      testDate:       req.body.testDate,
      labName:        req.body.labName || null,
      testName:       req.body.testName,
      parameters:     params,
      notes:          req.body.notes || null,
      attachmentPath: req.file ? `/uploads/labs/${req.file.filename}` : null,
      attachmentName: req.file ? req.file.originalname : null,
      attachmentType: req.file ? req.file.mimetype : null,
    });
    res.status(201).json(lab);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/labs/:id', labUpload.single('attachment'), async (req, res) => {
  try {
    const lab = await LabResult.findByPk(req.params.id);
    if (!lab) return res.status(404).json({ error: 'Lab result not found' });
    const params = req.body.parameters ? JSON.parse(req.body.parameters) : lab.parameters;
    const updates = {
      testDate:  req.body.testDate  || lab.testDate,
      labName:   req.body.labName   ?? lab.labName,
      testName:  req.body.testName  || lab.testName,
      parameters: params,
      notes:     req.body.notes     ?? lab.notes,
    };
    if (req.file) {
      // Delete old attachment if exists
      if (lab.attachmentPath) {
        const old = path.join(__dirname, lab.attachmentPath);
        if (fs.existsSync(old)) fs.unlinkSync(old);
      }
      updates.attachmentPath = `/uploads/labs/${req.file.filename}`;
      updates.attachmentName = req.file.originalname;
      updates.attachmentType = req.file.mimetype;
    }
    await lab.update(updates);
    res.json(lab);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/labs/:id', async (req, res) => {
  try {
    const lab = await LabResult.findByPk(req.params.id);
    if (!lab) return res.status(404).json({ error: 'Lab result not found' });
    if (lab.attachmentPath) {
      const filePath = path.join(__dirname, lab.attachmentPath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await lab.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/labs/:id/attachment', async (req, res) => {
  try {
    const lab = await LabResult.findByPk(req.params.id);
    if (!lab) return res.status(404).json({ error: 'Not found' });
    if (lab.attachmentPath) {
      const filePath = path.join(__dirname, lab.attachmentPath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await lab.update({ attachmentPath: null, attachmentName: null, attachmentType: null });
    res.json(lab);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── WhatsApp ─────────────────────────────────────────────────────────────────

async function sendWhatsAppTemplate(cfg, to, templateName, params = []) {
  const phone = to.replace(/\D/g, '');
  const body = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: cfg.languageCode || 'en' },
      components: params.length ? [{
        type: 'body',
        parameters: params.map(p => ({ type: 'text', text: String(p) })),
      }] : [],
    },
  };
  return axios.post(
    `https://graph.facebook.com/v19.0/${cfg.phoneNumberId}/messages`,
    body,
    { headers: { Authorization: `Bearer ${cfg.accessToken}`, 'Content-Type': 'application/json' } }
  );
}

// GET WhatsApp config
app.get('/api/whatsapp/config', async (req, res) => {
  try {
    let cfg = await WhatsappConfig.findOne();
    if (!cfg) cfg = await WhatsappConfig.create({});
    const safe = cfg.toJSON();
    if (safe.accessToken) safe.accessToken = safe.accessToken.slice(0, 8) + '••••••••';
    res.json(safe);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT WhatsApp config (full token only updated if provided and not masked)
app.put('/api/whatsapp/config', async (req, res) => {
  try {
    let cfg = await WhatsappConfig.findOne();
    if (!cfg) cfg = await WhatsappConfig.create({});
    const { accessToken, ...rest } = req.body;
    const patch = { ...rest };
    if (accessToken && !accessToken.includes('••••')) patch.accessToken = accessToken;
    await cfg.update(patch);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST test connection
app.post('/api/whatsapp/test', async (req, res) => {
  try {
    const cfg = await WhatsappConfig.findOne();
    if (!cfg || !cfg.phoneNumberId || !cfg.accessToken)
      return res.status(400).json({ error: 'WhatsApp not configured.' });
    const r = await axios.get(
      `https://graph.facebook.com/v19.0/${cfg.phoneNumberId}`,
      { headers: { Authorization: `Bearer ${cfg.accessToken}` } }
    );
    res.json({ ok: true, name: r.data.display_phone_number || r.data.id });
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// POST send message manually
app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const cfg = await WhatsappConfig.findOne();
    if (!cfg?.enabled) return res.status(400).json({ error: 'WhatsApp integration is disabled.' });
    if (!cfg.phoneNumberId || !cfg.accessToken)
      return res.status(400).json({ error: 'WhatsApp credentials not configured. Check Settings.' });
    const { to, templateName, params } = req.body;
    if (!to) return res.status(400).json({ error: 'Phone number required.' });
    const phone = to.replace(/\D/g, '');
    if (phone.length < 10) return res.status(400).json({ error: 'Invalid phone number (too short).' });
    if (!templateName) return res.status(400).json({ error: 'Template name required.' });
    await sendWhatsAppTemplate(cfg, to, templateName, params || []);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// ── Daily cron: follow-up + birthday reminders at 09:00 ──────────────────────
function startWhatsAppScheduler() {
  cron.schedule('0 9 * * *', async () => {
    try {
      const cfg = await WhatsappConfig.findOne();
      if (!cfg?.enabled || !cfg.phoneNumberId || !cfg.accessToken) return;

      const today = new Date();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${today.getFullYear()}-${mm}-${dd}`;

      const patients = await Patient.findAll();

      for (const p of patients) {
        const name = `${p.firstName} ${p.lastName}`;
        const phone = (p.phone || '').replace(/\D/g, '');
        if (phone.length < 10) continue;

        // Follow-up reminders — match records with followUpDate = today
        if (cfg.followUpTemplate) {
          const records = await MedicalRecord.findAll({ where: { patientId: p.id, followUpDate: todayStr } });
          for (const r of records) {
            try {
              await sendWhatsAppTemplate(cfg, phone, cfg.followUpTemplate, [name]);
              console.log(`Follow-up reminder sent to ${name} (${phone})`);
            } catch (e) { console.error(`Follow-up failed for ${name}:`, e.response?.data || e.message); }
          }
        }

        // Birthday reminders — match month-day
        if (cfg.birthdayTemplate && p.dateOfBirth) {
          const dob = p.dateOfBirth.slice(5); // MM-DD
          if (dob === `${mm}-${dd}`) {
            try {
              await sendWhatsAppTemplate(cfg, phone, cfg.birthdayTemplate, [name]);
              console.log(`Birthday wish sent to ${name} (${phone})`);
            } catch (e) { console.error(`Birthday failed for ${name}:`, e.response?.data || e.message); }
          }
        }
      }
    } catch (err) {
      console.error('WhatsApp scheduler error:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('WhatsApp scheduler started (daily 9:00 AM IST)');
}

// ── Auth ──────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
    const user = await User.findOne({ where: { username: username.trim().toLowerCase() } });
    if (!user || !user.active) return res.status(401).json({ error: 'Invalid credentials.' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });
    res.json({ id: user.id, name: user.name, username: user.username, role: user.role });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET all users (Admin only — enforced on frontend; basic list for management)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.findAll({ attributes: ['id', 'name', 'username', 'role', 'active'], order: [['name', 'ASC']] });
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, username, password, role } = req.body;
    if (!name || !username || !password || !role) return res.status(400).json({ error: 'All fields required.' });
    const exists = await User.findOne({ where: { username: username.trim().toLowerCase() } });
    if (exists) return res.status(400).json({ error: 'Username already taken.' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, username: username.trim().toLowerCase(), passwordHash, role });
    res.status(201).json({ id: user.id, name: user.name, username: user.username, role: user.role, active: user.active });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const { name, username, password, role, active } = req.body;
    const patch = {};
    if (name)     patch.name   = name;
    if (username) patch.username = username.trim().toLowerCase();
    if (role)     patch.role   = role;
    if (active !== undefined) patch.active = active;
    if (password) patch.passwordHash = await bcrypt.hash(password, 10);
    await user.update(patch);
    res.json({ id: user.id, name: user.name, username: user.username, role: user.role, active: user.active });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    // Prevent deleting last admin
    if (user.role === 'Admin') {
      const adminCount = await User.count({ where: { role: 'Admin', active: true } });
      if (adminCount <= 1) return res.status(400).json({ error: 'Cannot delete the last Admin account.' });
    }
    await user.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Serve React build in production (after all API routes)
const buildPath = path.join(__dirname, 'client', 'build');
app.use(express.static(buildPath));
app.get('*', (req, res) => {
  const indexPath = path.join(buildPath, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return res.status(503).send('Frontend not built. Run: cd client && npm run build');
  }
  res.sendFile(indexPath);
});

const { sequelize } = require('./models');

const SEED_SERVICES = [
  // Consultation & Diagnostics
  { category: 'Consultation & Diagnostics', name: 'Consultation',          price: 200,   description: 'General dental consultation' },
  { category: 'Consultation & Diagnostics', name: 'X-Ray',                 price: 200,   description: 'Dental radiograph' },
  // Restorative
  { category: 'Restorative',                name: 'Composite Filling – Class I',  price: 2000,  description: 'Single surface composite restoration' },
  { category: 'Restorative',                name: 'Composite Filling – Class II', price: 2200,  description: 'Two-surface composite restoration' },
  { category: 'Restorative',                name: 'Composite Filling – Class V',  price: 1800,  description: 'Cervical/gingival composite restoration' },
  { category: 'Restorative',                name: 'GIC Filling',           price: 1500,  description: 'Glass ionomer cement filling (range ₹1500–2500)' },
  // Endodontics
  { category: 'Endodontics',                name: 'Root Canal Treatment',         price: 4000,  description: 'Per tooth (range ₹4000–5500)' },
  { category: 'Endodontics',                name: 'Re-Root Canal Treatment',      price: 5500,  description: 'Retreatment per tooth (range ₹5500–6000)' },
  // Oral Surgery
  { category: 'Oral Surgery',               name: 'Wisdom Tooth Extraction',      price: 4000,  description: 'Surgical extraction (range ₹4000–8000)' },
  // Periodontics
  { category: 'Periodontics',               name: 'Scaling',                      price: 1500,  description: 'Full mouth scaling & polishing (range ₹1500–2500)' },
  { category: 'Periodontics',               name: 'Fluoride Application',         price: 1500,  description: 'Topical fluoride (range ₹1500–1800)' },
  // Implants
  { category: 'Implants',                   name: 'Dental Implant – Indian',      price: 30000, description: 'Indian brand implant (range ₹30000–32000)' },
  { category: 'Implants',                   name: 'Dental Implant – German (Osstem)', price: 35000, description: 'Osstem/German brand implant' },
  // Cosmetic
  { category: 'Cosmetic',                   name: 'Bleaching – First Seating',    price: 8000,  description: 'Teeth whitening first session' },
  { category: 'Cosmetic',                   name: 'Bleaching – Second Seating',   price: 3000,  description: 'Teeth whitening second session' },
  // Prosthodontics
  { category: 'Prosthodontics',             name: 'Complete Denture',             price: 25000, description: 'Full denture per arch (range ₹25000–40000)' },
  { category: 'Prosthodontics',             name: 'Removable Partial Denture (with clasp)', price: 8000, description: 'Per arch with metal clasp (range ₹8000–15000)' },
  { category: 'Prosthodontics',             name: 'Removable Partial Denture – Valplast',   price: 10000, description: 'Flexible partial denture per arch (range ₹10000–15000)' },
];

sequelize.sync({ alter: true })
  .then(async () => {
    // Seed service catalog only if empty
    const count = await ServiceCatalog.count();
    if (count === 0) {
      await ServiceCatalog.bulkCreate(SEED_SERVICES);
      console.log(`Seeded ${SEED_SERVICES.length} services into catalog`);
    }
    // Seed default admin if no users exist
    const userCount = await User.count();
    if (userCount === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await User.create({ name: 'Admin', username: 'admin', passwordHash, role: 'Admin' });
      console.log('Default admin created — username: admin  password: admin123');
    }
    startWhatsAppScheduler();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to sync database:', err);
  });
