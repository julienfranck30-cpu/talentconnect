// api/adzuna-jobs.js
// Récupère les offres d'emploi Adzuna selon le profil du candidat

const ADZUNA_APP_ID  = process.env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;

// Mapping secteurs Lance Mon Job → catégories Adzuna
const SECTEUR_TO_ADZUNA = {
  'Distribution / Négoce':       'sales-jobs',
  'Industrie':                   'engineering-jobs',
  'Automobile':                  'engineering-jobs',
  'BTP / Construction':          'construction-jobs',
  'Logistique / Transport':      'logistics-warehouse-jobs',
  'Agroalimentaire':             'hospitality-catering-jobs',
  'Retail / Commerce':           'retail-jobs',
  'Services B2B':                'sales-jobs',
  'Tech / Numérique':            'it-jobs',
  'Santé / Pharma':              'healthcare-nursing-jobs',
  'Finance / Banque':            'accounting-finance-jobs',
  'Immobilier':                  'property-jobs',
  'Hôtellerie / Restauration':   'hospitality-catering-jobs',
  'Éducation / Formation':       'teaching-jobs',
  'Énergie / Environnement':     'engineering-jobs',
  'RH / Recrutement':            'hr-jobs',
  'Conseil / Audit':             'consulting-jobs',
  'Médias / Communication':      'marketing-jobs',
};

// Mapping villes → codes région Adzuna France
function getLocationParam(ville) {
  const v = (ville || '').toLowerCase();
  if (v.includes('paris') || v.includes('île-de-france') || v.includes('idf')) return 'ile-de-france';
  if (v.includes('lyon') || v.includes('villefontaine') || v.includes('grenoble') || v.includes('isère')) return 'auvergne-rhone-alpes';
  if (v.includes('marseille') || v.includes('aix')) return 'provence-alpes-cote-d-azur';
  if (v.includes('bordeaux')) return 'nouvelle-aquitaine';
  if (v.includes('toulouse')) return 'occitanie';
  if (v.includes('nantes') || v.includes('rennes')) return 'pays-de-la-loire';
  if (v.includes('lille')) return 'hauts-de-france';
  if (v.includes('strasbourg')) return 'grand-est';
  if (v.includes('nice')) return 'provence-alpes-cote-d-azur';
  if (v.includes('dijon')) return 'bourgogne-franche-comte';
  return null; // Toute la France
}

async function fetchOffresAdzuna(poste, secteur, ville, limit = 10) {
  try {
    const appId  = ADZUNA_APP_ID;
    const appKey = ADZUNA_APP_KEY;

    if (!appId || !appKey) {
      console.error('Adzuna credentials manquants');
      return [];
    }

    const category = SECTEUR_TO_ADZUNA[secteur] || 'it-jobs';
    const location = getLocationParam(ville);
    const locationPath = location ? `/${location}` : '';

    // Encode le poste pour l'URL
    const posteEncoded = encodeURIComponent(poste);

    const url = `https://api.adzuna.com/v1/api/jobs/fr/search/1` +
      `?app_id=${appId}&app_key=${appKey}` +
      `&results_per_page=${limit}` +
      `&what=${posteEncoded}` +
      `&category=${category}` +
      `&where=${location || 'france'}` +
      `&sort_by=date` +
      `&max_days_old=30` +
      `&full_time=1`;

    console.log(`Adzuna search: ${poste} / ${secteur} / ${ville}`);

    const res = await fetch(url);

    if (!res.ok) {
      const err = await res.text();
      console.error(`Adzuna API error ${res.status}: ${err}`);
      return [];
    }

    const data = await res.json();
    const results = data.results || [];

    console.log(`Adzuna: ${results.length} offres trouvées pour "${poste}" en ${ville}`);

    // Extraire les infos utiles de chaque offre
    return results.map(job => ({
      id:          job.id,
      titre:       job.title || poste,
      entreprise:  job.company?.display_name || '',
      ville:       job.location?.display_name || ville,
      description: (job.description || '').slice(0, 500),
      url:         job.redirect_url || '',
      date:        job.created || '',
      // Extraire le domaine de l'entreprise pour Hunter
      domain:      extractDomain(job.company?.display_name || ''),
    }));

  } catch(e) {
    console.error('Adzuna exception:', e.message);
    return [];
  }
}

// Tente de deviner le domaine d'une entreprise à partir de son nom
function extractDomain(companyName) {
  if (!companyName) return null;
  const name = companyName
    .toLowerCase()
    .replace(/\s+(sa|sas|sarl|srl|group|groupe|france|fr|inc|ltd|gmbh|spa)$/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
  if (!name) return null;
  return `${name}.fr`;
}

module.exports = { fetchOffresAdzuna };
