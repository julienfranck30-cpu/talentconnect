// api/gmail.js
// Fichier unique qui gère OAuth Gmail : auth + callback + envoi
// Routes : ?action=auth | ?action=callback | utilisé en interne pour l'envoi

const { createClient } = require('@supabase/supabase-js');

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
    const { email, id } = req.query;
    if (!email || !id) return res.status(400).send('Email et ID requis');

    const state = Buffer.from(JSON.stringify({ email, id })).toString('base64');
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

    let candidatInfo;
    try {
      candidatInfo = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    } catch(e) { return res.status(400).send('State invalide'); }

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
