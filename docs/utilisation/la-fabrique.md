---
title: La Fabrique
description: Suivre la fabrication de chaque vidéo (script, voix, montage, sous-titres, relu), faite par toi ou par une IA, voir son storyboard et regarder la vidéo finie avant de la valider.
category: Utilisation
tags: [la fabrique, production, vidéo, reel, montage, storyboard, voix, sous-titres, ia, agents, avancement]
order: 3.5
updated: 2026-11-13
---

# La Fabrique

La Fabrique montre où en est chaque vidéo pas encore publiée (Reels et vidéos), de l'idée à la vidéo finie. Elle est dans le menu, entre Contenus et Stats (au téléphone : **Plus**).

## Les cinq étapes

| Étape | Ce qu'elle couvre |
|---|---|
| **Script** | Le texte de la vidéo et son storyboard |
| **Voix** | La voix off, enregistrée ou générée |
| **Montage** | Les plans assemblés, les blancs coupés, le format vertical |
| **Sous-titres** | Les sous-titres et le texte à l'écran |
| **Relu** | La vidéo finie regardée et approuvée |

Chaque vidéo est rangée dans la colonne de son étape en cours ; la dernière colonne, **Prêtes**, regroupe celles qui ont tout fini. Sur chaque carte, une barre en cinq morceaux montre l'avancement (vert : fait, bleu : en cours), et une ligne dit qui travaille dessus (« Claude · Monteur · Montage ») ou ce qui reste à faire.

Les cartes chiffres en haut comptent les vidéos par étape ; un clic n'affiche que cette colonne.

Sans rien renseigner, PlanneRs devine l'avancement : un texte écrit coche le Script, une vidéo dans les médias coche Voix, Montage et Sous-titres, une légende validée coche Relu.

## Déposer des vidéos

**Déposer des vidéos** (en haut de La Fabrique), ou glisse tes fichiers sur la page : chaque vidéo part dans ton stockage (celui choisi dans **Réglages › Stockage et médias › Dossier des dépôts** : Drive, OneDrive, Dropbox, NAS, R2…) et devient un Reel dans La Fabrique, montage fait, sous-titres et relecture à faire. En mode démo, rien n'est envoyé.

## La fiche de fabrication

Un clic sur une carte ouvre sa fiche :

- **la vidéo finie**, à regarder directement (il faut une adresse publique https) ;
- **l'avancement** : un clic sur une étape la fait passer de « À faire » à « En cours », puis « Fait » (ton nom est noté) ;
- **le storyboard**, plan par plan : durée, texte à l'écran, voix, image, son, et la durée totale (en rouge au-delà de 30 secondes pour un Reel) ;
- **Vidéo finie et relue** coche toutes les étapes. Si la légende n'est pas encore validée, PlanneRs propose de la relire : une vidéo prête ne part pas sans légende validée.

## Avec une IA

Par le [lien MCP](../reference/assistants-ia.md), une IA comme Claude fait avancer les vidéos elle-même et tout s'affiche en direct dans La Fabrique :

- `planners_fabrique` liste les vidéos en fabrication et leur étape ;
- `planners_production` passe une étape à « en cours » ou « fait » avec son nom (ex. « Claude · Monteur ») et une note, remplit le storyboard, et ajoute la vidéo finie.

L'IA ne valide jamais la légende par ce chemin : la validation reste à toi (ou à l'IA seulement si tu l'as autorisé dans Réglages › Espace › Assistant IA).

## L'équipe

En haut de La Fabrique, **Équipe** montre les six rôles qui fabriquent tes vidéos : Scénariste, Voix, Monteur, Sous-titres, Légendes et Contrôle qualité. Chaque carte a :

- **Qui tient ce rôle** : Claude par le lien MCP, Claude avec la clé API (Scénariste et Légendes seulement), ou toi ;
- **Consignes** : ce que le rôle doit faire, à ta façon (ton, durée, charte). Elles sont enregistrées dès que tu quittes le champ ; « Revenir aux consignes d'origine » les remet par défaut ;
- **Ce qu'il a fait** : le nombre d'étapes faites et les dernières vidéos, avec un point animé quand il travaille.

Avec le **lien MCP**, demande par exemple à Claude « fais le Scénariste sur la vidéo du jour » : il lit ses consignes avec `planners_team`, puis signe son travail « Claude · Scénariste » avec `planners_production`.

Avec la **clé API** (secret `ANTHROPIC_API_KEY`, voir [Assistants IA](../reference/assistants-ia.md)), la fiche d'une vidéo propose **Écrire le script (Claude)** (storyboard plan par plan, d'après les notes ou la transcription) et **Proposer la légende (Claude)**. Une légende déjà écrite n'est jamais remplacée : la proposition arrive en commentaire. Rien n'est validé tout seul.
