// api/admin/candidatures-update.js
// Met à jour le statut d'une candidature (admin) — protégée par ADMIN_SECRET.

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

  const { id, statut } = req.body;
  if (!id || !statut) return res.status(400).json({ error: 'id et statut requis' });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SECRET);
    const { error } = await sb
      .from('candidatures')
      .update({ statut })
      .eq('id', id);

    if (error) {
      console.error('Update error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('Exception:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
