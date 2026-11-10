---
title: Stats
description: Les statistiques Instagram et Facebook dans PlanneRs, avec les chiffres affichés, leur fréquence de mise à jour et les autorisations nécessaires.
category: Utilisation
tags: [stats, statistiques, insights, abonnés, vues, portée, likes, commentaires, meilleur reel]
order: 4
updated: 2026-11-10
---

# Stats

## Ce qui est affiché

**Instagram**

| Chiffre | Période |
|---|---|
| Abonnés, avec l'écart sur 7 jours | Aujourd'hui |
| Vues | Dernières 24 h et 7 jours |
| Comptes touchés (portée) | 7 jours |
| Visites du profil | 7 jours |
| Likes et commentaires | 30 jours |
| Reel le plus vu | Toutes les publications relevées |

Les petites courbes montrent l'évolution jour par jour. La liste **Publications** se trie par vues, likes, commentaires, portée ou date. Les vignettes de l'accueil et du calendrier affichent aussi les vues et les likes des posts publiés.

**Facebook** : abonnés de la Page.

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
