---
title: Ma version
description: Reprendre une publication qui a marché (la tienne ou celle d'un compte suivi), sur le même sujet ou un autre, et la refaire à ta sauce, sans image ni phrase recopiée, avec une note d'originalité, un carnet de recettes et la boucle de tes résultats.
category: Utilisation
tags: [ma version, recette, inspiration, remix, originalité, carnet, pépites, storyboard]
order: 4.55
updated: 2026-11-13
---

# Ma version

Une publication marche très bien, chez un compte que tu suis ou chez toi. **Ma version** en garde la recette et la refait à ta sauce : sur le même sujet, avec ses informations réécrites à ta façon, ou sur un autre sujet. Ce n'est pas un bouton « cloner » : aucune image ni phrase de l'original n'est reprise telle quelle.

On l'ouvre de trois endroits :

- **Stats › Pépites**, bouton **Faire ma version** sur une pépite ;
- **Stats › Ma version › Tes succès à refaire** : tes publications qui ont fait au moins 1,5 fois ta médiane d'interactions, bouton **Refaire à ma sauce** ;
- **Stats › Ma version › Ton carnet de recettes**, bouton **Utiliser**.

## 1. La recette

PlanneRs lit la publication et en sort la forme :

| Élément | Exemple |
| --- | --- |
| Accroche | une liste chiffrée avec un aveu : « [nombre] [erreurs] qui [problème] (la 2e, tout le monde la fait) » |
| Structure dans le temps | accroche 2 s, trois points de 5 à 6 s, fin 4 s |
| Format | Reel de 22 s, ou carrousel de 6 slides |
| Ressort | curiosité, se sentir concerné |
| Fin | une question qui fait commenter |

Avec la clé de l'API Claude (secret `ANTHROPIC_API_KEY`, voir [Assistants IA](../reference/assistants-ia.md)), c'est Claude qui lit la recette et explique pourquoi ça marche. Sans clé, PlanneRs la devine à partir du texte (type d'accroche, format) : c'est moins fin, mais l'atelier marche quand même.

**Garder dans mon carnet** range la recette pour la réutiliser sur un autre sujet.

## 2. Ta sauce

- **Le sujet** : **Le même que l'original** (par défaut pour une pépite) ou **Un autre sujet**.
  - Même sujet : le sujet est prérempli, et tu peux coller dans **Ce que dit l'original** la transcription de la vidéo ou tes notes. Claude reprend les informations et les idées, réécrites avec tes mots, dans ton angle et ton ton ; les chiffres pas sûrs sont marqués [à vérifier]. Sans rien coller, il part du texte de la publication.
  - Autre sujet : tu écris ton sujet, seule la recette est gardée.
- **L'angle**, pour réarranger la recette : Mythe ou réalité, Avant / après, Top 3 perso, Question de ta communauté.
- **Le format** : Reel ou carrousel (une recette de Reel peut devenir un carrousel, et l'inverse).
- **La durée max** : 15, 30, 45 ou 60 secondes.

Sont appliqués tout seuls : les consignes du Scénariste de [l'Équipe](la-fabrique.md), le nom de ton compte, ta limite de hashtags et la durée max.

## 3. Ta version

**Préparer ma version** écrit un storyboard plan par plan (texte à l'écran, voix) et une légende. Chaque case se retouche directement dans l'atelier. **Autre angle** propose la même recette avec l'angle suivant.

La **note d'originalité** compte la part de ta version qui ne reprend pas l'original mot pour mot (par suites de trois mots), en comparant au texte de la publication et à ce que tu as collé. Le sujet repris lui-même ne compte pas. Sous **80 %**, **Envoyer à La Fabrique** est bloqué : réécris les cases trop proches, ou change d'angle.

Sans clé API, la version part d'un modèle avec des [crochets] à remplir : l'étape Script reste « en cours » dans La Fabrique tant que tu ne l'as pas complétée.

**Envoyer à La Fabrique** crée la vidéo (ou le carrousel) dans [La Fabrique](la-fabrique.md) :

- le storyboard, signé « Claude · Scénariste » quand Claude l'a écrit ;
- la légende proposée, à relire et valider comme d'habitude ;
- en note privée : la recette, l'angle, la note d'originalité, le lien d'origine et, en mode même sujet, le contenu collé (pour mémoire).

La recette est gardée dans ton carnet au passage.

## Le carnet et le mélange

Dans **Stats › Ma version**, le carnet garde jusqu'à 100 recettes. **Mélanger** sur une recette, puis **Mélanger avec** sur une autre, crée une nouvelle recette : l'accroche de la première, la structure de la seconde.

## La boucle

Quand une version est publiée, PlanneRs compare ses interactions à ta médiane. Le carnet affiche, pour chaque recette, le score moyen de tes versions (par exemple « ×3 chez toi ») et met en tête celles qui marchent chez toi.

## Depuis le téléphone : partager un lien

PlanneRs installé sur l'écran d'accueil du téléphone apparaît dans le menu **Partager**. Sur une publication Instagram, TikTok, YouTube ou Facebook : **Partager** › **PlanneRs**, puis **Faire ma version**. L'atelier s'ouvre sur ce lien. Le lien seul ne dit pas ce que raconte la vidéo : colle sa légende ou sa transcription dans **Ce que dit l'original** pour une version plus juste. **Garder comme idée** crée une idée avec le lien, comme avant.

## Bibliothèque partagée

Sous ton carnet, **Bibliothèque partagée** propose des recettes qui marchent, écrites par la communauté : la forme seulement (accroche, structure dans le temps, ressort, façon de finir), jamais le contenu d'une publication. **Utiliser** ouvre l'atelier avec la recette ; **Garder** la range dans ton carnet.

La bibliothèque vit dans le dépôt public de PlanneRs (`web/recettes/bibliotheque.json`) : ton instance la relit toutes les 12 heures, et garde la copie livrée avec l'app si le dépôt ne répond pas.

**Ajouter ta recette** : sur une recette de ton carnet, **Partager** ouvre une proposition sur GitHub (un compte GitHub gratuit suffit), avec la recette déjà remplie, sans le texte ni le lien de l'original. Elle est relue, puis ajoutée à la bibliothèque pour tout le monde.

