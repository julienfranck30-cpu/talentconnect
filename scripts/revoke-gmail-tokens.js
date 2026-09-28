// scripts/revoke-gmail-tokens.js
// Révoque tous les jetons Gmail stockés dans la table candidatures.
// Usage : node scripts/revoke-gmail-tokens.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ihhqwukfkztwdhxfvsvf.supabase.co';
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_SECRET) {
  console.error('ERREUR : variable d\'environnement SUPABASE_SECRET_KEY manquante.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SECRET);

async function main() {
  // 1. Compter les jetons existants
  const { count, error: countErr } = await sb
    .from('candidatures')
    .select('*', { count: 'exact', head: true })
    .not('gmail_token', 'is', null);

  if (countErr) {
    console.error('Erreur de comptage :', countErr.message);
    process.exit(1);
  }

  console.log(`${count} candidature(s) avec un jeton Gmail à révoquer.`);

  if (count === 0) {
    console.log('Aucun jeton à révoquer. Terminé.');
    return;
  }

  // 2. Révoquer les jetons
  const { error: updateErr } = await sb
    .from('candidatures')
    .update({ gmail_token: null, gmail_connected: false })
    .not('gmail_token', 'is', null);

  if (updateErr) {
    console.error('Erreur de révocation :', updateErr.message);
    process.exit(1);
  }

  // 3. Vérifier
  const { count: remaining, error: verifyErr } = await sb
    .from('candidatures')
    .select('*', { count: 'exact', head: true })
    .not('gmail_token', 'is', null);

  if (verifyErr) {
    console.error('Erreur de vérification :', verifyErr.message);
    process.exit(1);
  }

  console.log(`Vérification : ${remaining} jeton(s) restant(s).`);
  if (remaining === 0) {
    console.log('✅ Tous les jetons Gmail ont été révoqués avec succès.');
  } else {
    console.error('⚠️  Des jetons restants ont été détectés.');
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Exception :', e.message);
  process.exit(1);
});
