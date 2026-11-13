// Repérage des personnes (YOLOS tiny, par transformers.js) dans un worker à part, pour le vertical qui
// suit la personne. Modèle d'environ 10 Mo, téléchargé la première fois puis gardé en cache par le navigateur.

let det = null;

async function load(ortUrl) {
  if (det) return det;
  const { pipeline, env, RawImage } = await import("./vendor/transformers.min.js");
  env.allowLocalModels = false;
  if (ortUrl) env.backends.onnx.wasm.wasmPaths = ortUrl;
  if (self.crossOriginIsolated) env.backends.onnx.wasm.numThreads = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
  const pipe = await pipeline("object-detection", "Xenova/yolos-tiny", {
    device: "wasm", dtype: "q8", progress_callback: (p) => self.postMessage({ progress: p }),
  });
  // Image réduite (256 px au lieu de 512) : bien assez pour trouver une personne, environ 4 fois plus rapide
  const ip = pipe.processor && pipe.processor.image_processor;
  if (ip && ip.size) ip.size = { shortest_edge: 256, longest_edge: 456 };
  det = { pipe, RawImage };
  return det;
}

// { id, image: { data, width, height }, ortUrl } → { id, ok, boxes: [{ score, x0, y0, x1, y1 }] } (de 0 à 1)
self.onmessage = async (e) => {
  const { id, image, ortUrl } = e.data;
  try {
    const { pipe, RawImage } = await load(ortUrl);
    const img = new RawImage(image.data, image.width, image.height, 4);
    const out = await pipe(img, { threshold: 0.5, percentage: true });
    const boxes = (out || []).filter((b) => b.label === "person")
      .map((b) => ({ score: b.score, x0: b.box.xmin, y0: b.box.ymin, x1: b.box.xmax, y1: b.box.ymax }));
    self.postMessage({ id, ok: true, boxes });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
