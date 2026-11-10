---
title: Page Facebook
description: Connecter une Page Facebook pour y relayer automatiquement les publications, le plus souvent celles d'Instagram, sans risque de doublon.
category: Réseaux sociaux
tags: [facebook, page, relais, publication, jeton de page, meta, doublon]
order: 3
updated: 2026-11-10
---

# Page Facebook

| | |
|---|---|
| Publie | Vidéos, photos, albums (carrousels), texte, stories photo |
| Ne publie pas | Stories vidéo (à poster à la main) |
| Rôle habituel | **Relais** : un post « Instagram + Facebook » part d'abord sur Instagram, puis sur la Page |
| Jeton | Jeton de Page sans expiration : voir [Application Meta et jetons](meta.md) |
| Autorisations | `pages_show_list`, `pages_read_engagement`, `pages_manage_posts` |

## Champs dans PlanneRs

**Réglages › Comptes › Page Facebook** :

| Champ | Où le trouver |
|---|---|
| Jeton de la Page | Le même que pour Instagram ([étape 3](meta.md#3-obtenir-un-jeton-de-page-sans-expiration)) |
| Identifiant de la Page | `id` de la Page dans la réponse de `me/accounts`, ou ta Page › **À propos** › **Transparence de la Page** |

Le test affiche « Accès à la Page OK » avec son nom.

## Pas de doublon

Le relais part **après** le réseau principal. S'il échoue alors qu'Instagram a publié :

- il n'est **pas relancé** automatiquement (règle « Ne pas relancer un relais… ») ;
- la carte d'échec propose **Poster à la main** ;
- « Réessayer » est grisé pour ne pas republier sur Instagram.

## Réactions et commentaires dans Stats

Lire les réactions et commentaires des publications de la Page demande `pages_read_user_content`, accordée seulement après une [vérification de l'application](https://developers.facebook.com/docs/app-review). Sans elle, la page Stats affiche les abonnés de la Page, et rien d'autre ne change.

## Documentation officielle

- [Pages API](https://developers.facebook.com/docs/pages-api/)
- [Publier sur une Page](https://developers.facebook.com/docs/pages-api/posts)
- [Vidéos sur une Page](https://developers.facebook.com/docs/video-api/)
