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

function nettoyerTexte(texte) {
  return texte.replace(/\s+/g, ' ').trim();
}

function extraireFormation(cvTexte, nomCandidat) {
  if (!cvTexte) return null;
  const lignes = cvTexte.split('\n').filter(l => l.trim().length > 5);
  const motsDiplome = ['master', 'licence', 'bachelor', 'bts', 'dut', 'mba', 'msc', 'master 2', 'master 1', 'grande école', 'programme grandes ecoles'];
  const motsEcole = ['school', 'ecema', 'emlyon', 'hec', 'essec', 'escp', 'kedge', 'skema', 'edhec', 'iae', 'inseec', 'igs', 'cesi', 'burgundy', 'université', 'university', 'business school', 'école de commerce', 'école supérieure'];
  for (const ligne of lignes) {
    const l = ligne.toLowerCase();
    if (nomCandidat && l.includes(nomCandidat.toLowerCase().split(' ')[0])) continue;
    if (motsDiplome.some(m => l.includes(m))) return nettoyerTexte(ligne).slice(0, 100);
  }
  for (const ligne of lignes) {
    const l = ligne.toLowerCase();
    if (nomCandidat && l.includes(nomCandidat.toLowerCase().split(' ')[0])) continue;
    if (motsEcole.some(m => l.includes(m))) return nettoyerTexte(ligne).slice(0, 100);
  }
  return null;
}

function extraireCompetences(cvTexte, nomCandidat, poste) {
  if (!cvTexte) return ['gestion administrative', 'travail en équipe', 'rigueur et sens du détail'];
  const posteLower = (poste || '').toLowerCase();
  const sectionsRegex = /comp[eé]tences?\s*[:\n]?([\s\S]{10,600})(?:atouts|centres d.int[eé]r[eê]t|informatique|langues|exp[eé]riences|dipl[oô]mes|formations|r[eé]seaux|$)/i;
  const match = cvTexte.match(sectionsRegex);
  if (match) {
    const bloc = match[1];
    const lignes = bloc.split(/[\n]/)
      .map(l => l.trim())
      .filter(l => l.length > 3 && l.length < 80)
      .filter(l => !/^(et|de|du|des|les|la|le|un|une|\d+)$/i.test(l));
    if (lignes.length >= 2) {
      const prioritaires = [];
      const autres = [];
      for (const ligne of lignes) {
        const l = ligne.toLowerCase();
        const estPertinent = (
          (posteLower.includes('achat') && (l.includes('achat') || l.includes('approvision') || l.includes('négociation') || l.includes('fournisseur') || l.includes('sourcing') || l.includes('stock'))) ||
          (posteLower.includes('approvision') && (l.includes('approvision') || l.includes('stock') || l.includes('erp') || l.includes('négociation'))) ||
          (posteLower.includes('logistique') && (l.includes('logistique') || l.includes('stock') || l.includes('transport'))) ||
          (posteLower.includes('comptab') && (l.includes('comptab') || l.includes('financ') || l.includes('sage') || l.includes('rapprochement') || l.includes('déclaration'))) ||
          (posteLower.includes('rh') && (l.includes('recrutement') || l.includes('paie') || l.includes('formation'))) ||
          (posteLower.includes('data') && (l.includes('données') || l.includes('power bi') || l.includes('excel') || l.includes('sql'))) ||
          (posteLower.includes('commercial') && (l.includes('vente') || l.includes('négociation') || l.includes('crm'))) ||
          (posteLower.includes('financ') && (l.includes('financ') || l.includes('comptab') || l.includes('trésor') || l.includes('budget'))) ||
          (posteLower.includes('audit') && (l.includes('audit') || l.includes('contrôle') || l.includes('conformité')))
        );
        if (estPertinent) prioritaires.push(ligne);
        else autres.push(ligne);
      }
      const selection = [...prioritaires, ...autres].slice(0, 3);
      if (selection.length >= 2) return selection;
    }
  }
  const cvLower = cvTexte.toLowerCase();
  const motsCles = [
    'approvisionnement', 'négociation', 'sourcing', 'gestion de stocks', 'supply chain',
    'erp', 'power bi', 'excel', 'pack office', 'tableaux de bord', 'reporting',
    'comptabilité', 'audit', 'recrutement', 'paie', 'marketing', 'communication',
    'gestion de projet', 'agile', 'lean', 'qualité', 'analyse de données',
    'rapprochements bancaires', 'états financiers', 'déclarations fiscales', 'trésorerie'
  ];
  const trouvees = [];
  for (const mot of motsCles) {
    if (cvLower.includes(mot) && trouvees.length < 3) {
      trouvees.push(mot.charAt(0).toUpperCase() + mot.slice(1));
    }
  }
  return trouvees.length >= 2 ? trouvees : ['gestion administrative', 'travail en équipe', 'rigueur et sens du détail'];
}

