// api/gmail-sender.js
// Envoie un email via l'API Gmail au nom du candidat

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
    if (!accessToken) {
      console.error('Gmail: impossible de renouveler le token');
      return false;
    }

    const raw = buildMimeMessage({ from, fromName, to, subject, htmlContent, attachments });

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Gmail API error ${res.status}:`, err);
      return false;
    }

    return true;
  } catch(e) {
    console.error('Gmail send exception:', e.message);
    return false;
  }
}

module.exports = { sendViaGmail };
