// Reconnaissance de la parole (Whisper, par transformers.js) dans un worker à part.
// Chargé seulement quand on demande des sous-titres ou des noms tirés des paroles : le modèle
// (40 à 80 Mo) est téléchargé la première fois, puis gardé en cache par le navigateur.

const MODELS = { fast: "onnx-community/whisper-tiny", precise: "onnx-community/whisper-base" };

let asr = null;
let loaded = "";

// Carte graphique (WebGPU) : bien plus rapide sur une longue piste, avec un encodeur en pleine précision
// et un décodeur compressé en 4 bits. Les adaptateurs logiciels ne valent pas mieux que le processeur.
async function gpuReady() {
  try {
    if (!navigator.gpu) return false;
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter && !(adapter.info && adapter.info.isFallbackAdapter) && !adapter.isFallbackAdapter;
  } catch {
    return false;
  }
}

async function load(model, ortUrl, gpu) {
  const want = `${model}:${gpu ? "gpu" : "cpu"}`;
  if (asr && loaded === want) return asr;
  const { pipeline, env } = await import("./vendor/transformers.min.js");
  env.allowLocalModels = false;
  if (ortUrl) env.backends.onnx.wasm.wasmPaths = ortUrl;
  // Plusieurs cœurs quand la page est isolée (en-têtes COOP et COEP du serveur), sinon un seul
  if (self.crossOriginIsolated) env.backends.onnx.wasm.numThreads = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
  const options = gpu
    ? { device: "webgpu", dtype: { encoder_model: "fp32", decoder_model_merged: "q4" } }
    : { device: "wasm", dtype: "q8" };
  const next = await pipeline("automatic-speech-recognition", MODELS[model] || MODELS.fast, {
    ...options, progress_callback: (p) => self.postMessage({ progress: p }),
  });
  if (asr && asr.dispose) asr.dispose().catch(() => {});
  asr = next;
  loaded = want;
  return asr;
}

async function run(audio, { language, model, ortUrl, gpu }) {
  const pipe = await load(model, ortUrl, gpu);
  self.postMessage({ progress: { status: "transcribing", device: gpu ? "gpu" : "cpu" } });
  return pipe(audio, {
    ...(language ? { language } : {}), task: "transcribe",
    return_timestamps: true, chunk_length_s: 30, stride_length_s: 5,
  });
}

self.onmessage = async (e) => {
  const { id, audio, language, model, ortUrl, preferGpu } = e.data;
  try {
    let out = null;
    if (preferGpu && (await gpuReady())) {
      try {
        out = await run(audio, { language, model, ortUrl, gpu: true });
      } catch (err) {
        // Carte graphique qui refuse le modèle ou plante : on refait le travail sur le processeur
        console.warn("WebGPU indisponible pour la reconnaissance, retour au processeur :", err);
        self.postMessage({ gpuFailed: true });
        out = null;
      }
    }
    if (!out) out = await run(audio, { language, model, ortUrl, gpu: false });
    const chunks = (out.chunks || []).map((c) => ({ start: c.timestamp[0], end: c.timestamp[1], text: c.text.trim() }));
    self.postMessage({ id, ok: true, result: { text: (out.text || "").trim(), chunks } });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