function extraireSituation(cvTexte, nomCandidat, contrat) {
  if (!cvTexte) return 'en recherche active d\'opportunités professionnelles';
  const formation = extraireFormation(cvTexte, nomCandidat);
  const lignes = cvTexte.split('\n').filter(l => l.trim().length > 5);

  // Cherche une expérience en cours (présent ou récente)
  const motsExpEnCours = ['en poste', 'en alternance', 'en stage', 'actuellement', 'depuis'];
  for (const ligne of lignes) {
    const l = ligne.toLowerCase();
    if (nomCandidat && l.includes(nomCandidat.toLowerCase().split(' ')[0])) continue;
    if (motsExpEnCours.some(m => l.includes(m)) && ligne.trim().length > 20 && ligne.trim().length < 120) {
      if (formation) return `en formation (${formation})`;
      return `en poste et en recherche active de nouvelles opportunités`;
    }
  }

  // Cherche une expérience passée
  const motsExp = ['stagiaire', 'alternant', 'assistant', 'chargé', 'responsable', 'analyste', 'consultant', 'coordinateur', 'gestionnaire'];
  for (const ligne of lignes) {
    const l = ligne.toLowerCase();
    if (nomCandidat && l.includes(nomCandidat.toLowerCase().split(' ')[0])) continue;
    if (motsExp.some(m => l.includes(m)) && ligne.trim().length > 20 && ligne.trim().length < 100) {
      const exp = nettoyerTexte(ligne);
      if (formation) return `en formation (${formation}), fort(e) d'une expérience en tant que ${exp}`;
      return `fort(e) d'une expérience en tant que ${exp}`;
    }
  }

  if (formation) return `en formation (${formation})`;
  return 'en recherche active d\'opportunités professionnelles';
}

// ─── DESCRIPTION ENTREPRISE PAR NOM + FALLBACK PAR SECTEUR ───────────────────

