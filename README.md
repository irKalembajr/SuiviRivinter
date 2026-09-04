# RIVINTER — Compte emballages global

Nouvelle application indépendante : **nouveau dépôt GitHub, nouveau projet Vercel, nouveau projet Supabase**. Ne pas appliquer ces scripts à l’ancienne application. Aucun site ni stock physique de dépôt n’est géré ici.

## Contenu

- Dashboard : position signée par Bremer et valeur nette en francs congolais.
- Journal global : consignation/livraison, déconsignation/retour, payante, bouteilles, casse/manquant et perte complète.
- PDF texte ou scanné : lecture locale, OCR français, contrôle humain avant encodage et stockage privé du justificatif.
- Report initial saisi manuellement, modifiable et verrouillable par un administrateur, avec historique des changements.
- Reprise fidèle d’un classeur préanalysé, réservée à une base neuve.
- Rapports mensuels, écart livraisons–retours, CSV, export Excel complet et impression.
- PDF A4 des dix dernières transactions datées, avec références, impacts et quantités signées.
- Comptes administrateurs/utilisateurs, désactivation, changement de mot de passe.
- Annulation par contrepassation datée ; pas de suppression ni modification des mouvements originaux.

Les données historiques sont fournies **séparément**, dans un fichier de reprise privé. La démonstration utilise seulement des données fictives en mémoire et les perd à l’actualisation.

## 1. Nouveau projet Supabase

1. Créer un **nouveau projet**, avec ses propres identifiants.
2. Dans SQL Editor, exécuter dans cet ordre :
   - `supabase/001_global.sql` : tables `rg_*`, calculs, rôles, reprise et audit ;
   - `supabase/002_storage.sql` : espace privé `rg-documents` et ses règles.
3. Dans Authentication > Users, créer le premier utilisateur avec une adresse que vous contrôlez, un mot de passe fort et un email confirmé.
4. Ouvrir `supabase/003_first_admin.sql`, remplacer l’adresse d’exemple, puis exécuter ce script une seule fois.
5. Désactiver les inscriptions publiques. Les comptes suivants seront créés depuis Gestion des comptes.
6. Définir l’URL Vercel comme URL du site dans les réglages Authentication.

Un compte Auth seul ne donne aucun accès au journal : il faut aussi un profil actif dans `rg_profiles`. Ne pas créer de politiques autorisant toutes les écritures pour corriger une erreur.

## 2. GitHub et Vercel

1. Décompresser l’archive source et placer **son contenu** à la racine d’un nouveau dépôt GitHub.
2. Ne jamais ajouter le fichier de reprise, le classeur, les PDF réels, un fichier `.env` ou une clé serveur à GitHub.
3. Importer ce dépôt dans un nouveau projet Vercel.
4. Choisir Node.js **24.x**, framework Vite, commande de construction `pnpm build`, dossier de sortie `dist`. Le fichier `vercel.json` fournit ces réglages.
5. Ajouter les quatre variables suivantes dans les environnements Vercel nécessaires :

| Variable | Valeur | Visibilité |
|---|---|---|
| `VITE_SUPABASE_URL` | URL du **nouveau** projet | Publique |
| `VITE_SUPABASE_ANON_KEY` | Clé publique publishable ou anon | Publique, protégée par les règles SQL |
| `SUPABASE_URL` | Même URL | Serveur |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé secrète/service_role du **nouveau** projet | **Serveur uniquement** |

6. Déployer, puis se connecter avec le premier administrateur.

Ne jamais préfixer la clé serveur par `VITE_`. Elle sert uniquement à la fonction Vercel `api/accounts.js`, après vérification du rôle administrateur.

La création de comptes exige Vercel (ou un hébergement compatible avec cette fonction). Un hébergement statique seul n’exécute pas cette fonction. La démonstration Sites est volontairement sans base réelle.

## 3. Reprendre les données avant toute nouvelle saisie

1. Se connecter à la nouvelle application, aller dans **Reprise du classeur**.
2. Choisir le fichier JSON privé fourni séparément et vérifier l’aperçu.
3. Confirmer. La reprise est atomique et refuse une base déjà utilisée ; elle ne remplace jamais des écritures.
4. Aller dans **Report initial**, déverrouiller en indiquant un motif, confirmer la date correcte du report, puis reverrouiller.
5. Vérifier les soldes avec le compte rendu privé fourni.

**Ne pas initialiser manuellement le report avant cette reprise.** Le report du classeur contient des indications de date contradictoires : la nouvelle application attend une confirmation plutôt que d’en inventer une.

Les écritures historiques sans date restent sans date. Elles sont incluses dans le dashboard global, mais exclues des rapports datés avec un avertissement de rapport partiel. Les références répétées et écritures à zéro du classeur sont conservées. Les cellules auxiliaires hors journal sont archivées, sans devenir des mouvements supplémentaires.

## 4. Utilisation des PDF

1. Importer **un seul bon par PDF**, 15 Mo et 10 pages maximum.
2. Attendre la lecture. Pour un scan, le premier OCR peut prendre du temps : son moteur et sa langue sont chargés depuis le site.
3. Vérifier le numéro, la date de livraison/retour, toutes les quantités, le client et les annotations manuscrites dans le PDF affiché.
4. Corriger les champs si nécessaire. Les avertissements exigent une note de justification.
5. Cocher la confirmation et enregistrer. C’est seulement alors que le PDF est envoyé dans Supabase privé et le mouvement encodé.

