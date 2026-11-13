---
title: Instagram
description: Connecter un compte Instagram professionnel pour publier automatiquement Reels, carrousels, images et stories, et relever les statistiques.
category: Réseaux sociaux
tags: [instagram, reel, carrousel, story, publication, graph api, jeton, compte professionnel, hashtags]
order: 2
updated: 2026-11-10
---

# Instagram

| | |
|---|---|
| Publie | Reels, carrousels (jusqu'à 10 éléments), images, stories (image ou vidéo) |
| Ne publie pas | Stickers de story (sondage, quiz, lien), musique de la bibliothèque Instagram, collaborations |
| Compte | Professionnel (Créateur ou Entreprise) relié à une Page Facebook |
| Jeton | Jeton de Page sans expiration : l'assistant de **Réglages › Comptes** le trouve pour toi, voir [Application Meta et jetons](meta.md#lassistant-de-planners-le-plus-simple) |
| Limite | 100 publications par API sur 24 h |

## Champs dans PlanneRs

**Réglages › Comptes › Instagram** :

| Champ | Où le trouver |
|---|---|
| Jeton d'accès | Le jeton de Page, voir [Application Meta et jetons, étape 3](meta.md#3-obtenir-un-jeton-de-page-sans-expiration) |
| Identifiant du compte Instagram pro | `instagram_business_account.id` dans la réponse de `me/accounts` (une suite de chiffres, souvent 1784…) |
| Identifiant de la Page liée | Facultatif : sert aussi au relais Facebook |

Le test affiche « Connecté à @ton-compte ».

## Médias

Instagram va chercher chaque média à une **adresse publique https**. Un lien Google Drive, Dropbox ou OneDrive ne convient pas. Utilise un [hébergement public](../stockage/README.md), ou laisse le robot copier le média depuis ton stockage source.

| Format | Recommandé |
|---|---|
| Reel | MP4 (H.264, AAC), 9:16, 1080 × 1920, de 3 s à 15 min ; couverture JPEG facultative |
| Carrousel | JPEG, 4:5 (1080 × 1350) ou 1:1, toutes les images au même format |
| Image | JPEG, 4:5 à 1,91:1 |
| Story | JPEG ou MP4, 9:16 |

Doc officielle : [Spécifications des médias](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media#creating).

## Comment se passe un envoi

1. Le robot crée un **conteneur** avec l'adresse du média et la légende.
2. Instagram traite la vidéo. Le robot attend jusqu'à 2 min 30, sinon il reprend au passage suivant (5 min plus tard).
3. Le robot publie le conteneur et enregistre le lien du post.

Un échec est retenté **une fois** au passage suivant, sauf quand ça ne servirait à rien (jeton expiré, média sans adresse publique).

## Légende

- 2 200 caractères au maximum.
- **5 hashtags au maximum** : Instagram limite désormais les hashtags par publication. Règle-le dans Réglages › Règles et contrôles.
- Les retours à la ligne sont conservés.

## Premier commentaire

Si le post a un **premier commentaire**, il est posté juste après la publication. Il faut le droit `instagram_manage_comments` sur le jeton (sinon, l'Activité le signale et le post reste publié). Sur la Page Facebook, le même commentaire demande `pages_manage_engagement`.

## Stories interactives

L'API ne permet pas d'ajouter de sticker (sondage, quiz, question, lien). Mets ces stories en **Publier à la main** : PlanneRs envoie un rappel, puis t'aide à enregistrer l'image et à copier la consigne.

## Documentation officielle

- [Publier du contenu](https://developers.facebook.com/docs/instagram-platform/content-publishing)
- [Référence de l'API Instagram](https://developers.facebook.com/docs/instagram-platform/reference)
- [Statistiques](https://developers.facebook.com/docs/instagram-platform/insights)
- [Outil de débogage des jetons](https://developers.facebook.com/tools/debug/accesstoken/)
