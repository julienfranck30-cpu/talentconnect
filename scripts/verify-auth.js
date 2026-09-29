// scripts/verify-auth.js
// Vérifie les garde-fous d'authentification des endpoints protégés
// en simulant req/res. Usage : node scripts/verify-auth.js

process.env.CRON_SECRET = 'secret-de-test';
process.env.ADMIN_SECRET = 'admin-secret-de-test';
process.env.ADMIN_USER = 'alice';
process.env.ADMIN_PASS = 'motdepasse-solide';

function mockRes() {
  const res = { statusCode: 200, body: null, headers: {} };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = c => { res.statusCode = c; return res; };
  res.json = b => { res.body = b; return res; };
  res.send = b => { res.body = b; return res; };
  res.redirect = u => { res.body = { redirect: u }; return res; };
  res.end = () => res;
  return res;
}

async function check(nom, handler, req) {
  const res = mockRes();
  try {
    await handler(req, res);
  } catch (e) {
    console.log(`  ${nom.padEnd(42)} → ERREUR ${e.message}`);
    return null;
  }
  return res;
}

let failures = 0;
function assert(cond, label) {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.log(`  ✗ ${label}`); failures++; }
}

(async () => {
  const post = { method: 'POST', headers: {}, query: {}, body: {} };
  const get = { method: 'GET', headers: {}, query: {} };

  console.log('\n§3.6 / §3.5 — endpoints sans Authorization doivent renvoyer 401');
  for (const path of [
    '../api/confirm-candidature',
    '../api/process-candidatures',
    '../api/brevo-stats',
    '../api/admin/candidatures-list',
    '../api/admin/candidatures-update',
    '../api/admin/candidatures-delete',
  ]) {
    const handler = require(path);
    const res = await check(path, handler, { ...post, query: {}, headers: {} });
    assert(res && res.statusCode === 401, `${path} → 401`);
  }

  console.log('\n§3.8 — /api/admin/login');
  const login = require('../api/admin/login');
  let r = await check('login', login, { ...post, body: { username: 'alice', password: 'mauvais' } });
  assert(r.statusCode === 401, 'mauvais mot de passe → 401');
  r = await check('login', login, { ...post, body: { username: 'alice', password: 'motdepasse-solide' } });
  assert(r.statusCode === 200 && r.body.token === process.env.ADMIN_SECRET, 'bons identifiants → token ADMIN_SECRET');
  r = await check('login', login, { ...post, body: { username: 'admin', password: 'admin123' } });
  assert(r.statusCode === 401, 'ancien couple admin/admin123 → 401 (plus de défaut)');

  console.log('\n§3.6 — avec le bon secret, l\'appel passe la garde (atteint la logique métier)');
  const list = require('../api/admin/candidatures-list');
  r = await check('list', list, { ...get, headers: { authorization: 'Bearer admin-secret-de-test' } });
  assert(r.statusCode !== 401, 'Authorization valide → pas de 401');

  console.log('\n§3.6 — CORS de brevo-stats restreint');
  const brevo = require('../api/brevo-stats');
  r = await check('brevo', brevo, { ...get, headers: { authorization: 'Bearer secret-de-test' } });
  assert(r.headers['Access-Control-Allow-Origin'] === 'https://www.lancemonjob.fr',
    'Access-Control-Allow-Origin = https://www.lancemonjob.fr');

  console.log('\n§3.5 — validation des entrées de /api/candidatures-create');
  const create = require('../api/candidatures-create');
  r = await check('create', create, { ...post, body: { nom: 'X', email: 'pas-un-email' }, headers: {}, socket: {} });
  assert(r.statusCode === 400, 'email invalide → 400');
  r = await check('create', create, { ...post, body: { email: 'a@b.fr' }, headers: {}, socket: {} });
  assert(r.statusCode === 400, 'nom manquant → 400');

  console.log(`\n${failures === 0 ? '✅ Toutes les vérifications passent.' : `❌ ${failures} vérification(s) en échec.`}\n`);
  process.exit(failures === 0 ? 0 : 1);
})();
