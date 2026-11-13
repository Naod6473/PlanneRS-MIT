# Découpe vidéo (studio)

Le bouton « Couper une vidéo » de La Fabrique charge `ui.js` à la demande.

- `cut.js` : blancs et hésitations (« euh »), repris d'Autocut (`autocut/core.py`) en JavaScript. Mêmes résultats que l'original.
- `video.js` : lecture des MP4/MOV et export de la version coupée (WebCodecs), repris d'Autocut (`web/static/video.js`).
- `moments.js` : les 3 meilleurs passages pour des shorts (repris d'Autocut `shorts.js`).
- `speech.js`, `asr-worker.js`, `ort/` : reconnaissance de la parole (Whisper base, transformers.js), pour les sous-titres et les accroches.
- `reframe.js`, `reframe-worker.js` : vertical 9:16 qui suit la personne (YOLOS tiny, environ 10 Mo, transformers.js), trajet lissé pour un cadre calme.
- `captions.js` : sous-titres incrustés façon Shorts (mot prononcé en couleur), repris d'Autocut.
- `VERSION` : sa présence fait apparaître le bouton.

Tout tourne dans le navigateur. Ce dossier fait partie de la version publique, sous licence MIT. Le dépôt d'Autocut n'est pas modifié : c'est une copie, à faire évoluer ici.
