# Runbook sécurité — talentconnect

Correctifs appliqués dans ce dépôt. Ce document liste **ce qui reste à faire manuellement**
(dashboard Supabase, variables Vercel, Google Cloud, CNIL) car ces actions ne peuvent pas
être exécutées depuis le code.

Référence : `AUDIT.md` §3 (vulnérabilités) et §4.1 / §4.3 (RGPD).

---

## 1. Actions immédiates (à faire en premier)

### 1.1 Révoquer les jetons Gmail (AUDIT §3.4)

```bash
SUPABASE_SECRET_KEY=... node scripts/revoke-gmail-tokens.js
```

Résultat attendu : `0` ligne avec `gmail_token IS NOT NULL`.

> Google : les refresh tokens révoqués en base sont déjà invalidés pour notre application.
> Pour une révocation côté Google, supprimer le client OAuth dans
> Google Cloud Console → *API et services* → *Credentials*, puis en recréer un
> (invalide tous les tokens émis).

### 1.2 Activer les RLS (AUDIT §3.1 / §3.2)

Exécuter `scripts/enable-rls.sql` dans Supabase → SQL Editor.

Résultat attendu : un `curl` anonyme sur `/rest/v1/candidatures` renvoie `401`/`403`.

### 1.3 Faire passer le bucket `cvs` en privé (AUDIT §3.7)

Supabase → Storage → bucket `cvs` → Settings → **Public bucket = OFF**.

> ⚠️ Le codeupload déjà écrit des URL signées. Passer le bucket en privé est donc
> compatible, mais casse l'accès public aux CV envoyés **avant** ce correctif.
> Voir §4.3.

### 1.4 Variables d'environnement Vercel

Ajouter dans le projet Vercel (`talentconnect-gold`) → Settings → Environment Variables :

