---
title: Contenus
description: Le tableau Kanban de production (Idée, Écriture, Médias, Légende, Prêt, Programmé, Publié), ses verrous, la fiche d'un post et l'aperçu Instagram.
category: Utilisation
tags: [contenus, créer un post, fenêtre de création, kanban, idée, légende, validation, verrou, fiche, aperçu instagram, reel, carrousel]
order: 3
updated: 2026-11-11
---

# Contenus

## Le tableau

Sept colonnes suivent un contenu de l'idée à la publication :

| Colonne | Sens |
|---|---|
| Idée | À creuser |
| Écriture | Texte ou script en cours |
| Médias | Images ou vidéo en cours |
| Légende | Légende à écrire ou à valider |
| Prêt | Validé, sans date |
| Programmé | Validé et daté : il partira tout seul |
| Publié | Parti (les 10 derniers) |

Chaque carte montre trois points : texte, médias, légende validée. Le filtre de format (Reel, carrousel…) est en haut.

### Déplacer une carte

- **Ordinateur** : glisse la carte d'une colonne à l'autre.
- **Téléphone** : bouton ⇄ « Déplacer vers… ».
- Une **confirmation** s'affiche, désactivable comme pour le [calendrier](calendrier.md#confirmation). Après un déplacement, « Annuler » dans le message du bas le défait.

Règles :

- **Publié** ne bouge jamais, et se remplit tout seul : robot, « C'est posté », ou post publié en dehors de PlanneRs (à la main, par un script ou un assistant) et repéré sur Instagram au même format, à moins d'une heure et demie de l'heure prévue (vérifié toutes les 10 minutes tant qu'un post Instagram attend).
- **Programmé** est verrouillé : clique sur **Débloquer** pour pouvoir déplacer la carte.
- Pour entrer dans **Programmé**, il faut une légende validée **et** une date.
- Revenir en **Légende** ou avant retire la validation de la légende : elle devra être revalidée.

Le « + » en haut de chaque colonne crée une carte directement à cette étape.

## La liste

Une ligne par sujet, une colonne par réseau. La recherche filtre par titre ou légende.

### Modifier plusieurs posts d'un coup

Coche les posts (la case en tête de colonne coche tout ce qui est affiché). Une barre apparaît :

- **Décaler** les dates d'un nombre de jours (en avant ou en arrière) ;
- **Ajouter** ou **retirer** un réseau ;
- **Valider** les légendes (seulement celles qui passent les contrôles) ;
- **Supprimer**.

Chaque action se défait avec « Annuler » dans le message du bas. Les posts publiés ne sont jamais modifiés.

## Les médias

Toutes les images et vidéos des posts, des plus récentes aux plus anciennes, sans doublon (un fichier utilisé par plusieurs posts n'apparaît qu'une fois, avec le nombre de posts).

- Filtre **Images** ou **Vidéos**, et recherche par nom de fichier, titre du post ou description.
- Un clic sur la vignette ouvre le post qui l'utilise.
- **Réutiliser** crée un brouillon avec ce média, prêt à être écrit et daté.

## Créer ou modifier un post

