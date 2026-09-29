// api/admin/login.js
// Authentification admin côté serveur — retourne un token (ADMIN_SECRET).

const crypto = require('crypto');

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

// Pas de fallback : sans variables d'environnement configurées, l'endpoint est inerte.
if (!ADMIN_USER || !ADMIN_PASS || !ADMIN_SECRET) {
  console.error('ERREUR : ADMIN_USER, ADMIN_PASS et ADMIN_SECRET doivent être définis sur Vercel.');
}

function timingSafeEquals(a, b) {
  const bufA = Buffer.from(String(a).padEnd(256, '0'));
  const bufB = Buffer.from(String(b).padEnd(256, '0'));
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!ADMIN_USER || !ADMIN_PASS || !ADMIN_SECRET) {
    return res.status(503).json({ error: 'Authentification admin non configurée' });
  }

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiants requis' });
  }

  // Comparaison timing-safe
  const userMatch = timingSafeEquals(username, ADMIN_USER);
  const passMatch = timingSafeEquals(password, ADMIN_PASS);

  if (!userMatch || !passMatch) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  // Retourner le secret admin comme token
  return res.status(200).json({ token: ADMIN_SECRET });
};
