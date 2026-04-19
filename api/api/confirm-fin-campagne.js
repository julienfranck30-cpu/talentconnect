// api/confirm-fin-campagne.js
const BREVO_KEY = process.env.BREVO_API_KEY;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, prenom, nom, poste, secteurs, contrat, totalSent, volume, ville } = req.body;

  if (!email || !prenom) return res.status(400).json({ error: 'Données manquantes' });

  const secteursListe = secteurs
    ? secteurs.split(',').map(s => `<li style="margin-bottom:6px">✓ ${s.trim()}</li>`).join('')
    : '<li>Non précisé</li>';

  const tauxReussite = volume ? Math.round((totalSent / volume) * 100) : 100;

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.8;font-size:15px;background:#f9f9f9;padding:32px;border-radius:12px">

      <div style="text-align:center;margin-bottom:32px">
        <h1 style="font-size:28px;font-weight:800;color:#111;margin:0">✦ Lance Mon Job</h1>
        <p style="color:#888;font-size:14px;margin-top:4px">Ton IA de candidature spontanée</p>
      </div>

      <div style="background:#8B5CF6;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px">
        <div style="font-size:48px;margin-bottom:8px">🎯</div>
        <h2 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px 0">Ta campagne est terminée !</h2>
        <p style="color:#ddd;font-size:15px;margin:0">Bonjour ${prenom}, voici le récapitulatif de ta campagne</p>
      </div>

      <div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:24px;border:1px solid #eee;text-align:center">
        <div style="font-size:56px;font-weight:800;color:#8B5CF6;line-height:1">${totalSent}</div>
        <div style="font-size:16px;color:#555;margin-top:4px">candidatures envoyées</div>
        <div style="margin-top:16px;display:inline-block;background:#f0fdf4;border:1px solid #86efac;border-radius:20px;padding:6px 16px;font-size:13px;color:#16a34a;font-weight:700">
          ✓ Taux de réussite : ${tauxReussite}%
        </div>
      </div>

      <div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:24px;border:1px solid #eee">
        <h3 style="font-size:16px;font-weight:700;color:#111;margin-top:0">📋 Détails de ta campagne</h3>
        <table style="width:100%;font-size:13px;color:#555">
          <tr><td style="padding:6px 0;color:#888">Candidat</td><td style="font-weight:600;color:#111;text-align:right">${prenom} ${nom}</td></tr>
          <tr><td style="padding:6px 0;color:#888">Poste visé</td><td style="font-weight:600;color:#111;text-align:right">${poste || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#888">Contrat</td><td style="font-weight:600;color:#111;text-align:right">${contrat || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#888">Zone</td><td style="font-weight:600;color:#111;text-align:right">${ville || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#888">Candidatures envoyées</td><td style="font-weight:600;color:#8B5CF6;text-align:right">${totalSent} / ${volume}</td></tr>
        </table>
      </div>

      <div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:24px;border:1px solid #eee">
        <h3 style="font-size:16px;font-weight:700;color:#111;margin-top:0">🏢 Secteurs ciblés</h3>
        <ul style="padding-left:16px;color:#555;font-size:13px;margin:0">
          ${secteursListe}
        </ul>
      </div>

      <div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:24px;border:1px solid #eee">
        <h3 style="font-size:16px;font-weight:700;color:#111;margin-top:0">📞 Et maintenant ?</h3>
        <ol style="padding-left:20px;color:#555;font-size:13px">
          <li style="margin-bottom:10px"><strong>Surveille ta boîte email</strong> — les recruteurs vont te contacter directement sur <strong>${email}</strong></li>
          <li style="margin-bottom:10px"><strong>Réponds rapidement</strong> — les recruteurs apprécient les candidats réactifs, idéalement sous 24h</li>
          <li style="margin-bottom:10px"><strong>Prépare ton pitch</strong> — 2-3 phrases sur ton parcours, ta motivation et ta disponibilité</li>
          <li style="margin-bottom:10px"><strong>Vérifie tes spams</strong> — certaines réponses peuvent atterrir dans les indésirables</li>
          <li><strong>Patience</strong> — les recruteurs peuvent mettre 1 à 3 semaines à répondre</li>
        </ol>
      </div>

      <div style="background:#f4f0ff;border-radius:10px;padding:20px;margin-bottom:24px;text-align:center">
        <p style="color:#8B5CF6;font-weight:700;font-size:15px;margin:0 0 8px 0">💡 Conseil de l'équipe</p>
        <p style="color:#555;font-size:13px;margin:0">Si tu n'as pas de réponse sous 3 semaines, contacte-nous à <a href="mailto:support@lancemonjob.fr" style="color:#8B5CF6">support@lancemonjob.fr</a> — on analysera ta campagne et te proposera des pistes d'amélioration.</p>
      </div>

      <div style="text-align:center;color:#aaa;font-size:12px">
        <p>Lance Mon Job — Lyon, France<br/>
        Pour toute question : <a href="mailto:support@lancemonjob.fr" style="color:#8B5CF6">support@lancemonjob.fr</a></p>
        <p>Tu reçois cet email car tu as lancé une campagne sur Lance Mon Job.</p>
      </div>

    </div>`;

  try {
    const res2 = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_KEY
      },
      body: JSON.stringify({
        sender: { name: 'Lance Mon Job', email: 'support@lancemonjob.fr' },
        to: [{ email, name: `${prenom} ${nom}` }],
        subject: `✦ Ta campagne est terminée — ${totalSent} candidatures envoyées, ${prenom} !`,
        htmlContent
      })
    });

    if (!res2.ok) {
      const err = await res2.text();
      console.error('Brevo fin campagne error:', err);
      return res.status(500).json({ error: 'Email non envoyé' });
    }

    return res.status(200).json({ success: true });
  } catch(e) {
    console.error('Fin campagne error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
