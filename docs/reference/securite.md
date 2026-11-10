---
title: Sécurité
description: Comment PlanneRs protège l'accès (Cloudflare Access), chiffre les identifiants (AES-GCM) et limite les droits, plus les liens pour tout révoquer.
category: Référence
tags: [sécurité, cloudflare access, jwt, chiffrement, aes-gcm, encryption_key, révocation, secrets, moindre privilège]
order: 2
updated: 2026-11-10
---

# Sécurité

## Qui peut ouvrir PlanneRs

- Toute l'application passe derrière [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-apps/) : seules les adresses e-mail autorisées se connectent.
- Le Worker vérifie lui-même la signature du jeton Access (`cf-access-jwt-assertion`) avec les clés publiques de ton équipe (`ACCESS_TEAM_DOMAIN`) et l'audience de l'application (`ACCESS_AUD`). Sans jeton valide, l'API répond « Connexion requise ».
- Seules les pages `confidentialite.html` et `conditions.html` restent publiques (Google les demande pour l'écran de consentement).

## Identifiants

- Chaque jeton, clé ou mot de passe collé dans **Réglages** est chiffré en **AES-GCM** avant d'être écrit dans D1. La clé vient du secret `ENCRYPTION_KEY`, qui ne quitte pas Cloudflare.
- L'interface n'affiche jamais un secret enregistré : on peut seulement le remplacer ou le supprimer.
- Sans `ENCRYPTION_KEY`, rien n'est enregistré. Si tu la changes, les identifiants existants deviennent illisibles : reconnecte chaque service.

## Bonnes pratiques

- Donne à chaque connecteur **le minimum** : lecture seule pour le stockage source, un seul bucket pour R2, un seul dépôt pour GitHub.
- Ne colle jamais un jeton dans un chat, un ticket ou un dépôt Git.
- Garde `DRY_RUN = "true"` tant que tu n'as pas vérifié tes connexions.
- Si un identifiant a fuité : révoque-le chez le service (liens ci-dessous), crée-en un nouveau, puis remplace-le dans PlanneRs.

## Tout révoquer

| Service | Où |
|---|---|
| Meta (Instagram, Facebook, Threads) | [Paramètres Facebook › Intégrations professionnelles](https://www.facebook.com/settings/?tab=business_tools) et [Applications Instagram](https://www.instagram.com/accounts/manage_access/) |
| LinkedIn | [Autorisations des applications](https://www.linkedin.com/psettings/permitted-services) |
| X | [Applications connectées](https://x.com/settings/connected_apps), ou régénère les clés dans le [portail développeur](https://developer.x.com/en/portal/dashboard) |
| Bluesky | **Paramètres › Confidentialité et sécurité › Mots de passe d'application** |
| Mastodon | **Préférences › Développement** sur ton instance |
| Google | [Applications tierces](https://myaccount.google.com/connections) ; clés de compte de service dans [IAM](https://console.cloud.google.com/iam-admin/serviceaccounts) |
| Microsoft | [Applications et services](https://account.live.com/consent/Manage) |
| Dropbox | [Applications connectées](https://www.dropbox.com/account/connected_apps) |
| GitHub | [Jetons fine-grained](https://github.com/settings/personal-access-tokens) |
| Cloudflare R2 | [Jetons d'API R2](https://dash.cloudflare.com/?to=/:account/r2/api-tokens) |
| Telegram | @BotFather › `/revoke` |

## Signaler une faille

Ouvre un avis de sécurité privé sur le dépôt GitHub (**Security › Report a vulnerability**) plutôt qu'un ticket public.

Documentation officielle : [Valider le JWT Access](https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/) · [Secrets des Workers](https://developers.cloudflare.com/workers/configuration/secrets/) · [Web Crypto AES-GCM](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/encrypt#aes-gcm).