function getDescriptionEntreprise(company, secteur) {
  // Descriptions spécifiques pour les grandes entreprises connues
  const descriptions = {
    // Assurance / Mutuelle
    'Maif': 'votre engagement militant et vos valeurs de solidarité qui font de vous une référence dans le secteur mutualiste',
    'Macif': 'votre modèle coopératif et votre engagement envers vos sociétaires',
    'Mma': 'votre expertise en assurance et votre engagement envers la protection de vos clients',
    'Axa': 'votre leadership mondial dans l\'assurance et votre vision de la protection innovante',
    'Allianz': 'votre positionnement de référence dans l\'assurance et la gestion des risques',
    'Groupama': 'votre ancrage territorial et votre engagement envers le monde agricole et rural',
    'Covea': 'votre modèle mutualiste unique et votre engagement envers vos assurés',
    'Malakoff Humanis': 'votre engagement envers la protection sociale et le bien-être de vos assurés',
    // Banque / Finance
    'BNP Paribas': 'votre engagement envers l\'innovation financière et l\'accompagnement client',
    'Société Générale': 'votre dynamisme et votre engagement envers la transformation bancaire',
    'Crédit Agricole': 'votre ancrage coopératif et votre proximité avec les territoires',
    'LCL': 'votre engagement envers la relation client et l\'accompagnement bancaire de proximité',
    'Banque Populaire': 'votre modèle coopératif et votre engagement envers les entrepreneurs',
    'Caisse d\'Epargne': 'votre mission d\'utilité sociale et votre ancrage dans les territoires',
    'La Banque Postale': 'votre mission de service public et votre engagement envers l\'accessibilité bancaire',
    'Natixis': 'votre expertise en banque de financement et en gestion d\'actifs',
    // Logistique / Transport
    'Geodis': 'votre positionnement de référence dans la supply chain mondiale',
    'DHL': 'votre leadership mondial dans la logistique et l\'express international',
    'Fedex': 'votre expertise dans la livraison express et la logistique mondiale',
    'UPS': 'votre réseau mondial et votre engagement envers la fiabilité des livraisons',
    'Chronopost': 'votre expertise dans la livraison express et la satisfaction client',
    'Colis Privé': 'votre dynamisme dans le secteur de la livraison du dernier kilomètre',
    'XPO Logistics': 'votre positionnement de leader dans la logistique et le transport',
    'DB Schenker': 'votre expertise en logistique intégrée et en supply chain internationale',
    'Kuehne Nagel': 'votre leadership dans la logistique maritime, aérienne et terrestre',
    // Distribution / Retail
    'Carrefour': 'votre engagement envers la proximité client et l\'innovation retail',
    'Leclerc': 'votre modèle coopératif et votre engagement envers le pouvoir d\'achat des consommateurs',
    'Auchan': 'votre vision du commerce et votre engagement envers la satisfaction client',
    'Intermarché': 'votre modèle intégré producteur-distributeur unique en France',
    'Casino': 'votre diversité de formats et votre présence dans les centres-villes',
    'Decathlon': 'votre culture sportive et votre engagement envers l\'accessibilité du sport',
    'Fnac Darty': 'votre expertise dans le commerce de produits culturels et technologiques',
    'Leroy Merlin': 'votre engagement envers l\'habitat et l\'accompagnement de vos clients dans leurs projets',
    // Industrie / Manufacture
    'Schneider Electric': 'votre leadership dans la transition énergétique et la digitalisation industrielle',
    'Michelin': 'votre excellence industrielle et votre engagement envers la mobilité durable',
    'Renault': 'votre engagement envers la mobilité électrique et la transformation automobile',
    'PSA': 'votre expertise automobile et votre engagement envers la mobilité de demain',
    'Stellantis': 'votre positionnement de référence dans l\'industrie automobile mondiale',
    'Airbus': 'votre excellence aéronautique et votre leadership dans l\'aviation civile mondiale',
    'Safran': 'votre expertise en propulsion et équipements aéronautiques de haute technologie',
    'Thales': 'votre positionnement de référence dans les technologies de défense et de sécurité',
    'Dassault': 'votre excellence dans l\'aéronautique et les systèmes d\'information',
    // Agroalimentaire
    'Danone': 'votre engagement envers la nutrition, la santé et le développement durable',
    'Lactalis': 'votre positionnement de leader mondial des produits laitiers',
    'Sodebo': 'votre dynamisme dans l\'agroalimentaire et votre engagement envers la qualité',
    'Bonduelle': 'votre engagement envers la végétalisation de l\'alimentation et le développement durable',
    'Fleury Michon': 'votre engagement envers une alimentation saine et des produits de qualité',
    // Services / Conseil
    'Sodexo': 'votre leadership dans les services de qualité de vie',
    'Elior': 'votre expertise dans la restauration collective et les services',
    'Capgemini': 'votre expertise en transformation digitale et en conseil technologique',
    'Accenture': 'votre positionnement de référence dans le conseil et la transformation des entreprises',
    'Deloitte': 'votre excellence dans l\'audit, le conseil et les services financiers',
    'PwC': 'votre expertise en audit, conseil et accompagnement des transformations',
    'KPMG': 'votre référence en audit et conseil auprès des grandes organisations',
    'EY': 'votre engagement envers la transformation et la performance des organisations',
    // Tech
    'Orange': 'votre leadership dans les télécommunications et votre engagement envers le numérique pour tous',
    'SFR': 'votre dynamisme dans les télécommunications et les services numériques',
    'Bouygues Telecom': 'votre engagement envers la connectivité et l\'innovation numérique',
    'Sopra Steria': 'votre expertise en transformation numérique et en conseil IT',
    'Atos': 'votre positionnement de référence dans la transformation numérique des entreprises',
    'CGI': 'votre expertise en conseil IT et en intégration de systèmes',
    // BTP / Construction
    'Vinci': 'votre leadership dans la construction et les concessions à l\'échelle mondiale',
    'Bouygues Construction': 'votre savoir-faire reconnu dans la construction durable et innovante',
    'Eiffage': 'votre expertise dans la construction et les infrastructures en France et en Europe',
    'Spie': 'votre positionnement de référence dans les services multi-techniques',
    // Santé / Pharma
    'Sanofi': 'votre engagement envers la santé et le bien-être des patients dans le monde',
    'Ipsen': 'votre expertise dans le développement de traitements innovants',
    'Servier': 'votre engagement envers la recherche pharmaceutique et l\'amélioration de la vie des patients',
    'Korian': 'votre engagement envers le bien vieillir et la qualité de l\'accompagnement des personnes âgées',
    'Ramsay Santé': 'votre positionnement de référence dans les soins de santé privés en France',
    // Énergie
    'EDF': 'votre rôle central dans la transition énergétique et la production d\'électricité en France',
    'Engie': 'votre engagement envers la transition énergétique et les énergies renouvelables',
    'TotalEnergies': 'votre transformation vers une énergie plus propre et votre engagement envers la durabilité',
    'Veolia': 'votre mission de transformation écologique et de gestion des ressources naturelles',
    'Suez': 'votre expertise dans la gestion de l\'eau et des déchets au service des territoires',
  };

  if (descriptions[company]) return descriptions[company];

  // Fallback par secteur quand l'entreprise n'est pas connue
  const secteurLower = (secteur || '').toLowerCase();
  if (secteurLower.includes('assur') || secteurLower.includes('mutuel')) {
    return 'votre engagement envers la protection et l\'accompagnement de vos assurés';
  }
  if (secteurLower.includes('finance') || secteurLower.includes('banque')) {
    return 'votre rigueur dans la gestion des actifs et votre engagement envers vos clients';
  }
  if (secteurLower.includes('logistique') || secteurLower.includes('transport')) {
    return 'votre expertise logistique et votre engagement envers la performance des flux';
  }
  if (secteurLower.includes('industrie') || secteurLower.includes('automobile')) {
    return 'votre excellence industrielle et votre culture de l\'amélioration continue';
  }
  if (secteurLower.includes('agroalimentaire')) {
    return 'votre engagement envers la qualité alimentaire et la satisfaction de vos consommateurs';
  }
  if (secteurLower.includes('santé') || secteurLower.includes('pharma')) {
    return 'votre engagement envers la santé et le bien-être des patients';
  }
  if (secteurLower.includes('tech') || secteurLower.includes('numérique')) {
    return 'votre dynamisme dans la transformation numérique et votre culture de l\'innovation';
  }
  if (secteurLower.includes('btp') || secteurLower.includes('construction')) {
    return 'votre savoir-faire reconnu dans la construction et votre engagement envers la qualité';
  }
  if (secteurLower.includes('énergie') || secteurLower.includes('environnement')) {
    return 'votre engagement envers la transition énergétique et le développement durable';
  }
  if (secteurLower.includes('conseil') || secteurLower.includes('audit')) {
    return 'votre excellence dans le conseil et votre engagement envers la performance de vos clients';
  }
  if (secteurLower.includes('retail') || secteurLower.includes('commerce') || secteurLower.includes('distribution')) {
    return 'votre engagement envers la satisfaction client et votre dynamisme commercial';
  }
  if (secteurLower.includes('rh') || secteurLower.includes('ressources humaines')) {
    return 'votre engagement envers le développement des talents et le bien-être au travail';
  }
  if (secteurLower.includes('immobilier')) {
    return 'votre expertise dans la valorisation et la gestion de l\'immobilier';
  }
  if (secteurLower.includes('hôtellerie') || secteurLower.includes('restauration')) {
    return 'votre engagement envers l\'excellence du service et l\'expérience client';
  }
  if (secteurLower.includes('éducation') || secteurLower.includes('formation')) {
    return 'votre engagement envers la transmission du savoir et le développement des compétences';
  }
  if (secteurLower.includes('médias') || secteurLower.includes('communication')) {
    return 'votre créativité et votre engagement envers une communication impactante';
  }

  return `votre réputation d'excellence et l'ambition de vos projets`;
}

