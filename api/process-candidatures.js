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

// ─── EXTRACTION CV ────────────────────────────────────────────────────────────

function nettoyerTexte(texte) {
  return texte.replace(/\s+/g, ' ').trim();
}

function extraireFormation(cvTexte, nomCandidat) {
  if (!cvTexte) return null;

  // Ignore les X premières lignes qui contiennent souvent le nom/titre
  const lignes = cvTexte.split('\n').filter(l => l.trim().length > 5);

  // Cherche une ligne contenant un diplôme réel
  const motsDiplome = ['master', 'licence', 'bachelor', 'bts', 'dut', 'mba', 'msc', 'master 2', 'master 1', 'grande école', 'programme grandes ecoles'];
  const motsEcole = ['school', 'ecema', 'emlyon', 'hec', 'essec', 'escp', 'kedge', 'skema', 'edhec', 'iae', 'inseec', 'igs', 'cesi', 'burgundy', 'université', 'university', 'business school', 'école de commerce', 'école supérieure'];

  // Priorité 1 : ligne contenant un diplôme
  for (const ligne of lignes) {
    const l = ligne.toLowerCase();
    // Ignore si la ligne contient le nom du candidat
    if (nomCandidat && l.includes(nomCandidat.toLowerCase().split(' ')[0])) continue;
    if (motsDiplome.some(m => l.includes(m))) {
      return nettoyerTexte(ligne).slice(0, 100);
    }
  }

  // Priorité 2 : ligne contenant une école
  for (const ligne of lignes) {
    const l = ligne.toLowerCase();
    if (nomCandidat && l.includes(nomCandidat.toLowerCase().split(' ')[0])) continue;
    if (motsEcole.some(m => l.includes(m))) {
      return nettoyerTexte(ligne).slice(0, 100);
    }
  }

  return null;
}

