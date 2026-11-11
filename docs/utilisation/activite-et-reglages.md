---
title: Activité et réglages
description: Le journal d'activité, l'état des comptes et du robot, puis chaque rubrique des réglages (comptes, stockage, créneaux, règles, notifications, espace).
category: Utilisation
tags: [activité, journal, robot, réglages, créneaux, règles, notifications, espace, import, export, sauvegarde]
order: 5
updated: 2026-11-10
---

# Activité et réglages

## Activité

- **État des comptes** : chaque compte connecté avec son statut (OK, À surveiller, À reconnecter) et la date de connexion.
- **Robot de publication** : en marche, en simulation ou à l'arrêt, et l'heure de son dernier passage.
- **Journal** : tout ce qui s'est passé, en clair (publication réussie, échec avec sa raison, changement de date, légende validée…). Filtre par type en haut.

### Commentaires Instagram

Sous l'état des connexions : les commentaires des dernières publications Instagram, **sans réponse** d'abord (« Tous » montre aussi ceux auxquels tu as répondu). Écris ta réponse et **Répondre** la publie sous le commentaire, sur Instagram. **Proposer une réponse** demande un brouillon à Claude (si la [clé Claude](../reference/assistants-ia.md#réécrire-une-légende-pour-chaque-réseau) est posée) : tu le relis et tu l'envoies toi-même, rien ne part tout seul. La liste est relue au plus toutes les 10 minutes ; le bouton d'actualisation la relit tout de suite.

Il faut l'autorisation Meta `instagram_manage_comments` sur le jeton Instagram (la même que pour le premier commentaire) ; sans elle, un message l'indique.

## Réglages

### Comptes

Un réseau par fiche : ce qu'il demande, ce qu'il permet, les droits, les limites et les liens de documentation. Voir [Réseaux sociaux](../README.md#réseaux-sociaux). Les identifiants sont chiffrés et ne sont jamais renvoyés au navigateur ([Sécurité](../reference/securite.md)).

Chaque matin, PlanneRs vérifie que chaque compte répond encore. Pour Instagram et Facebook, il lit aussi la date d'expiration du jeton Meta et l'affiche sous le compte (« Jeton valable jusqu'au … ») ; 7 jours avant, l'alerte passe en rouge et part dans le résumé du matin. Un jeton d'utilisateur système Meta n'expire pas : aucune date ne s'affiche. Le jeton Threads est renouvelé tout seul chaque semaine (il repart pour 60 jours).

### Stockage et médias

Stockages sources, envoi de fichiers et hébergements publics : voir [Stockage : vue d'ensemble](../stockage/README.md).

**Dossier des dépôts** : là où partent les photos et vidéos ajoutées depuis Aujourd'hui ou partagées depuis le téléphone quand elles ne sont rattachées à aucun post (`PlanneRs/depots` par défaut).

### Créneaux

Tes horaires types, qui forment les lignes du calendrier. Modifier l'heure d'un créneau ne déplace pas les posts déjà programmés.

Quand assez de statistiques sont relevées (au moins 8 posts récents), le bloc **Meilleurs horaires** montre les 3 heures où tes posts font le plus de vues, avec « Ajouter » pour en faire un créneau.

### Modèles

- **Signature** : le texte que tu ajoutes souvent en fin de légende.
- **Groupes de hashtags** : des séries prêtes, par thème.

Sous la légende d'un post, « Insérer » ajoute la signature ou un groupe à la fin du texte.

- **Liens suivis** : indique tes sites (un domaine par ligne). Au moment d'envoyer, PlanneRs ajoute `utm_source` (le réseau), `utm_medium=social` et `utm_campaign` (le titre du post) aux liens vers ces sites, pour voir dans les statistiques du site (Google Analytics, Matomo, Plausible…) ce que rapporte chaque réseau. Les légendes enregistrées ne changent pas ; l'aperçu et « Poster à la main » montrent la version envoyée. Les liens qui ont déjà des paramètres `utm_` ne sont pas touchés. Liste vide : rien n'est modifié.

### Règles et contrôles

| Réglage | Effet |
|---|---|
| Robot de publication en marche | Décoché : le robot ne publie rien (les rappels « à la main » et les stats continuent). |
| Ne rien envoyer sans légende validée | Un post non validé reste « À valider » et ne part pas. |
| Demander une confirmation avant de déplacer un contenu | Fenêtre « Déplacer ce contenu ? » dans le calendrier et Contenus. |
| Ne pas relancer un relais si le réseau principal a déjà publié | Si Facebook échoue alors qu'Instagram a publié, pas de nouvel essai automatique (évite le doublon). |
| Nombre maximal de hashtags | Au-delà, le post est bloqué dans « Avant envoi ». |
| Contrôles personnalisés | Rappel si la légende ne contient pas un texte donné. |

### Notifications

- **Rappel avant un post à la main** : nombre de minutes avant l'heure.
- **Prévenir tout de suite en cas d'échec**.
- **Résumé du matin** (8 h par défaut, heure réglable) : les légendes à valider pour aujourd'hui et demain, les posts à publier à la main, les échecs, les comptes déconnectés et les jetons qui expirent dans les 7 jours. S'il n'y a rien à signaler, aucun message. Le lien du message ouvre directement Aujourd'hui.
- **Bilan du dimanche soir** (19 h par défaut, heure réglable) : les publications de la semaine et celles manquées, l'évolution des abonnés Instagram, les comptes touchés, les 3 posts les plus vus, puis la semaine prochaine (posts prévus, légendes à valider, posts à la main) et les jours où rien n'est prévu. « Voir le bilan de cette semaine » l'affiche tout de suite, sans l'envoyer.
- **Rappel « à la main »** : toucher la notification ouvre directement l'aide à la publication du post.
- **Dans ton agenda** : un lien secret `https://ton-domaine/cal/<jeton>.ics` à ajouter dans Google Agenda (**Autres agendas › + › À partir de l'URL**), Outlook (**Ajouter un calendrier › S'abonner à partir du web**) ou Apple Calendrier (**Fichier › Nouvel abonnement**). Les posts des 30 derniers jours et des 4 prochains mois s'affichent avec leur statut (« [À valider] », « [À la main] »…), et un rappel 15 minutes avant ceux à poster à la main. Un second lien (`?only=manual`) ne montre que ceux à la main. L'agenda relit le lien tout seul (Google le fait toutes les quelques heures). Le lien est secret : **Recréer le lien** coupe l'ancien, **Désactiver** le coupe pour de bon. Comme le lien de validation client, il doit passer Cloudflare Access : ajoute une application **Bypass** pour le chemin `/cal/`, voir [Équipe et validation client](equipe-et-client.md#faire-valider-par-un-client).
- Canaux : [ntfy](../notifications/ntfy.md), [Telegram](../notifications/telegram.md), [Webhook](../notifications/webhook.md).

### Espace

- Nom de l'espace.
- **Langue · Language** : français ou anglais (English). Par défaut, celle du navigateur. Le choix est gardé sur cet appareil. Les textes que tu écris (titres, légendes) ne sont jamais traduits.
- **Exporter (JSON)** : sauvegarde complète des posts, du journal et des réglages, sans les identifiants des comptes.
- **Importer** : remplace l'espace par un fichier exporté. Pratique pour déménager ou préparer un planning ailleurs.
- **Sauvegardes** : chaque lundi matin, une sauvegarde des posts et des réglages (sans identifiants). Les 8 dernières sont gardées dans la base ; si l'envoi vers le Drive est connecté, une copie part aussi dans le dossier `PlanneRs/sauvegardes`. **Sauvegarder maintenant** en fait une tout de suite. **Restaurer** remplace les posts et les réglages par une sauvegarde ; l'état actuel est sauvegardé juste avant (« avant restauration »), on peut donc revenir en arrière. Le journal et les comptes ne changent pas. Les sauvegardes ne vont jamais vers un hébergement public (GitHub Pages, R2).
- **Équipe** : qui peut valider, voir [Équipe et validation client](equipe-et-client.md).
- **Assistant IA** : l'adresse à donner à Claude, ChatGPT ou Codex, et si l'assistant peut valider lui-même (non par défaut : il prépare, tu valides). Voir [Assistants IA](../reference/assistants-ia.md).
- **Récupérer l'historique Instagram** : tes publications Instagram faites en dehors de PlanneRs (jusqu'à 500) arrivent comme « publiées », avec leur légende et leur lien. Elles apparaissent dans le calendrier, les Stats et le bilan du mois, et peuvent être reprises. Celles déjà présentes (même lien, ou post Instagram publié à moins d'une heure) ne sont pas recréées. Rien n'est publié.
- **Importer un planning (CSV)** : ajoute des posts depuis un tableur, sans rien effacer. Colonnes reconnues : `date` (AAAA-MM-JJ ou JJ/MM/AAAA), `heure` (12:30 ou 12h30), `titre` (seule obligatoire), `format` (reel, carrousel, image…), `reseaux` (instagram+facebook) et `legende`. Séparateur `;` ou `,`. Un aperçu liste ce qui sera créé et les lignes ignorées ; « Modèle CSV » donne un fichier d'exemple. Les légendes importées sont à valider.
- **Aide** : revoir la visite guidée, lire la documentation.
