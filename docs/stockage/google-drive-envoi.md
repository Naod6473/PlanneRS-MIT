---
title: Google Drive (envoi de fichiers)
description: Autoriser PlanneRs à envoyer vidéos, photos et fichiers dans ton Google Drive par OAuth (ID client Application Web, écran de consentement en production).
category: Stockage
tags: [google drive, oauth, écriture, envoi, upload, id client, écran de consentement, redirect uri, refresh token]
order: 2
updated: 2026-11-10
---

# Google Drive (envoi de fichiers)

| | |
|---|---|
| Accès | Ton compte Google, par OAuth (jeton de rafraîchissement) |
| Sert à | Raccourcis « Ajouter une vidéo / une photo », dépôt d'un fichier sur Aujourd'hui ; les sous-dossiers manquants sont créés |
| Prérequis | PlanneRs sur **ton propre domaine** (voir [Installation › Utiliser ton propre domaine](../demarrage/installation.md#utiliser-ton-propre-domaine)) |

Dans les étapes ci-dessous, remplace `planners.exemple.fr` par l'adresse de ton PlanneRs.

## 1. Écran de consentement

Utilise le même projet Google Cloud que pour [Google Drive (lecture)](google-drive-lecture.md).

1. [Google Auth Platform › Présentation](https://console.cloud.google.com/auth/overview) › **Commencer** si c'est la première fois.
2. [Branding](https://console.cloud.google.com/auth/branding) :
   - nom de l'application : « PlanneRs » ; adresse e-mail d'assistance : la tienne ;
   - page d'accueil : `https://planners.exemple.fr/` ;
   - règles de confidentialité : `https://planners.exemple.fr/confidentialite.html` ;
   - conditions d'utilisation : `https://planners.exemple.fr/conditions.html` ;
   - domaines autorisés : ton domaine principal (`exemple.fr`).
   Ces deux pages sont fournies avec PlanneRs et restent publiques.
3. [Audience](https://console.cloud.google.com/auth/audience) : type **Externe**, puis **Publier l'application** (passer « En production »). En mode « Test », Google coupe l'accès au bout de 7 jours.
4. [Accès aux données](https://console.cloud.google.com/auth/scopes) › **Ajouter ou supprimer des niveaux d'accès** › coche `.../auth/drive` › **Mettre à jour** › **Enregistrer**.

## 2. ID client

1. [Clients](https://console.cloud.google.com/auth/clients) › **Créer un client**.
2. Type d'application : **Application Web**. Nom : « PlanneRs ».
3. **URI de redirection autorisés** › **Ajouter un URI** : `https://planners.exemple.fr/api/oauth/google/callback` (PlanneRs affiche l'adresse exacte dans sa fiche).
4. **Créer**, puis copie l'**ID client** et le **Code secret du client**.

## 3. Dans PlanneRs

1. **Réglages › Stockage et médias › Google Drive (envoi de fichiers)**.
2. Colle l'ID client et le code secret. L'identifiant du dossier racine est facultatif : par défaut, celui de Google Drive (lecture).
3. **Enregistrer**, puis **Autoriser avec Google**.
4. Google prévient que l'application n'est pas validée : c'est normal pour une application personnelle. **Paramètres avancés** › **Accéder à PlanneRs**, puis **Continuer**.
5. De retour dans PlanneRs, la fiche affiche « Envoi de fichiers dans « ton dossier » ».

Les fichiers envoyés vont par défaut dans `PlanneRs/depots` du dossier racine (modifiable dans Réglages › Stockage › Dossier des dépôts), ou dans le dossier du post sélectionné. Ils restent privés dans ton Drive.

## Révoquer

[Ton compte Google › Applications tierces](https://myaccount.google.com/connections) › PlanneRs › **Supprimer tous les accès**.

Documentation officielle : [Envois vers Drive](https://developers.google.com/workspace/drive/api/guides/manage-uploads) · [OAuth pour les applications Web](https://developers.google.com/identity/protocols/oauth2/web-server) · [Configurer l'écran de consentement](https://developers.google.com/workspace/guides/configure-oauth-consent).
