// api/process-candidatures.js
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

const FALLBACK_EMAILS = ['rh', 'recrutement', 'contact', 'jobs', 'carriere'];

// ─── EXTRACTION DES INFOS DU CV ───────────────────────────────────────────────

function extraireFormation(cvTexte) {
  if (!cvTexte) return null;
  const lignes = cvTexte.split(/[\n.]/);
  const motsCles = ['master', 'licence', 'bachelor', 'bts', 'dut', 'mba', 'école', 'ecole', 'université', 'university', 'formation', 'diplôme'];
  for (const ligne of lignes) {
    const l = ligne.toLowerCase();
    if (motsCles.some(m => l.includes(m)) && ligne.trim().length > 10) {
      return ligne.trim().slice(0, 120);
    }
  }
  return null;
}

function extraireCompetences(cvTexte, secteur) {
  if (!cvTexte) return [];
  
  const competencesParSecteur = {
    'Logistique / Transport': ['logistique', 'transport', 'supply chain', 'approvisionnement', 'stock', 'entrepôt', 'livraison', 'achats', 'fournisseur'],
    'Finance / Banque': ['comptabilité', 'finance', 'audit', 'trésorerie', 'bilan', 'fiscal', 'budget', 'contrôle de gestion', 'sage', 'erp'],
    'Tech / Numérique': ['développement', 'python', 'javascript', 'sql', 'data', 'informatique', 'web', 'digital', 'agile', 'scrum'],
    'Industrie': ['production', 'qualité', 'lean', 'maintenance', 'process', 'normes', 'iso', 'sécurité', 'mécanique'],
    'Commerce / Retail': ['vente', 'commercial', 'négociation', 'client', 'marketing', 'crm', 'prospection'],
    'Santé / Pharma': ['médical', 'pharmaceutique', 'clinique', 'réglementation', 'bpm', 'qualité'],
    'Ressources Humaines': ['recrutement', 'formation', 'paie', 'social', 'rh', 'talent', 'gpec'],
    'Conseil / Audit': ['conseil', 'audit', 'stratégie', 'analyse', 'projet', 'management', 'transformation'],
  };

  const motsGeneraux = ['gestion', 'organisation', 'communication', 'analyse', 'management', 'project', 'équipe', 'rigueur', 'autonomie', 'excel', 'pack office', 'anglais'];
  
  const motsRecherches = [
    ...(competencesParSecteur[secteur] || []),
    ...motsGeneraux
  ];

  const cvLower = cvTexte.toLowerCase();
  const trouvees = [];
  
  for (const mot of motsRecherches) {
    if (cvLower.includes(mot) && trouvees.length < 3) {
      trouvees.push(mot.charAt(0).toUpperCase() + mot.slice(1));
    }
  }

  return trouvees.length > 0 ? trouvees : ['gestion de projet', 'travail en équipe', 'adaptabilité'];
}

function extraireExperience(cvTexte) {
  if (!cvTexte) return null;
  const lignes = cvTexte.split(/[\n]/);
  const motsCles = ['stage', 'alternance', 'cdi', 'cdd', 'assistant', 'chargé', 'responsable', 'manager', 'coordinateur', 'analyste', 'consultant'];
  for (const ligne of lignes) {
    const l = ligne.toLowerCase();
    if (motsCles.some(m => l.includes(m)) && ligne.trim().length > 15 && ligne.trim().length < 150) {
      return ligne.trim();
    }
  }
  return null;
}

function extraireEcole(cvTexte) {
  if (!cvTexte) return null;
  const ecoles = ['ecema', 'emlyon', 'hec', 'essec', 'escp', 'kedge', 'skema', 'edhec', 'audencia', 'burgundy', 'iae', 'inseec', 'igs', 'cesi', 'bsc', 'paris', 'lyon', 'grenoble', 'université', 'school'];
  const lignes = cvTexte.split(/[\n]/);
  for (const ligne of lignes) {
    const l = ligne.toLowerCase();
    if (ecoles.some(e => l.includes(e)) && ligne.trim().length > 5) {
      return ligne.trim().slice(0, 80);
    }
  }
  return null;
}

function getSituationActuelle(cvTexte, contrat) {
  const formation = extraireFormation(cvTexte);
  const experience = extraireExperience(cvTexte);
  const ecole = extraireEcole(cvTexte);

  if (formation) return `en formation (${formation.slice(0, 80)})`;
  if (ecole) return `étudiant(e) à ${ecole}`;
  if (experience) return `fort(e) d'une expérience en ${experience.slice(0, 60)}`;
  return 'en recherche active d\'opportunités professionnelles';
}

