// api/webhook.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;
const BREVO_KEY       = process.env.BREVO_API_KEY;

async function sendConfirmationEmail(candidat) {
  const plans = {
    '29€': { label: 'Starter', volume: 50 },
    '59€': { label: 'Pro', volume: 150 },
    '99€': { label: 'Max', volume: 300 },
  };

  let planInfo = { label: 'Starter', volume: 50 };
  for (const [key, val] of Object.entries(plans)) {
    if (candidat.plan && candidat.plan.includes(key)) {
      planInfo = val;
      break;
    }
  }

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;background:#fff">
      <div style="background:#0f0f0f;padding:30px;text-align:center">
        <h1 style="color:#fff;font-size:24px;margin:0">✦ TalentConnect</h1>
      </div>
      <div style="padding:32px">
        <h2 style="font-size:20px;margin-bottom:8px">Bonjour ${candidat.nom} 👋</h2>
        <p style="color:#555;margin-bottom:24px">Ton paiement a bien été reçu. Ta campagne de candidatures spontanées est maintenant <strong>en cours de préparation</strong>.</p>

        <div style="background:#f9f9f9;border-radius:8px;padding:20px;margin-bottom:24px">
          <h3 style="margin:0 0 12px;font-size:15px;color:#333">📋 Récapitulatif de ta campagne</h3>
          <table style="width:100%;font-size:14px;color:#555">
            <tr><td style="padding:4px 0"><strong>Offre</strong></td><td>${planInfo.label} — ${planInfo.volume} candidatures</td></tr>
            <tr><td style="padding:4px 0"><strong>Poste visé</strong></td><td>${candidat.poste || '—'}</td></tr>
            <tr><td style="padding:4px 0"><strong>Secteurs</strong></td><td>${candidat.secteurs || '—'}</td></tr>
            <tr><td style="padding:4px 0"><strong>Zone</strong></td><td>${candidat.ville || '—'} · ${candidat.rayon || ''}</td></tr>
          </table>
        </div>

        <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:16px;border-radius:4px;margin-bottom:24px">
          <p style="margin:0;font-size:14px;color:#166534">
            ✅ Tes candidatures seront envoyées dans les <strong>prochaines minutes</strong> aux entreprises correspondant à ton profil.
          </p>
        </div>

        <h3 style="font-size:15px">📌 Prochaines étapes</h3>
        <ol style="color:#555;font-size:14px;line-height:1.8">
          <li>Nos algorithmes identifient les entreprises cibles dans ta zone</li>
          <li>Une lettre de motivation personnalisée est générée pour chaque entreprise</li>
          <li>Les candidatures sont envoyées aux bons interlocuteurs RH</li>
          <li>Les entreprises te contactent directement sur <strong>${candidat.email}</strong> ou <strong>${candidat.tel || 'ton téléphone'}</strong></li>
        </ol>

        <p style="font-size:13px;color:#888;margin-top:24px">
          Une question ? Réponds directement à cet email ou contacte-nous sur
          <a href="mailto:julienfranck30@gmail.com" style="color:#6366f1">julienfranck30@gmail.com</a>
        </p>
      </div>
      <div style="background:#f9f9f9;padding:16px;text-align:center;font-size:11px;color:#aaa">
        TalentConnect · talentconnect-gold.vercel.app · Données traitées conformément au RGPD
      </div>
    </div>`;

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_KEY
      },
      body: JSON.stringify({
        sender: { name: 'TalentConnect', email: 'julienfranck30@gmail.com' },
        to: [{ email: candidat.email, name: candidat.nom }],
        subject: `✦ Ta campagne est lancée — ${planInfo.volume} candidatures en cours d'envoi`,
        htmlContent,
      }),
    });
    if (res.ok) {
      console.log(`Email de confirmation envoyé à ${candidat.email}`);
    } else {
      console.error('Brevo confirmation error:', await res.text());
    }
  } catch(e) {
    console.error('Brevo error:', e.message);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let event;
  try {
    event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch(e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true, ignored: true });
  }

  const obj = event.data?.object;
  const customerEmail =
    obj?.customer_details?.email ||
    obj?.customer_email ||
    obj?.receipt_email ||
    obj?.charges?.data?.[0]?.billing_details?.email;

  if (!customerEmail) {
    console.log('No email found in Stripe event');
    return res.status(200).json({ received: true });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SECRET);
  const { data: candidatures, error } = await sb
    .from('candidatures')
    .select('*')
    .eq('email', customerEmail)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !candidatures?.length) {
    console.error('Candidature not found for:', customerEmail);
    return res.status(200).json({ received: true });
  }

  const candidat = candidatures[0];

  await sb.from('candidatures')
    .update({ statut: 'Payé' })
    .eq('id', candidat.id);

  await sendConfirmationEmail(candidat);

  console.log(`Paiement reçu pour ${candidat.nom} — confirmation envoyée`);
  return res.status(200).json({ received: true });
};
