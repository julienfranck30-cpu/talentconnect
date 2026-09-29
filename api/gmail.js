// api/gmail.js
// Fichier unique qui gère OAuth Gmail : auth + callback + envoi
// Routes : ?action=auth | ?action=callback | utilisé en interne pour l'envoi

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// ─── STATE SIGNING (HMAC + nonce + expiration) ───────────────────────────────

const STATE_SECRET = process.env.OAUTH_STATE_SECRET;
const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

// Sans secret configuré, l'OAuth est refusé plutôt qu'accepter un état non signé
// (un secret aléatoire régénéré à chaque cold start casserait le callback).
if (!STATE_SECRET) {
  console.error('ERREUR : OAUTH_STATE_SECRET doit être défini sur Vercel.');
}

function signState(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', STATE_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyState(signed) {
  const dot = signed.lastIndexOf('.');
  if (dot === -1) return null;
  const body = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);
  const expected = crypto.createHmac('sha256', STATE_SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    if (!payload.nonce || !payload.email || !payload.id) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── UTILS ───────────────────────────────────────────────────────────────────

async function getAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token:  refreshToken,
      client_id:      process.env.GOOGLE_CLIENT_ID,
      client_secret:  process.env.GOOGLE_CLIENT_SECRET,
      grant_type:     'refresh_token'
    })
  });
  const data = await res.json();
  return data.access_token || null;
}

function buildMimeMessage({ from, fromName, to, subject, htmlContent, attachments = [] }) {
  const boundary = `boundary_${Date.now()}`;
  const lines = [];
  lines.push(`From: ${fromName} <${from}>`);
  lines.push(`To: ${to}`);
  lines.push(`Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`);
  lines.push(`MIME-Version: 1.0`);
  lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  lines.push('');
  lines.push(`--${boundary}`);
  lines.push(`Content-Type: text/html; charset=UTF-8`);
  lines.push(`Content-Transfer-Encoding: base64`);
  lines.push('');
  lines.push(Buffer.from(htmlContent).toString('base64'));
  for (const att of attachments) {
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: ${att.type}; name="${att.name}"`);
    lines.push(`Content-Transfer-Encoding: base64`);
    lines.push(`Content-Disposition: attachment; filename="${att.name}"`);
    lines.push('');
    lines.push(att.content);
  }
  lines.push(`--${boundary}--`);
  const raw = lines.join('\r\n');
  return Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sendViaGmail({ refreshToken, from, fromName, to, subject, htmlContent, attachments = [] }) {
  try {
    const accessToken = await getAccessToken(refreshToken);
    if (!accessToken) { console.error('Gmail: token invalide'); return false; }
    const raw = buildMimeMessage({ from, fromName, to, subject, htmlContent, attachments });
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw })
    });
    if (!res.ok) { const err = await res.text(); console.error(`Gmail API error:`, err); return false; }
    return true;
  } catch(e) { console.error('Gmail send exception:', e.message); return false; }
}

// ─── HANDLER PRINCIPAL ───────────────────────────────────────────────────────

module.exports = async (req, res) => {
  const action = req.query.action;

  // ── AUTH : redirige vers Google ──
  if (action === 'auth') {
    if (!STATE_SECRET) return res.status(503).send('OAuth non configuré');
    const { email, id } = req.query;
    if (!email || !id) return res.status(400).send('Email et ID requis');

    const state = signState({
      email,
      id,
      nonce: crypto.randomBytes(16).toString('hex'),
      exp: Date.now() + STATE_MAX_AGE_MS
    });
    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email'
    ].join(' ');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(process.env.GOOGLE_CLIENT_ID)}&` +
      `redirect_uri=${encodeURIComponent('https://www.lancemonjob.fr/api/gmail?action=callback')}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=${encodeURIComponent(state)}`;

    return res.redirect(authUrl);
  }

  // ── CALLBACK : reçoit le code Google ──
  if (action === 'callback') {
    const { code, state, error } = req.query;

    if (error) return res.redirect('https://www.lancemonjob.fr?gmail_error=1');
    if (!code || !state) return res.status(400).send('Paramètres manquants');

    const candidatInfo = verifyState(state);
    if (!candidatInfo) return res.status(400).send('State invalide ou expiré');

    const { email, id } = candidatInfo;

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id:     process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri:  'https://www.lancemonjob.fr/api/gmail?action=callback',
          grant_type:    'authorization_code'
        })
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        console.error('Token error:', tokenData);
        return res.redirect(`https://www.lancemonjob.fr/suivi?email=${encodeURIComponent(email)}&gmail_error=1`);
      }

      // Vérifie que le compte Google réellement autorisé correspond bien à l'e-mail
      // du candidat : sans ce contrôle, un attaquant peut connecter SA boîte Gmail
      // sur le dossier d'un tiers (et lire/écrire en son nom).
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });
      if (!profileRes.ok) {
        console.error('userinfo error:', profileRes.status);
        return res.redirect(`https://www.lancemonjob.fr/suivi?email=${encodeURIComponent(email)}&gmail_error=1`);
      }
      const profile = await profileRes.json();
      if (!profile.email || profile.email.toLowerCase() !== String(email).toLowerCase()) {
        console.error(`Compte Google ${profile.email} refusé : ne correspond pas au candidat ${email}.`);
        return res.redirect(`https://www.lancemonjob.fr/suivi?email=${encodeURIComponent(email)}&gmail_mismatch=1`);
      }

      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
      await sb.from('candidatures').update({
        gmail_token: tokenData.refresh_token || tokenData.access_token,
        gmail_connected: true
      }).eq('id', id);

      console.log(`Gmail connecté pour ${email}`);
      return res.redirect(`https://www.lancemonjob.fr/suivi?email=${encodeURIComponent(email)}&gmail_ok=1`);

    } catch(e) {
      console.error('Callback error:', e.message);
      return res.redirect(`https://www.lancemonjob.fr/suivi?email=${encodeURIComponent(email)}&gmail_error=1`);
    }
  }

  return res.status(400).json({ error: 'Action inconnue. Utilisez ?action=auth ou ?action=callback' });
};

// Export de la fonction d'envoi pour process-candidatures.js
module.exports.sendViaGmail = sendViaGmail;
