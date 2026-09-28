// api/candidatures-create.js
// Crée une nouvelle candidature côté serveur (avec clé secrète).
// Remplace l'insert direct depuis le frontend.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    nom, email, tel, genre, poste, secteurs, ville, rayon,
    contrats, duree_contrat, cv, cv_url, cv_texte, plan, message,
    offres_publiees, statut, dispo_tot, dispo_tard, situation
  } = req.body;

  // Validation minimale
  if (!nom || !email) return res.status(400).json({ error: 'Nom et email requis' });
  if (!email.includes('@')) return res.status(400).json({ error: 'Email invalide' });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SECRET);
    const { data, error } = await sb.from('candidatures').insert([{
      nom, email, tel, genre, poste, secteurs, ville, rayon,
      contrats, duree_contrat, cv, cv_url, cv_texte, plan, message,
      offres_publiees, statut: statut || 'En attente paiement',
      dispo_tot, dispo_tard, situation
    }]).select();

    if (error) {
      console.error('Insert error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ id: data?.[0]?.id, data });
  } catch (e) {
    console.error('Exception:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
