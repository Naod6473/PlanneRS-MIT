---
title: Threads
description: Connecter un compte Threads en se connectant avec Threads (assistant), pour publier texte, images, vidéos et carrousels ; jeton renouvelé tout seul.
category: Réseaux sociaux
tags: [threads, connexion, assistant, oauth, meta, publication, jeton, 60 jours, carrousel]
order: 4
updated: 2026-11-13
---

# Threads

| | |
|---|---|
| Publie | Texte (500 caractères), images, vidéos, carrousels |
| Médias | Récupérés par Meta à leur adresse publique, comme Instagram |
| Jeton | Jeton Threads longue durée (60 jours), **renouvelé tout seul** par PlanneRs |
| Autorisations | `threads_basic`, `threads_content_publish` |

## Le plus simple : l'assistant

**Réglages › Comptes** › **Threads** › **Me guider pas à pas** :

1. Crée l'app (ou réutilise celle d'Instagram) avec le cas d'usage **Accéder à l'API Threads**.
2. Dans ses **Paramètres**, colle l'adresse de retour donnée par l'assistant (`https://ton-domaine/api/oauth/threads/callback`) dans les trois champs d'URL de rappel, et ajoute les droits `threads_basic` et `threads_content_publish`.
3. Déclare-toi **testeur Threads** et accepte l'invitation dans l'app Threads.
4. Colle l'identifiant et la clé secrète **de l'app Threads** (page Paramètres du cas d'usage, pas ceux de l'app Meta), puis **Se connecter avec Threads**.

Tu reviens dans PlanneRs connecté, avec un jeton de 60 jours que PlanneRs prolonge tout seul chaque semaine. La clé secrète n'est gardée que 15 minutes, chiffrée, le temps du retour.

## À la main : obtenir le jeton

1. Dans [Mes applications](https://developers.facebook.com/apps/), crée une application avec le cas d'usage **Accéder à l'API Threads**, ou ajoute-le à ton application existante.
2. Dans le cas d'usage Threads › **Autorisations** : ajoute `threads_basic` et `threads_content_publish`.
3. **Rôles d'application** › **Rôles** › ajoute ton compte Threads comme **testeur Threads**, puis accepte l'invitation dans l'app Threads : Paramètres › Compte › **Autorisations du site web** › **Invitations**.
4. Génère un jeton : dans le cas d'usage Threads, **Paramètres** › **Générateur de jeton d'accès utilisateur** (ou l'[Explorateur de l'API Graph](https://developers.facebook.com/tools/explorer/) réglé sur `graph.threads.net`).
5. Échange-le contre un jeton de 60 jours : voir [Jetons longue durée](https://developers.facebook.com/docs/threads/get-started/long-lived-tokens).

## Champs dans PlanneRs

| Champ | Valeur |
|---|---|
| Jeton d'accès Threads | Le jeton longue durée |
| Identifiant de l'utilisateur Threads | Facultatif (sinon « me ») |

PlanneRs prolonge le jeton tout seul chaque semaine tant qu'il est encore valide (appel `refresh_access_token`).

## Documentation officielle

- [Threads API](https://developers.facebook.com/docs/threads)
- [Publier sur Threads](https://developers.facebook.com/docs/threads/posts)
