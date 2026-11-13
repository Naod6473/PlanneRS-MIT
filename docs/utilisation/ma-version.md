---
title: Ma version
description: Reprendre la recette d'une publication qui a marché (la tienne ou celle d'un compte suivi), jamais son contenu, et la refaire à ta sauce, avec une note d'originalité, un carnet de recettes et la boucle de tes résultats.
category: Utilisation
tags: [ma version, recette, inspiration, remix, originalité, carnet, pépites, storyboard]
order: 4.55
updated: 2026-11-13
---

# Ma version

Une publication marche très bien, chez un compte que tu suis ou chez toi. **Ma version** en garde la recette, pas le contenu, et la refait à ta sauce. Ce n'est pas un bouton « cloner » : le texte, les images et l'idée exacte de l'original ne sont jamais repris.

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

- **Ton sujet** : ce dont tu veux parler.
- **L'angle**, pour réarranger la recette : Mythe ou réalité, Avant / après, Top 3 perso, Question de ta communauté.
- **Le format** : Reel ou carrousel (une recette de Reel peut devenir un carrousel, et l'inverse).
- **La durée max** : 15, 30, 45 ou 60 secondes.

Sont appliqués tout seuls : les consignes du Scénariste de [l'Équipe](la-fabrique.md), le nom de ton compte, ta limite de hashtags et la durée max.

## 3. Ta version

**Préparer ma version** écrit un storyboard plan par plan (texte à l'écran, voix) et une légende. Chaque case se retouche directement dans l'atelier. **Autre angle** propose la même recette avec l'angle suivant.

La **note d'originalité** compte la part de ta version qui ne reprend pas l'original (par suites de trois mots). Sous **80 %**, **Envoyer à La Fabrique** est bloqué : réécris les cases trop proches, ou change d'angle.

Sans clé API, la version part d'un modèle avec des [crochets] à remplir : l'étape Script reste « en cours » dans La Fabrique tant que tu ne l'as pas complétée.

**Envoyer à La Fabrique** crée la vidéo (ou le carrousel) dans [La Fabrique](la-fabrique.md) :

- le storyboard, signé « Claude · Scénariste » quand Claude l'a écrit ;
- la légende proposée, à relire et valider comme d'habitude ;
- en note privée : la recette, l'angle, la note d'originalité et le lien d'origine.

La recette est gardée dans ton carnet au passage.

## Le carnet et le mélange

Dans **Stats › Ma version**, le carnet garde jusqu'à 100 recettes. **Mélanger** sur une recette, puis **Mélanger avec** sur une autre, crée une nouvelle recette : l'accroche de la première, la structure de la seconde.

## La boucle

Quand une version est publiée, PlanneRs compare ses interactions à ta médiane. Le carnet affiche, pour chaque recette, le score moyen de tes versions (par exemple « ×3 chez toi ») et met en tête celles qui marchent chez toi.
