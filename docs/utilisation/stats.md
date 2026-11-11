---
title: Stats
description: Les statistiques Instagram et Facebook dans PlanneRs, avec les chiffres affichés, leur fréquence de mise à jour et les autorisations nécessaires.
category: Utilisation
tags: [stats, période, 7 jours, 30 jours, 90 jours, cartes, partages, enregistrements, statistiques, insights, abonnés, vues, portée, likes, commentaires, meilleur reel]
order: 4
updated: 2026-11-11
---

# Stats

## Ce qui est affiché

À gauche, les **comptes** (Instagram, Page Facebook) : clique sur l'un d'eux. En haut, la **période** : 7, 30 ou 90 jours. Chaque carte donne le total de la période, l'écart avec la période d'avant (▲ en vert, ▼ en rouge, survole pour voir l'ancien chiffre) et la courbe jour par jour.

| Carte | Instagram | Facebook |
|---|---|---|
| Abonnés (écart = gagnés sur la période) | Oui | Oui |
| Comptes touchés, vues | Oui | |
| Likes (réactions sur Facebook), commentaires, partages | Oui | Oui, d'après les posts de la période |
| Enregistrements, réponses aux stories, visites du profil | Oui | |

D'où viennent les chiffres : pour 7 et 30 jours, les totaux du compte renvoyés par Instagram ; pour 90 jours et pour les courbes, les relevés quotidiens. La portée est reprise jour par jour sur les 30 derniers jours dès le premier relevé ; les autres courbes se remplissent au fil des jours. Une carte sans aucune donnée n'est pas affichée.

Sous les cartes : le **Reel le plus vu**, la liste **Publications** (triée par vues, likes, commentaires, portée ou date) et les **hashtags qui marchent**.

Un post a bien marché ? Ouvre-le depuis la liste et choisis **Reprendre plus tard** pour le reprogrammer dans quelques semaines ([Contenus](contenus.md#reprendre-un-post-qui-a-bien-marché)).

## Bilan du mois

Le bouton **Bilan du mois** (en haut de Stats) résume un mois : nombre de publications et jours couverts, abonnés gagnés sur Instagram et Facebook, vues, likes et commentaires, répartition par réseau et par format, et les 5 meilleurs posts. Les flèches changent de mois. **Copier le résumé** donne un texte à coller dans un message ; **Imprimer ou PDF** ouvre l'impression du navigateur (choisis « Enregistrer en PDF ») pour l'envoyer à un client.

## Mise à jour

Le relevé se fait **une fois par jour**, au premier passage du robot après 7 h, et à la demande avec **Actualiser**. Les 20 publications les plus récentes ou les moins récemment relevées sont mises à jour à chaque fois. L'historique garde 120 jours.

Les statistiques ne dépendent pas de `DRY_RUN` : elles fonctionnent même en simulation.

## Autorisations nécessaires

| Réseau | Autorisations du jeton |
|---|---|
| Instagram | `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement` |
| Facebook (abonnés) | `pages_show_list`, `pages_read_engagement` |
| Facebook (réactions et commentaires) | `pages_read_user_content` : demande une [vérification de l'application par Meta](https://developers.facebook.com/docs/app-review), non nécessaire au reste |

Si une autorisation manque, un bandeau l'indique sur la page Stats. Pour l'ajouter, voir [Application Meta et jetons](../reseaux/meta.md).

Docs officielles : [Statistiques Instagram](https://developers.facebook.com/docs/instagram-platform/insights) · [Statistiques des Pages](https://developers.facebook.com/docs/platforminsights/page).
