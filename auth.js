// Sign-in sessions and server-side role checks.
//
// Every /api and /uploads request must carry a valid session cookie, and the
// signed-in user's role must allow the route (see RULES). Sessions end after
// IDLE_MINUTES without any request, when the user signs out, or when an admin
// deactivates the user, changes their role or password, or deletes them.
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcrypt');
const { User, Session, AppSetting } = require('./models');
const { Op } = require('sequelize');

const COOKIE = 'clinic_session';
const IDLE_MINUTES = 90;
const IDLE_MS = IDLE_MINUTES * 60 * 1000;
const TOUCH_EVERY_MS = 60 * 1000; // don't write lastSeenAt on every single request

// Default permissions per role. Admin always has everything. Keep these keys
// in step with PERMISSION_FEATURES in client/src/App.js.
const DEFAULT_ROLE_PERMS = {
  Doctor:       { editPatients: true,  appointments: true,  billing: true,  medicalRecords: true,  prescriptions: true,  labResults: true,  whatsapp: true  },
  Receptionist: { editPatients: true,  appointments: true,  billing: true,  medicalRecords: false, prescriptions: false, labResults: false, whatsapp: true  },
  Nurse:        { editPatients: false, appointments: false, billing: false, medicalRecords: true,  prescriptions: false, labResults: true,  whatsapp: false },
};
const FEATURES = Object.keys(DEFAULT_ROLE_PERMS.Doctor);

const PUBLIC = 'public';
const ANY = 'any';      // any signed-in user
const ADMIN = 'admin';
// An array means: allowed if the role has ANY of these permissions.

// First match wins. Anything under /api or /uploads that matches no rule is Admin-only.
const RULES = [
  ['POST', /^\/api\/auth\/login$/, PUBLIC],
  ['*',    /^\/api\/auth\/(me|logout)$/, ANY],

  ['GET',  /^\/api\/settings\/role-permissions$/, ANY],
  ['GET',  /^\/api\/license$/, ANY],

  ['GET',  /^\/api\/patients(\/\d+)?$/, ANY],
  ['*',    /^\/api\/patients(\/\d+)?$/, ['editPatients']],

  // Billing reads a patient's visits and records to fill in a bill
  ['GET',  /^\/api\/appointments(\/\d+)?$/, ['appointments', 'billing']],
  ['*',    /^\/api\/appointments(\/\d+)?$/, ['appointments']],
  ['GET',  /^\/api\/patients\/\d+\/records$/, ['medicalRecords', 'billing']],
  ['*',    /^\/api\/(patients\/\d+\/records|records\/\d+)$/, ['medicalRecords']],

  // The dental chart is part of the clinical record; turning a plan into an estimate is billing
  ['POST', /^\/api\/patients\/\d+\/dental\/estimate$/, ['billing']],
  ['*',    /^\/api\/(patients\/\d+\/dental(\/(dentition|conditions|treatments))?|dental\/(conditions|treatments)\/\d+)$/, ['medicalRecords']],

  ['GET',  /^\/api\/services$/, ANY],
  ['*',    /^\/api\/services(\/\d+)?$/, ['billing']],
  ['*',    /^\/api\/(bills|payments)(\/|$)/, ['billing']],

  ['*',    /^\/api\/(patients\/\d+\/prescriptions|prescriptions\/\d+)$/, ['prescriptions']],
  ['*',    /^\/api\/(patients\/\d+\/labs|labs\/\d+(\/attachment)?)$/, ['labResults']],
  ['GET',  /^\/uploads\/labs\/[^/]+$/, ['labResults']],

  // Sending one message needs the WhatsApp permission; settings and broadcasts are Admin-only
  ['GET',  /^\/api\/whatsapp\/config$/, ['whatsapp']],
  ['POST', /^\/api\/whatsapp\/send$/, ['whatsapp']],
];

function ruleFor(method, path) {
  for (const [m, re, access] of RULES) {
    if ((m === '*' || m === method) && re.test(path)) return access;
  }
  return ADMIN;
}

// ── Role permissions (shared by every device, stored in the database) ────────
let permsCache = null;

async function getRolePerms() {
  if (permsCache) return permsCache;
  const row = await AppSetting.findByPk('rolePermissions');
  const saved = row ? row.value : {};
  const merged = {};
  for (const role of Object.keys(DEFAULT_ROLE_PERMS)) {
    merged[role] = { ...DEFAULT_ROLE_PERMS[role] };
    for (const f of FEATURES) {
      if (typeof saved?.[role]?.[f] === 'boolean') merged[role][f] = saved[role][f];
    }
  }
  permsCache = { perms: merged, saved: !!row };
  return permsCache;
}