| Variable | Statut | Usage |
|---|---|---|
| `SUPABASE_URL` | existe | — |
| `SUPABASE_SECRET_KEY` | **existe — vérifier qu'elle est bien la clé `service_role`** | toutes les API serveur |
| `STRIPE_SECRET_KEY` | **à ajouter** | `api/webhook.js` |
| `STRIPE_WEBHOOK_SECRET` | **à ajouter** | signature webhook Stripe |
| `BREVO_API_KEY` | existe | envoi d'emails |
| `CRON_SECRET` | **à ajouter** (valeur aléatoire longue) | protège `process-candidatures`, `brevo-stats`, `confirm-candidature` |
| `ADMIN_SECRET` | **à ajouter** (valeur aléatoire longue) | token d'administration |
| `ADMIN_USER` | **à ajouter** | plus de défaut `admin` |
| `ADMIN_PASS` | **à ajouter** | plus de défaut `admin123` |
| `OAUTH_STATE_SECRET` | **à ajouter** | signature HMAC du `state` OAuth |
| `HUNTER_API_KEY` | existe | recherche d'emails |
| `ANTHROPIC_API_KEY` | existe | génération des lettres |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | **à vérifier** | réponses aux offres publiées (`api/adzuna-jobs.js`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | existent | OAuth Gmail |

> La liste complète, avec l'origine de chaque clé, est dans `.env.example` (racine).
> Les 16 variables ont été recoupées avec le code : aucune n'est oubliée, aucune n'est superflue.

Générer les secrets :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> Le cron Vercel envoie automatiquement `Authorization: Bearer $CRON_SECRET`.
> Il fonctionnera donc sans code supplémentaire une fois `CRON_SECRET` défini.

### 1.5 Roter la clé Supabase publishable (AUDIT §3.1)

La clé `sb_publishable_…` a été retirée de tout le code client. Elle n'est plus utilisée
que par des sessions éventuellement ouvertes : la **rotation reste recommandée** pour
invalidater d'éventuels jetons `anon` déjà émis.

Supabase → Project Settings → API → **Reset publishable key**.

---

## 2. À vérifier après déploiement

```bash
# Endpoints protégés : doivent répondre 401 sans Authorization
curl -i -X POST https://www.lancemonjob.fr/api/confirm-candidature -H 'Content-Type: application/json' -d '{}'
curl -i https://www.lancemonjob.fr/api/process-candidatures
curl -i https://www.lancemonjob.fr/api/brevo-stats
curl -i https://www.lancemonjob.fr/api/admin/candidatures-list

# RLS : doit répondre 401/403 (nécessite l'ancienne clé publishable)
curl -i "https://ihhqwukfkztwdhxfvsvf.supabase.co/rest/v1/candidatures?select=*" \
  -H "apikey: sb_publishable_ANCIENNE_CLÉ"

# Webhook Stripe : event non signé → 400
curl -i -X POST https://www.lancemonjob.fr/api/webhook -d '{}'

# Upload non-PDF renommé .pdf → 400
curl -i -X POST https://www.lancemonjob.fr/api/upload-cv -F "cv=@faux.pdf;type=application/pdf"
```

---

## 3. Points à trancher

### 3.1 `cv_url` historiques

Les candidatures créées avant le correctif §3.7 ont une `cv_url` en **URL publique**,
qui continuera de fonctionner tant que le bucket reste public. Après le passage en privé,
elles Pointent vers une URL morte. `scripts/backfill-cv-paths.js` extrait déjà le chemin ;
il reste à le lancer pour normaliser ces lignes.

### 3.2 Conservation des jetons Gmail

`gmail_token` est stocké **en clair** (colonne `TEXT`). Le correctif porte sur le
contrôle d'accès et la signature du `state`, pas sur le chiffrement au repos
(cf. AUDIT §3.4). Deux options :
- **rapide** : ne stocker que le `refresh_token` (déjà le cas) et ne jamais le logger ;
- **complet** : migrer vers Supabase Vault ou un chiffrement applicatif (`pgcrypto`).

### 3.3 Identité du candidat sur `/suivi` (hors périmètre AUDIT)

`/suivi?email=` retourne la campagne à quiconque connaît l'e-mail. C'est une fuite
d'information résiduelle : le nom, le poste et les entreprises contactées sont lisibles
avec une simple adresse. Correctif recommandé : jeton à usage unique envoyé par email
à la création, ou Supabase Auth.

---

## 4. Reste à faire (pas de code)

### 4.1 Notification CNIL (AUDIT §4.1) — **en retard**

`scripts/cnil-notification.md` contient le brouillon. À compléter avec le nombre réel
de personnes concernées (`SELECT count(*) FROM candidatures;`) puis à envoyer.

- notifications@cnil.fr
- formulaire : https://www.cnil.fr/fr/organisations/porter-a-la-connaissance/notification-d-incident

Délai légal : 72 h après connaissance. L'incident est connu depuis l'audit du 23/09/2026.

### 4.2 Bandeau cookies — fait dans le code

`cookies-consent.js` est ajouté aux 13 pages. Vérifier en staging que GA4 **ne se charge pas**
avant acceptation (DevTools → Network → aucun requête vers `googletagmanager.com`).

### 4.3 Contacter les candidats (§4.1)

Recommandé : le risque est élevé (données personnelles + risque de détournement Gmail).
Un email d'information aux candidats concernés est conseillé — see §5 du brouillon CNIL.

---

## 5. Récapitulatif des items AUDIT couverts

| § | Problème | État |
|---|---|---|
| 3.4 | OAuth Gmail : `state` non signé | ✅ HMAC + nonce + expiration + vérification de l'identité du compte |
| 3.1 / 3.2 | RLS ouverte, clé publique exposée | ✅ clé retirée du client, API serveur, `enable-rls.sql` fourni |
| 3.3 | Webhook Stripe sans signature | ✅ (PR #9) |
| 3.7 | Bucket CV public | ✅ code (PR #9) — **reste le passage en privé du bucket** |
| 3.5 | Relais d'e-mail ouvert | ✅ secret serveur + échappement HTML + rate limit |
| 3.6 | Endpoints publics sans auth | ✅ `CRON_SECRET`, CORS restreint, code mort supprimé |
| 3.8 | Admin en dur | ✅ auth serveur, plus aucun secret côté client |
| 3.9 | XSS stocké | ✅ `escapeHtml` dans admin, suivi, app et les gabarits d'e-mail |
| 3.10 | Injection de prompt | ✅ `system` prompt, balises `<contenu_cv>`, validation de la sortie |
| 4.3 | Bandeau cookies | ✅ `cookies-consent.js` sur 13 pages |
| 4.1 | Notification CNIL | ⬜ action manuelle |
