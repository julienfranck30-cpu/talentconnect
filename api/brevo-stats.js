// api/brevo-stats.js
const BREVO_KEY = process.env.BREVO_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

module.exports = async (req, res) => {
  // Authentification serveur↔serveur
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // CORS restreint au domaine du site
  res.setHeader('Access-Control-Allow-Origin', 'https://www.lancemonjob.fr');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Date range — 30 derniers jours
    const dateTo = new Date().toISOString().slice(0, 10);
    const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const response = await fetch(
      `https://api.brevo.com/v3/smtp/statistics/aggregatedReport?startDate=${dateFrom}&endDate=${dateTo}`,
      {
        headers: {
          'api-key': BREVO_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('Brevo stats error:', err);
      return res.status(500).json({ error: 'Brevo API error' });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (e) {
    console.error('Brevo stats exception:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
