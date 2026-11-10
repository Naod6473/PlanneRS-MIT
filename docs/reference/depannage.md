---
title: Dépannage
description: Messages d'erreur courants (Meta, Instagram, Facebook, Threads, LinkedIn, X, Google Drive, Cloudflare) et quoi faire pour chacun.
category: Référence
tags: [dépannage, erreur, 2207052, 2207076, 2207077, erreur 10, 190, oauth, jeton expiré, invalid scopes, access, d1, robot]
order: 1
updated: 2026-11-10
---

# Dépannage

Chaque échec est expliqué dans la fiche du post (**Ce qui s'est passé · Pourquoi · Quoi faire**) et dans **Activité**. Cette page complète ces messages.

## Meta (Instagram, Facebook, Threads)

| Erreur | Cause | Quoi faire |
|---|---|---|
| `2207052` « Media download has failed » | Instagram n'arrive pas à lire le média à son adresse | Ouvre l'adresse dans une fenêtre privée. Si elle répond, réessaie dans quelques minutes (hébergement encore en cours de publication). |
| `2207076` / `2207077` | Vidéo refusée à la lecture (souvent via un CDN tiers comme jsDelivr) | Héberge la vidéo sur [Cloudflare R2](../stockage/cloudflare-r2.md) ou [GitHub Pages](../stockage/github-pages.md), pas via jsDelivr. |
| `2207026` | Format vidéo non accepté | MP4 H.264 + AAC, 9:16, 3 s à 15 min, 30 i/s conseillés. Voir [Instagram](../reseaux/instagram.md). |
| `#10` « Application does not have permission » | Erreur passagère ou permission manquante | Réessaie **une fois**. Si elle revient, vérifie les permissions dans [Meta](../reseaux/meta.md). |
| `#190` / `OAuthException` | Jeton expiré, révoqué ou mal collé | Régénère un jeton de page permanent ([Meta › Jeton permanent](../reseaux/meta.md)). |
| `#200` / `2500` | Jeton invalide ou en-tête `Bearer` manquant (relais, proxy) | Colle le jeton seul, sans guillemets ni espace. Si un proxy l'injecte, il doit envoyer `Authorization: Bearer <jeton>`. |
| « Invalid Scopes: pages_read_user_content » | Permission non proposée à ton type d'application | Retire-la dans l'explorateur Graph ; elle n'est pas nécessaire. |
| `#4` / `#32` / `#613` | Limite d'appels atteinte | Attends une heure ; le robot réessaie au passage suivant. |
| `9007` « Media ID is not available » | Le conteneur vidéo n'est pas encore prêt | Rien à faire : le robot reprend au passage suivant. |
| 25 publications par 24 h | Limite Instagram par compte | Étale les posts. |
| « Facebook ÉCHEC » après un post Instagram réussi | Le relais Facebook a échoué | **Ne relance pas le post** : « Réessayer » est désactivé pour éviter un doublon sur Instagram. Publie le relais Facebook à la main. |

Pour tester un jeton : [Débogueur de jeton d'accès](https://developers.facebook.com/tools/debug/accesstoken/). Codes officiels : [Erreurs Graph API](https://developers.facebook.com/docs/graph-api/guides/error-handling) · [Erreurs Instagram](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/error-codes).

## Jetons qui expirent

| Service | Durée | Signe | Quoi faire |
|---|---|---|---|
| Meta (jeton de page permanent) | Pas d'expiration | `#190` après changement de mot de passe | [Régénérer](../reseaux/meta.md) |
| Threads | 60 jours | `#190` | [Rafraîchir le jeton](../reseaux/threads.md) avant l'échéance |
| LinkedIn | 60 jours | `401` | [Nouveau jeton](../reseaux/linkedin.md) |
| Google Drive (envoi) | 7 jours en mode « Test » | `invalid_grant` | Passer l'application **En production**, puis **Autoriser avec Google** ([Google Drive (envoi)](../stockage/google-drive-envoi.md)) |
| GitHub (fine-grained) | Date choisie | `401` | [Nouveau jeton](../stockage/github-pages.md) |
| OneDrive | 90 jours sans usage | `invalid_grant` | [Nouveau jeton](../stockage/onedrive.md) |

Note la date d'échéance de chaque jeton dans ton agenda.

## X, Bluesky, Mastodon

| Erreur | Quoi faire |
|---|---|
| X `403` « You are not permitted » | Les clés doivent être en **Read and Write**, puis régénère l'Access Token ([X](../reseaux/x.md)). |
| X `429` | Quota de l'offre gratuite atteint ; attends la fin de la période. |
| Bluesky `AuthenticationRequired` | Utilise un **mot de passe d'application**, pas ton mot de passe ([Bluesky](../reseaux/bluesky.md)). |
| Mastodon `422` | Texte trop long pour l'instance, ou média encore en traitement. |

## Application

| Symptôme | Quoi faire |
|---|---|
| « Secret ENCRYPTION_KEY manquant » | `npx wrangler secret put ENCRYPTION_KEY` ([Installation](../demarrage/installation.md)) |
| « Connexion requise » ou page blanche | Vérifie l'application Cloudflare Access et les variables `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` ([Installation](../demarrage/installation.md)). |
| `no such table` | Les migrations D1 ne sont pas passées : `npm run db:init`. |
| Rien ne part à l'heure | `DRY_RUN` vaut encore `"true"`, le robot est arrêté (**Réglages › Règles**), ou la légende n'est pas validée. |
| Un post apparaît dans « Manqués » | Il avait plus de 24 h de retard : **Reprogrammer**, **Déjà posté** ou **Ignorer**. |
| Heure décalée | Le fuseau de l'espace vaut `Europe/Paris` par défaut (réglage `timezone`, voir [Architecture](architecture.md#données)). |

Journal du Worker en direct : `npx wrangler tail`. Documentation officielle : [Journaux Workers](https://developers.cloudflare.com/workers/observability/logs/real-time-logs/).
