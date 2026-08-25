const BREVO_KEY = process.env.BREVO_API_KEY;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, prenom, nom, poste, secteurs, contrat, duree_contrat, plan, dispo_tot, candidat_id } = req.body;

  const suiviUrl = `https://www.lancemonjob.fr/suivi?email=${encodeURIComponent(email)}`;
  const gmailAuthUrl = `https://www.lancemonjob.fr/api/gmail?action=auth&email=${encodeURIComponent(email)}&id=${encodeURIComponent(candidat_id || '')}`;

  const secteursList = secteurs
    ? secteurs.split(',').map(s => `<li style="margin-bottom:4px">✓ ${s.trim()}</li>`).join('')
    : '<li>Non précisé</li>';

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.8;font-size:15px;background:#f9f9f9;padding:32px;border-radius:12px">
      <div style="text-align:center;margin-bottom:32px">
        <h1 style="font-size:28px;font-weight:800;color:#111;margin:0">✦ Lance Mon Job</h1>
        <p style="color:#888;font-size:14px;margin-top:4px">Ton IA de candidature spontanée</p>
      </div>
      <div style="background:#8B5CF6;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px">
        <div style="font-size:48px;margin-bottom:8px">🎉</div>
        <h2 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px 0">Candidature enregistrée !</h2>
        <p style="color:#ddd;font-size:15px;margin:0">Bonjour ${prenom}, ta campagne est bien prise en compte</p>
      </div>

      <!-- BOUTON GMAIL -->
      <div style="background:linear-gradient(135deg,#f0fdf4,#ecfdf5);border:1.5px solid #86efac;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center">
        <div style="font-size:32px;margin-bottom:8px">📬</div>
        <h3 style="font-size:16px;font-weight:800;color:#15803d;margin:0 0 8px 0">Booste tes résultats x3</h3>
        <p style="font-size:13px;color:#166534;margin:0 0 16px 0">Connecte ton Gmail pour que tes candidatures partent <strong>depuis ta propre adresse email</strong>. Les recruteurs reçoivent un email de toi directement — pas d'un service inconnu.</p>
        <a href="${gmailAuthUrl}" style="display:inline-block;background:#ffffff;border:2px solid #16a34a;color:#15803d;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none">
          🔗 Connecter mon Gmail →
        </a>
        <p style="font-size:11px;color:#4ade80;margin:10px 0 0 0">100% sécurisé · On envoie uniquement, on ne lit pas tes emails</p>
      </div>

      <div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:24px;border:1px solid #eee">
        <h3 style="font-size:16px;font-weight:700;color:#111;margin-top:0">📋 Récapitulatif</h3>
        <table style="width:100%;font-size:13px;color:#555">
          <tr><td style="padding:6px 0;color:#888">Candidat</td><td style="font-weight:600;color:#111;text-align:right">${prenom} ${nom}</td></tr>
          <tr><td style="padding:6px 0;color:#888">Poste visé</td><td style="font-weight:600;color:#111;text-align:right">${poste || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#888">Contrat</td><td style="font-weight:600;color:#111;text-align:right">${contrat || '—'}</td></tr>
          ${duree_contrat ? `<tr><td style="padding:6px 0;color:#888">Durée</td><td style="font-weight:600;color:#111;text-align:right">${duree_contrat}</td></tr>` : ''}
          <tr><td style="padding:6px 0;color:#888">Offre</td><td style="font-weight:600;color:#8B5CF6;text-align:right">${plan || '—'}</td></tr>
          ${dispo_tot ? `<tr><td style="padding:6px 0;color:#888">Disponible le</td><td style="font-weight:600;color:#111;text-align:right">${dispo_tot}</td></tr>` : ''}
        </table>
      </div>
      <div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:24px;border:1px solid #eee">
        <h3 style="font-size:16px;font-weight:700;color:#111;margin-top:0">🏢 Secteurs ciblés</h3>
        <ul style="padding-left:16px;color:#555;font-size:13px;margin:0">${secteursList}</ul>
      </div>
      <div style="background:#f4f0ff;border-radius:10px;padding:20px;margin-bottom:24px;text-align:center">
        <p style="color:#8B5CF6;font-weight:700;font-size:15px;margin:0 0 12px 0">📊 Suis ta campagne en temps réel</p>
        <a href="${suiviUrl}" style="display:inline-block;background:linear-gradient(135deg,#A855F7,#22D3EE);color:#080612;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none">Voir le suivi de ma campagne →</a>
      </div>
      <div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:24px;border:1px solid #eee">
        <h3 style="font-size:16px;font-weight:700;color:#111;margin-top:0">⚡ Prochaines étapes</h3>
        <ol style="padding-left:20px;color:#555;font-size:13px">
          <li style="margin-bottom:8px">Connecte ton Gmail ci-dessus pour de meilleurs résultats</li>
          <li style="margin-bottom:8px">Ton paiement est confirmé — ta campagne démarre sous 24h</li>
          <li style="margin-bottom:8px">Tes candidatures sont envoyées automatiquement aux entreprises</li>
          <li style="margin-bottom:8px">Les recruteurs te contactent directement sur ${email}</li>
          <li>Tu reçois un email de fin de campagne avec le récapitulatif complet</li>
        </ol>
      </div>
      <div style="text-align:center;color:#aaa;font-size:12px">
        <p>Lance Mon Job — Lyon, France<br/>
        Pour toute question : <a href="mailto:support@lancemonjob.fr" style="color:#8B5CF6">support@lancemonjob.fr</a></p>
      </div>
    </div>`;

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': BREVO_KEY },
      body: JSON.stringify({
        sender: { name: 'Lance Mon Job', email: 'support@lancemonjob.fr' },
        to: [{ email, name: `${prenom} ${nom}` }],
        subject: `✦ Ta campagne est enregistrée, ${prenom} !`,
        htmlContent
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Brevo error:', err);
      return res.status(500).json({ error: 'Email non envoyé' });
    }

    return res.status(200).json({ success: true });
  } catch(e) {
    console.error('Confirm error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
