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
      { name: 'Brake France', domain: 'brake.fr' },
      { name: 'Promocash', domain: 'promocash.fr' },
      { name: 'Davigel', domain: 'davigel.fr' },
      { name: 'Agrial', domain: 'agrial.fr' },
      { name: 'Schiever', domain: 'schiever.fr' },
      { name: 'Euralis', domain: 'euralis.fr' },
      { name: 'Vivescia', domain: 'vivescia.com' },
      { name: 'Axéréal', domain: 'axereal.com' },
      { name: 'InVivo', domain: 'invivo-group.com' },
      { name: 'Soufflet', domain: 'soufflet.com' },
      { name: 'Limagrain', domain: 'limagrain.com' },
      { name: 'Terrena', domain: 'terrena.fr' },
      { name: 'Biocoop', domain: 'biocoop.fr' },
      { name: 'Rungis Express', domain: 'rungisexpress.com' },
      { name: 'Leclerc', domain: 'e.leclerc' },
      { name: 'Intermarché', domain: 'intermarche.com' },
      { name: 'Lidl France', domain: 'lidl.fr' },
      { name: 'Aldi France', domain: 'aldi.fr' },
      { name: 'Picard', domain: 'picard.fr' },
      { name: 'Thiriet', domain: 'thiriet.com' },
      { name: 'Labeyrie', domain: 'labeyrie.fr' },
      { name: 'Galec', domain: 'galec.fr' },
      { name: 'Nicolas', domain: 'nicolas.com' },
      { name: 'Maïsadour', domain: 'maisadour.com' },
      { name: 'Arterris', domain: 'arterris.fr' },
    ],
    'Industrie': [
      { name: 'Schneider Electric', domain: 'se.com' },
      { name: 'Saint-Gobain', domain: 'saint-gobain.com' },
      { name: 'Faurecia', domain: 'faurecia.com' },
      { name: 'Legrand', domain: 'legrand.fr' },
      { name: 'Plastic Omnium', domain: 'plasticomnium.com' },
      { name: 'Safran', domain: 'safran-group.com' },
      { name: 'Thales', domain: 'thalesgroup.com' },
      { name: 'Airbus', domain: 'airbus.com' },
      { name: 'Michelin', domain: 'michelin.fr' },
      { name: 'Valeo', domain: 'valeo.com' },
      { name: 'ArcelorMittal', domain: 'arcelormittal.com' },
      { name: 'Alstom', domain: 'alstom.com' },
      { name: 'Nexans', domain: 'nexans.com' },
      { name: 'Lisi Group', domain: 'lisi-group.com' },
      { name: 'Daher', domain: 'daher.com' },
      { name: 'Latécoère', domain: 'latecoere.fr' },
      { name: 'Dassault Aviation', domain: 'dassault-aviation.com' },
      { name: 'Naval Group', domain: 'naval-group.com' },
      { name: 'Forvia', domain: 'forvia.com' },
      { name: 'Knauf', domain: 'knauf.fr' },
      { name: 'Sika', domain: 'sika.fr' },
      { name: 'Lafarge', domain: 'lafarge.fr' },
      { name: 'Holcim', domain: 'holcim.fr' },
      { name: 'Imerys', domain: 'imerys.com' },
      { name: 'Eramet', domain: 'eramet.com' },
      { name: 'Vallourec', domain: 'vallourec.com' },
      { name: 'Constellium', domain: 'constellium.com' },
      { name: 'SKF France', domain: 'skf.com' },
      { name: 'Bosch France', domain: 'bosch.fr' },
      { name: 'Siemens France', domain: 'siemens.fr' },
    ],
    'Automobile': [
      { name: 'Renault', domain: 'renault.fr' },
      { name: 'Stellantis', domain: 'stellantis.com' },
      { name: 'Norauto', domain: 'norauto.fr' },
      { name: 'Midas', domain: 'midas.fr' },
      { name: 'Speedy', domain: 'speedy.fr' },
      { name: 'Feu Vert', domain: 'feu-vert.fr' },
      { name: 'Euromaster', domain: 'euromaster.fr' },
      { name: 'Vulco', domain: 'vulco.fr' },
      { name: 'Dekra', domain: 'dekra.fr' },
      { name: 'LeasePlan', domain: 'leaseplan.fr' },
      { name: 'ALD Automotive', domain: 'aldautomotive.fr' },
      { name: 'Arval', domain: 'arval.fr' },
      { name: 'Toyota France', domain: 'toyota.fr' },
      { name: 'BMW France', domain: 'bmw.fr' },
      { name: 'Mercedes France', domain: 'mercedes-benz.fr' },
      { name: 'Volkswagen France', domain: 'volkswagen.fr' },
      { name: 'Audi France', domain: 'audi.fr' },
      { name: 'Peugeot', domain: 'peugeot.fr' },
      { name: 'Citroën', domain: 'citroen.fr' },
      { name: 'Dacia', domain: 'dacia.fr' },
      { name: 'Carglass', domain: 'carglass.fr' },
      { name: 'Aramis Auto', domain: 'aramisauto.com' },
      { name: 'Emil Frey', domain: 'emil-frey.fr' },
      { name: 'Autosphere', domain: 'autosphere.fr' },
      { name: 'Profil Plus', domain: 'profil-plus.fr' },
      { name: 'Roady', domain: 'roady.fr' },
      { name: 'Groupe Dubreuil', domain: 'dubreuil.fr' },
      { name: 'Ford France', domain: 'ford.fr' },
      { name: 'Opel France', domain: 'opel.fr' },
      { name: 'DS Automobiles', domain: 'ds-automobiles.fr' },
    ],
    'BTP / Construction': [
      { name: 'Vinci Construction', domain: 'vinci-construction.fr' },
      { name: 'Bouygues Construction', domain: 'bouygues-construction.com' },
      { name: 'Eiffage', domain: 'eiffage.com' },
      { name: 'NGE', domain: 'nge.fr' },
      { name: 'Spie Batignolles', domain: 'spiebatignolles.fr' },
      { name: 'Colas', domain: 'colas.fr' },
      { name: 'Eurovia', domain: 'eurovia.com' },
      { name: 'Apave', domain: 'apave.com' },
      { name: 'Bureau Veritas', domain: 'bureauveritas.fr' },
      { name: 'Socotec', domain: 'socotec.fr' },
      { name: 'Egis', domain: 'egis.fr' },
      { name: 'Nexity', domain: 'nexity.fr' },
      { name: 'Kaufman & Broad', domain: 'ketb.com' },
      { name: 'Bouygues Immobilier', domain: 'bouygues-immobilier.com' },
      { name: 'Fayat', domain: 'fayat.com' },
      { name: 'Léon Grosse', domain: 'leon-grosse.fr' },
      { name: 'GSE', domain: 'gse.fr' },
      { name: 'Icade', domain: 'icade.fr' },
      { name: 'Altarea', domain: 'altarea.com' },
      { name: 'Cogedim', domain: 'cogedim.com' },
      { name: 'CDC Habitat', domain: 'cdchabitat.fr' },
      { name: 'Soprema', domain: 'soprema.fr' },
      { name: 'Parexgroup', domain: 'parexgroup.com' },
      { name: 'Mapei', domain: 'mapei.fr' },
      { name: 'Siplast', domain: 'siplast.fr' },
      { name: 'Monier', domain: 'monier.fr' },
      { name: 'Wienerberger', domain: 'wienerberger.fr' },
      { name: 'Terreal', domain: 'terreal.fr' },
      { name: 'Razel-Bec', domain: 'razel-bec.com' },
      { name: 'Demathieu Bard', domain: 'demathieu-bard.fr' },
    ],
    'Logistique / Transport': [
      { name: 'Geodis', domain: 'geodis.com' },
      { name: 'XPO Logistics', domain: 'xpo.com' },
      { name: 'DB Schenker', domain: 'dbschenker.com' },
      { name: 'Kuehne Nagel', domain: 'kuehne-nagel.com' },
      { name: 'ID Logistics', domain: 'id-logistics.com' },
      { name: 'DHL France', domain: 'dhl.fr' },
      { name: 'Chronopost', domain: 'chronopost.fr' },
      { name: 'Mondial Relay', domain: 'mondialrelay.fr' },
      { name: 'FM Logistic', domain: 'fmlogistic.com' },
      { name: 'Gefco', domain: 'gefco.net' },
      { name: 'Bolloré Logistics', domain: 'bollore-logistics.com' },
      { name: 'CMA CGM', domain: 'cma-cgm.com' },
      { name: 'Transdev', domain: 'transdev.com' },
      { name: 'Keolis', domain: 'keolis.com' },
      { name: 'Heppner', domain: 'heppner.com' },
      { name: 'Dachser', domain: 'dachser.fr' },
      { name: 'Rhenus', domain: 'rhenus.fr' },
      { name: 'Stef', domain: 'stef.com' },
      { name: 'Savoye', domain: 'savoye.com' },
      { name: 'Hardis Group', domain: 'hardis-group.com' },
      { name: 'Mecalux', domain: 'mecalux.fr' },
      { name: 'Jungheinrich', domain: 'jungheinrich.fr' },
      { name: 'Toyota MH', domain: 'toyota-industries.fr' },
      { name: 'Linde MH', domain: 'linde-mh.fr' },
      { name: 'Manitou', domain: 'manitou.com' },
      { name: 'Fenwick', domain: 'fenwick.fr' },
      { name: 'Vanderlande', domain: 'vanderlande.com' },
      { name: 'Swisslog', domain: 'swisslog.com' },
      { name: 'Novatrans', domain: 'novatrans.fr' },
      { name: 'TNT France', domain: 'tnt.fr' },
    ],
    'Agroalimentaire': [
      { name: 'Danone', domain: 'danone.com' },
      { name: 'Lactalis', domain: 'lactalis.fr' },
      { name: 'Bigard', domain: 'bigard.fr' },
      { name: 'Savencia', domain: 'savencia.com' },
      { name: 'Bonduelle', domain: 'bonduelle.fr' },
      { name: 'Fleury Michon', domain: 'fleurymichon.fr' },
      { name: 'Cooperl', domain: 'cooperl.com' },
      { name: 'Panzani', domain: 'panzani.fr' },
      { name: 'Bel', domain: 'groupe-bel.com' },
      { name: 'Sodiaal', domain: 'sodiaal.fr' },
      { name: 'Yoplait', domain: 'yoplait.fr' },
      { name: 'Candia', domain: 'candia.fr' },
      { name: 'Materne', domain: 'materne.fr' },
      { name: 'Andros', domain: 'andros.fr' },
      { name: 'McCain', domain: 'mccain.fr' },
      { name: 'Findus', domain: 'findus.fr' },
      { name: 'Lindt', domain: 'lindt.fr' },
      { name: 'Ferrero France', domain: 'ferrero.fr' },
      { name: 'Mars France', domain: 'mars.com' },
      { name: 'Mondelez', domain: 'mondelezinternational.com' },
      { name: 'Haribo', domain: 'haribo.fr' },
      { name: 'Vico', domain: 'vico.fr' },
      { name: 'Elle & Vire', domain: 'elle-vire.com' },
      { name: 'Président', domain: 'president.fr' },
      { name: 'Entremont', domain: 'entremont.com' },
      { name: 'SVA Jean Rozé', domain: 'sva-jeanroze.fr' },
      { name: 'Elivia', domain: 'elivia.fr' },
      { name: 'William Saurin', domain: 'william-saurin.fr' },
      { name: 'Cofigeo', domain: 'cofigeo.fr' },
      { name: 'Lamb Weston', domain: 'lambweston.com' },
    ],
    'Retail / Commerce': [
      { name: 'Carrefour', domain: 'carrefour.fr' },
      { name: 'Leroy Merlin', domain: 'leroymerlin.fr' },
      { name: 'Decathlon', domain: 'decathlon.fr' },
      { name: 'Fnac Darty', domain: 'fnacdarty.com' },
      { name: 'Maisons du Monde', domain: 'maisonsdumonde.com' },
      { name: 'Zara France', domain: 'zara.com' },
      { name: 'H&M France', domain: 'hm.com' },
      { name: 'Kiabi', domain: 'kiabi.com' },
      { name: 'La Redoute', domain: 'laredoute.fr' },
      { name: 'Conforama', domain: 'conforama.fr' },
      { name: 'But', domain: 'but.fr' },
      { name: 'Ikea France', domain: 'ikea.com' },
      { name: 'Castorama', domain: 'castorama.fr' },
      { name: 'Brico Dépôt', domain: 'bricodepot.fr' },
      { name: 'Point P', domain: 'pointp.fr' },
      { name: 'Darty', domain: 'darty.com' },
      { name: 'Boulanger', domain: 'boulanger.com' },
      { name: 'Sephora', domain: 'sephora.fr' },
      { name: 'Nocibé', domain: 'nocibe.fr' },
      { name: 'Yves Rocher', domain: 'yves-rocher.fr' },
      { name: "L'Occitane", domain: 'loccitane.com' },
      { name: 'Cultura', domain: 'cultura.com' },
      { name: 'Joué Club', domain: 'joueclub.fr' },
      { name: 'King Jouet', domain: 'king-jouet.com' },
      { name: 'Jules', domain: 'jules.com' },
      { name: 'Celio', domain: 'celio.com' },
      { name: 'Grand Optical', domain: 'grandoptical.com' },
      { name: 'Optic 2000', domain: 'optic2000.com' },
      { name: 'Krys', domain: 'krys.com' },
      { name: 'Afflelou', domain: 'afflelou.com' },
    ],
    'Services B2B': [
      { name: 'Sodexo', domain: 'sodexo.com' },
      { name: 'Edenred', domain: 'edenred.fr' },
      { name: 'Manpower', domain: 'manpower.fr' },
      { name: 'Adecco', domain: 'adecco.fr' },
      { name: 'Randstad', domain: 'randstad.fr' },
      { name: 'Synergie', domain: 'synergie.fr' },
      { name: 'Groupe Crit', domain: 'groupecrit.fr' },
      { name: 'Proman', domain: 'proman.fr' },
      { name: 'Samsic', domain: 'samsic.fr' },
      { name: 'Elior', domain: 'elior.com' },
      { name: 'Compass Group', domain: 'compass-group.fr' },
      { name: 'Atalian', domain: 'atalian.fr' },
      { name: 'Onet', domain: 'onet.fr' },
      { name: 'ISS France', domain: 'issworld.com' },
      { name: 'Derichebourg', domain: 'derichebourg.com' },
      { name: 'Veolia', domain: 'veolia.fr' },
      { name: 'Suez', domain: 'suez.com' },
      { name: 'Engie', domain: 'engie.fr' },
      { name: 'TotalEnergies', domain: 'totalenergies.fr' },
      { name: 'EDF', domain: 'edf.fr' },
      { name: 'Dalkia', domain: 'dalkia.fr' },
      { name: 'Spie', domain: 'spie.com' },
      { name: 'Bouygues Energies', domain: 'bouygues-es.com' },
      { name: 'Eiffage Energie', domain: 'eiffage-energie.com' },
      { name: 'Axians', domain: 'axians.fr' },
      { name: 'Actemium', domain: 'actemium.fr' },
      { name: 'Securitas', domain: 'securitas.fr' },
      { name: 'Prosegur', domain: 'prosegur.fr' },
      { name: 'Ortec', domain: 'ortec.fr' },
      { name: 'Snef', domain: 'snef.fr' },
    ],
    'Tech / Numérique': [
      { name: 'Capgemini', domain: 'capgemini.com' },
      { name: 'Sopra Steria', domain: 'soprasteria.com' },
      { name: 'Atos', domain: 'atos.net' },
      { name: 'CGI', domain: 'cgi.com' },
      { name: 'Wavestone', domain: 'wavestone.com' },
      { name: 'Accenture France', domain: 'accenture.com' },
      { name: 'IBM France', domain: 'ibm.com' },
      { name: 'SAP France', domain: 'sap.com' },
      { name: 'Salesforce France', domain: 'salesforce.com' },
      { name: 'Microsoft France', domain: 'microsoft.com' },
      { name: 'Dassault Systèmes', domain: 'dassault-systemes.com' },
      { name: 'Criteo', domain: 'criteo.com' },
      { name: 'OVHcloud', domain: 'ovhcloud.com' },
      { name: 'Talend', domain: 'talend.com' },
      { name: 'Devoteam', domain: 'devoteam.com' },
      { name: 'Alten', domain: 'alten.fr' },
      { name: 'Aubay', domain: 'aubay.com' },
      { name: 'Cegid', domain: 'cegid.com' },
      { name: 'Sage France', domain: 'sage.com' },
      { name: 'Generix Group', domain: 'generixgroup.com' },
      { name: 'Axway', domain: 'axway.com' },
      { name: 'Ivalua', domain: 'ivalua.com' },
      { name: 'Coupa', domain: 'coupa.com' },
      { name: 'Inetum', domain: 'inetum.com' },
      { name: 'Econocom', domain: 'econocom.com' },
      { name: 'Business & Decision', domain: 'businessdecision.fr' },
      { name: 'Altran', domain: 'altran.com' },
      { name: 'Akka Technologies', domain: 'akka.eu' },
      { name: 'Berger-Levrault', domain: 'berger-levrault.com' },
      { name: 'SCC France', domain: 'scc.com' },
    ],
    'Santé / Pharma': [
      { name: 'Sanofi', domain: 'sanofi.com' },
      { name: 'Pierre Fabre', domain: 'pierre-fabre.com' },
      { name: 'Ipsen', domain: 'ipsen.com' },
      { name: 'Servier', domain: 'servier.fr' },
      { name: 'Biomérieux', domain: 'biomerieux.fr' },
      { name: 'Guerbet', domain: 'guerbet.com' },
      { name: 'Boiron', domain: 'boiron.fr' },
      { name: 'UPSA', domain: 'upsa.fr' },
      { name: 'Urgo', domain: 'urgo.fr' },
      { name: 'Hartmann', domain: 'hartmann.fr' },
      { name: 'Coloplast', domain: 'coloplast.fr' },
      { name: 'Baxter', domain: 'baxter.fr' },
      { name: 'B. Braun', domain: 'bbraun.fr' },
      { name: 'Fresenius', domain: 'fresenius.fr' },
      { name: 'Roche France', domain: 'roche.fr' },
      { name: 'Novartis France', domain: 'novartis.fr' },
      { name: 'Pfizer France', domain: 'pfizer.fr' },
      { name: 'AstraZeneca France', domain: 'astrazeneca.fr' },
      { name: 'Abbvie France', domain: 'abbvie.fr' },
      { name: 'Amgen France', domain: 'amgen.fr' },
      { name: 'Gilead France', domain: 'gilead.fr' },
      { name: 'Takeda France', domain: 'takeda.com' },
      { name: 'UCB Pharma', domain: 'ucb.com' },
      { name: 'Chiesi', domain: 'chiesi.fr' },
      { name: 'Leo Pharma', domain: 'leo-pharma.fr' },
      { name: 'Arkopharma', domain: 'arkopharma.fr' },
      { name: 'Weleda', domain: 'weleda.fr' },
      { name: 'Pileje', domain: 'pileje.com' },
      { name: 'Biocodex', domain: 'biocodex.fr' },
      { name: 'Cooper', domain: 'cooper.fr' },
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
