// api/candidatures-create.js
// Crée une nouvelle candidature côté serveur (clé secrète) et envoie l'email de confirmation.
// Remplace l'insert direct depuis le frontend (clé publique retirée du client).

const { createClient } = require('@supabase/supabase-js');
const { sendConfirmationEmail } = require('../lib/confirm-email');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;

// ─── Limitation de débit par IP ──────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 heure
const RATE_LIMIT_MAX = 5;                     // 5 candidatures / heure / IP
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (list.length >= RATE_LIMIT_MAX) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  return false;
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (rateLimited(clientIp(req))) {
    return res.status(429).json({ error: 'Trop de demandes. Réessaie plus tard.' });
  }

  const {
    nom, email, tel, genre, poste, secteurs, ville, rayon,
    contrats, duree_contrat, cv, cv_url, cv_texte, plan, message,
    offres_publiees, statut, dispo_tot, dispo_tard, situation
  } = req.body;

  // ─── Validation ────────────────────────────────────────────────────────────
  if (!nom || !email) return res.status(400).json({ error: 'Nom et email requis' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return res.status(400).json({ error: 'Email invalide' });
  }
  if (String(nom).length > 200 || String(poste || '').length > 200) {
    return res.status(400).json({ error: 'Champ trop long' });
  }
  if (cv_texte && String(cv_texte).length > 10000) {
    return res.status(400).json({ error: 'Contenu CV trop long' });
  }

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

    const row = data?.[0] || {};

    // Email de confirmation (échec non bloquant : la candidature est déjà enregistrée)
    try {
      const nomParts = String(nom).trim().split(/\s+/);
      await sendConfirmationEmail({
        email,
        prenom: nomParts[0] || nom,
        nom: nomParts.slice(1).join(' '),
        poste,
        secteurs,
        contrat: contrats,
        duree_contrat,
        plan,
        dispo_tot,
        candidat_id: row.id
      });
    } catch (e) {
      console.warn('Email de confirmation non envoyé:', e.message);
    }

    return res.status(201).json({ id: row.id, data: row });
  } catch (e) {
    console.error('Exception:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
