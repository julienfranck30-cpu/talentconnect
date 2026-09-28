# Notification d'incident de sécurité — RGPD art. 33

**À envoyer à la CNIL sous 72h** (déjà en retard depuis l'audit du 23/09/2026 — à traiter en urgence)

---

## 1. Responsable du traitement

- **Nom** : Lance Mon Job (TalentConnect)
- **Contact** : julienfranck30@gmail.com
- **Représentant** : [à compléter si différent]

## 2. Nature de la violation

**Type** : Accès non autorisé à des données personnelles + risque de détournement de comptes Gmail

**Description** :
- Table Supabase `candidatures` accessible en lecture ET écriture par le rôle `anon` (clé publique exposée dans le code frontend)
- Jetons OAuth Gmail stockés en clair dans la base, lisibles par tout détenteur de la clé publique
- CV de candidats stockés dans un bucket public avec URLs devinables
- Endpoints API publics sans authentification (relais d'e-mail, déclenchement d'envoi en masse)
- Interface admin avec identifiants en dur côté client (`admin`/`admin123`)

## 3. Données concernées

- **Nombre de personnes affectées** : [à compléter — `SELECT count(*) FROM candidatures`]
- **Types de données** :
  - Identité (nom, prénom, email, téléphone)
  - Données professionnelles (poste visé, secteurs, CV, lettre de motivation)
  - Données de paiement (plan souscrit, statut)
  - Jetons OAuth Gmail (refresh tokens)
  - Données de suivi (entreprises contactées, statut campagne)

## 4. Conséquences probables

- **Accès non autorisé** aux données personnelles de tous les candidats
- **Risque de détournement de comptes Gmail** des candidats ayant connecté leur boîte mail
- **Usurpation d'identité** possible via le relais d'e-mail ouvert (phishing signé par le domaine)
- **Modification/suppression** de candidatures par un attaquant
- **Atteinte à la réputation** et perte de confiance

## 5. Mesures prises ou proposées

### Mesures immédiates (déjà en cours)
1. **Révocation des jetons Gmail** stockés dans la base
2. **Activation de RLS** (Row Level Security) sur la table `candidatures` — blocage de l'accès `anon`/`authenticated`
3. **Rotation de la clé publique** Supabase — suppression du frontend, bascule vers des fonctions serveur avec clé secrète
4. **Vérification de signature** des webhooks Stripe
5. **Passage du bucket CV en privé** + URLs signées

### Mesures complémentaires
6. Authentification serveur pour l'interface admin
7. Protection des endpoints API par secret partagé (`CRON_SECRET`)
8. Échappement des données dans les templates HTML (anti-XSS)
9. Bandeau de consentement cookies avant chargement GA4

## 6. Communication aux personnes concernées

**Recommandation** : OUI, une communication est nécessaire car le risque est élevé (accès à des données personnelles sensibles + risque de détournement Gmail).

**Canal proposé** : Email à tous les candidats concernés, les informant :
- De la nature de l'incident
- Des données potentiellement affectées
- Des mesures prises
- Des recommandations (vérifier l'activité Gmail, changer les mots de passe, etc.)

## 7. Date et signature

- **Date de découverte** : 23/09/2026 (audit de sécurité)
- **Date de notification** : [date du jour]
- **Signature** : [responsable du traitement]

---

**Documents joints** :
- Rapport d'audit complet (`AUDIT.md`)
- Preuves de correction (commits Git, scripts SQL)
- Registre des traitements (à mettre à jour)
