// api/webhook.js
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const SUPABASE_URL          = process.env.SUPABASE_URL;
const SUPABASE_SECRET       = process.env.SUPABASE_SECRET_KEY;
const BREVO_KEY             = process.env.BREVO_API_KEY;
const STRIPE_SECRET_KEY     = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = Stripe(STRIPE_SECRET_KEY);

const PLANS = {
  '29€': { label: 'Starter', volume: 50, amount: 2900 },
  '59€': { label: 'Pro', volume: 150, amount: 5900 },
  '99€': { label: 'Max', volume: 300, amount: 9900 },
};

// Échappement HTML : les données du candidat sont injectées dans des gabarits d'e-mail.
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function matchPlan(candidatPlan) {
  for (const [key, val] of Object.entries(PLANS)) {
    if (candidatPlan?.includes(key)) return val;
  }
  return PLANS['29€'];
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function sendConfirmationEmail(candidat) {
  const planInfo = matchPlan(candidat.plan);
  const nom = escapeHtml(candidat.nom);
  const poste = escapeHtml(candidat.poste);
  const secteurs = escapeHtml(candidat.secteurs);
  const ville = escapeHtml(candidat.ville);
  const rayon = escapeHtml(candidat.rayon);
  const emailCandidat = escapeHtml(candidat.email);
  const tel = escapeHtml(candidat.tel);

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;background:#fff">
      <div style="background:#0f0f0f;padding:30px;text-align:center">
        <h1 style="color:#fff;font-size:24px;margin:0">✦ TalentConnect</h1>
      </div>
      <div style="padding:32px">
        <h2 style="font-size:20px;margin-bottom:8px">Bonjour ${nom} 👋</h2>
        <p style="color:#555;margin-bottom:24px">Ton paiement a bien été reçu. Ta campagne de candidatures spontanées est maintenant <strong>en cours de préparation</strong>.</p>

        <div style="background:#f9f9f9;border-radius:8px;padding:20px;margin-bottom:24px">
          <h3 style="margin:0 0 12px;font-size:15px;color:#333">📋 Récapitulatif de ta campagne</h3>
          <table style="width:100%;font-size:14px;color:#555">
            <tr><td style="padding:4px 0"><strong>Offre</strong></td><td>${planInfo.label} — ${planInfo.volume} candidatures</td></tr>
            <tr><td style="padding:4px 0"><strong>Poste visé</strong></td><td>${poste || '—'}</td></tr>
            <tr><td style="padding:4px 0"><strong>Secteurs</strong></td><td>${secteurs || '—'}</td></tr>
            <tr><td style="padding:4px 0"><strong>Zone</strong></td><td>${ville || '—'} · ${rayon || ''}</td></tr>
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
          <li>Les entreprises te contactent directement sur <strong>${emailCandidat}</strong> ou <strong>${tel || 'ton téléphone'}</strong></li>
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
        to: [{ email: candidat.email, name: candidat.nom }],  // en-tête d'e-mail : ne pas échapper
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

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      req.headers['stripe-signature'],
      STRIPE_WEBHOOK_SECRET
    );
  } catch (e) {
    console.error('Stripe signature verification failed:', e.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true, ignored: true });
  }

  const session = event.data.object;
  const sb = createClient(SUPABASE_URL, SUPABASE_SECRET);

  let candidat = null;

  if (session.client_reference_id) {
    const { data, error } = await sb
      .from('candidatures')
      .select('*')
      .eq('id', session.client_reference_id)
      .limit(1);
    if (!error && data?.length) candidat = data[0];
    if (!candidat) console.error('client_reference_id inconnu:', session.client_reference_id);
  }

  if (!candidat) {
    const customerEmail =
      session.customer_details?.email ||
      session.customer_email ||
      session.receipt_email;

    if (!customerEmail) {
      console.log('No client_reference_id nor email found in Stripe event');
      return res.status(200).json({ received: true });
    }

    const { data, error } = await sb
      .from('candidatures')
      .select('*')
      .eq('email', customerEmail)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !data?.length) {
      console.error('Candidature not found for:', customerEmail);
      return res.status(200).json({ received: true });
    }
    candidat = data[0];
  }

  const expectedPlan = matchPlan(candidat.plan);
  if (session.amount_total !== expectedPlan.amount) {
    console.error(`Montant payé (${session.amount_total}) incohérent avec le plan "${candidat.plan}" (attendu ${expectedPlan.amount}) — dossier ${candidat.id}`);
    return res.status(200).json({ received: true, mismatch: true });
  }

  await sb.from('candidatures')
    .update({ statut: 'Payé' })
    .eq('id', candidat.id);

  await sendConfirmationEmail(candidat);

  console.log(`Paiement reçu pour ${candidat.nom} — confirmation envoyée`);
  return res.status(200).json({ received: true });
}