function getMissionsSecteur(secteur, company) {
  const missions = {
    'Logistique / Transport': `optimiser vos flux logistiques et renforcer la performance de votre chaîne d'approvisionnement`,
    'Finance / Banque': `contribuer à la fiabilité de vos processus financiers et soutenir vos équipes comptables`,
    'Tech / Numérique': `accompagner vos projets digitaux et contribuer au développement de vos solutions technologiques`,
    'Industrie': `soutenir vos processus industriels et contribuer à l'amélioration continue de votre production`,
    'Distribution / Négoce': `optimiser vos processus d'achats et renforcer vos relations fournisseurs`,
    'Retail / Commerce': `développer votre performance commerciale et renforcer la satisfaction client`,
    'Santé / Pharma': `soutenir vos équipes dans le respect des réglementations et l'amélioration de vos processus`,
    'Ressources Humaines': `accompagner vos équipes RH et contribuer au développement de vos talents`,
    'Conseil / Audit': `apporter une valeur ajoutée analytique et accompagner vos missions de conseil`,
    'BTP / Construction': `contribuer à la réussite de vos projets et renforcer vos équipes terrain`,
    'Agroalimentaire': `soutenir vos opérations et contribuer à la qualité de votre production`,
    'Énergie / Environnement': `accompagner votre transition énergétique et renforcer vos équipes opérationnelles`,
  };
  return missions[secteur] || `contribuer activement au développement de ${company} et soutenir vos équipes`;
}

function getAspectEntreprise(secteur, company) {
  const aspects = {
    'Logistique / Transport': `votre positionnement de leader dans la gestion des flux logistiques`,
    'Finance / Banque': `votre engagement envers la rigueur financière et l'accompagnement de vos clients`,
    'Tech / Numérique': `votre culture d'innovation et vos projets de transformation digitale`,
    'Industrie': `votre expertise industrielle et votre engagement qualité`,
    'Distribution / Négoce': `votre réseau de distribution et votre capacité à créer de la valeur`,
    'Retail / Commerce': `votre approche centrée client et votre dynamisme commercial`,
    'Santé / Pharma': `votre engagement envers la santé et l'amélioration de la vie des patients`,
    'Ressources Humaines': `votre approche innovante du management des talents`,
    'Conseil / Audit': `votre expertise reconnue et votre capacité d'accompagnement des entreprises`,
    'BTP / Construction': `vos projets ambitieux et votre savoir-faire dans le secteur de la construction`,
    'Agroalimentaire': `votre engagement envers la qualité et l'innovation dans le secteur alimentaire`,
    'Énergie / Environnement': `votre engagement dans la transition énergétique et le développement durable`,
  };
  return aspects[secteur] || `votre réputation d'excellence et votre dynamisme dans le secteur ${secteur}`;
}

// ─── GÉNÉRATION DE LA LETTRE ──────────────────────────────────────────────────

function generateLettre(candidat, company, secteur, contactName) {
  const prenom = contactName ? contactName.split(' ')[0] : null;
  const salutation = prenom ? `Madame, Monsieur ${prenom},` : 'Madame, Monsieur,';
  const contrat = candidat.contrats || 'CDI';
  const isAlternance = contrat.toLowerCase().includes('alternance');
  const isStage = contrat.toLowerCase().includes('stage');
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const cvTexte = candidat.cv_texte || '';
  const competences = extraireCompetences(cvTexte, secteur);
  const situationActuelle = getSituationActuelle(cvTexte, contrat);
  const comp1 = competences[0] || 'gestion de projet';
  const comp2 = competences[1] || 'travail en équipe';
  const comp3 = competences[2] || 'adaptabilité';
  const missions = getMissionsSecteur(secteur, company);
  const aspectEntreprise = getAspectEntreprise(secteur, company);

  let paragrapheContrat = '';
  if (isAlternance) {
    paragrapheContrat = `\nJe tiens également à préciser que le coût de cette alternance serait réduit pour votre société grâce au plan d'aide à l'apprentissage. Votre OPCO prendra en charge tout ou partie des frais de scolarité ainsi qu'une part de mon salaire à hauteur de 5 000€.\n`;
  } else if (isStage) {
    paragrapheContrat = `\nCe stage s'inscrit dans le cadre de ma formation et constitue pour moi une étape déterminante pour consolider mes compétences professionnelles.\n`;
  }

  const lettre = `${candidat.nom}
${candidat.tel || ''}
${candidat.email || ''}

À l'attention du Responsable du Recrutement
${company}

À ${candidat.ville || 'Lyon'}, le ${today}

Objet : Candidature spontanée – ${contrat} – ${candidat.poste}

${salutation}

C'est avec un grand intérêt que je suis l'évolution de ${company}, notamment pour ${aspectEntreprise}. Souhaitant mettre mes compétences au service d'une structure reconnue dans le secteur ${secteur}, je vous adresse ma candidature spontanée pour un poste de ${candidat.poste}.

Actuellement ${situationActuelle}, j'ai développé une expertise en ${comp1} et ${comp2}. Mon parcours m'a également permis de renforcer mes compétences en ${comp3}, que je souhaite aujourd'hui mobiliser au sein de vos équipes.

Intégrer ${company} représente pour moi l'opportunité de ${missions}. Rigoureux(se), autonome et doté(e) d'un excellent esprit d'équipe, je suis prêt(e) à m'investir pleinement dans les missions que vous pourriez me confier.
${paragrapheContrat}
Je serais ravi(e) de vous exposer plus en détail mes motivations et mon projet professionnel lors d'un entretien à votre convenance. Vous trouverez mon CV en pièce jointe.

Dans l'attente de votre retour, je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.

${candidat.nom}
${candidat.tel || ''}`;

  return lettre;
}

