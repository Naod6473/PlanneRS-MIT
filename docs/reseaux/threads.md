---
title: Threads
description: Connecter un compte Threads pour publier texte, images, vidéos et carrousels, avec un jeton de 60 jours à renouveler.
category: Réseaux sociaux
tags: [threads, meta, publication, jeton, 60 jours, carrousel]
order: 4
updated: 2026-11-10
---

# Threads

| | |
|---|---|
| Publie | Texte (500 caractères), images, vidéos, carrousels |
| Médias | Récupérés par Meta à leur adresse publique, comme Instagram |
| Jeton | Jeton Threads longue durée : **60 jours**, renouvelable |
| Autorisations | `threads_basic`, `threads_content_publish` |

## Obtenir le jeton

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

Pense à renouveler le jeton avant 60 jours. Un jeton encore valide se prolonge par l'appel `refresh_access_token` (voir la doc ci-dessus).

## Documentation officielle

- [Threads API](https://developers.facebook.com/docs/threads)
- [Publier sur Threads](https://developers.facebook.com/docs/threads/posts)