function getMissions(company, poste) {
  const posteL = (poste || '').toLowerCase();
  if (posteL.includes('rh') || posteL.includes('ressources humaines') || posteL.includes('recrutement')) {
    return 'accompagner vos équipes RH, soutenir vos processus de recrutement et contribuer au développement de vos talents';
  }
  if (posteL.includes('comptab') || posteL.includes('financ') || posteL.includes('audit')) {
    return 'renforcer la fiabilité de vos processus financiers, contribuer à la production de vos états comptables et soutenir vos équipes dans le respect des obligations fiscales';
  }
  if (posteL.includes('achat') || posteL.includes('approvisionnement') || posteL.includes('supply')) {
    return 'optimiser vos processus d\'achats, renforcer vos relations fournisseurs et contribuer à la performance de votre chaîne d\'approvisionnement';
  }
  if (posteL.includes('logistique') || posteL.includes('transport') || posteL.includes('stock')) {
    return 'optimiser vos flux logistiques, améliorer la gestion de vos stocks et contribuer à la performance de votre organisation';
  }
  if (posteL.includes('commercial') || posteL.includes('vente') || posteL.includes('marketing')) {
    return 'développer votre performance commerciale, soutenir vos équipes terrain et contribuer à la satisfaction de vos clients';
  }
  if (posteL.includes('data') || posteL.includes('analyste')) {
    return 'analyser vos données, produire des insights actionnables et soutenir vos décisions stratégiques';
  }
  if (posteL.includes('communication')) {
    return 'renforcer votre image de marque, soutenir vos campagnes de communication et contribuer à votre stratégie digitale';
  }
  if (posteL.includes('paie')) {
    return 'assurer la fiabilité de vos processus de paie, contribuer à vos obligations sociales et soutenir vos équipes RH';
  }
  if (posteL.includes('sourcing')) {
    return 'identifier de nouveaux fournisseurs, optimiser votre panel et contribuer à la performance de vos achats';
  }
  if (posteL.includes('ingénieur') || posteL.includes('production')) {
    return 'optimiser vos lignes de production, contribuer à l\'amélioration continue et garantir la qualité de vos processus industriels';
  }
  if (posteL.includes('projet') || posteL.includes('chef de')) {
    return 'piloter vos projets, coordonner vos équipes et assurer la livraison dans les délais et les budgets impartis';
  }
  return `contribuer activement à vos projets, soutenir vos équipes et apporter des solutions concrètes à vos enjeux opérationnels`;
}