// ─── DOMAINES PAR SECTEUR ─────────────────────────────────────────────────────

const DOMAINES_PAR_SECTEUR = {
  'Distribution / Négoce': [
    { name: 'Sysco France', domain: 'sysco.fr' },
    { name: 'Metro France', domain: 'metro.fr' },
    { name: 'Pomona', domain: 'pomona.fr' },
    { name: 'Transgourmet', domain: 'transgourmet.fr' },
    { name: 'Brake France', domain: 'brake.fr' },
    { name: 'Agrial', domain: 'agrial.fr' },
    { name: 'Biocoop', domain: 'biocoop.fr' },
    { name: 'Leclerc', domain: 'e.leclerc' },
    { name: 'Intermarché', domain: 'intermarche.com' },
    { name: 'Lidl France', domain: 'lidl.fr' },
  ],
  'Industrie': [
    { name: 'Schneider Electric', domain: 'se.com' },
    { name: 'Saint-Gobain', domain: 'saint-gobain.com' },
    { name: 'Faurecia', domain: 'faurecia.com' },
    { name: 'Legrand', domain: 'legrand.fr' },
    { name: 'Safran', domain: 'safran-group.com' },
    { name: 'Thales', domain: 'thalesgroup.com' },
    { name: 'Airbus', domain: 'airbus.com' },
    { name: 'Michelin', domain: 'michelin.fr' },
    { name: 'Valeo', domain: 'valeo.com' },
    { name: 'Alstom', domain: 'alstom.com' },
  ],
  'Automobile': [
    { name: 'Renault', domain: 'renault.fr' },
    { name: 'Stellantis', domain: 'stellantis.com' },
    { name: 'Norauto', domain: 'norauto.fr' },
    { name: 'Midas', domain: 'midas.fr' },
    { name: 'Feu Vert', domain: 'feu-vert.fr' },
    { name: 'Euromaster', domain: 'euromaster.fr' },
    { name: 'Toyota France', domain: 'toyota.fr' },
    { name: 'BMW France', domain: 'bmw.fr' },
    { name: 'Peugeot', domain: 'peugeot.fr' },
    { name: 'Volkswagen France', domain: 'volkswagen.fr' },
  ],
  'BTP / Construction': [
    { name: 'Vinci Construction', domain: 'vinci-construction.fr' },
    { name: 'Bouygues Construction', domain: 'bouygues-construction.com' },
    { name: 'Eiffage', domain: 'eiffage.com' },
    { name: 'NGE', domain: 'nge.fr' },
    { name: 'Colas', domain: 'colas.fr' },
    { name: 'Bureau Veritas', domain: 'bureauveritas.fr' },
    { name: 'Nexity', domain: 'nexity.fr' },
    { name: 'Fayat', domain: 'fayat.com' },
    { name: 'Kaufman & Broad', domain: 'ketb.com' },
    { name: 'Léon Grosse', domain: 'leon-grosse.fr' },
  ],
  'Logistique / Transport': [
    { name: 'Geodis', domain: 'geodis.com' },
    { name: 'XPO Logistics', domain: 'xpo.com' },
    { name: 'DB Schenker', domain: 'dbschenker.com' },
    { name: 'Kuehne Nagel', domain: 'kuehne-nagel.com' },
    { name: 'ID Logistics', domain: 'id-logistics.com' },
    { name: 'DHL France', domain: 'dhl.fr' },
    { name: 'FM Logistic', domain: 'fmlogistic.com' },
    { name: 'CMA CGM', domain: 'cma-cgm.com' },
    { name: 'Stef', domain: 'stef.com' },
    { name: 'Dachser', domain: 'dachser.fr' },
  ],
  'Agroalimentaire': [
    { name: 'Danone', domain: 'danone.com' },
    { name: 'Lactalis', domain: 'lactalis.fr' },
    { name: 'Bonduelle', domain: 'bonduelle.fr' },
    { name: 'Fleury Michon', domain: 'fleurymichon.fr' },
    { name: 'Bel', domain: 'groupe-bel.com' },
    { name: 'Andros', domain: 'andros.fr' },
    { name: 'McCain', domain: 'mccain.fr' },
    { name: 'Ferrero France', domain: 'ferrero.fr' },
    { name: 'Mars France', domain: 'mars.com' },
    { name: 'Candia', domain: 'candia.fr' },
  ],
  'Retail / Commerce': [
    { name: 'Carrefour', domain: 'carrefour.fr' },
    { name: 'Leroy Merlin', domain: 'leroymerlin.fr' },
    { name: 'Decathlon', domain: 'decathlon.fr' },
    { name: 'Fnac Darty', domain: 'fnacdarty.com' },
    { name: 'Ikea France', domain: 'ikea.com' },
    { name: 'Castorama', domain: 'castorama.fr' },
    { name: 'Boulanger', domain: 'boulanger.com' },
    { name: 'Sephora', domain: 'sephora.fr' },
    { name: 'Kiabi', domain: 'kiabi.com' },
    { name: 'La Redoute', domain: 'laredoute.fr' },
  ],
  'Services B2B': [
    { name: 'Sodexo', domain: 'sodexo.com' },
    { name: 'Manpower', domain: 'manpower.fr' },
    { name: 'Adecco', domain: 'adecco.fr' },
    { name: 'Randstad', domain: 'randstad.fr' },
    { name: 'Elior', domain: 'elior.com' },
    { name: 'Veolia', domain: 'veolia.fr' },
    { name: 'Engie', domain: 'engie.fr' },
    { name: 'Securitas', domain: 'securitas.fr' },
    { name: 'Spie', domain: 'spie.com' },
    { name: 'Onet', domain: 'onet.fr' },
  ],
  'Tech / Numérique': [
    { name: 'Capgemini', domain: 'capgemini.com' },
    { name: 'Sopra Steria', domain: 'soprasteria.com' },
    { name: 'Atos', domain: 'atos.net' },
    { name: 'CGI', domain: 'cgi.com' },
    { name: 'Accenture France', domain: 'accenture.com' },
    { name: 'Dassault Systèmes', domain: 'dassault-systemes.com' },
    { name: 'OVHcloud', domain: 'ovhcloud.com' },
    { name: 'Alten', domain: 'alten.fr' },
    { name: 'Cegid', domain: 'cegid.com' },
    { name: 'Sage France', domain: 'sage.com' },
  ],
  'Santé / Pharma': [
    { name: 'Sanofi', domain: 'sanofi.com' },
    { name: 'Pierre Fabre', domain: 'pierre-fabre.com' },
    { name: 'Ipsen', domain: 'ipsen.com' },
    { name: 'Servier', domain: 'servier.fr' },
    { name: 'Biomérieux', domain: 'biomerieux.fr' },
    { name: 'Roche France', domain: 'roche.fr' },
    { name: 'Pfizer France', domain: 'pfizer.fr' },
    { name: 'Novartis France', domain: 'novartis.fr' },
    { name: 'AstraZeneca France', domain: 'astrazeneca.fr' },
    { name: 'Boiron', domain: 'boiron.fr' },
  ],
  'Finance / Banque': [
    { name: 'BNP Paribas', domain: 'bnpparibas.fr' },
    { name: 'Société Générale', domain: 'societegenerale.fr' },
    { name: 'Crédit Agricole', domain: 'credit-agricole.fr' },
    { name: 'Crédit Mutuel', domain: 'creditmutuel.fr' },
    { name: 'AXA France', domain: 'axa.fr' },
    { name: 'Allianz France', domain: 'allianz.fr' },
    { name: 'Natixis', domain: 'natixis.com' },
    { name: 'Amundi', domain: 'amundi.fr' },
    { name: 'Maif', domain: 'maif.fr' },
    { name: 'LCL', domain: 'lcl.fr' },
  ],
  'Immobilier': [
    { name: 'Nexity', domain: 'nexity.fr' },
    { name: 'Orpi', domain: 'orpi.com' },
    { name: 'Century 21', domain: 'century21.fr' },
    { name: 'Foncia', domain: 'foncia.com' },
    { name: 'Citya', domain: 'citya.com' },
    { name: 'Laforêt', domain: 'laforet.com' },
    { name: 'Gecina', domain: 'gecina.fr' },
    { name: 'Covivio', domain: 'covivio.eu' },
    { name: 'Vinci Immobilier', domain: 'vinci-immobilier.com' },
    { name: 'Bouygues Immobilier', domain: 'bouygues-immobilier.com' },
  ],
  'Hôtellerie / Restauration': [
    { name: 'Accor', domain: 'accor.com' },
    { name: 'B&B Hotels', domain: 'hotel-bb.com' },
    { name: "McDonald's France", domain: 'mcdonalds.fr' },
    { name: 'Burger King France', domain: 'burgerking.fr' },
    { name: 'Elior', domain: 'elior.com' },
    { name: 'Sodexo', domain: 'sodexo.com' },
    { name: 'Novotel', domain: 'novotel.com' },
    { name: 'Ibis', domain: 'ibis.com' },
    { name: 'Marriott France', domain: 'marriott.fr' },
    { name: 'Areas', domain: 'areas.com' },
  ],
  'Éducation / Formation': [
    { name: 'Groupe IGS', domain: 'groupe-igs.fr' },
    { name: 'Groupe INSEEC', domain: 'inseec.com' },
    { name: 'EM Lyon', domain: 'emlyon.com' },
    { name: 'Cesi', domain: 'cesi.fr' },
    { name: 'Afpa', domain: 'afpa.fr' },
    { name: 'Cegos', domain: 'cegos.fr' },
    { name: 'OpenClassrooms', domain: 'openclassrooms.com' },
    { name: 'HEC Paris', domain: 'hec.edu' },
    { name: 'ESSEC', domain: 'essec.edu' },
    { name: 'ESCP', domain: 'escp.eu' },
  ],
  'Énergie / Environnement': [
    { name: 'EDF', domain: 'edf.fr' },
    { name: 'Engie', domain: 'engie.fr' },
    { name: 'TotalEnergies', domain: 'totalenergies.fr' },
    { name: 'Veolia', domain: 'veolia.fr' },
    { name: 'Suez', domain: 'suez.com' },
    { name: 'Enedis', domain: 'enedis.fr' },
    { name: 'Paprec', domain: 'paprec.com' },
    { name: 'Dalkia', domain: 'dalkia.fr' },
    { name: 'Neoen', domain: 'neoen.com' },
    { name: 'Voltalia', domain: 'voltalia.com' },
  ],
  'Ressources Humaines': [
    { name: 'Manpower', domain: 'manpower.fr' },
    { name: 'Adecco', domain: 'adecco.fr' },
    { name: 'Randstad', domain: 'randstad.fr' },
    { name: 'Michael Page', domain: 'michaelpage.fr' },
    { name: 'Hays France', domain: 'hays.fr' },
    { name: 'Fed Group', domain: 'fedgroup.fr' },
    { name: 'Synergie', domain: 'synergie.fr' },
    { name: 'Proman', domain: 'proman.fr' },
    { name: 'Groupe Crit', domain: 'groupecrit.fr' },
    { name: 'Expectra', domain: 'expectra.fr' },
  ],
  'Conseil / Audit': [
    { name: 'Deloitte France', domain: 'deloitte.fr' },
    { name: 'PwC France', domain: 'pwc.fr' },
    { name: 'KPMG France', domain: 'kpmg.fr' },
    { name: 'EY France', domain: 'ey.com' },
    { name: 'McKinsey France', domain: 'mckinsey.com' },
    { name: 'BCG France', domain: 'bcg.com' },
    { name: 'Mazars', domain: 'mazars.fr' },
    { name: 'Grant Thornton', domain: 'grantthornton.fr' },
    { name: 'Wavestone', domain: 'wavestone.com' },
    { name: 'Sia Partners', domain: 'sia-partners.com' },
  ],
};

