# Audit complet — Lance Mon Job (repo `talentconnect`)

**Date de l'audit :** 23 septembre 2026
**Périmètre :** intégralité du dépôt (`main`, commit `49fbe0e`) — 6 253 lignes, 11 fichiers sous `api/`, 14 pages statiques.
**Méthode :** lecture exhaustive du code, analyse de l'historique Git (197 commits), vérifications dynamiques non intrusives sur l'infrastructure de production (requêtes `HEAD` sans récupération de données, aucune écriture).

---

## 1. Résumé exécutif

La plateforme est **fonctionnelle sur le papier mais structurellement non sécurisée et sur-promise commercialement**. Trois constats dominent :

1. **La base de données de production est lisible par n'importe qui sur Internet.** Vérifié pendant cet audit : 13 dossiers candidats accessibles sans authentification, y compris téléphones, URLs de CV et **jetons OAuth Gmail**. Le bucket de stockage des CV est public. C'est une violation de données au sens de l'art. 33 RGPD, notifiable à la CNIL sous 72 h.
2. **Le paiement n'est pas vérifié.** Le webhook Stripe n'a aucune vérification de signature, et la même clé publique Supabase autorise l'écriture : un utilisateur peut passer sa campagne en statut « Payé » depuis la console de son navigateur, ou forger un webhook. Le service est gratuit pour qui le souhaite.
3. **Les volumes vendus sont structurellement inatteignables.** Le moteur d'envoi plafonne à ~45 destinataires par secteur choisi : une offre Max (300 candidatures, 99 €) sur un seul secteur livrera au mieux 15 % de ce qui est vendu, sans que personne ne s'en aperçoive.

S'y ajoute un défaut d'exploitation révélé par l'historique : le cron d'envoi **n'a pas fonctionné du 25 août au 23 septembre 2026** (un mois de campagnes payées non livrées) sans qu'aucune alerte ne se déclenche — corrigé au commit `a7470a1`, mais la cause racine (aucune supervision, aucun test, aucune CI) demeure.

### Tableau de synthèse

| Domaine | État | Constats bloquants |
|---|---|---|
| Sécurité applicative | 🔴 Critique | 4 vulnérabilités critiques, 4 élevées, 2 moyennes |
| Conformité RGPD | 🔴 Critique | Fuite de données avérée, 4 sous-traitants non déclarés, pas de bandeau cookies |
| Droit de la consommation | 🟠 Élevé | Volumes non livrables, fonctionnalités vendues non implémentées, mentions légales incomplètes |
| Fiabilité / exploitation | 🔴 Critique | Timeout serverless quasi certain, aucun retry, aucune supervision |
| Fonctionnalités | 🟠 Partiel | 5 fonctionnalités facturées absentes du code |
| Qualité du code | 🟠 Moyen | ~900 lignes mortes ou dupliquées, 0 test, 0 CI, 0 lockfile |
| Ergonomie / accessibilité | 🟠 Moyen | Tunnel 13 étapes non sauvegardé, échecs silencieux, navigation clavier impossible |
| SEO / contenu | 🟡 Faible | Index du blog en 404, pas de favicon, pas de `robots.txt` |

---

## 2. Architecture réelle

```
Navigateur (statique, pas de build)
  ├── index.html / blog / pages légales      → contenu marketing
  ├── formulaire.html + app.js               → tunnel 13 étapes
  │      ├─ POST /api/upload-cv              → Supabase Storage (bucket PUBLIC) + extraction texte
  │      ├─ INSERT candidatures              → Supabase REST avec clé publique (RLS inopérante)
  │      ├─ POST /api/confirm-candidature    → e-mail Brevo
  │      └─ redirection Stripe Payment Link
  ├── suivi.html                             → SELECT * par e-mail, sans authentification
  └── admin.html                             → identifiants en dur dans le JS client

Fonctions Vercel (Node, CommonJS/ESM mélangés)
  ├── /api/webhook               ← Stripe (signature NON vérifiée) → statut « Payé »
  ├── /api/gmail                 ← OAuth Google (state NON signé), stockage du refresh token en clair
  ├── /api/process-candidatures  ← cron quotidien 08:00, endpoint PUBLIC
  │      ├─ Anthropic Claude (rédaction de la lettre, 1 appel/candidat)
  │      ├─ Hunter.io (recherche d'e-mails)  + repli rh@/contact@
  │      ├─ Adzuna (offres publiées, domaines devinés)
  │      └─ Brevo ou Gmail du candidat (envoi)
  ├── /api/brevo-stats           ← CORS *, sans authentification
  ├── /api/candidatures          ← stub mort
  └── /api/api/*                 ← doublons morts (ancienne marque « TalentConnect »)
```

Pas de framework, pas d'étape de build, pas de gestionnaire d'état : tout le code client est du JS global attaché à `window`.

---

## 3. Sécurité

### 3.1 🔴 CRITIQUE — Base de données de production ouverte en lecture anonyme

**Vérifié en production pendant cet audit** (requête `HEAD`, aucune donnée personnelle récupérée) :

```
HEAD /rest/v1/candidatures?select=id            → 200, content-range: 0-12/13
HEAD /rest/v1/candidatures?select=gmail_token,cv_url,tel → 200
```

