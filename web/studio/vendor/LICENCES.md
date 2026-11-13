# Bibliothèques incluses

Copiées sans modification depuis le moteur d'Autocut (elles-mêmes copiées depuis npm).

| Fichier | Paquet | Version | Licence |
| --- | --- | --- | --- |
| mp4box.esm.js (lecture des MP4 et MOV) | mp4box | 2.4.1 | BSD-3-Clause |
| mp4-muxer.esm.js (écriture des MP4) | mp4-muxer | 5.2.2 | MIT |
| transformers.min.js (reconnaissance de la parole, chargé à la demande) | @huggingface/transformers | 3.8.1 | Apache-2.0 |
| ../ort/ort-wasm-simd-threaded.jsep.* (moteur ONNX en WebAssembly, tiré du même paquet) | onnxruntime-web (dans @huggingface/transformers 3.8.1) | 3.8.1 | MIT |

Modèle de reconnaissance de la parole : Whisper base d'OpenAI (licence MIT), converti en ONNX par onnx-community,
téléchargé depuis Hugging Face par le navigateur à la première demande puis gardé en cache.
