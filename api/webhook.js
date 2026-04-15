// api/webhook.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;
const HUNTER_KEY      = process.env.HUNTER_API_KEY;
const BREVO_KEY       = process.env.BREVO_API_KEY;

const SECTEUR_KEYWORDS = {
  'Distribution / Négoce': 'distribution',
  'Industrie':             'industrie',
  'Automobile':            'automobile',
  'BTP / Construction':    'construction',
  'Logistique / Transport':'logistique',
  'Agroalimentaire':       'agroalimentaire',
  'Retail / Commerce':     'commerce',
  'Services B2B':          'services',
  'Tech / Numérique':      'tech',
  'Santé / Pharma':        'sante',
};

const PLAN_VOLUMES = { '29€': 50, '59€': 150, '99€': 300 };

function getPlanVolume(plan) {
  for (const [key, vol] of Object.entries(PLAN_VOLUMES)) {
    if (plan && plan.includes(key)) return vol;
  }
  return 50;
}

async function findCompanies(secteur, ville, limit) {
  const keyword = SECTEUR_KEYWORDS[secteur] || secteur.toLowerCase();
  const companies = [];
  try {
    const params = new URLSearchParams({
      api_token: process.env.PAPPERS_API_KEY,
      q: keyword,
      siege: ville.split(',')[0].trim(),
      par_page: Math.min(limit, 10),
      page: 1
    });
    const res = await fetch(`https://api.pappers.fr/v2/recherche?${params}`);
    const data = await res.json();
    if (data.resultats) {
      for (const co of data.resultats) {
        if (co.nom_domaine) {
          companies.push({ name: co.nom_entreprise, domain: co.nom_domaine });
        }
      }
    }
  } catch(e) { console.error('Pappers error:', e.message); }
  return companies;
}

async function searchEmails(domain) {
  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${HUNTER_KEY}&limit=3&type=personal`
    );
    const data = await res.json();
    if (data.data && data.data.emails) {
      return data.data.emails
        .filter(e => e.confidence > 70)
        .map(e => ({ email: e.value, name: `${e.first_name || ''} ${e.last_name || ''}`.trim() }));
    }
  } catch(e) { console.error('Hunter error:', e.message); }
  return [];
}

async function sendCandidature(to, toName, company, candidat) {
  const subject = `Candidature spontanée – ${candidat.poste} | ${candidat.nom}`;
  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
      <p>Madame, Monsieur,</p>
      <p>Je me permets de vous adresser ma candidature spontanée pour un poste de <strong>${candidat.poste}</strong> au sein de <strong>${company}</strong>.</p>
      ${candidat.message ? `<p>${candidat.message}</p>` : ''}
      <p>Actuellement en recherche dans le secteur <strong>${candidat.secteurs}</strong>, région <strong>${candidat.ville}</strong>.</p>
      <p>Je reste disponible pour un entretien.</p>
      <br/>
      <p>Cordialement,<br/><strong>${candidat.nom}</strong><br/>
      📧 ${candidat.email}<br/>
      📞 ${candidat.tel || 'Non renseigné'}</p>
    </div>`;

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': BREVO_KEY },
    body: JSON.stringify({
      sender: { name: candidat.nom, email: 'noreply@talentconnect-gold.vercel.app' },
      to: [{ email: to, name: toName || company }],
      replyTo: { email: candidat.email, name: candidat.nom },
      subject,
      htmlContent,
    }),
  });
  return res.ok;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let event;
  try {
    event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch(e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (event.type !== 'checkout.session.completed' && event.type !== 'payment_intent.succeeded') {
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
    .from('candidatures').select('*')
    .eq('email', customerEmail)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !candidatures?.length) {
    console.error('Candidature not found for:', customerEmail);
    return res.status(200).json({ received: true });
  }

  const candidat = candidatures[0];
  const volume = getPlanVolume(candidat.plan);
  const secteurs = candidat.secteurs ? candidat.secteurs.split(',').map(s => s.trim()) : [];

  console.log(`Processing ${candidat.nom} — ${volume} envois`);

  await sb.from('candidatures').update({ statut: "En cours d'envoi" }).eq('id', candidat.id);

  let totalSent = 0;

  for (const secteur of secteurs) {
    if (totalSent >= volume) break;
    const companies = await findCompanies(secteur, candidat.ville, Math.min(volume - totalSent, 10));

    for (const company of companies) {
      if (totalSent >= volume) break;
      const contacts = await searchEmails(company.domain);
      for (const contact of contacts) {
        if (totalSent >= volume) break;
        const sent = await sendCandidature(contact.email, contact.name, company.name, candidat);
        if (sent) {
          totalSent++;
          console.log(`Sent to ${contact.email} — total: ${totalSent}`);
        }
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }

  await sb.from('candidatures').update({
    statut: 'Envoyé',
    message: (candidat.message || '') + `\n\n[AUTO] ${totalSent} candidatures envoyées le ${new Date().toLocaleDateString('fr-FR')}`
  }).eq('id', candidat.id);

  console.log(`Done: ${totalSent}/${volume} pour ${candidat.nom}`);
  return res.status(200).json({ received: true, sent: totalSent });
};
