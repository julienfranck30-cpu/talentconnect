// api/gmail-auth.js
// Redirige le candidat vers Google pour autoriser l'accès à son Gmail

module.exports = async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = 'https://www.lancemonjob.fr/api/gmail-callback';

  // Récupère l'email du candidat depuis le paramètre URL
  const candidatEmail = req.query.email || '';
  const candidatId = req.query.id || '';

  if (!candidatEmail || !candidatId) {
    return res.status(400).send('Email et ID candidat requis');
  }

  // State encodé pour retrouver le candidat après le callback
  const state = Buffer.from(JSON.stringify({ email: candidatEmail, id: candidatId })).toString('base64');

  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email'
  ].join(' ');

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `access_type=offline&` +
    `prompt=consent&` +
    `state=${encodeURIComponent(state)}`;

  return res.redirect(authUrl);
};
