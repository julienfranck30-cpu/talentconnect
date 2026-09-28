-- scripts/enable-rls.sql
-- Active Row Level Security sur la table candidatures et bloque l'accès anon/authenticated.
-- À exécuter dans le dashboard Supabase (SQL Editor) ou via le CLI Supabase.

-- 1. Activer RLS sur la table candidatures
ALTER TABLE candidatures ENABLE ROW LEVEL SECURITY;

-- 2. Supprimer les politiques existantes (si elles existent)
DROP POLICY IF EXISTS "Allow all for anon" ON candidatures;
DROP POLICY IF EXISTS "Allow all for authenticated" ON candidatures;
DROP POLICY IF EXISTS "Enable all for anon" ON candidatures;
DROP POLICY IF EXISTS "Enable all for authenticated" ON candidatures;

-- 3. Créer une politique bloquante pour anon (aucun accès)
CREATE POLICY "Deny all for anon" ON candidatures
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- 4. Créer une politique bloquante pour authenticated (aucun accès)
CREATE POLICY "Deny all for authenticated" ON candidatures
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- 5. Vérification
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'candidatures';
