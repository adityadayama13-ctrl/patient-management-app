// Dental chart: per-tooth conditions (with history) and per-tooth treatment
// plans that can be turned into an estimate. Teeth use FDI numbering.
// Access rules for these routes live in auth.js.
const express = require('express');
const { Patient, Bill, ToothCondition, ToothTreatment, sequelize } = require('./models');

const DENTAL_CONDITIONS = ['sound', 'caries', 'filled', 'rct', 'crown', 'bridge', 'implant', 'missing', 'extract', 'fractured', 'mobile', 'impacted'];
const DENTITIONS = ['Adult', 'Child', 'Mixed'];

// Permanent teeth 11-18, 21-28, 31-38, 41-48; primary teeth 51-55, 61-65, 71-75, 81-85
function validTooth(t) {
  const m = /^([1-8])([1-8])$/.exec(String(t));
  if (!m) return false;
  const quadrant = Number(m[1]), position = Number(m[2]);
  return quadrant <= 4 || position <= 5;
}

const router = express.Router();

async function findPatient(req, res) {
  const patient = await Patient.findByPk(req.params.patientId);
  if (!patient) res.status(404).json({ error: 'Patient not found' });
  return patient;
}

router.get('/api/patients/:patientId/dental', async (req, res) => {
  try {
    const patient = await findPatient(req, res);
    if (!patient) return;
    const conditions = await ToothCondition.findAll({
      where: { patientId: patient.id }, order: [['createdAt', 'DESC'], ['id', 'DESC']],
    });
    const treatments = await ToothTreatment.findAll({
      where: { patientId: patient.id }, order: [['createdAt', 'ASC'], ['id', 'ASC']],
    });
    // A deleted estimate frees its treatments to be billed again
    const billIds = [...new Set(treatments.map(t => t.billId).filter(Boolean))];
    const live = new Set((await Bill.findAll({ where: { id: billIds }, attributes: ['id'] })).map(b => b.id));
    const plan = treatments.map(t => {
      const json = t.toJSON();
      if (json.billId && !live.has(json.billId)) json.billId = null;
      return json;
    });
    res.json({ dentition: patient.dentition || null, conditions, treatments: plan });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/api/patients/:patientId/dental/dentition', async (req, res) => {
  try {
    const patient = await findPatient(req, res);
    if (!patient) return;
    const { dentition } = req.body;
    if (!DENTITIONS.includes(dentition)) return res.status(400).json({ error: 'Choose Adult, Child or Mixed.' });
    await patient.update({ dentition });
    res.json({ dentition });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/api/patients/:patientId/dental/conditions', async (req, res) => {
  try {
    const patient = await findPatient(req, res);
    if (!patient) return;
    const { tooth, condition, note } = req.body;
    if (!validTooth(tooth)) return res.status(400).json({ error: 'Unknown tooth number.' });
    if (!DENTAL_CONDITIONS.includes(condition)) return res.status(400).json({ error: 'Unknown condition.' });
    const entry = await ToothCondition.create({
      patientId: patient.id, tooth: String(tooth), condition, note: note?.trim() || null, recordedBy: req.user.name,
    });
    res.status(201).json(entry);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/api/dental/conditions/:id', async (req, res) => {
  try {
    const entry = await ToothCondition.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    await entry.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/patients/:patientId/dental/treatments', async (req, res) => {
  try {
    const patient = await findPatient(req, res);
    if (!patient) return;
    const { tooth, serviceId, name, price, note } = req.body;
    if (!validTooth(tooth)) return res.status(400).json({ error: 'Unknown tooth number.' });
    if (!name?.trim()) return res.status(400).json({ error: 'Choose a treatment.' });
    const amount = Number(price);
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: 'Enter a valid price.' });
    const t = await ToothTreatment.create({
      patientId: patient.id, tooth: String(tooth), serviceId: serviceId || null, name: name.trim(),
      price: amount, note: note?.trim() || null, recordedBy: req.user.name,
    });
    res.status(201).json(t);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/api/dental/treatments/:id', async (req, res) => {
  try {
    const t = await ToothTreatment.findByPk(req.params.id);
    if (!t) return res.status(404).json({ error: 'Treatment not found' });
    const { status, note } = req.body;
    const patch = {};
    if (status !== undefined) {
      if (!['Planned', 'Done'].includes(status)) return res.status(400).json({ error: 'Unknown status.' });
      patch.status = status;
      patch.doneAt = status === 'Done' ? new Date().toISOString().slice(0, 10) : null;
    }
    if (note !== undefined) patch.note = note?.trim() || null;
    await t.update(patch);
    res.json(t);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/api/dental/treatments/:id', async (req, res) => {
  try {
    const t = await ToothTreatment.findByPk(req.params.id);
    if (!t) return res.status(404).json({ error: 'Treatment not found' });
    if (t.billId && await Bill.findByPk(t.billId)) {
      return res.status(400).json({ error: 'This treatment is on an estimate. Delete or edit the estimate in Billing first.' });
    }
    await t.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Put the chosen planned treatments on a new estimate, one line per tooth
router.post('/api/patients/:patientId/dental/estimate', async (req, res) => {
  try {
    const patient = await findPatient(req, res);
    if (!patient) return;
    const ids = Array.isArray(req.body.treatmentIds) ? req.body.treatmentIds.map(Number) : [];
    if (!ids.length) return res.status(400).json({ error: 'Choose at least one treatment.' });

    const bill = await sequelize.transaction(async transaction => {
      const chosen = await ToothTreatment.findAll({
        where: { id: ids, patientId: patient.id }, order: [['tooth', 'ASC']], transaction, lock: transaction.LOCK.UPDATE,
      });
      if (chosen.length !== ids.length) throw Object.assign(new Error('Some treatments were not found.'), { status: 400 });
      for (const t of chosen) {
        if (t.billId && await Bill.findByPk(t.billId, { transaction })) {
          throw Object.assign(new Error(`${t.name} on tooth ${t.tooth} is already on an estimate.`), { status: 400 });
        }
      }
      const created = await Bill.create({
        patientId: patient.id,
        billDate: new Date().toISOString().slice(0, 10),
        type: 'Estimate',
        status: 'Unpaid', // matches estimates made in Billing; converting keeps it
        items: chosen.map(t => ({ description: `${t.name} – tooth ${t.tooth}`, amount: Number(t.price) })),
        notes: 'Treatment plan from the dental chart.',
      }, { transaction });
      await ToothTreatment.update({ billId: created.id }, { where: { id: ids }, transaction });
      return created;
    });
    res.status(201).json(bill);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

module.exports = { router };
