---
title: Mastodon
description: Connecter un compte Mastodon (ou compatible) avec un jeton d'application pour publier texte, images et vidéos.
category: Réseaux sociaux
tags: [mastodon, fediverse, instance, jeton, application, publication]
order: 8
updated: 2026-11-10
---

# Mastodon

| | |
|---|---|
| Publie | Texte (500 caractères sur la plupart des instances), images, vidéos |
| Identifiants | Adresse de l'instance + jeton d'application |
| Autorisations | `write:statuses`, `write:media` |

## Obtenir le jeton

1. Sur ton instance : **Préférences** › **Développement** › **Nouvelle application** (adresse directe : `https://ton-instance/settings/applications/new`).
2. Nom : « PlanneRs ». Dans **Autorisations**, décoche tout sauf `write:statuses` et `write:media`.
3. **Envoyer**, puis ouvre l'application créée et copie **Votre jeton d'accès**.

## Champs dans PlanneRs

| Champ | Valeur |
|---|---|
| Adresse de l'instance | Par exemple `https://mastodon.social` |
| Jeton d'accès | Celui de l'étape 3 |

Une connexion par instance. Pour révoquer, supprime l'application dans Préférences › Développement.

## Documentation officielle

- [Publier un statut](https://docs.joinmastodon.org/methods/statuses/#create)
- [Envoyer un média](https://docs.joinmastodon.org/methods/media/#v2)
- [Obtenir un jeton](https://docs.joinmastodon.org/client/token/)
