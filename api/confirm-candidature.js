// api/confirm-candidature.js
// Endpoint protégé (secret partagé serveur↔serveur).
// L'envoi est normalement déclenché en interne par /api/candidatures-create ;
// cet endpoint reste disponible pour un envoi manuel depuis un outil interne.

const CRON_SECRET = process.env.CRON_SECRET;
const { sendConfirmationEmail } = require('../lib/confirm-email');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization;
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email invalide' });
  }

  try {
    const result = await sendConfirmationEmail(req.body);
    if (!result.ok) return res.status(500).json({ error: result.error });
    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('Confirm error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
