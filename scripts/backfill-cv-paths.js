// scripts/backfill-cv-paths.js
//
// Nettoyage ponctuel, non bloquant : normalise candidatures.cv_url en chemins nus
// (cv_xxx.pdf) pour les lignes qui contiennent encore une ancienne URL publique
// Supabase (bucket 'cvs' passé en privé, CON-64). api/process-candidatures.js gère
// déjà les deux formats et régénère une URL signée à la demande — ce script ne
// corrige rien côté sécurité, il remet juste la colonne dans un état cohérent.
//
// Usage:
//   node scripts/backfill-cv-paths.js            (dry-run — affiche les changements sans écrire)
//   node scripts/backfill-cv-paths.js --apply    (applique réellement les mises à jour)
//
// Nécessite SUPABASE_URL et SUPABASE_SECRET_KEY dans l'environnement.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET) {
  console.error('SUPABASE_URL et SUPABASE_SECRET_KEY doivent être définis dans l\'environnement.');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const PAGE_SIZE = 500;

function extractCvPath(cvUrl) {
  const publicPrefix = `${SUPABASE_URL}/storage/v1/object/public/cvs/`;
  if (cvUrl.startsWith(publicPrefix)) {
    return decodeURIComponent(cvUrl.slice(publicPrefix.length));
  }
  if (/^https?:\/\//i.test(cvUrl)) {
    const match = cvUrl.match(/\/cvs\/([^/?]+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  }
  return null; // déjà un chemin nu — rien à faire
}

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_SECRET);

  // Pagination par curseur sur id (et non par offset) : les lignes mises à jour
  // sortent du filtre ilike au fil de l'exécution, un offset classique sauterait
  // alors des lignes.
  let lastId = null;
  let totalScanned = 0;
  let totalResolved = 0;
  let totalUpdated = 0;
  let totalUnresolved = 0;

  while (true) {
    let query = sb
      .from('candidatures')
      .select('id, cv_url')
      .ilike('cv_url', 'http%')
      .order('id', { ascending: true })
      .limit(PAGE_SIZE);

    if (lastId !== null) query = query.gt('id', lastId);

    const { data: rows, error } = await query;

    if (error) {
      console.error('Erreur lecture Supabase:', error.message);
      process.exit(1);
    }
    if (!rows.length) break;

    for (const row of rows) {
      totalScanned++;
      const cvPath = extractCvPath(row.cv_url);

      if (!cvPath) {
        totalUnresolved++;
        console.warn(`[id=${row.id}] chemin introuvable dans cv_url, laissé tel quel: ${row.cv_url}`);
        continue;
      }

      totalResolved++;
      console.log(`[id=${row.id}] ${row.cv_url} -> ${cvPath}`);

      if (APPLY) {
        const { error: updateError } = await sb
          .from('candidatures')
          .update({ cv_url: cvPath })
          .eq('id', row.id);

        if (updateError) {
          console.error(`[id=${row.id}] échec update: ${updateError.message}`);
          continue;
        }
        totalUpdated++;
      }
    }

    lastId = rows[rows.length - 1].id;
  }

  console.log('---');
  console.log(`Lignes scannées (cv_url = URL): ${totalScanned}`);
  console.log(`Chemins résolus: ${totalResolved}`);
  console.log(`Chemins non résolus (laissés tels quels): ${totalUnresolved}`);
  console.log(APPLY
    ? `Lignes mises à jour: ${totalUpdated}`
    : `Dry-run — aucune écriture. Relancer avec --apply pour appliquer ces ${totalResolved} changements.`);
}

main().catch(e => {
  console.error('Erreur inattendue:', e.message);
  process.exit(1);
});