function accordGenre(genre, masc, fem, neutre) {
  if (genre === 'M') return masc;
  if (genre === 'F') return fem;
  return neutre || `${masc}(e)`;
}

function generateLettre(candidat, company, secteur, contactName) {
  const salutation = 'Madame, Monsieur,';
  const contrat = candidat.contrats || 'CDI';
  const isAlternance = contrat.toLowerCase().includes('alternance');
  const isStage = contrat.toLowerCase().includes('stage');
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const genre = candidat.genre || 'N';
  const cvTexte = candidat.cv_texte || '';
  const nomCandidat = (candidat.nom || '').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  const competences = extraireCompetences(cvTexte, nomCandidat, candidat.poste);
  const situation = extraireSituation(cvTexte, nomCandidat, contrat);
  const dispoPhrase = candidat.dispo_tot ? `, disponible à partir du ${candidat.dispo_tot}` : '';
  const descriptionEntreprise = getDescriptionEntreprise(company, secteur);
  const missionText = getMissions(company, candidat.poste);
  const missions = missionText.match(/^[aeiouéèêëàâîïôùûü]/i) ? "d'" + missionText : "de " + missionText;
  const comp1 = competences[0] || 'gestion administrative';
  const comp2 = competences[1] || 'travail en équipe';
  const comp3 = competences[2] || 'rigueur et sens du détail';

  let posteAffiche = candidat.poste || '';
  if (genre === 'M') {
    posteAffiche = posteAffiche.replace(/\(e\)/g, '').replace(/\(e\s/g, ' ').trim();
  } else if (genre === 'F') {
    posteAffiche = posteAffiche.replace(/\(e\)/g, 'e').replace(/\(e\s/g, 'e ').trim();
  }

  const pret = accordGenre(genre, 'prêt', 'prête', 'prêt(e)');
  const ravi = accordGenre(genre, 'ravi', 'ravie', 'ravi(e)');
  const dote = accordGenre(genre, 'doté', 'dotée', 'doté(e)');
  const rigoureux = accordGenre(genre, 'Rigoureux', 'Rigoureuse', 'Rigoureux(se)');

  let paragrapheContrat = '';
  if (isAlternance) {
    paragrapheContrat = `\nJe tiens également à préciser que le coût de cette alternance serait réduit pour votre société grâce au plan d'aide à l'apprentissage. Votre OPCO prendra en charge tout ou partie des frais de scolarité ainsi qu'une part de mon salaire à hauteur de 5 000€.\n`;
  } else if (isStage) {
    paragrapheContrat = `\nCe stage s'inscrit dans le cadre de ma formation et constitue une étape déterminante pour consolider mes compétences professionnelles.\n`;
  }

  const lettre = `${nomCandidat}
${candidat.tel || ''}
${candidat.email || ''}

À l'attention du Responsable du Recrutement
${company}

À ${candidat.ville || 'Lyon'}, le ${today}

Objet : Candidature spontanée – ${contrat} – ${posteAffiche}

${salutation}

C'est avec un grand intérêt que je suis l'évolution de ${company}, notamment pour ${descriptionEntreprise}. Souhaitant mettre mes compétences au service d'une structure de référence, je vous adresse ma candidature spontanée pour un poste de ${posteAffiche}.

Actuellement ${situation}${dispoPhrase}, j'ai développé une expertise en ${comp1} et ${comp2}. Mon parcours m'a également permis de renforcer mes compétences en ${comp3}, que je souhaite aujourd'hui mobiliser au sein de vos équipes.

Intégrer ${company} représente pour moi l'opportunité ${missions}. ${rigoureux}, autonome et ${dote} d'un excellent esprit d'équipe, je suis ${pret} à m'investir pleinement dans les missions que vous pourriez me confier.
${paragrapheContrat}
Je serais ${ravi} de vous exposer plus en détail mes motivations et mon projet professionnel lors d'un entretien à votre convenance. Vous trouverez mon CV en pièce jointe.

Dans l'attente de votre retour, je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.

${nomCandidat}
${candidat.tel || ''}`;

  return lettre;
}

const { DOMAINES_PAR_SECTEUR, getCompaniesByRegion } = require('./companies');

async function findCompanies(secteur, ville, limit) {
  return getCompaniesByRegion(secteur, ville, limit);
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
      sender: { name: 'Lance Mon Job', email: 'support@lancemonjob.fr' },
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
      const companies = await findCompanies(secteur, candidat.ville, Math.min(volume - totalSent, 15));

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

    // Email de fin de campagne au candidat
    try {
      const nomParts = (candidat.nom || '').trim().split(' ');
      const prenom = nomParts[0] || candidat.nom;
      const nom = nomParts.slice(1).join(' ') || '';
      await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://lancemonjob.fr'}/api/confirm-fin-campagne`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:     candidat.email,
          prenom:    prenom,
          nom:       nom,
          poste:     candidat.poste,
          secteurs:  candidat.secteurs,
          contrat:   candidat.contrats,
          totalSent: totalSent,
          volume:    volume,
          ville:     candidat.ville
        })
      });
      console.log(`Email fin campagne envoyé à ${candidat.email}`);
    } catch(e) {
      console.error('Email fin campagne error:', e.message);
    }

    console.log(`Terminé: ${totalSent}/${volume} pour ${candidat.nom}`);
    totalProcessed++;
  }

  return res.status(200).json({ processed: totalProcessed });
};
