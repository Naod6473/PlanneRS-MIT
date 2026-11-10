---
title: Équipe et validation client
description: Travailler à plusieurs (accès, validateurs, commentaires) et faire valider des légendes par un client grâce à un lien sans compte.
category: Utilisation
tags: [équipe, validateurs, commentaires, client, lien de validation, cloudflare access, bypass]
order: 6
updated: 2026-11-10
---

# Équipe et validation client

## Donner accès à d'autres personnes

PlanneRs n'a pas de comptes à lui : l'accès passe par [Cloudflare Access](../demarrage/installation.md#protéger-laccès-avec-cloudflare-access). Pour ajouter quelqu'un, ajoute son adresse e-mail à la règle (policy) de l'application dans Zero Trust › **Access** › **Applications**. Chacun se connecte avec un code reçu par e-mail.

L'adresse de la personne connectée s'affiche dans **Réglages › Espace › Équipe**.

## Choisir qui valide

Dans **Réglages › Espace › Équipe**, la liste **Validateurs** prend une adresse e-mail par ligne.

- Liste vide : tout le monde peut valider une légende.
- Liste remplie : seules ces personnes valident. Les autres préparent les posts, les déplacent et les commentent ; à leur place, le bouton « Valider » laisse un message « En attente d'un validateur ».

Le serveur vérifie aussi cette règle : une validation envoyée par quelqu'un d'autre est refusée.

## Commenter un post

En bas de la fiche d'un post, la zone **Commentaires** garde les échanges (qui, quand, quoi). Chaque commentaire apparaît aussi dans l'[Activité](activite-et-reglages.md).

## Faire valider par un client

Le client relit les textes et valide, ou laisse un commentaire, sans créer de compte.

- Pour un post : fiche du post › **Plus** › **Lien de validation client**.
- Pour toutes les légendes en attente : carte « Légendes à valider » d'Aujourd'hui › **Lien client**.

Le lien (`https://ton-domaine/v/…`) est valable 30 jours et ne montre que les posts choisis. Ce que fait le client arrive dans la fiche du post et dans l'Activité (« validée par le client »).

### Laisser passer le lien dans Cloudflare Access

Access protège tout le domaine, donc aussi le lien client. Il faut une exception pour le chemin `/v/` :

1. Zero Trust › **Access** › **Applications** › **Add an application** › **Self-hosted**.
2. Nom : « PlanneRs, validation client ». Domaine : le tien, chemin `v/`.
3. Policy : action **Bypass**, règle **Include › Everyone**.
4. Enregistre. L'application principale reste protégée ; seul `/v/…` est public.

Doc officielle : [Politiques Bypass](https://developers.cloudflare.com/cloudflare-one/policies/access/#bypass).

Sans cette exception, le client tombe sur l'écran de connexion d'Access. En mode démo, le lien n'existe pas.
