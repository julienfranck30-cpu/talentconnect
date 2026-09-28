// api/admin/login.js
// Authentification admin côté serveur — retourne un token (ADMIN_SECRET).

const crypto = require('crypto');

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const ADMIN_SECRET = process.env.ADMIN_SECRET;

if (!ADMIN_SECRET) {
  console.error('ERREUR : variable d\'environnement ADMIN_SECRET manquante.');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiants requis' });
  }

  // Comparaison timing-safe
  const userMatch = crypto.timingSafeEqual(
    Buffer.from(username.padEnd(256, '0')),
    Buffer.from(ADMIN_USER.padEnd(256, '0'))
  );
  const passMatch = crypto.timingSafeEqual(
    Buffer.from(password.padEnd(256, '0')),
    Buffer.from(ADMIN_PASS.padEnd(256, '0'))
  );

  if (!userMatch || !passMatch) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  // Retourner le secret admin comme token
  return res.status(200).json({ token: ADMIN_SECRET });
};