La clé `sb_publishable_…` est publiée en clair dans [app.js:4](app.js#L4), [admin.html:216](admin.html#L216) et [suivi.html:159](suivi.html#L159). Les politiques RLS de la table `candidatures` sont soit désactivées, soit permissives : **toute personne disposant de l'URL du site peut lire l'intégralité des dossiers candidats** — nom, e-mail, téléphone, CV, situation professionnelle, et le champ `gmail_token`.

Conséquences :
- Fuite de données personnelles (art. 33 RGPD → notification CNIL sous 72 h, et art. 34 → information des personnes si risque élevé, ce qui est le cas ici avec les jetons Gmail).
- Le `gmail_token` est un **refresh token OAuth Google** : quiconque le récupère peut envoyer des e-mails depuis la boîte Gmail du candidat, indéfiniment, jusqu'à révocation manuelle.

**Correction :** activer RLS avec `USING (false)` pour le rôle `anon`, déplacer toutes les lectures/écritures derrière des fonctions serverless utilisant `SUPABASE_SECRET_KEY`, **révoquer immédiatement tous les jetons Gmail stockés** (et les chiffrer à l'avenir), faire tourner la clé publiée.

### 3.2 🔴 CRITIQUE — Écriture anonyme : le paiement est contournable

L'interface d'administration ([admin.html:505](admin.html#L505)) et l'ancien panneau ([app.js:403](app.js#L403)) exécutent `update({statut})` et `delete().neq('id',0)` **avec la clé publique**. La politique d'écriture est donc ouverte au rôle `anon`. Deux conséquences directes :

- N'importe qui peut exécuter, depuis la console du navigateur, l'équivalent de `update({statut:'Payé'})` sur son propre dossier → campagne livrée sans paiement.
- N'importe qui peut **supprimer l'intégralité de la table** (`delete().neq('id',0)` est littéralement présent dans le code livré).

*(Non testé en production : je n'ai effectué aucune écriture. La lecture ouverte est confirmée, l'écriture est démontrée par le fonctionnement même de l'admin en production.)*

### 3.3 🔴 CRITIQUE — Webhook Stripe sans vérification de signature

[api/webhook.js:90-136](api/webhook.js#L90) : le corps de la requête est parsé en JSON et exploité tel quel. Aucun appel à `stripe.webhooks.constructEvent`, aucune dépendance `stripe` dans `package.json`, aucun `STRIPE_WEBHOOK_SECRET`.

```
POST /api/webhook  {"type":"checkout.session.completed",
                    "data":{"object":{"customer_details":{"email":"cible@x.fr"}}}}
→ statut « Payé » + campagne lancée
```

De plus, **le montant payé n'est jamais comparé au plan commandé** : un paiement Starter (29 €) déclenche l'exécution du dernier dossier enregistré pour cet e-mail, quel que soit son plan.

**Correction :** vérifier la signature `stripe-signature` sur le corps brut (désactiver le body parser), contrôler `amount_total` vs plan, et lier la session Stripe au dossier via `client_reference_id` plutôt que par e-mail.

### 3.4 🔴 CRITIQUE — Détournement de compte Gmail via `state` OAuth non signé

[api/gmail.js:76](api/gmail.js#L76) construit le `state` OAuth en base64 non signé, et [api/gmail.js:103-131](api/gmail.js#L103) le décode sans vérification, puis écrit le refresh token sur l'`id` qu'il contient :

```js
candidatInfo = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
await sb.from('candidatures').update({ gmail_token: … }).eq('id', id);
```

Un attaquant qui connaît un `id` de dossier (lisible anonymement, cf. 3.1) forge un lien `?action=auth&email=…&id=<id_attaquant>` et l'envoie à une victime. Si la victime autorise Google, **son jeton Gmail est écrit sur le dossier de l'attaquant**, dont la campagne enverra ensuite des centaines d'e-mails depuis la boîte de la victime.

Problèmes connexes dans le même fichier :
- Aucune vérification que le compte Google autorisé correspond à `candidat.email`, alors que `sendViaGmail` utilise `from: candidat.email` ([api/process-candidatures.js:497](api/process-candidatures.js#L497)) — usurpation d'expéditeur possible, et rejet Gmail si divergence.
- [api/gmail.js:129](api/gmail.js#L129) : `tokenData.refresh_token || tokenData.access_token` — si Google ne renvoie pas de refresh token, un access token d'une heure est stocké à sa place, et la connexion Gmail cesse silencieusement de fonctionner.
- Le scope `gmail.send` est un *scope restreint* Google : son usage impose une vérification OAuth et une évaluation de sécurité CASA. Stocker les jetons en clair dans une table lisible publiquement est un manquement direct aux conditions du programme.

**Correction :** signer le `state` (HMAC + expiration + nonce à usage unique), vérifier l'e-mail du compte via `userinfo`, chiffrer les jetons au repos, révoquer l'existant.

### 3.5 🟠 ÉLEVÉ — Relais d'e-mail ouvert sur `/api/confirm-candidature`

[api/confirm-candidature.js](api/confirm-candidature.js) accepte n'importe quel POST non authentifié et envoie un e-mail **depuis `support@lancemonjob.fr`** (domaine authentifié SPF/DKIM) vers l'adresse fournie. Les champs `prenom`, `nom`, `poste`, `secteurs` sont interpolés dans le HTML **sans échappement** → injection HTML, donc insertion de liens arbitraires.

Un attaquant dispose ainsi d'une plateforme de phishing signée par votre domaine, avec un bouton « Connecter mon Gmail » légitime. Risque : blacklistage du domaine, suspension du compte Brevo.

**Correction :** authentifier l'appel (secret partagé serveur↔serveur ou appel interne depuis l'insertion), échapper toutes les variables, limiter le débit par IP.

### 3.6 🟠 ÉLEVÉ — Endpoint d'envoi et endpoint de statistiques publics

- [api/process-candidatures.js:566](api/process-candidatures.js#L566) accepte GET et POST sans aucune authentification. Les crons Vercel ne sont pas protégés par défaut : n'importe qui peut déclencher l'envoi en masse à volonté (coût Claude + Hunter + Brevo, et risque de doublons).
- [api/brevo-stats.js](api/brevo-stats.js) expose vos statistiques d'e-mailing (volumes, bounces) avec `Access-Control-Allow-Origin: *` et sans authentification.

**Correction :** vérifier `Authorization: Bearer ${CRON_SECRET}` sur les deux, restreindre le CORS.

### 3.7 🟠 ÉLEVÉ — Upload de fichiers non authentifié vers un bucket public

[api/upload-cv.js](api/upload-cv.js) :
- Aucune authentification, aucune limite de débit → n'importe qui peut remplir votre stockage.
- **Aucun contrôle de taille** alors que l'interface annonce « PDF · 5 Mo max » ([formulaire.html:265](formulaire.html#L265)) ; `formidable` est instancié sans `maxFileSize`.
- Validation du type par l'extension du nom (`endsWith('.pdf')`), pas par le contenu → tout fichier renommé `.pdf` est accepté, stocké et servi publiquement depuis votre domaine Supabase avec `Content-Type: application/pdf`.
- [api/upload-cv.js:46](api/upload-cv.js#L46) : `getPublicUrl` sur un bucket **confirmé public** pendant cet audit (une requête anonyme sur `/storage/v1/object/public/cvs/<inexistant>` répond `NoSuchKey` et non « bucket introuvable »). Les CV sont donc accessibles sans authentification, et les noms `cv_<timestamp>.pdf` sont énumérables — d'autant plus que `created_at` est lisible anonymement.

**Correction :** bucket privé + URLs signées à durée limitée, `maxFileSize: 5 * 1024 * 1024`, vérification de la signature PDF (`%PDF-`), noms non devinables (UUID), suppression à l'expiration.

### 3.8 🟠 ÉLEVÉ — Interface d'administration sans authentification réelle

[admin.html:217-218](admin.html#L217) :

```js
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';
```

Identifiants en clair dans un fichier servi publiquement, vérification côté client, session matérialisée par `sessionStorage.setItem('lmj_admin','1')`. Contourner l'écran de connexion demande une ligne de console — et de toute façon les données sont accessibles directement via l'API (3.1).

**Correction :** authentification côté serveur (Supabase Auth ou Vercel Password Protection), toutes les requêtes admin passant par une fonction serverless avec la clé secrète.

### 3.9 🟡 MOYEN — XSS stocké dans les interfaces internes

Les données saisies par les candidats sont injectées via `innerHTML` sans échappement :
- [admin.html:385-393](admin.html#L385) : `c.nom`, `c.poste`, `c.email`, `c.ville` dans le tableau ; `openDetail('${c.id}')` interpolé dans un attribut.
- [suivi.html:248-270](suivi.html#L248) : idem côté candidat.
- [app.js:445-478](app.js#L445) : idem (code mort).

Un candidat qui saisit `<img src=x onerror=…>` dans son poste exécute du JavaScript dans le navigateur de l'administrateur, avec accès à la clé Supabase et à toute la base.

### 3.10 🟡 MOYEN — Injection de prompt via le CV

[api/process-candidatures.js:298-299](api/process-candidatures.js#L298) : le texte du CV (3 000 caractères issus d'un PDF fourni par l'utilisateur) est concaténé dans le prompt Claude sans délimitation ni neutralisation. Un CV contenant des instructions peut modifier le contenu des lettres envoyées **à des centaines de recruteurs sous votre marque**.

**Correction :** encadrer le contenu dans des balises explicites, rappeler dans le prompt système que le contenu est une donnée non fiable, et valider la sortie (longueur, présence des placeholders attendus).

### 3.11 Points positifs relevés

- **Aucun secret en dur dans l'historique Git** (197 commits analysés) : toutes les clés serveur passent par `process.env`. C'est le point d'hygiène le mieux tenu du projet.
- Pas de `node_modules` ni de `.env` jamais commité.
- Le HTML des e-mails de candidature est construit côté serveur, jamais à partir d'entrées de tiers externes.

---

## 4. Conformité (RGPD et droit de la consommation)

### 4.1 🔴 Violation de données en cours

Les points 3.1 et 3.7 constituent une violation de données à caractère personnel déjà effective (exposition, pas seulement risque). Obligations immédiates : consigner l'incident au registre, **notifier la CNIL sous 72 h**, évaluer l'information des personnes concernées (art. 34 — probable ici, compte tenu des CV et des jetons Gmail).

### 4.2 🔴 Sous-traitants non déclarés dans la politique de confidentialité

[confidentialite.html](confidentialite.html) liste Stripe, Supabase, Brevo et Vercel. **Sont absents :**

| Sous-traitant | Donnée transmise | Localisation |
|---|---|---|
| **Anthropic (Claude)** | Texte intégral du CV, nom, poste, ville, disponibilité | États-Unis |
| **Hunter.io** | Domaines ciblés (et réception d'adresses nominatives de tiers) | États-Unis |
| **Adzuna** | Poste, secteur, ville | Royaume-Uni |
| **Google (Gmail API)** | Contenu des candidatures, jeton OAuth | États-Unis |

Le CV peut contenir des données sensibles (santé, handicap RQTH, appartenance syndicale, origine). Leur transmission à un LLM américain sans mention ni base légale explicite est un manquement sérieux aux art. 13, 28 et 44 RGPD.

### 4.3 🔴 Absence de bandeau de consentement cookies

Google Analytics 4 (`G-BMKHRFJ914`) est chargé **sans consentement préalable** sur toutes les pages, y compris les pages légales ([index.html:10](index.html#L10), et dans chaque page). En France, GA4 requiert le consentement préalable (art. 82 loi Informatique & Libertés) ; la CNIL sanctionne activement ce manquement.

### 4.4 🟠 Information des destinataires (recruteurs) absente

Les adresses nominatives obtenues via Hunter.io (`type=personal`, [api/process-candidatures.js:438](api/process-candidatures.js#L438)) sont des données personnelles de tiers collectées indirectement. L'art. 14 RGPD impose de les informer de l'origine de leurs données lors du premier contact. Les e-mails envoyés ne contiennent **ni mention de la source, ni lien de désinscription, ni coordonnées du responsable de traitement**.

S'y ajoute le repli sur des adresses devinées `rh@`/`contact@` ([api/process-candidatures.js:459](api/process-candidatures.js#L459)) et, pour Adzuna, des **domaines entièrement inventés** (`extractDomain` construit `<nomsociété>.fr`, [api/adzuna-jobs.js:107](api/adzuna-jobs.js#L107)) : le CV et les coordonnées du candidat peuvent ainsi être envoyés à une organisation tierce sans aucun lien avec l'entreprise visée. C'est une divulgation de données personnelles à des destinataires non identifiés.

### 4.5 🟠 Rétention « 2 ans max » annoncée mais non implémentée

Aucun mécanisme de purge (ni cron, ni script, ni politique Supabase) n'existe. Aucun outil non plus pour traiter une demande d'effacement ou de portabilité : le traitement serait manuel, sans traçabilité.

### 4.6 🟠 Mentions légales et CGV incomplètes

| Manque | Fondement |
|---|---|
| SIRET / RCS / forme juridique définitive (« en cours d'immatriculation ») | art. 6-III LCEN |
| Numéro de TVA ou mention « TVA non applicable, art. 293 B du CGI » — les prix sont annoncés « TTC » | CGI |
| Téléphone de l'hébergeur | art. 6-III LCEN |
| **Médiateur de la consommation** (obligatoire pour toute vente B2C en ligne) | art. L612-1 c. consommation |
| Description du droit de rétractation de 14 jours et formulaire type (seule l'exclusion L221-28 est mentionnée) | art. L221-5 |
| CGV art. 3 mentionne « formulaire (12 étapes) », le tunnel en compte 13 | cohérence contractuelle |

**Point positif :** la case de renonciation expresse au droit de rétractation ([formulaire.html:346-349](formulaire.html#L346)) est correctement rédigée et bloquante — c'est conforme et récent.

### 4.7 🟠 Allégations commerciales non étayées

- **Témoignages** ([index.html:119-150](index.html#L119)) : trois avis nominatifs avec résultats chiffrés, sans mécanisme de vérification. Depuis la transposition de la directive Omnibus, présenter des avis sans en vérifier l'authenticité est une pratique commerciale trompeuse (art. L121-4, 21° c. consommation).
- **« Ciblage IA des entreprises »** : il n'y a aucune IA dans le ciblage. C'est une liste statique de 680 entreprises codée en dur ([api/companies.js](api/companies.js)) filtrée par correspondance de chaînes sur le nom de ville. L'IA n'intervient que pour la rédaction de la lettre.
- **« On identifie les PME et ETI »** ([index.html:113](index.html#L113)) : la base est constituée de grands groupes (Carrefour, Airbus, BNP…), au point qu'une liste `GRANDES_ENTREPRISES` existe pour éviter de leur écrire à des adresses génériques.
- **« Jusqu'à 300 candidatures »** : structurellement inatteignable (cf. 5.1).

---

## 5. Fonctionnalités : ce qui marche, ce qui manque

### 5.1 🔴 Les volumes vendus ne peuvent pas être livrés

[api/process-candidatures.js:618](api/process-candidatures.js#L618) :

```js
const companies = await findCompanies(secteur, candidat.ville, Math.min(volume - totalSent, 15));
```

Plafond de **15 entreprises par secteur**, chacune donnant au plus 3 contacts Hunter (ou 2 adresses de repli). Plafond absolu : **~45 envois par secteur sélectionné**.

| Offre | Vendu | Secteurs nécessaires (cas optimal) | Résultat si 1 secteur choisi |
|---|---|---|---|
| Starter 29 € | 50 | 2 | ~45 (90 %) |
| Pro 59 € | 150 | 4 | ~45 (30 %) |
| Max 99 € | 300 | **7 minimum** | ~45 (**15 %**) |

Le candidat choisit librement ses secteurs et n'est jamais averti. Aucun contrôle ne compare `totalSent` au volume vendu : l'e-mail de fin affiche même un « taux de réussite » calculé sur le volume promis, donc un 15 % affiché comme tel, sans explication ni remboursement.

Aggravant : `getCompaniesByRegion` étant déterministe, **tous les candidats d'un même secteur/région contactent les 15 mêmes entreprises**. Aucune rotation, aucune déduplication inter-campagnes : les mêmes recruteurs reçoivent les mêmes e-mails en boucle (impact délivrabilité et réputation).

### 5.2 🔴 Le traitement dépasse presque certainement le timeout Vercel

Aucun `maxDuration` n'est configuré dans [vercel.json](vercel.json) (défaut : 10 s en Hobby, 15 s en Pro sans configuration explicite). Or, pour un seul candidat, la fonction effectue en série :

- 1 appel Claude (~3-8 s),
- 1 appel Hunter par entreprise (15 par secteur),
- **le téléchargement du CV répété pour CHAQUE e-mail** ([api/process-candidatures.js:483,510,680](api/process-candidatures.js#L510)) — 300 téléchargements pour une campagne Max,
- 1 appel Brevo par e-mail + `setTimeout(300 ms)` imposé,
- le tout **pour 3 candidats à la suite** (`limit(3)`).

Ordre de grandeur : 5 à 15 minutes par campagne. La fonction sera tuée en cours de route. Conséquences :

- Le statut reste bloqué sur `En cours d'envoi`, or la requête ne sélectionne que `statut = 'Payé'` → **le dossier n'est jamais repris**, aucun retry, aucune alerte. La campagne meurt à moitié livrée.
- L'e-mail de fin de campagne et `entreprises_contactees` ne sont jamais écrits.

**Correction :** découper en lots (file d'attente, un e-mail ou un lot de N par invocation), rendre l'opération idempotente (table `envois` avec état par destinataire), télécharger le CV une seule fois par candidat, `maxDuration` explicite.

### 5.3 🟠 Fonctionnalités facturées absentes du code

| Vendu | Où | Implémentation |
|---|---|---|
| « Relances automatiques » (Pro, Max) | [index.html:174](index.html#L174), [formulaire.html:327](formulaire.html#L327) | **Aucune.** Aucun code de relance nulle part. |
| « Appel coaching 30 min » (Max) | [index.html:186](index.html#L186) | **Aucune.** Pas de prise de rendez-vous, pas de notification. |
| « Garantie entretien » (Max) | [index.html:187,193](index.html#L187), CGV art. 6 | **Non opérable** : aucun suivi des entretiens obtenus, aucun déclencheur de seconde campagne. |
| « Priorité de traitement » (Pro) | [index.html:175](index.html#L175) | **Aucune** : la file est traitée par `created_at` croissant, sans considération de plan. |
| « Suivi en temps réel » (Pro) | [index.html:176](index.html#L176) | **Trompeur** : `/suivi` est accessible à tous les plans, et le compteur ne bouge qu'à la toute fin (il est extrait par regex du champ `message`). |

### 5.4 🟠 Bugs fonctionnels confirmés

1. **`entreprises_contactees` est doublement encodé.** Écrit via `JSON.stringify(...)` ([api/process-candidatures.js:720](api/process-candidatures.js#L720)), relu comme un tableau :
   - [suivi.html:267](suivi.html#L267) : `.map()` sur une chaîne → `TypeError`, la section « Entreprises contactées » ne s'affiche jamais (fonctionnalité pourtant vendue comme « rapport d'envoi complet »).
   - [admin.html:473](admin.html#L473) : `.length` sur une chaîne → affiche le nombre de **caractères**, par ex. « 1523 entreprises ».
2. **L'échec d'upload de CV est silencieux.** [app.js:286-288](app.js#L286) : si `uploadCV` renvoie `null`, la campagne est enregistrée sans CV ni texte, sans message. Le candidat paie, ses candidatures partent sans pièce jointe et avec la lettre générique de repli (pas de Claude).
3. **L'expéditeur `julienfranck30@gmail.com`** est utilisé dans [api/webhook.js:74](api/webhook.js#L74) : Brevo ne peut pas authentifier un domaine `gmail.com` (SPF/DKIM/DMARC) → l'e-mail de confirmation post-paiement finit en spam ou est rejeté. C'est aussi un reliquat de l'ancienne marque « TalentConnect », encore affichée dans ce même e-mail.
4. **Incohérence de mapping secteur/Adzuna** : le formulaire propose « Ressources Humaines », `SECTEUR_TO_ADZUNA` attend « RH / Recrutement » ([api/adzuna-jobs.js:24](api/adzuna-jobs.js#L24)) → repli silencieux sur `it-jobs`, offres hors sujet.
5. **`getLocationParam` calcule `locationPath` qui n'est jamais utilisé** ([api/adzuna-jobs.js:57](api/adzuna-jobs.js#L57)).
6. **21 des 66 descriptions d'entreprise ne se déclenchent jamais** : les clés de `getDescriptionEntreprise` (`'Axa'`, `'DHL'`, `'Orange'`, `'Vinci'`…) ne correspondent pas exactement aux noms de `companies.js` (`'AXA France'`, `'DHL France'`…). Les lettres tombent sur la phrase générique.
7. **19 domaines dupliqués** dans la base d'entreprises (`spie.com` ×3, `engie.fr` ×2…) → doublons d'envoi vers la même société.
8. **Le commentaire d'en-tête annonce « 1500+ entreprises »** pour 680 entrées (661 domaines uniques).
9. **Cadence vs promesse** : cron quotidien à 08:00, 3 candidats par exécution. Au-delà de 3 commandes/jour, un arriéré se forme, alors que les CGV promettent 24 h ouvrées et que l'e-mail post-paiement annonce « dans les prochaines minutes » ([api/webhook.js:44](api/webhook.js#L44)).
10. **Risque pour le compte Gmail du candidat** : envoyer 300 e-mails en quelques minutes depuis un Gmail gratuit (limite 500/jour, détection d'envoi en masse) expose le candidat à une suspension de sa messagerie personnelle. Aucun avertissement n'est donné dans l'e-mail qui propose la connexion.

---

## 6. Code mort et dette technique

### 6.1 Fichiers entièrement morts (~200 lignes)

| Fichier | État |
|---|---|
| [api/api/confirm-candidature.js](api/api/confirm-candidature.js) (91 l.) | Doublon obsolète, marque « TalentConnect », expéditeur Gmail personnel. Déployé publiquement sur `/api/api/confirm-candidature` → relais d'e-mail ouvert supplémentaire. |
| [api/api/confirm-fin-campagne.js](api/api/confirm-fin-campagne.js) (107 l.) | Jamais appelé : la logique est dupliquée en ligne dans `process-candidatures.js`. |
| [api/candidatures.js](api/candidatures.js) (4 l.) | Stub renvoyant `{message:'API OK'}`. |

### 6.2 Blocs morts dans des fichiers vivants (~160 lignes)

- **[app.js:374-493](app.js#L374)** — tout le panneau d'administration historique. `admin.html` embarque son propre script et **ne charge jamais `app.js`** (seul `formulaire.html` le fait). Ce code mort contient une seconde copie des identifiants admin et la fonction destructrice `clearAll()`.
- **[app.js:131-137](app.js#L131)** — `getStepForField`, jamais appelée.
- **[app.js:23](app.js#L23)** — `badgeCls` référence les statuts `'Retenu'`/`'Refusé'` qui n'existent plus dans le workflow.
- **[api/process-candidatures.js:46-160](api/process-candidatures.js#L46)** — `extraireFormation`, `extraireCompetences`, `extraireSituation`, `accordGenre` : ~150 lignes d'heuristiques de traitement du français, utilisées uniquement par le gabarit de repli, qui fait doublon avec l'appel Claude.
- **`DOMAINES_PAR_SECTEUR`** est exporté ([api/companies.js:782](api/companies.js#L782)) mais aucun module ne le consomme.
- **`getMissions(company, poste)`** ignore complètement son paramètre `company`.
- **23 classes CSS inutilisées sur 141** dans [style.css](style.css) (`.admin-header`, `.btn-retain`, `.logos-row`, `.rating-bar`…), héritées de l'ancien design admin.
- **Dépendance `cloudinary`** déclarée dans [package.json](package.json), importée nulle part.

### 6.3 Duplication

- **~600 lignes de gabarits HTML d'e-mails** dupliquées entre `webhook.js`, `confirm-candidature.js`, `api/api/*` et le bloc en ligne de `process-candidatures.js`. Les marques et signatures y divergent (« TalentConnect » / « Lance Mon Job », Paris / Lyon, Gmail perso / support@).
- **Identifiants Supabase répétés dans 3 fichiers** (`app.js`, `admin.html`, `suivi.html`).
- **Chaînes de statut en dur** (`'Payé'`, `"En cours d'envoi"`, `'Envoyé'`, `'En attente paiement'`) répétées dans 5 fichiers, sans énumération partagée — une faute de frappe casse silencieusement la chaîne de traitement.
- **Deux tableaux de bord d'administration** aux fonctionnalités divergentes (celui de `app.js` sait supprimer, celui de `admin.html` sait exporter en CSV).

### 6.4 Outillage absent

- **Aucun lockfile** (`package-lock.json` absent) → builds non reproductibles.
- **Aucun test**, **aucune CI**, **aucun linter**. L'incident de `a7470a1` (trois erreurs de syntaxe, dont un `const` dupliqué et un bloc collé à l'intérieur d'un littéral d'objet) aurait été détecté par un simple `node --check` en pre-commit.
- **Modules mélangés** : `upload-cv.js` combine `require()` et `export default`/`export const` ; les autres fichiers sont en CommonJS pur. Cela fonctionne sur les versions récentes de Node (détection automatique de module), mais reste fragile face à un changement de runtime — à uniformiser.
- **Aucune supervision** : uniquement des `console.log`. Rien ne signale qu'un cron échoue pendant un mois.

---

## 7. Ergonomie et accessibilité

### 7.1 Tunnel de conversion

- **13 étapes avant le paiement**, sans sauvegarde : un rafraîchissement, un retour arrière navigateur ou une coupure réseau efface tout. Aucun `localStorage`, aucune reprise possible.
- **L'étape 12 est un mur marketing** inséré au milieu d'un tunnel payant, après que l'utilisateur a déjà fourni CV et coordonnées — friction inutile à ce stade.
- **La barre de progression n'atteint jamais 100 %** : `((step-1)/13)*100` plafonne à 92 % à la dernière étape ([app.js:55](app.js#L55)).
- **Le récapitulatif final ne permet pas de corriger un champ** : il faut remonter étape par étape avec « Retour ».
- **L'écran de succès annonce « Tu vas être redirigé vers le paiement »** mais aucune redirection n'a lieu — un bouton apparaît, à cliquer manuellement ([formulaire.html:363](formulaire.html#L363)).
- **Aucune relance si le paiement est abandonné** : le dossier reste « En attente paiement » indéfiniment, sans e-mail de rappel ni lien de reprise.

### 7.2 Validation des saisies

| Champ | Validation actuelle | Problème |
|---|---|---|
| E-mail | `email.includes('@')` | `a@` est accepté |
| Téléphone | non vide | Aucun format, aucune normalisation, alors que l'UI affiche « 🇫🇷 +33 » |
| Dates (3 champs texte) | non vides | `31/13/2026` accepté ; pas de contrôle « postérieur à aujourd'hui » ; pas de contrôle `dispo_tard ≥ dispo_tot` |
| CV | extension côté serveur | Taille jamais vérifiée malgré « 5 Mo max » affiché |
| Ville | non vide | Texte libre, alors que le moteur attend une liste fermée de 12 villes — « Villeurbanne » ou « 69100 » ne matchent aucune région |

Aucune validation n'existe côté serveur : la table est alimentée directement par le client.

### 7.3 Accessibilité (non conforme RGAA / WCAG AA)

- **Tous les contrôles sont des `<div onclick>`** (chips, cartes de prix, FAQ, lignes de tableau) : non focalisables, inutilisables au clavier, invisibles pour les lecteurs d'écran. Aucun `role`, `tabindex`, `aria-pressed` ou `aria-expanded`.
- **Aucune gestion du focus** entre les étapes : le lecteur d'écran reste sur l'élément précédent après un changement d'étape.
- **Contraste insuffisant** : `--muted: #777770` sur `#080612` donne un ratio d'environ 4,2:1, en dessous du 4.5:1 requis — et ce token est utilisé pour du texte de 11 à 13 px, largement présent (sous-titres, mentions légales, libellés).
- **Messages d'erreur non annoncés** : les `div.err` ne portent pas `role="alert"`/`aria-live`.
- **Pas de `<label for>`** : les libellés sont des `<label>` englobants ou de simples `<div>`.
- **Tableau d'administration non responsive**, aucun `scope` sur les en-têtes.

### 7.4 Espace de suivi

- L'accès se fait **par simple saisie d'une adresse e-mail**, sans lien magique ni code : la page affiche à quiconque connaît une adresse l'ensemble des informations de la campagne correspondante (cf. 3.1).
- Seule **la campagne la plus récente** est affichée : un client fidèle perd l'historique.
- La progression est **dérivée par regex du champ `message`** (`/(\d+) candidatures envoyées/`) : elle reste à 0 % pendant toute la campagne et saute à sa valeur finale à la toute fin.

---

## 8. SEO, contenu et exploitation

- 🟠 **L'index du blog est cassé.** [vercel.json](vercel.json) route `/blog` vers `/blog/index.html`, **qui n'existe pas** → 404. Le fichier [blog.html](blog.html) est à la racine mais écrit comme s'il était dans `/blog/` (`../style.css`, liens relatifs vers `candidature-spontanee.html`) : à son emplacement réel, tous ses liens sont cassés. Sa balise `canonical` pointe d'ailleurs vers `/blog/`, c'est-à-dire vers la 404.
- 🟡 **Aucun `robots.txt`** → le `sitemap.xml` n'est déclaré nulle part.
- 🟡 **Aucun favicon référencé** dans aucune page, alors que [favicon-lancemonjob.svg](favicon-lancemonjob.svg) existe dans le dépôt.
- 🟡 **Balises Open Graph présentes sur un seul article** sur six ; aucune Twitter Card. Les partages sociaux sont sans aperçu.
- 🟡 **Aucune donnée structurée** : la FAQ de la page d'accueil et les six articles se prêtent directement à `FAQPage` / `Article` (gain de visibilité immédiat, effort faible).
- 🟡 `/suivi` et l'index du blog sont absents du `sitemap.xml`.
- 🟡 **Aucune page 404 personnalisée.**

---

## 9. Plan d'action priorisé

### P0 — À traiter immédiatement (jours, pas semaines)

| # | Action | Renvoi |
|---|---|---|
| 1 | Activer RLS sur `candidatures` (aucun accès `anon`), faire tourner la clé publiée, basculer toutes les lectures/écritures derrière des fonctions serverless | 3.1, 3.2 |
| 2 | **Révoquer tous les jetons Gmail existants**, chiffrer le champ, signer le `state` OAuth (HMAC + nonce + expiration), vérifier la correspondance du compte Google | 3.4 |
| 3 | Rendre le bucket `cvs` privé, passer aux URLs signées, ajouter `maxFileSize` et la vérification de la signature PDF | 3.7 |
| 4 | Vérifier la signature du webhook Stripe, contrôler le montant vs le plan, lier par `client_reference_id` | 3.3 |
| 5 | Protéger `/api/process-candidatures`, `/api/confirm-candidature` et `/api/brevo-stats` (secret + limitation de débit), supprimer `api/api/` et `api/candidatures.js` | 3.5, 3.6, 6.1 |
| 6 | Remplacer l'authentification admin côté client par une authentification serveur | 3.8 |
| 7 | Notifier la CNIL (art. 33), consigner l'incident, évaluer l'information des personnes | 4.1 |
| 8 | Ajouter un bandeau de consentement bloquant avant GA4 | 4.3 |

### P1 — Sous 2 à 4 semaines

| # | Action | Renvoi |
|---|---|---|
| 9 | Refondre le moteur d'envoi : file d'attente idempotente (table `envois` par destinataire), lots courts, `maxDuration` explicite, téléchargement du CV une seule fois, retry et alerte | 5.2 |
| 10 | Aligner l'offre commerciale sur la capacité réelle : élargir la base, lever le plafond de 15/secteur, dédupliquer inter-campagnes, **ou** réduire les volumes annoncés et rembourser le delta | 5.1 |
| 11 | Retirer ou implémenter les fonctionnalités facturées non livrées (relances, coaching, garantie entretien, priorité) | 5.3 |
| 12 | Corriger le double encodage de `entreprises_contactees` (colonne `jsonb`, `JSON.stringify` supprimé) et les deux affichages | 5.4.1 |
| 13 | Rendre visible l'échec d'upload de CV et bloquer la soumission sans CV | 5.4.2 |
| 14 | Compléter la politique de confidentialité (Anthropic, Hunter, Adzuna, Google) et ajouter au minimum un lien de désinscription + la mention de la source dans les e-mails aux recruteurs | 4.2, 4.4 |
| 15 | Compléter mentions légales et CGV (SIRET, TVA, médiateur, droit de rétractation, hébergeur) | 4.6 |
| 16 | Échapper toutes les interpolations `innerHTML` (admin, suivi, gabarits d'e-mails) | 3.9, 3.5 |
| 17 | Supprimer l'expéditeur `@gmail.com` de `webhook.js` et le reliquat de marque « TalentConnect » | 5.4.3 |
| 18 | Corriger l'index du blog (créer `blog/index.html`, ajuster les chemins et le canonical) | 8 |

### P2 — Dette et qualité (1 à 2 mois)

| # | Action | Renvoi |
|---|---|---|
| 19 | Supprimer le code mort (~360 lignes : bloc admin d'`app.js`, `getStepForField`, heuristiques CV redondantes, 23 classes CSS, dépendance `cloudinary`) | 6.1, 6.2 |
| 20 | Factoriser les gabarits d'e-mails (~600 lignes dupliquées) et centraliser statuts, plans et identifiants | 6.3 |
| 21 | Ajouter lockfile, ESLint, `node --check` en pre-commit et une CI GitHub Actions ; supervision + alerte sur échec de cron | 6.4 |
| 22 | Valider les entrées côté serveur (schéma), normaliser téléphone et dates, remplacer la ville en texte libre par une autocomplétion sur référentiel | 7.2 |
| 23 | Accessibilité : contrôles natifs (`<button>`, `<input type="radio">`), gestion du focus, `aria-live` sur les erreurs, contraste ≥ 4.5:1 | 7.3 |
| 24 | Sauvegarder l'état du tunnel, permettre la correction depuis le récapitulatif, ajouter la relance de paiement abandonné | 7.1 |
| 25 | Corriger le ciblage : mapping « Ressources Humaines » pour Adzuna, `locationPath` inutilisé, 19 domaines dupliqués, 21 descriptions d'entreprise inopérantes, et **supprimer le devinage de domaine d'Adzuna** (`<nom>.fr`) | 5.4.4-8, 4.4 |
| 26 | Implémenter la purge à 2 ans et un parcours de demande RGPD (accès / effacement / portabilité) | 4.5 |
| 27 | SEO : `robots.txt`, favicon, Open Graph partout, données structurées `FAQPage`/`Article`, page 404 | 8 |

---

## 10. Annexe — inventaire

| Fichier | Lignes | Rôle | État |
|---|---|---|---|
| `api/process-candidatures.js` | 804 | Moteur d'envoi (cron) | 🔴 Endpoint public, timeout probable, plafond de volume |
| `api/companies.js` | 782 | Base de 680 entreprises, 18 secteurs | 🟡 19 doublons, en-tête mensonger (« 1500+ ») |
| `admin.html` | 529 | Tableau de bord admin | 🔴 Identifiants en dur, XSS |
| `app.js` | 493 | Tunnel + admin historique | 🔴 Secrets exposés ; l. 374-493 mortes |
| `formulaire.html` | 377 | Tunnel 13 étapes | 🟠 Accessibilité, validation |
| `suivi.html` | 292 | Suivi candidat | 🔴 Accès sans authentification, bug d'affichage |
| `index.html` | 289 | Page d'accueil | 🟠 Allégations non étayées |
| `style.css` | 220 | Styles partagés | 🟡 23 classes inutilisées / 141 |
| `blog/*.html` | 1 211 | 6 articles SEO | 🟢 Corrects (1 seul avec OG) |
| `blog.html` | 154 | Index du blog | 🔴 Inaccessible (404) + chemins cassés |
| `api/gmail.js` | 146 | OAuth + envoi Gmail | 🔴 `state` non signé, jetons en clair |
| `api/webhook.js` | 141 | Webhook Stripe | 🔴 Signature non vérifiée, marque obsolète |
| `confidentialite.html` | 125 | Politique de confidentialité | 🟠 Sous-traitants manquants |
| `api/adzuna-jobs.js` | 118 | Offres publiées | 🟠 Domaines inventés |
| `api/api/confirm-fin-campagne.js` | 107 | — | ⚫ Mort |
| `api/confirm-candidature.js` | 96 | E-mail de confirmation | 🟠 Relais ouvert, injection HTML |
| `api/api/confirm-candidature.js` | 91 | — | ⚫ Mort + relais ouvert |
| `mentions-legales.html` | 82 | Mentions légales | 🟠 Incomplètes |
| `api/upload-cv.js` | 71 | Upload CV | 🔴 Non authentifié, bucket public |
| `cgv.html` | 60 | CGV/CGU | 🟠 Incomplètes, incohérences |
| `api/brevo-stats.js` | 36 | Statistiques e-mailing | 🟠 Public, CORS `*` |
| `vercel.json` | 15 | Routage + cron | 🟠 Route `/blog` cassée, pas de `maxDuration` |
| `package.json` | 10 | Dépendances | 🟡 `cloudinary` inutilisé, pas de lockfile |
| `api/candidatures.js` | 4 | — | ⚫ Mort |

> `api/companies.js` et `api/adzuna-jobs.js` sont de simples modules, mais Vercel les expose malgré tout comme routes HTTP (`/api/companies`, `/api/adzuna-jobs`) : les appeler renvoie une erreur 500 puisqu'ils n'exportent pas de handler. À déplacer hors de `api/` (par ex. `lib/`).

**Légende :** 🔴 critique · 🟠 à corriger · 🟡 mineur · 🟢 conforme · ⚫ mort

---

### Note méthodologique

Les vérifications dynamiques se sont limitées à trois requêtes en lecture seule vers l'infrastructure de production, destinées à confirmer ou infirmer l'exposition des données : deux requêtes `HEAD` sur l'API REST Supabase (renvoyant uniquement des en-têtes de comptage, aucune donnée personnelle) et une requête sur un objet de stockage inexistant. **Aucune écriture, suppression ou modification n'a été effectuée, et aucune donnée personnelle n'a été consultée.** Les points 3.2 (écriture anonyme) et 5.2 (timeout) sont déduits du code et du comportement de l'application en production ; ils restent à confirmer par un test en environnement de recette.
