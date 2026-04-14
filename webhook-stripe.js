// api/api/webhook-stripe.js
// Vercel Serverless Function
// Déclenché automatiquement par Stripe après chaque paiement confirmé

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;
const HUNTER_KEY      = process.env.HUNTER_API_KEY;
const BREVO_KEY       = process.env.BREVO_API_KEY;
const STRIPE_SECRET   = process.env.STRIPE_SECRET_KEY;

// Mapping secteurs → mots-clés pour Hunter.io
const SECTEUR_KEYWORDS = {
  'Distribution / Négoce': ['distribution', 'negoce', 'grossiste'],
  'Industrie':             ['industrie', 'manufacturing', 'fabrication'],
  'Automobile':            ['automobile', 'automotive', 'garage', 'carrosserie'],
  'BTP / Construction':    ['btp', 'construction', 'batiment', 'travaux'],
  'Logistique / Transport':['logistique', 'transport', 'livraison', 'entrepot'],
  'Agroalimentaire':       ['agroalimentaire', 'alimentaire', 'food'],
  'Retail / Commerce':     ['commerce', 'retail', 'magasin', 'boutique'],
  'Services B2B':          ['services', 'conseil', 'consulting'],
  'Tech / Numérique':      ['tech', 'digital', 'software', 'informatique'],
  'Santé / Pharma':        ['sante', 'pharma', 'medical', 'clinique'],
};

// Nombre d'envois selon le plan
const PLAN_VOLUMES = {
  '29€': 50,
  '59€': 150,
  '99€': 300,
};

function getPlanVolume(plan) {
  for (const [key, vol] of Object.entries(PLAN_VOLUMES)) {
    if (plan && plan.includes(key)) return vol;
  }
  return 50;
}

// Recherche d'emails via Hunter.io Domain Search
async function searchEmails(domain) {
  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${HUNTER_KEY}&limit=3&type=personal`
    );
    const data = await res.json();
    if (data.data && data.data.emails) {
      return data.data.emails
        .filter(e => e.confidence > 70)
        .map(e => ({ email: e.value, name: `${e.first_name || ''} ${e.last_name || ''}`.trim(), company: data.data.organization }));
    }
  } catch(e) { console.error('Hunter error:', e.message); }
  return [];
}

// Recherche d'entreprises via Hunter.io Company Search
async function findCompanies(secteur, ville, limit) {
  const keywords = SECTEUR_KEYWORDS[secteur] || [secteur.toLowerCase()];
  const keyword = keywords[0];
  const companies = [];

  try {
    // Hunter.io ne fait pas de recherche géo directe, on utilise des domaines connus
    // En production, coupler avec une API INSEE/Pappers pour trouver les domaines
    const res = await fetch(
      `https://api.hunter.io/v2/companies/search?keyword=${keyword}&country=fr&api_key=${HUNTER_KEY}&limit=${Math.min(limit, 10)}`
    );
    const data = await res.json();
    if (data.data && data.data.companies) {
      companies.push(...data.data.companies.slice(0, limit));
    }
  } catch(e) { console.error('Hunter companies error:', e.message); }

  return companies;
}

// Envoi d'un email de candidature via Brevo
async function sendCandidature(to, toName, company, candidat) {
  const subject = `Candidature spontanée – ${candidat.poste} | ${candidat.nom}`;
  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
      <p>Madame, Monsieur,</p>
      <p>Je me permets de vous adresser ma candidature spontanée pour un poste de <strong>${candidat.poste}</strong> au sein de <strong>${company}</strong>.</p>
      ${candidat.message ? `<p>${candidat.message}</p>` : ''}
      <p>Fort(e) d'une expérience dans le secteur <strong>${candidat.secteurs}</strong>, je suis actuellement en recherche d'opportunités dans la région de <strong>${candidat.ville}</strong> (rayon ${candidat.rayon}).</p>
      <p>Je serais ravi(e) de vous présenter mon parcours lors d'un entretien.</p>
      <p>Dans l'attente de votre retour, je reste disponible par email ou téléphone.</p>
      <br/>
      <p>Cordialement,</p>
      <p><strong>${candidat.nom}</strong><br/>
      📧 ${candidat.email}<br/>
      📞 ${candidat.tel || 'Non renseigné'}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
      <p style="font-size:11px;color:#999">Ce message a été envoyé via TalentConnect · talentconnect-gold.vercel.app</p>
    </div>`;

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': BREVO_KEY,
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
}

// Handler principal Vercel
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let event;
  try {
    // Stripe envoie le body en raw — on parse directement
    event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch(e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // On ne traite que les paiements confirmés
  if (event.type !== 'checkout.session.completed' && event.type !== 'payment_intent.succeeded') {
    return res.status(200).json({ received: true, ignored: true });
  }

  const customerEmail = event.data?.object?.customer_email ||
                        event.data?.object?.receipt_email ||
                        event.data?.object?.charges?.data?.[0]?.billing_details?.email;

  if (!customerEmail) {
    console.log('No email found in Stripe event');
    return res.status(200).json({ received: true });
  }

  // Récupère la candidature depuis Supabase
  const sb = createClient(SUPABASE_URL, SUPABASE_SECRET);
  const { data: candidatures, error } = await sb
    .from('candidatures')
    .select('*')
    .eq('email', customerEmail)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !candidatures?.length) {
    console.error('Candidature not found for email:', customerEmail);
    return res.status(200).json({ received: true });
  }

  const candidat = candidatures[0];
  const volume = getPlanVolume(candidat.plan);
  const secteurs = candidat.secteurs ? candidat.secteurs.split(',').map(s => s.trim()) : [];

  console.log(`Processing candidature for ${candidat.nom} — ${volume} envois`);

  // Met le statut en "En cours d'envoi"
  await sb.from('candidatures').update({ statut: 'En cours d\'envoi' }).eq('id', candidat.id);

  let totalSent = 0;
  const errors = [];

  // Pour chaque secteur, cherche des entreprises et envoie
  for (const secteur of secteurs) {
    if (totalSent >= volume) break;
    const remaining = volume - totalSent;
    const companies = await findCompanies(secteur, candidat.ville, Math.min(remaining, 10));

    for (const company of companies) {
      if (totalSent >= volume) break;
      if (!company.domain) continue;

      const contacts = await searchEmails(company.domain);
      for (const contact of contacts) {
        if (totalSent >= volume) break;
        const sent = await sendCandidature(contact.email, contact.name, company.name || company.domain, candidat);
        if (sent) {
          totalSent++;
          console.log(`Sent to ${contact.email} (${company.name}) — total: ${totalSent}`);
        } else {
          errors.push(contact.email);
        }
        // Pause 200ms entre envois pour éviter le spam
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }

  // Met à jour le statut final dans Supabase
  await sb.from('candidatures').update({
    statut: 'Envoyé',
    message: candidat.message + `\n\n[AUTO] ${totalSent} candidatures envoyées le ${new Date().toLocaleDateString('fr-FR')}`
  }).eq('id', candidat.id);

  console.log(`Done: ${totalSent}/${volume} envois pour ${candidat.nom}`);
  return res.status(200).json({ received: true, sent: totalSent });
};
