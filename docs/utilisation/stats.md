---
title: Stats
description: Les statistiques Instagram et Facebook dans PlanneRs, avec les chiffres affichés, leur fréquence de mise à jour et les autorisations nécessaires.
category: Utilisation
tags: [stats, période, 7 jours, 30 jours, 90 jours, cartes, partages, enregistrements, statistiques, insights, abonnés, vues, portée, likes, commentaires, meilleur reel]
order: 4
updated: 2026-11-11
---

# Stats

L'écran a trois onglets : **Mes chiffres** (cette page), **[Succès](succes.md)** (tes paliers à partager) et **[Pépites](pepites.md)** (les comptes que tu suis).

## Ce qui est affiché

À gauche, les **comptes** connectés (Instagram, Page Facebook, chaîne YouTube) : clique sur l'un d'eux. En haut, la **période** : 7, 30 ou 90 jours. Chaque carte donne le total de la période, l'écart avec la période d'avant (▲ en vert, ▼ en rouge, survole pour voir l'ancien chiffre) et la courbe jour par jour.

| Carte | Instagram | Facebook | YouTube |
|---|---|---|---|
| Abonnés (écart = gagnés sur la période) | Oui | Oui | Oui |
| Vues | Oui | | Oui (vues de la chaîne par jour, d'un relevé à l'autre) |
| Comptes touchés | Oui | | |
| Likes (réactions sur Facebook), commentaires | Oui | Oui, d'après les posts de la période | Oui, d'après les vidéos de la période |
| Partages | Oui | Oui | |
| Enregistrements, réponses aux stories, visites du profil | Oui | | |

D'où viennent les chiffres : pour 7 et 30 jours, les totaux du compte renvoyés par Instagram ; pour 90 jours et pour les courbes, les relevés quotidiens. La portée est reprise jour par jour sur les 30 derniers jours dès le premier relevé ; les autres courbes se remplissent au fil des jours. Une carte sans aucune donnée n'est pas affichée.

Sous les cartes : le **Reel le plus vu**, la liste **Publications** (triée par vues, likes, commentaires, portée ou date) et les **hashtags qui marchent**.

Un post a bien marché ? Ouvre-le depuis la liste et choisis **Republier** pour le reprogrammer quand tu veux ([Contenus](contenus.md#republier-un-post-qui-a-bien-marché)).

La carte **À republier** liste jusqu'à 5 posts publiés il y a plus de 45 jours, au-dessus de ta moyenne de vues, et pas encore republiés. Le bouton **Republier** ouvre directement la fenêtre de reprogrammation.

## Quand publier

Une carte jours × heures compare chaque moment de publication à ta moyenne (vues, sinon portée ou interactions, réseau par réseau). Il faut au moins 8 posts publiés avec des chiffres. La meilleure heure sert aussi de suggestion **Conseillé** dans la fenêtre de création et dans **Réglages › Créneaux**.

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
