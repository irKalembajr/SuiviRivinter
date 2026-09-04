# Vérifications de livraison

- 14 tests automatisés réussis : calculs, fractions invalides, signes, bacs associés, références, dates et contrepassations.
- SQL exécuté sous PostgreSQL embarqué PGlite : droits utilisateur/admin, interdiction de suppression directe, verrouillage du report, reprise atomique, absence d’écrasement.
- Justificatifs : existence dans le stockage, propriétaire, validation humaine, motif des avertissements et empreinte unique contrôlés côté base.
- Les deux scans fournis ont été lus par Tesseract français ; les références et quantités obtenues ont été comparées aux documents.
- Reprise du classeur vérifiée ligne par ligne, puis testée avec conservation exacte des lignes et de l’archive des cellules dans PostgreSQL local.
- Construction de production réussie.

## Contrôles à effectuer après installation

1. Se connecter comme administrateur sur Vercel.
2. Importer la reprise privée dans le nouveau projet et contrôler ses soldes.
3. Confirmer la date du report et le verrouiller.
4. Créer un utilisateur de test, vérifier la consultation et l’encodage, puis sa désactivation.
5. Importer un PDF de test complet, contrôler les lignes, conserver le document et ouvrir le justificatif.
6. Vérifier le refus d’un doublon, puis une contrepassation de test et son effet daté.
7. Vérifier impression et CSV sur votre navigateur.
8. Mettre en place les sauvegardes base + Storage.

Les connexions Supabase réelles et la fonction de création de comptes Vercel n’ont pas été exécutées contre un service configuré. Le moteur OCR a été testé localement, pas le parcours navigateur complet. Aucun contrôle visuel automatisé n’a été effectué.

Le contrôle distant des vulnérabilités des dépendances n’a pas abouti (expiration de la requête au registre npm). Ne pas interpréter ce résultat comme une absence de vulnérabilités ; relancer `pnpm audit` et entretenir les dépendances avant mise en production.

Les outils WebMCP sont optionnels et n’ont pas été vérifiés dans un navigateur disposant de cette interface.
