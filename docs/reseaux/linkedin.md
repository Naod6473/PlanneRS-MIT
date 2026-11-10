---
title: LinkedIn
description: Connecter un profil ou une page LinkedIn pour publier texte, images, documents PDF et vidéos, avec un jeton OAuth de 60 jours.
category: Réseaux sociaux
tags: [linkedin, page entreprise, profil, oauth, jeton, 60 jours, urn, pdf, carrousel, community management api]
order: 5
updated: 2026-11-10
---

# LinkedIn

| | |
|---|---|
| Publie | Texte (3 000 caractères), images, documents PDF (le « carrousel » LinkedIn), vidéos |
| Jeton | OAuth 2.0, **60 jours** |
| Autorisations | `w_member_social` (profil) ou `w_organization_social` (page) |

## Profil ou page ?

| Publier sur | Produit LinkedIn à demander | Délai |
|---|---|---|
| Ton profil | **Share on LinkedIn** + **Sign In with LinkedIn using OpenID Connect** | Immédiat |
| Une page entreprise | **Community Management API** | Validation par LinkedIn (formulaire, quelques jours ou semaines) |

## 1. Créer l'application

1. Ouvre [Mes applications LinkedIn](https://www.linkedin.com/developers/apps) › **Create app**.
2. Nom, page LinkedIn associée (obligatoire, même pour publier sur ton profil), logo.
3. Onglet **Settings** : fais vérifier l'application par un administrateur de la page (**Verify**).
4. Onglet **Products** : demande le ou les produits du tableau ci-dessus. Pour une page : [Community Management API](https://developer.linkedin.com/product-catalog/marketing/community-management-api).

## 2. Obtenir le jeton

1. Ouvre le [Générateur de jeton](https://www.linkedin.com/developers/tools/oauth/token-generator).
2. Choisis ton application et coche `w_member_social` (profil) ou `w_organization_social` (page). Pour le profil, ajoute `openid` et `profile`.
3. **Request access token**, accepte, copie le jeton.

## 3. Trouver l'auteur (URN)

| Auteur | Format | Où trouver le numéro |
|---|---|---|
| Page | `urn:li:organization:123456` | Adresse de la page en mode administrateur : `linkedin.com/company/123456/admin/` |
| Profil | `urn:li:person:AbC123` | Appel `GET https://api.linkedin.com/v2/userinfo` avec le jeton : champ `sub` |

## Champs dans PlanneRs

| Champ | Valeur |
|---|---|
| Jeton d'accès OAuth | Le jeton de l'étape 2 |
| Auteur | L'URN de l'étape 3 |
| Version de l'API | Facultatif, format AAAAMM (par défaut, une version récente) |

La fiche rappelle de renouveler le jeton avant 60 jours : refais l'étape 2.

## Documentation officielle

- [Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api)
- [Images API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api) · [Documents API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/documents-api) · [Videos API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api)
- [Partager sur son profil](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin)
