---
title: Automatisations
description: Reprendre automatiquement les articles d'un flux RSS comme posts à relire, ajouter un commentaire quand un post dépasse un nombre de likes, et brancher un autre outil.
category: Utilisation
tags: [automatisation, rss, atom, flux, blog, commentaire automatique, likes, seuil, n8n, api]
order: 7
updated: 2026-11-11
---

# Automatisations

Réglages › **Automatisations**. Trois aides qui te font gagner du temps sans jamais publier à ta place sans accord.

## Reprendre un flux RSS

Tu as un blog, un site d'actualités ou une boutique avec un flux RSS ou Atom ? Chaque nouvel article devient un post à relire.

1. Clique sur **Ajouter un flux** et colle l'adresse du flux (souvent `https://ton-site/feed` ou `/rss.xml`).
2. Coche les réseaux visés. Sans réseau coché, le post prend ton premier réseau.

Ce qui se passe ensuite :

- PlanneRs relit le flux **toutes les heures**. Le bouton **Relire maintenant** le fait tout de suite.
- À l'ajout, les articles déjà en ligne ne sont pas repris. Seuls les suivants le seront.
- Un nouvel article crée un post avec son titre, son lien et son image s'il en a une. Au plus 5 posts par flux et par passage.
- Le post arrive dans **Prêts à programmer**, sans date et **sans validation**. Tu relis la légende, tu choisis un créneau, tu valides. Rien ne part tout seul.
- Chaque reprise est notée dans Activité. Un flux qui ne répond pas aussi, avec la raison.

## Après la publication

Une règle du type : « quand un post dépasse 100 likes sur Instagram, ajouter ce commentaire ». Utile pour donner un lien, poser une question ou annoncer une offre sous les posts qui marchent.

1. Clique sur **Ajouter une règle**.
2. Choisis le réseau (Instagram ou Facebook), le nombre de likes et le texte du commentaire.

À savoir :

- La vérification se fait **une fois par jour**, avec le relevé des [statistiques](stats.md). Ce n'est pas instantané.
- Une règle s'applique **une seule fois par post**, sur les posts publiés depuis moins de 14 jours. Les stories ne sont pas concernées.
- Les [liens suivis](activite-et-reglages.md#modèles) s'appliquent aussi à ce commentaire.
- Si le réseau refuse le commentaire, PlanneRs l'écrit dans Activité et ne réessaie pas : ajoute-le à la main.
- Robot en simulation (`DRY_RUN`) : le commentaire est seulement noté dans le journal. Robot à l'arrêt : aucune règle ne s'applique.
- Sur Instagram, il faut l'autorisation `instagram_manage_comments` sur le jeton Meta (voir [Instagram](../reseaux/instagram.md)).

## Brancher un autre outil

n8n, Make, Zapier ou un script peuvent lire ton planning et créer des posts : voir l'[API](../reference/api.md). Pour être prévenu d'un rappel ou d'un échec dans ton outil : le [webhook signé](../notifications/webhook.md).
