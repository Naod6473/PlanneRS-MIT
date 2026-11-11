---
title: Aujourd'hui
description: L'écran d'accueil de PlanneRs, avec les indicateurs, ce qui est au programme, la liste « À faire », les publications manquées et les raccourcis.
category: Utilisation
tags: [aujourd'hui, tableau de bord, à faire, manqués, raccourcis, idée, dépôt de fichiers, kpi]
order: 1
updated: 2026-11-10
---

# Aujourd'hui

C'est l'écran d'accueil. Un clic sur le logo PlanneRs y ramène depuis n'importe où.

## Les quatre indicateurs

Chaque indicateur est cliquable et ouvre la liste correspondante.

| Indicateur | Ce qu'il compte | Liste |
|---|---|---|
| Publiés aujourd'hui | Publiés / prévus aujourd'hui | Publications du jour |
| Légendes à valider | Posts des 14 prochains jours dont la légende n'est pas validée (ils ne partiront pas) | Légendes à valider, avec « Relire et valider » et « Tout valider » |
| Prêts à partir sur 7 jours | Posts validés, datés et automatiques : le robot les enverra seul | Prêts à partir |
| Planning d'avance | Jours couverts jusqu'au dernier post prévu, et nombre de jours vides | Frise jour par jour, jours vides en orange |

## Au programme

Les vignettes des publications d'**Aujourd'hui**, de **Demain** ou des **7 jours**. Leur couleur indique l'étape, la même partout ([les 5 étapes](contenus.md#le-tableau)) :

| Couleur | Étape |
|---|---|
| Gris | Idée |
| Orange | En préparation |
| Bleu | À valider |
| Bleu foncé | Programmé (partira tout seul) |
| Vert | Publié |

Une petite flèche violette signale un réseau à poster à la main. Un échec ou un retard ajoute un bandeau rouge sur la vignette. Un post ignoré est en pointillés.

L'étape s'affiche aussi avec une icône et un mot, pas seulement avec la couleur. Un repère rouge marque l'heure actuelle dans la journée.

## À faire

Ce qui demande ton attention, du plus urgent au moins urgent :

- **Échecs** : « Réessayer », « Poster à la main » ou « Comprendre » (ce qui s'est passé, pourquoi, que faire).
- **En retard** (moins de 24 h) : un post « à la main » dont l'heure est passée. « Poster » ouvre l'aide à la publication manuelle, « Ignorer » le retire de la liste.

**Poster à la main depuis le téléphone** : dans l'aide à la publication, **Poster en un geste** copie le texte (ou la consigne d'une story) et ouvre le menu Partager avec l'image ou la vidéo : choisis Instagram (Story ou Publication), colle le texte, publie. Le bouton apparaît sur les téléphones qui savent partager un fichier depuis le navigateur ; sinon, les étapes une par une restent là. Le rappel envoyé par [ntfy, Telegram ou le webhook](../notifications/ntfy.md) ouvre directement cette aide quand tu touches la notification. Une fois en ligne, le post passe tout seul en « publié » s'il est repéré sur Instagram (sinon, « C'est posté »).
- **Manqués** : une seule carte regroupe tout ce dont l'heure est passée depuis plus de 24 h sans publication. Elle ouvre la liste des manqués, avec pour chacun :
  - « Reprogrammer » : ouvre « Changer la date » ;
  - « Déjà posté » : tu l'as publié ailleurs, tu colles le lien et il passe en Publié ;
  - « Ignorer » : il va dans le volet « Ignorées », d'où « Remettre » le fait revenir.
- **Légendes à valider** :
  - « Relire et valider » les présente une par une, légende modifiable (V valide, → passe à la suivante) ;
  - « Tout valider » les valide d'un coup après une confirmation qui les liste. Les posts qui ont un problème bloquant (média manquant, trop de hashtags…) sont laissés de côté. « Annuler » dans le message qui suit retire la validation.
- **Posts à la main du jour**, **contenus d'actualité qui vont se périmer** (date limite dans moins de 3 jours).

## Poster à la main

Pour les réseaux sans connexion automatique ou à l'API payante, coche-les dans Réglages › Règles et contrôles › **À poster à la main**. À l'heure prévue, tu reçois un rappel, et le post apparaît dans « À faire ». **Poster** ouvre la fiche :

- un onglet par réseau à poster, avec une coche quand c'est fait ;
- **Enregistrer le média**, puis **Copier le texte** (la version propre à ce réseau, s'il y en a une) ;
- **Ouvrir X avec le texte** : pour X, LinkedIn, Threads et Bluesky, le réseau s'ouvre avec le texte déjà écrit, il reste à ajouter le média. Pour TikTok, YouTube, Instagram et Facebook, aucun réseau ne permet de pré-remplir le texte depuis un lien : le bouton copie le texte et ouvre la page d'envoi ;
- sur téléphone, **Poster en un geste** copie le texte et envoie la vidéo directement dans l'app choisie (TikTok, YouTube, X…) par le menu Partager ;
- **C'est posté** note le réseau comme fait et passe au suivant.

Sur ordinateur, aucun réseau ne permet de joindre la vidéo automatiquement par un lien : glisse-la dans la fenêtre du réseau.

## Raccourcis

| Raccourci | Effet |
|---|---|
| Proposer une idée | Crée une carte dans la colonne **Idée** de [Contenus](contenus.md). |
| Dicter une idée | Pareil, à la voix (si le navigateur sait faire la dictée). |
| Coller un lien d'actu | Crée une idée avec le lien comme source ; elle se périme dans 3 jours. |
| Ajouter une vidéo / une photo | Envoie le fichier dans ton Google Drive (voir [Google Drive, envoi](../stockage/google-drive-envoi.md)) et crée l'idée correspondante. |
| Nouveau contenu | Ouvre un post vierge. |
| Dossier Drive du projet | Ouvre le dossier racine de tes médias. |
| Remplir un jour vide | Propose de programmer un post prêt sur le prochain jour sans rien. |

Sur ordinateur, tu peux aussi **déposer un fichier n'importe où sur la page** : il est envoyé dans le Drive comme avec « Ajouter une vidéo ».
