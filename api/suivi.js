// api/suivi.js
// Récupère une candidature par email (suivi candidat) — protégée par RLS ou vérification serveur.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.query;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email invalide' });
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SECRET);
    const { data, error } = await sb
      .from('candidatures')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Suivi error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Aucune campagne trouvée' });
    }

    return res.status(200).json({ data: data[0] });
  } catch (e) {
    console.error('Exception:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
