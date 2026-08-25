// api/gmail-callback.js
// Reçoit le code OAuth de Google, échange contre un token, sauvegarde dans Supabase

const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`https://www.lancemonjob.fr/suivi?gmail_error=1`);
  }

  if (!code || !state) {
    return res.status(400).send('Paramètres manquants');
  }

  // Décode le state pour retrouver le candidat
  let candidatInfo;
  try {
    candidatInfo = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
  } catch(e) {
    return res.status(400).send('State invalide');
  }

  const { email, id } = candidatInfo;

  // Échange le code contre un access_token + refresh_token
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  'https://www.lancemonjob.fr/api/gmail-callback',
        grant_type:    'authorization_code'
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('Token error:', tokenData);
      return res.redirect(`https://www.lancemonjob.fr/suivi?email=${encodeURIComponent(email)}&gmail_error=1`);
    }

    // Sauvegarde le refresh_token dans Supabase
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

    await sb.from('candidatures').update({
      gmail_token: tokenData.refresh_token || tokenData.access_token,
      gmail_connected: true
    }).eq('id', id);

    console.log(`Gmail connecté pour candidat ${id} (${email})`);

    // Redirige vers la page de suivi avec succès
    return res.redirect(`https://www.lancemonjob.fr/suivi?email=${encodeURIComponent(email)}&gmail_ok=1`);

  } catch(e) {
    console.error('Gmail callback error:', e.message);
    return res.redirect(`https://www.lancemonjob.fr/suivi?email=${encodeURIComponent(email)}&gmail_error=1`);
  }
};
