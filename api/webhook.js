// api/webhook.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;
const HUNTER_KEY      = process.env.HUNTER_API_KEY;
const BREVO_KEY       = process.env.BREVO_API_KEY;

const PLAN_VOLUMES = { '29€': 50, '59€': 150, '99€': 300 };

function getPlanVolume(plan) {
  for (const [key, vol] of Object.entries(PLAN_VOLUMES)) {
    if (plan && plan.includes(key)) return vol;
  }
  return 50;
}

async function findCompanies(secteur, ville, limit) {
  const DOMAINES_PAR_SECTEUR = {
    'Distribution / Négoce': [
      { name: 'Sysco France', domain: 'sysco.fr' },
      { name: 'Metro France', domain: 'metro.fr' },
      { name: 'Pomona', domain: 'pomona.fr' },
      { name: 'Transgourmet', domain: 'transgourmet.fr' },
      { name: 'Pro à Pro', domain: 'proapro.fr' },
    ],
    'Industrie': [
      { name: 'Schneider Electric', domain: 'se.com' },
      { name: 'Saint-Gobain', domain: 'saint-gobain.com' },
      { name: 'Faurecia', domain: 'faurecia.com' },
      { name: 'Legrand', domain: 'legrand.fr' },
      { name: 'Plastic Omnium', domain: 'plasticomnium.com' },
    ],
    'Automobile': [
      { name: 'Renault', domain: 'renault.fr' },
      { name: 'PSA Group', domain: 'stellantis.com' },
      { name: 'Norauto', domain: 'norauto.fr' },
      { name: 'Midas', domain: 'midas.fr' },
      { name: 'Speedy', domain: 'speedy.fr' },
    ],
    'BTP / Construction': [
      { name: 'Vinci Construction', domain: 'vinci-construction.fr' },
      { name: 'Bouygues Construction', domain: 'bouygues-construction.com' },
      { name: 'Eiffage', domain: 'eiffage.com' },
      { name: 'NGE', domain: 'nge.fr' },
      { name: 'Spie Batignolles', domain: 'spiebatignolles.fr' },
    ],
    'Logistique / Transport': [
      { name: 'Geodis', domain: 'geodis.com' },
      { name: 'XPO Logistics', domain: 'xpo.com' },
      { name: 'DB Schenker', domain: 'dbschenker.com' },
      { name: 'Kuehne Nagel', domain: 'kuehne-nagel.com' },
      { name: 'ID Logistics', domain: 'id-logistics.com' },
    ],
    'Agroalimentaire': [
      { name: 'Danone', domain: 'danone.com' },
      { name: 'Lactalis', domain: 'lactalis.fr' },
      { name: 'Bigard', domain: 'bigard.fr' },
      { name: 'Savencia', domain: 'savencia.com' },
      { name: 'Bonduelle', domain: 'bonduelle.fr' },
    ],
    'Retail / Commerce': [
      { name: 'Carrefour', domain: 'carrefour.fr' },
      { name: 'Leroy Merlin', domain: 'leroymerlin.fr' },
      { name: 'Decathlon', domain: 'decathlon.fr' },
      { name: 'Fnac Darty', domain: 'fnacdarty.com' },
      { name: 'Maisons du Monde', domain: 'maisonsdumonde.com' },
    ],
    'Services B2B': [
      { name: 'Sodexo', domain: 'sodexo.com' },
      { name: 'Edenred', domain: 'edenred.fr' },
      { name: 'Manpower', domain: 'manpower.fr' },
      { name: 'Adecco', domain: 'adecco.fr' },
      { name: 'Randstad', domain: 'randstad.fr' },
    ],
    'Tech / Numérique': [
      { name: 'Capgemini', domain: 'capgemini.com' },
      { name: 'Sopra Steria', domain: 'soprasteria.com' },
      { name: 'Atos', domain: 'atos.net' },
      { name: 'CGI', domain: 'cgi.com' },
      { name: 'Wavestone', domain: 'wavestone.com' },
    ],
    'Santé / Pharma': [
      { name: 'Sanofi', domain: 'sanofi.com' },
      { name: 'Pierre Fabre', domain: 'pierre-fabre.com' },
      { name: 'Ipsen', domain: 'ipsen.com' },
      { name: 'Servier', domain: 'servier.fr' },
      { name: 'Biomérieux', domain: 'biomerieux.fr' },
    ],
  };

  const liste = DOMAINES_PAR_SECTEUR[secteur] || [];
  return liste.slice(0, limit);
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
        .map(e => ({
          email: e.value,
          name: `${e.first_name || ''} ${e.last_name || ''}`.trim()
        }));
    }
  } catch(e) {
    console.error('Hunter error:', e.message);
  }
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
      <p>Cordialement,<br/>
      <strong>${candidat.nom}</strong><br/>
      ${candidat.email}<br/>
      ${candidat.tel || 'Non renseigné'}</p>
    </div>`;

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_KEY
      },
      body: JSON.stringify({
        sender: { name: candidat.nom, email: 'noreply@talentconnect-gold.vercel.app' },
        to: [{ email: to, name: toName || company }],
        replyTo: { email: candidat.email, name: candidat.nom },
        subject,
        htmlContent,
      }),
    });
    return res.ok;
  } catch(e) {
    console.error('Brevo error:', e.message);
    return false;
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
  const volume = getPlanVolume(candidat.plan);
  const secteurs = candidat.secteurs ? candidat.secteurs.split(',').map(s => s.trim()) : [];

  console.log(`Processing ${candidat.nom} — ${volume} envois`);

  await sb.from('candidatures')
    .update({ statut: "En cours d'envoi" })
    .eq('id', candidat.id);

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
