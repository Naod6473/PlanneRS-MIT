---
title: Google Drive (lecture)
description: Relier un dossier Google Drive en lecture seule avec un compte de service, pour ouvrir le dossier de chaque post et copier les médias avant publication.
category: Stockage
tags: [google drive, compte de service, service account, clé json, lecture seule, google cloud, dossier racine]
order: 1
updated: 2026-11-10
---

# Google Drive (lecture)

| | |
|---|---|
| Accès | Compte de service Google (clé JSON), lecture seule |
| Voit | Uniquement les dossiers partagés avec lui |
| Expiration | Aucune ; révocable à tout moment |
| Sert à | « Ouvrir le dossier » d'un post, liens vers chaque fichier, « Enregistrer » sur le téléphone, copie automatique vers l'hébergement public |

## Étapes

1. Ouvre la [console Google Cloud](https://console.cloud.google.com/projectcreate) et crée un projet (ou prends-en un existant).
2. Active l'API Drive : [API Google Drive](https://console.cloud.google.com/apis/library/drive.googleapis.com) › **Activer**.
3. Crée un compte de service : [Comptes de service](https://console.cloud.google.com/iam-admin/serviceaccounts) › **Créer un compte de service**. Nom : « planners ». Aucun rôle n'est nécessaire : **Continuer**, puis **OK**.
4. Ouvre ce compte de service › onglet **Clés** › **Ajouter une clé** › **Créer une clé** › **JSON**. Un fichier `.json` est téléchargé.
5. Copie l'adresse du compte de service (`planners@ton-projet.iam.gserviceaccount.com`).
6. Dans [Google Drive](https://drive.google.com/), clic droit sur ton dossier racine › **Partager** › colle cette adresse, rôle **Lecteur**, décoche « Envoyer une notification », **Partager**.
7. Ouvre ce dossier et copie la fin de son adresse, après `/folders/` : c'est l'**identifiant du dossier racine**.

## Champs dans PlanneRs

**Réglages › Stockage et médias › Google Drive** :

| Champ | Valeur |
|---|---|
| Clé JSON du compte de service | Bouton **Choisir le fichier** (le `.json` de l'étape 4) ; ou colle tout son contenu |
| Identifiant du dossier racine | Celui de l'étape 7 |

Le test affiche le nombre d'éléments vus dans le dossier.

## Sécurité

- La clé est chiffrée dans la base. Ne la colle jamais dans un chat ou un ticket.
- Si elle a fuité : compte de service › **Clés** › crée une nouvelle clé, supprime l'ancienne, puis remplace-la dans PlanneRs.
- Doc officielle : [Gérer les clés des comptes de service](https://cloud.google.com/iam/docs/keys-create-delete).

## Bon à savoir

- Un compte de service ne peut pas **écrire** dans un Drive personnel (il n'a pas d'espace de stockage). Pour envoyer des fichiers, voir [Google Drive (envoi)](google-drive-envoi.md).
- Les liens Drive ne remplacent pas un [hébergement public](README.md).

Documentation officielle : [Créer un compte de service](https://cloud.google.com/iam/docs/service-accounts-create) · [Drive API](https://developers.google.com/workspace/drive/api/guides/about-sdk).
