---
title: Application Meta et jetons
description: Créer une application Meta et obtenir un jeton de Page sans expiration, commun à Instagram et à la Page Facebook, avec les bonnes autorisations.
category: Réseaux sociaux
tags: [meta, facebook, instagram, application, jeton, token, page access token, graph api explorer, autorisations, permissions]
order: 1
updated: 2026-11-10
---

# Application Meta et jetons

Instagram et la Page Facebook passent par la même API (Graph API de Meta) et peuvent partager **un seul jeton** : le jeton de la Page reliée au compte Instagram. Bien obtenu, il **n'expire jamais**.

## Avant de commencer

- Un compte Instagram **professionnel** (Créateur ou Entreprise). Dans l'app Instagram : Profil › ☰ › **Type de compte et outils** › **Passer à un compte professionnel**.
- Une **Page Facebook** dont tu es administrateur, reliée à ce compte Instagram. Sur Facebook : ta Page › **Paramètres** › **Comptes liés** › **Instagram** › **Connecter le compte**.

## 1. Créer l'application

1. Ouvre [Mes applications](https://developers.facebook.com/apps/) › **Créer une application**. Il faut un compte développeur Meta, gratuit : [s'inscrire](https://developers.facebook.com/async/registration/).
2. Choisis le cas d'usage qui donne accès à **l'API Instagram avec connexion Facebook** et à la **gestion des Pages**. Si la liste ne le propose pas, choisis **Autre**, puis le type **Entreprise**.
3. Laisse l'application en mode **Développement**. Tant que tu ne publies que sur tes propres comptes (tu es administrateur de l'application), aucune vérification par Meta n'est nécessaire.

Doc officielle : [Créer une application](https://developers.facebook.com/docs/development/create-an-app/).

## 2. Autorisations à demander

| Autorisation | Sert à |
|---|---|
| `pages_show_list` | Retrouver la Page et son compte Instagram |
| `pages_read_engagement` | Lire la Page (abonnés, publications) |
| `pages_manage_posts` | Publier sur la Page (relais Facebook) |
| `instagram_basic` | Lire le compte Instagram |
| `instagram_content_publish` | Publier sur Instagram |
| `instagram_manage_insights` | [Stats](../utilisation/stats.md) Instagram |
| `instagram_manage_comments` | Facultatif : premier commentaire |
| `business_management` | Facultatif : utile si la Page appartient à un portefeuille business |

Référence : [Liste des autorisations](https://developers.facebook.com/docs/permissions).

## 3. Obtenir un jeton de Page sans expiration

1. Ouvre l'[Explorateur de l'API Graph](https://developers.facebook.com/tools/explorer/).
2. À droite, **Application Meta** : choisis ton application.
3. **Utilisateur ou Page** : laisse **Jeton d'utilisateur**.
4. **Autorisations** : ajoute toutes celles du tableau ci-dessus.
5. Clique **Generate Access Token** et accepte dans la fenêtre Facebook, en cochant ta Page **et** ton compte Instagram.
6. Copie le jeton, puis ouvre l'[Outil de débogage des jetons](https://developers.facebook.com/tools/debug/accesstoken/) : colle-le, **Déboguer**, puis en bas **Étendre le jeton d'accès**. Copie le nouveau jeton (valable 60 jours).
7. Reviens dans l'Explorateur, colle ce jeton long dans **Jeton d'accès**, puis lance la requête `GET me/accounts?fields=name,access_token,instagram_business_account`.
8. Dans la réponse, repère ta Page :
   - `access_token` : c'est le **jeton de Page**. Issu d'un jeton long, il n'expire pas ;
   - `id` : l'**identifiant de la Page** ;
   - `instagram_business_account.id` : l'**identifiant du compte Instagram**.
9. Vérifie le jeton de Page dans l'[Outil de débogage](https://developers.facebook.com/tools/debug/accesstoken/) : **Type** Page, **Expire** Jamais, et les autorisations listées.

Doc officielle : [Jetons longue durée](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived) · [Types de jetons](https://developers.facebook.com/docs/facebook-login/guides/access-tokens).

### Variante : utilisateur système

Si ta Page appartient à un portefeuille business, un **utilisateur système** de Meta Business donne aussi un jeton sans expiration, indépendant de ton compte personnel. Voir [Utilisateurs système](https://developers.facebook.com/docs/marketing-api/system-users/) et les [paramètres business](https://business.facebook.com/settings/).

## 4. Coller dans PlanneRs

**Réglages › Comptes** :

- **Instagram** : le jeton de Page, l'identifiant du compte Instagram et, facultatif, l'identifiant de la Page. Voir [Instagram](instagram.md).
- **Page Facebook** : le même jeton et l'identifiant de la Page. Voir [Page Facebook](facebook.md).

## Changer ou révoquer le jeton

- Un jeton de Page devient invalide si tu changes ton mot de passe Facebook, si tu perds le rôle d'administrateur de la Page ou si tu retires l'application de ton compte : [Intégrations professionnelles](https://www.facebook.com/settings/?tab=business_tools).
- Pour en changer, refais l'étape 3 et colle le nouveau jeton dans les deux fiches.

## Erreurs fréquentes

Voir [Dépannage › Meta](../reference/depannage.md#meta-instagram-facebook-threads).