async function findCompanies(secteur, limit) {
  const liste = DOMAINES_PAR_SECTEUR[secteur] || [];
  return liste.slice(0, limit);
}

async function searchEmails(domain) {
  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${HUNTER_KEY}&limit=3&type=personal`
    );
    const data = await res.json();
    if (data.data && data.data.emails && data.data.emails.length > 0) {
      const filtered = data.data.emails
        .filter(e => e.confidence > 70)
        .map(e => ({ email: e.value, name: `${e.first_name || ''} ${e.last_name || ''}`.trim() }));
      if (filtered.length > 0) return filtered;
    }
  } catch(e) {
    console.error('Hunter error:', e.message);
  }
  console.log(`Hunter: 0 résultat pour ${domain} — fallback générique`);
  return FALLBACK_EMAILS.slice(0, 2).map(prefix => ({ email: `${prefix}@${domain}`, name: '' }));
}

async function sendCandidature(to, toName, company, secteur, candidat) {
  const lettre = generateLettre(candidat, company, secteur, toName);

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;color:#333;line-height:1.8;font-size:15px">
      ${lettre.replace(/\n/g, '<br/>')}
    </div>`;

  let attachments = [];
  if (candidat.cv_url) {
    try {
      const cvRes = await fetch(candidat.cv_url);
      if (cvRes.ok) {
        const cvBuffer = await cvRes.arrayBuffer();
        if (cvBuffer.byteLength > 0) {
          const cvBase64 = Buffer.from(cvBuffer).toString('base64');
          const cvNom = candidat.cv || 'CV.pdf';
          attachments = [{ content: cvBase64, name: cvNom, type: 'application/pdf' }];
          console.log(`CV chargé: ${cvNom} (${cvBuffer.byteLength} bytes)`);
        }
      } else {
        console.error(`CV fetch failed: HTTP ${cvRes.status}`);
      }
    } catch(e) {
      console.error('CV download error:', e.message);
    }
  }

  try {
    const body = {
      sender: { name: 'TalentConnect', email: 'julienfranck30@gmail.com' },
      // ⚠️ MODE TEST — pour production: to: [{ email: to, name: toName || company }],
      to: [{ email: 'julienfranck30@gmail.com', name: 'TEST' }],
      replyTo: { email: candidat.email, name: candidat.nom },
      subject: `Candidature spontanée – ${candidat.poste} | ${candidat.nom} → ${company}`,
      htmlContent,
    };

    if (attachments.length > 0) body.attachment = attachments;

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': BREVO_KEY },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Brevo error ${res.status}: ${errText}`);
      return false;
    }
    return true;
  } catch(e) {
    console.error('Brevo error:', e.message);
    return false;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SECRET);

  const { data: candidatures, error } = await sb
    .from('candidatures')
    .select('*')
    .eq('statut', 'Payé')
    .order('created_at', { ascending: true })
    .limit(3);

  if (error) {
    console.error('Supabase error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  if (!candidatures?.length) {
    console.log('Aucune candidature à traiter');
    return res.status(200).json({ processed: 0 });
  }

  let totalProcessed = 0;

  for (const candidat of candidatures) {
    const volume = getPlanVolume(candidat.plan);
    const secteurs = candidat.secteurs
      ? candidat.secteurs.split(',').map(s => s.trim())
      : [];

    console.log(`Traitement de ${candidat.nom} — ${volume} envois`);
    await sb.from('candidatures').update({ statut: "En cours d'envoi" }).eq('id', candidat.id);

    let totalSent = 0;

    for (const secteur of secteurs) {
      if (totalSent >= volume) break;
      const companies = await findCompanies(secteur, Math.min(volume - totalSent, 10));

      for (const company of companies) {
        if (totalSent >= volume) break;
        const contacts = await searchEmails(company.domain);
        for (const contact of contacts) {
          if (totalSent >= volume) break;
          const sent = await sendCandidature(contact.email, contact.name, company.name, secteur, candidat);
          if (sent) {
            totalSent++;
            console.log(`Envoyé à ${contact.email} (${company.name}) — total: ${totalSent}`);
          }
          await new Promise(r => setTimeout(r, 300));
        }
      }
    }

    await sb.from('candidatures').update({
      statut: 'Envoyé',
      message: (candidat.message || '') + `\n\n[AUTO] ${totalSent} candidatures envoyées le ${new Date().toLocaleDateString('fr-FR')}`
    }).eq('id', candidat.id);

    console.log(`Terminé: ${totalSent}/${volume} pour ${candidat.nom}`);
    totalProcessed++;
  }

  return res.status(200).json({ processed: totalProcessed });
};