async function allowed(user, access) {
  if (access === PUBLIC || access === ANY) return true;
  if (user.role === 'Admin') return true;
  if (access === ADMIN) return false;
  const { perms } = await getRolePerms();
  return access.some(f => perms[user.role]?.[f] === true);
}

// ── Sessions ──────────────────────────────────────────────────────────────────
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

function readCookie(req) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === COOKIE) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function setCookie(res, token) {
  // HttpOnly: page scripts can't read it. SameSite=Strict: other sites can't
  // make the browser send it. No Max-Age: the server decides when it expires.
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict`);
}

function clearCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}

async function loadSession(req) {
  const token = readCookie(req);
  if (!token) return null;
  const session = await Session.findByPk(hashToken(token), { include: User });
  if (!session) return null;
  const idle = Date.now() - new Date(session.lastSeenAt).getTime();
  if (idle > IDLE_MS || !session.User || !session.User.active) {
    await session.destroy();
    return null;
  }
  if (idle > TOUCH_EVERY_MS) await session.update({ lastSeenAt: new Date() });
  return session;
}

// Sign a user out everywhere (optionally keeping the device making the change)
async function revokeUserSessions(userId, keepSessionId) {
  const where = { userId };
  if (keepSessionId) where.id = { [Op.ne]: keepSessionId };
  await Session.destroy({ where });
}

function publicUser(u) {
  return { id: u.id, name: u.name, username: u.username, role: u.role };
}

// ── Middleware ────────────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  const path = req.path;
  if (!path.startsWith('/api/') && !path.startsWith('/uploads/')) return next();
  try {
    const access = ruleFor(req.method, path);
    if (access === PUBLIC) return next();
    const session = await loadSession(req);
    if (!session) {
      clearCookie(res);
      return res.status(401).json({ error: 'Please sign in again.', signedOut: true });
    }
    req.user = session.User;
    req.sessionId = session.id;
    if (!(await allowed(req.user, access))) {
      return res.status(403).json({ error: 'Your role does not have access to this.' });
    }
    next();
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Sign-in throttling: 5 wrong passwords lock that username on that device for 5 minutes
const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000;
const failures = new Map(); // `${ip}|${username}` -> { count, lockedUntil }

function lockedFor(key) {
  const f = failures.get(key);
  if (!f || !f.lockedUntil) return 0;
  const left = f.lockedUntil - Date.now();
  if (left <= 0) { failures.delete(key); return 0; }
  return left;
}

function recordFailure(key) {
  const f = failures.get(key) || { count: 0, lockedUntil: 0 };
  f.count += 1;
  if (f.count >= MAX_FAILS) { f.lockedUntil = Date.now() + LOCK_MS; f.count = 0; }
  failures.set(key, f);
}

// ── Routes ────────────────────────────────────────────────────────────────────
const router = express.Router();

router.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
    const uname = String(username).trim().toLowerCase();
    const key = `${req.ip}|${uname}`;
    const left = lockedFor(key);
    if (left) {
      return res.status(429).json({ error: `Too many wrong passwords. Try again in ${Math.ceil(left / 60000)} minutes.` });
    }
    const user = await User.findOne({ where: { username: uname } });
    const ok = user && user.active && await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      recordFailure(key);
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    failures.delete(key);

    // Tidy up sessions that have already gone idle
    await Session.destroy({ where: { lastSeenAt: { [Op.lt]: new Date(Date.now() - IDLE_MS) } } });

    const token = crypto.randomBytes(32).toString('hex');
    await Session.create({ id: hashToken(token), userId: user.id, lastSeenAt: new Date() });
    setCookie(res, token);
    res.json(publicUser(user));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/auth/me', (req, res) => {
  res.json({ ...publicUser(req.user), idleMinutes: IDLE_MINUTES });
});

router.post('/api/auth/logout', async (req, res) => {
  try {
    await Session.destroy({ where: { id: req.sessionId } });
    clearCookie(res);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/settings/role-permissions', async (req, res) => {
  try { res.json(await getRolePerms()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/api/settings/role-permissions', async (req, res) => {
  try {
    const clean = {};
    for (const role of Object.keys(DEFAULT_ROLE_PERMS)) {
      clean[role] = {};
      for (const f of FEATURES) clean[role][f] = req.body?.[role]?.[f] === true;
    }
    await AppSetting.upsert({ key: 'rolePermissions', value: clean });
    permsCache = null;
    res.json(await getRolePerms());
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = { requireAuth, router, revokeUserSessions };