function extraireCompetences(cvTexte, nomCandidat, poste) {
  if (!cvTexte) return ['gestion administrative', 'travail en équipe', 'rigueur et sens du détail'];

  const posteLower = (poste || '').toLowerCase();

  // Tentative 1 : extraire directement la section "Compétences" du CV
  const sectionsRegex = /comp[eé]tences?\s*[:\n]?([\s\S]{10,600})(?:atouts|centres d.int[eé]r[eê]t|informatique|langues|exp[eé]riences|dipl[oô]mes|formations|r[eé]seaux|$)/i;
  const match = cvTexte.match(sectionsRegex);

  if (match) {
    const bloc = match[1];
    const lignes = bloc.split(/[\n]/)
      .map(l => l.trim())
      .filter(l => l.length > 3 && l.length < 80)
      .filter(l => !/^(et|de|du|des|les|la|le|un|une|\d+)$/i.test(l));

    if (lignes.length >= 2) {
      // Priorise les compétences pertinentes pour le poste
      const prioritaires = [];
      const autres = [];
      for (const ligne of lignes) {
        const l = ligne.toLowerCase();
        const estPertinent = (
          (posteLower.includes('achat') && (l.includes('achat') || l.includes('approvision') || l.includes('négociation') || l.includes('fournisseur') || l.includes('sourcing') || l.includes('stock'))) ||
          (posteLower.includes('approvision') && (l.includes('approvision') || l.includes('stock') || l.includes('erp') || l.includes('négociation'))) ||
          (posteLower.includes('logistique') && (l.includes('logistique') || l.includes('stock') || l.includes('transport'))) ||
          (posteLower.includes('comptab') && (l.includes('comptab') || l.includes('financ') || l.includes('sage'))) ||
          (posteLower.includes('rh') && (l.includes('recrutement') || l.includes('paie') || l.includes('formation'))) ||
          (posteLower.includes('data') && (l.includes('données') || l.includes('power bi') || l.includes('excel') || l.includes('sql'))) ||
          (posteLower.includes('commercial') && (l.includes('vente') || l.includes('négociation') || l.includes('crm')))
        );
        if (estPertinent) prioritaires.push(ligne);
        else autres.push(ligne);
      }
      const selection = [...prioritaires, ...autres].slice(0, 3);
      if (selection.length >= 2) return selection;
    }
  }

  // Tentative 2 : mots-clés dans tout le CV
  const cvLower = cvTexte.toLowerCase();
  const motsCles = [
    'approvisionnement', 'négociation', 'sourcing', 'gestion de stocks', 'supply chain',
    'erp', 'power bi', 'excel', 'pack office', 'tableaux de bord', 'reporting',
    'comptabilité', 'audit', 'recrutement', 'paie', 'marketing', 'communication',
    'gestion de projet', 'agile', 'lean', 'qualité', 'analyse de données'
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
  if (!cvTexte) return null;

  const formation = extraireFormation(cvTexte, nomCandidat);
  const lignes = cvTexte.split('\n').filter(l => l.trim().length > 5);

  // Cherche une expérience récente
  const motsExp = ['stagiaire', 'alternant', 'assistant', 'chargé', 'responsable', 'analyste', 'consultant', 'coordinateur'];
  for (const ligne of lignes) {
    const l = ligne.toLowerCase();
    if (nomCandidat && l.includes(nomCandidat.toLowerCase().split(' ')[0])) continue;
    if (motsExp.some(m => l.includes(m)) && ligne.trim().length > 20 && ligne.trim().length < 100) {
      const exp = nettoyerTexte(ligne);
      if (formation) return `en formation (${formation}) et fort(e) d'une expérience en tant que ${exp}`;
      return `fort(e) d'une expérience en tant que ${exp}`;
    }
  }

  if (formation) return `en formation (${formation})`;
  return 'en recherche active d\'opportunités professionnelles';
}

function getDescriptionEntreprise(company) {
  // Description naturelle sans mentionner le secteur technique interne
  const descriptions = {
    'Sodexo': 'votre leadership dans les services de qualité de vie',
    'Elior': 'votre expertise dans la restauration collective et les services',
    'Geodis': 'votre positionnement de référence dans la supply chain mondiale',
    'Carrefour': 'votre engagement envers la proximité client et l\'innovation retail',
    'Decathlon': 'votre culture sportive et votre engagement envers l\'accessibilité du sport',
    'Sanofi': 'votre engagement envers la santé et le bien-être des patients',
    'BNP Paribas': 'votre engagement envers l\'innovation financière et l\'accompagnement client',
    'Capgemini': 'votre expertise en transformation digitale et en conseil technologique',
    'Vinci Construction': 'vos projets ambitieux et votre savoir-faire reconnu dans la construction',
    'Danone': 'votre engagement envers la nutrition, la santé et le développement durable',
    'Schneider Electric': 'votre leadership dans la transition énergétique et la digitalisation industrielle',
  };

  if (descriptions[company]) return descriptions[company];

  // Générique naturel sans mention du secteur
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
  if (posteL.includes('communication') || posteL.includes('marketing')) {
    return 'renforcer votre image de marque, soutenir vos campagnes de communication et contribuer à votre stratégie digitale';
  }
  if (posteL.includes('paie') || posteL.includes('comptab')) {
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

// ─── GÉNÉRATION LETTRE SANS IA ────────────────────────────────────────────────

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
  const descriptionEntreprise = getDescriptionEntreprise(company);
  const missionText = getMissions(company, candidat.poste);
  const missions = missionText.match(/^[aeiouéèêëàâîïôùûü]/i) ? "d'" + missionText : "de " + missionText;

  const comp1 = competences[0] || 'gestion administrative';
  const comp2 = competences[1] || 'travail en équipe';
  const comp3 = competences[2] || 'rigueur et sens du détail';

  // Adapte le poste selon le genre (enlève les parenthèses)
  let posteAffiche = candidat.poste || '';
  if (genre === 'M') {
    posteAffiche = posteAffiche.replace(/\(e\)/g, '').replace(/\(e\s/g, ' ').trim();
  } else if (genre === 'F') {
    posteAffiche = posteAffiche.replace(/\(e\)/g, 'e').replace(/\(e\s/g, 'e ').trim();
  }
  const pret = accordGenre(genre, 'prêt', 'prête', 'prêt(e)');
  const ravi = accordGenre(genre, 'ravi', 'ravie', 'ravi(e)');
  const dote = accordGenre(genre, 'doté', 'dotée', 'doté(e)');
  const fort = accordGenre(genre, 'fort', 'forte', 'fort(e)');
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

    console.log(`Terminé: ${totalSent}/${volume} pour ${candidat.nom}`);
    totalProcessed++;
  }

  return res.status(200).json({ processed: totalProcessed });
};