**Nouveau post** (et **Modifier** dans la fiche d'un post) ouvre la fenêtre de création :

- **En haut, les réseaux** : clique sur un logo pour l'ajouter ou le retirer. Le premier coché est le réseau **principal**, les autres sont des **relais**. Tes ensembles de réseaux (Réglages › Modèles) sont à côté.
- **Le texte** : l'onglet **Tous les réseaux** est le texte commun ; un onglet par réseau permet une version propre (un point orange la signale). Le compteur indique la limite la plus courte des réseaux choisis et passe en rouge au-delà.
- **Insérer un média** : depuis l'appareil (envoyé dans ton Drive si « Google Drive (envoi) » est connecté), en glissant un fichier sur la fenêtre, ou en collant un lien `https://`. Le format (Reel, carrousel, image, texte) se déduit des médias.
- **Paramètres** : titre (pris dans la première ligne si tu le laisses vide), format, publication à la main, premier commentaire, texte alternatif.
- **À droite, l'aperçu** par réseau se met à jour pendant que tu écris. Sur téléphone, passe de **Écrire** à **Aperçu** en haut.
- **En bas** : le jour et le créneau, puis **Programmer** (avec une date), **Ajouter à « Prêts à programmer »** (sans date) ou **Enregistrer en brouillon**. Si tu as le droit de valider, coche **Texte validé** pour qu'il parte à l'heure prévue ; toute modification du texte décoche la case.

Rien n'est enregistré avant ces boutons : fermer la fenêtre demande confirmation s'il y a des changements.

## La fiche d'un post

Un clic sur une carte ouvre sa fiche :

- statut, réseaux, format, date ;
- **médias** : lecteur vidéo ou images, liens vers les fichiers et le dossier de stockage ;
- **Aperçu sur Instagram** : le post tel qu'il apparaîtra, en vue **Fil** (4:5, légende coupée à 125 caractères avec « plus »), **Reel** (9:16) ou **Profil** (case 3:4, pour vérifier le cadrage de la couverture) ;
- **légende** avec compteur de caractères et de hashtags, « Copier », « Valider la légende » ;
- **Avant envoi** : ce qui bloque ou mérite attention ;
- **Changer la date**, **Titre, format et réseaux**, « Publier à la main » ;
- **Commentaires** : les échanges sur le post (voir [Équipe et validation client](equipe-et-client.md)) ;
- **Plus** : dupliquer, répéter, lien de validation client, supprimer.

Modifier une légende validée retire sa validation.

### Aperçu sur chaque réseau

Sous les médias, **Aperçu sur Instagram** montre le post dans le fil, en Reel ou dans la grille du profil. **Aperçu sur les autres réseaux** montre la carte telle qu'elle apparaîtra sur X, LinkedIn, Bluesky, Threads, Mastodon ou Facebook : coupure « … voir plus » de LinkedIn et Facebook, et, pour les réseaux limités, le texte qui dépasse en rouge avec le compteur.

### Vérifier les liens

Si la légende contient des liens, **Vérifier les liens** (sous les contrôles) teste chacun. Chaque matin, PlanneRs vérifie aussi ceux des posts des 3 prochains jours. Un lien mort (404, 410, erreur du serveur, site introuvable) ajoute une alerte dans les contrôles et une ligne dans l'Activité. Les sites qui refusent les robots (401, 403, 429) ne sont pas signalés : ils marchent dans un navigateur.

### Une légende par réseau

Quand un post part sur plusieurs réseaux, des onglets apparaissent au-dessus de la légende : **Tous**, puis un par réseau. Écris dans l'onglet d'un réseau pour lui donner sa propre version (plus courte pour X, plus posée pour LinkedIn). Laisse-le vide pour reprendre la légende commune. Un point sur l'onglet signale une version propre. Le compteur affiche la limite du réseau (280 caractères pour X, par exemple), et « Poster à la main » copie la bonne version.

Si ton instance a une clé Claude, **Réécrire pour … avec Claude** propose une version adaptée au réseau, à relire avant d'enregistrer ([Assistants IA](../reference/assistants-ia.md#réécrire-une-légende-pour-chaque-réseau)).

### Description des images

Dans **Titre, format, réseaux et options**, le champ **Description des images (texte alternatif)** décrit ce qu'on voit sur l'image, pour les personnes malvoyantes. Elle est envoyée à Bluesky, Mastodon, X et LinkedIn avec chaque image. L'assistant IA peut la remplir (outil `planners_update_post`, ou une description par image avec `planners_add_media`).

### Premier commentaire

Toujours dans **Titre, format, réseaux et options**, le champ **Premier commentaire** (facultatif) est posté sous le post sur Instagram et Facebook juste après la publication : pratique pour les hashtags ou un lien. Ses hashtags comptent dans la limite fixée dans les règles. S'il est refusé (le compte n'a pas le droit `instagram_manage_comments` ou `pages_manage_engagement`), le post reste publié et l'Activité le signale : ajoute-le à la main.

### Reprendre un post qui a bien marché

Sur un post publié, **Reprendre plus tard** crée une copie avec les mêmes médias et la même légende, par défaut 6 semaines plus tard, le même jour de la semaine et au même créneau. La légende de la copie est à revalider : c'est l'occasion de la rafraîchir. Pour trouver les posts qui ont le mieux marché, trie la liste de [Stats](stats.md) par vues.

### Répéter un post

**Plus › Répéter…** crée des copies du post à la même heure : chaque semaine, toutes les 2 semaines ou chaque mois, jusqu'à 26 copies. Seules les dates à venir sont gardées. Si la légende est validée, les copies le sont aussi. « Annuler » dans le message qui suit supprime les copies.

## Stories

Une story n'a pas de légende : la fiche affiche une **Consigne** (le sticker à ajouter, par exemple). Les stories interactives (sondage, quiz) se publient à la main : l'API ne permet pas d'ajouter de sticker.