Un bon incomplet signale les pages manquantes. Une lecture OCR n’est jamais considérée comme certaine. Le document d’exemple de déconsignation annonce deux pages alors qu’une seule est fournie : obtenir la page manquante est préférable à une validation partielle.

Les lignes de livraison sont déjà en **casiers**. Pour les retours, les bouteilles sont divisées par le conditionnement, puis comparées aux bacs ; les bacs inclus dans les casiers ne sont pas additionnés une deuxième fois. Les bacs seuls excédentaires sont isolés.

Les articles de livraison inconnus doivent être associés à un Bremer dans **Articles PDF**, ou saisis manuellement après vérification. Les codes de bouteilles/caisses de retour reconnus correspondent au modèle analysé ; un autre format peut nécessiter une adaptation.

L’empreinte SHA-256 et la référence du bon limitent les doublons. Une référence de déconsignation avec suffixe est rapprochée de son numéro principal à dix chiffres. Une transaction échouée après transfert peut laisser un PDF orphelin privé ; il n’affecte pas les soldes. Ne pas effacer les documents référencés.

## 5. Règles comptables

**Solde négatif : Brasimba doit à Rivinter. Solde positif : Rivinter doit à Brasimba.**

Solde = report initial + débits − crédits. Valeur = somme des soldes par type × tarif.

| Opération | Effet sur le compte global |
|---|---|
| Consignation/livraison | Débit de casiers : augmente le solde |
| Déconsignation/retour | Crédit de casiers : diminue le solde |
| Consignation payante | Crédit d’emballages ; le montant du BV doit correspondre à leur valeur |
| Consignation bouteilles | Crédit des casiers constitués et débit des bacs utilisés ; BV = valeur des bouteilles uniquement |
| Casse/manquant bouteilles | Débit en **équivalents casiers**, crédit des bacs récupérés |
| Perte emballage complet | Débit du casier complet, sans crédit automatique d’un bac |
| Contrepassation | Impact opposé, à la date d’annulation, sans effacer l’original |

Tarifs : casier 65 cl, 33 cl noir, 33 cl vert et 30 cl : **16 500 Fc** ; ALE 50 cl : **24 500 Fc** ; bac seul : **4 500 Fc**.

Bouteilles : 65 cl = 12 par casier à 1 000 Fc ; 50 cl = 20 à 1 000 Fc ; 33 cl noir/vert et 30 cl = 24 à 500 Fc. Les consignations de bouteilles exigent des casiers complets. Les casses sont saisies en équivalents casiers, conformément à l’unité du journal ; les bouteilles isolées non convertibles ne sont pas arrondies.

Les tarifs sont fixés dans `ledger.js` et `rg_price`. Tout changement futur doit être versionné et testé ; ne pas modifier les valeurs historiques. Les nouvelles opérations sont recalculées **côté PostgreSQL** : changer le navigateur ne permet pas de choisir un montant arbitraire.

## 6. Droits et conservation

- Utilisateur actif : consultation globale, saisie et import PDF.
- Administrateur actif : mêmes droits, plus comptes, report, reprise, correspondances, audit et annulation.
- Chaque administrateur possède les mêmes droits ; « principal » désigne le premier compte, pas un troisième rôle.
- Les données réelles ne sont pas enregistrées dans le stockage local du navigateur.
- Le stockage Supabase est privé ; les liens de consultation expirent après deux minutes.
- Sauvegarder régulièrement **la base et les objets Storage séparément**, ainsi que le classeur et le JSON de reprise d’origine. Un export CSV n’est pas une sauvegarde complète.
- En cas de mot de passe oublié, le propriétaire du projet peut rétablir l’accès depuis Supabase Auth. Le changement de son propre mot de passe est disponible une fois connecté.

## Développement

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
```

Le développement sans variables Supabase ouvre la démonstration. `pnpm dev` n’exécute pas la fonction Vercel de création des comptes ; utiliser un déploiement Vercel de test pour ce parcours.

L’OCR est préparé automatiquement avant lancement et construction. Ne pas ajouter `public/ocr` généré à GitHub : ces fichiers sont reconstruits à partir des dépendances verrouillées.

L’exporteur `scripts/export-workbook.py` requiert Python et openpyxl ; il lit le format précis du classeur étudié, contrôle les soldes ligne par ligne et écrit un JSON séparé. Il ne recharge pas les liens externes et refuse d’écraser un export existant. Ce n’est pas un importateur Excel universel.

## Vérifications et limites

Tests automatisés des calculs, parsing, reports mensuels et fonctions SQL/RLS sous PostgreSQL embarqué PGlite. Les deux scans fournis ont été passés dans le moteur OCR et leurs résultats vérifiés. La reprise réelle du classeur a été testée localement, avec comparaison des écritures et de l’archive source.

La connexion réelle Supabase, l’API Vercel et le parcours OCR dans un navigateur en production doivent encore être vérifiés après configuration de votre nouveau projet. Aucun projet Supabase réel ni déploiement Vercel n’a été créé par les scripts fournis. Pas de revendication de test visuel navigateur ou de certification de sécurité.

WebMCP est optionnel : lecture du solde et ouverture d’un formulaire sans enregistrement. Il est désactivé si le navigateur ne le prend pas en charge. Son contrat n’a pas pu être vérifié dans un contexte WebMCP disponible.

### Références techniques

- [Fonction de création des comptes Supabase](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
- [Contrôle d’accès Storage](https://supabase.com/docs/guides/storage/security/access-control)
- [Fonctions Node.js sur Vercel](https://vercel.com/docs/functions/runtimes/node-js)
- [Versions Node.js supportées sur Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Tesseract.js — installation locale](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md)
