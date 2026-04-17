// api/confirm-candidature.js
const BREVO_KEY = process.env.BREVO_API_KEY;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, prenom, nom, poste, secteurs, contrat, plan, dispo_tot } = req.body;

  if (!email || !prenom) return res.status(400).json({ error: 'Données manquantes' });

  const planLabel = plan || '29€ – 50 candidatures';
  const dispoPhrase = dispo_tot ? `<br/>📅 <strong>Disponibilité :</strong> À partir du ${dispo_tot}` : '';

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.8;font-size:15px;background:#f9f9f9;padding:32px;border-radius:12px">

      <div style="text-align:center;margin-bottom:32px">
        <h1 style="font-size:28px;font-weight:800;color:#111;margin:0">✦ TalentConnect</h1>
        <p style="color:#888;font-size:14px;margin-top:4px">Ton IA de candidature spontanée</p>
      </div>

      <div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:24px;border:1px solid #eee">
        <h2 style="font-size:20px;font-weight:700;color:#111;margin-top:0">Bonjour ${prenom} 👋</h2>
        <p>Ta campagne a bien été enregistrée. Dès réception de ton paiement, nous lancerons l'envoi de tes candidatures spontanées.</p>
        <p style="color:#555">Voici un récapitulatif de ta demande :</p>

        <div style="background:#f4f0ff;border-radius:8px;padding:16px;margin-top:16px">
          👤 <strong>Candidat :</strong> ${prenom} ${nom}<br/>
          💼 <strong>Poste visé :</strong> ${poste || '—'}<br/>
          🏢 <strong>Secteurs :</strong> ${secteurs || '—'}<br/>
          📄 <strong>Contrat :</strong> ${contrat || '—'}<br/>
          🎯 <strong>Offre choisie :</strong> ${planLabel}
          ${dispoPhrase}
        </div>
      </div>

      <div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:24px;border:1px solid #eee">
        <h3 style="font-size:16px;font-weight:700;color:#111;margin-top:0">🚀 Comment ça se passe ?</h3>
        <ol style="padding-left:20px;color:#555">
          <li style="margin-bottom:8px"><strong>Paiement</strong> — Tu finalises ton paiement via Stripe (lien envoyé séparément)</li>
          <li style="margin-bottom:8px"><strong>Traitement</strong> — Notre IA identifie les entreprises cibles dans ton secteur</li>
          <li style="margin-bottom:8px"><strong>Envoi</strong> — Une lettre personnalisée + ton CV sont envoyés à chaque recruteur</li>
          <li><strong>Résultats</strong> — Les entreprises te contactent directement sur ton email</li>
        </ol>
      </div>

      <div style="background:#8B5CF6;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px">
        <p style="color:#fff;font-size:15px;margin:0 0 12px 0">📨 Tes candidatures seront envoyées dans les <strong>24h après paiement</strong></p>
        <p style="color:#ddd;font-size:13px;margin:0">Les entreprises te contacteront directement sur <strong>${email}</strong></p>
      </div>

      <div style="background:#fff;border-radius:10px;padding:20px;border:1px solid #eee;margin-bottom:24px">
        <h3 style="font-size:15px;font-weight:700;color:#111;margin-top:0">🔒 Tes données sont protégées</h3>
        <p style="color:#555;font-size:13px;margin:0">Conformément au RGPD, tes données personnelles sont utilisées uniquement pour l'envoi de tes candidatures et conservées 2 ans maximum. Tu peux demander leur suppression à tout moment en répondant à cet email.</p>
      </div>

      <div style="text-align:center;color:#aaa;font-size:12px">
        <p>TalentConnect — Paris, France<br/>
        Pour toute question : <a href="mailto:julienfranck30@gmail.com" style="color:#8B5CF6">julienfranck30@gmail.com</a></p>
        <p>Tu reçois cet email car tu as créé une campagne sur TalentConnect.</p>
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
        sender: { name: 'TalentConnect', email: 'julienfranck30@gmail.com' },
        to: [{ email, name: `${prenom} ${nom}` }],
        subject: `✦ Ta campagne TalentConnect est enregistrée, ${prenom} !`,
        htmlContent
      })
    });

    if (!res2.ok) {
      const err = await res2.text();
      console.error('Brevo confirm error:', err);
      return res.status(500).json({ error: 'Email non envoyé' });
    }

    return res.status(200).json({ success: true });
  } catch(e) {
    console.error('Confirm error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
