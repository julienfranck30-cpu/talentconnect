// api/admin/candidatures-list.js
// Liste toutes les candidatures (admin) — protégée par CRON_SECRET.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

module.exports = async (req, res) => {
  // Vérification d'authentification
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${ADMIN_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SECRET);
    const { data, error } = await sb
      .from('candidatures')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('List error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ data });
  } catch (e) {
    console.error('Exception:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
