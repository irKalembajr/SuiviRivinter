# Mise à jour 1.1 — Exports

Dans **Rapports**, deux boutons supplémentaires :

- **Exporter Excel complet** : fichier .xlsx avec feuille RIVINTER, groupes Débit / Crédit / Solde dans l’ordre du classeur fourni, couleurs de solde, références, report initial et solde CDF. L’historique importé garde son ordre d’origine ; les nouvelles écritures et contrepassations sont ajoutées. Les formules du solde sont locales au fichier, sans anciens liens externes.
- **10 dernières transactions · PDF A4** : PDF A4 paysage, classé par date du mouvement décroissante, puis ordre de saisie et ligne source. Les contrepassations sont des écritures distinctes. Les lignes sans date sont signalées et exclues de ce classement.

L’Excel exporte **tout le journal**, indépendamment du mois ou du filtre affiché. Les dix dernières transactions sont également prises sur tout le journal. Les deux exports sont disponibles pour les comptes actifs.

Le modèle conserve la structure comptable du classeur, mais n’exporte pas les anciens calculs auxiliaires hors journal ni les liens SharePoint externes. Les données actuelles remplacent les anciennes valeurs. La colonne inutilisée « Colonne1 » devient « Observations » pour signaler les dates absentes et annulations.

Les données ne quittent pas le navigateur pour être converties. Le fichier téléchargé est privé : protégez-le comme le classeur original. En démonstration, les exports portent la mention DÉMONSTRATION et ne représentent pas la base réelle.

## Installer sur Vercel

1. Remplacer les fichiers du nouveau dépôt GitHub par ceux de cette mise à jour, en conservant les paramètres Vercel.
2. Inclure impérativement package.json, pnpm-lock.yaml, excel-style.json et les trois fichiers export-*.js.
3. Laisser Vercel reconstruire et déployer l’application.
4. Se reconnecter et ouvrir Rapports.

**Aucune nouvelle migration SQL et aucune réimportation Excel ne sont nécessaires.** Cette mise à jour n’efface ni ne modifie les données Supabase.

Un PDF ordinaire tient sur une page A4 ; les références exceptionnellement longues sont reproduites intégralement sur une annexe A4 au lieu d’être coupées.
