// Vertical qui suit la personne : on repère où est la personne (le visage, le haut du corps) toutes les
// demi-secondes, on lisse ce trajet pour que le cadre bouge peu et en douceur, puis l'export recadre chaque
// image à sa position. Tout se fait dans le navigateur.

// Centre horizontal (0 à 1) de la personne à suivre parmi les boîtes repérées : la plus grande,
// en préférant celle qui reste près de la position précédente (pas de saut d'une personne à l'autre).
export function pickBox(boxes, prev = null) {
  let best = null, bestScore = -Infinity;
  for (const b of boxes || []) {
    const w = b.x1 - b.x0, h = b.y1 - b.y0;
    if (w <= 0 || h <= 0 || b.score < 0.5) continue;
    const cx = (b.x0 + b.x1) / 2;
    const s = w * h + b.score * 0.05 - (prev == null ? 0 : Math.abs(cx - prev) * 0.6);
    if (s > bestScore) { bestScore = s; best = cx; }
  }
  return best;
}

const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };

// Trajet lissé à partir des repérages [{ t, x }] (x null : personne vue). Les trous reprennent la position
// voisine, un filtre médian enlève les erreurs isolées, une zone morte garde le cadre immobile tant que la
// personne bouge peu, puis la caméra la rejoint en douceur. Renvoie [{ t, x }] ou null si personne.
export function smoothPath(samples, { dead = 0.06, ease = 0.5, win = 2 } = {}) {
  const pts = (samples || []).filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
  const firstSeen = pts.find((p) => p.x != null);
  if (!firstSeen) return null;
  let last = firstSeen.x;
  const filled = pts.map((p) => (p.x != null ? (last = p.x) : last));
  const med = filled.map((_, i) => median(filled.slice(Math.max(0, i - win), i + win + 1)));
  let target = med[0], pos = med[0];
  return pts.map((p, i) => {
    if (Math.abs(med[i] - target) > dead) target = med[i];
    pos += (target - pos) * ease;
    return { t: p.t, x: Math.min(1, Math.max(0, pos)) };
  });
}

// Position à l'instant t (interpolée entre deux repérages)
export function xAt(path, t) {
  if (!path || !path.length) return 0.5;
  if (t <= path[0].t) return path[0].x;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if (t <= b.t) return b.t === a.t ? b.x : a.x + ((b.x - a.x) * (t - a.t)) / (b.t - a.t);
  }
  return path[path.length - 1].x;
}

// Valeur `pos` de cropRect (0 à 1) qui centre le cadre de largeur `frac` (part de l'image gardée) sur x
export function posFor(x, frac) {
  if (frac >= 1) return 0.5;
  return Math.min(1, Math.max(0, (x - frac / 2) / (1 - frac)));
}

// Instants à regarder dans les passages gardés : toutes les `step` secondes, 240 au plus.
export function sampleTimes(pieces, step = 0.5, max = 240) {
  const len = pieces.reduce((n, p) => n + Math.max(0, p.end - p.start), 0);
  const gap = Math.max(step, len / max);
  const out = [];
  for (const p of pieces) for (let t = p.start; t < p.end; t += gap) out.push(+t.toFixed(3));
  return out;
}

let worker = null;
function detector() {
  if (!worker) worker = new Worker(new URL("./reframe-worker.js", import.meta.url), { type: "module" });
  return worker;
}

const seek = (el, t) => new Promise((ok, ko) => {
  const done = () => { el.removeEventListener("seeked", done); el.removeEventListener("error", bad); ok(); };
  const bad = () => { el.removeEventListener("seeked", done); el.removeEventListener("error", bad); ko(new Error("lecture")); };
  el.addEventListener("seeked", done); el.addEventListener("error", bad);
  el.currentTime = t;
});

// Repère la personne dans la vidéo `url` aux instants `times`. onStatus(étape, part de 0 à 1).
// Renvoie le trajet lissé, ou null si personne n'a été vu.
export async function trackPerson(url, times, { ortUrl = "" } = {}, onStatus = () => {}) {
  const el = document.createElement("video");
  el.muted = true; el.playsInline = true; el.preload = "auto"; el.src = url;
  await new Promise((ok, ko) => { el.onloadeddata = ok; el.onerror = () => ko(new Error("lecture")); });
  const W = 256, H = Math.max(2, Math.round((W * el.videoHeight) / el.videoWidth));
  const canvas = new OffscreenCanvas(W, H), ctx = canvas.getContext("2d", { willReadFrequently: true });
  const w = detector();
  let id = 0;
  const ask = (image) => new Promise((ok, ko) => {
    const me = ++id;
    const on = (e) => {
      if (e.data.progress) { if (e.data.progress.status === "progress") onStatus("model", (e.data.progress.progress || 0) / 100); return; }
      if (e.data.id !== me) return;
      w.removeEventListener("message", on);
      e.data.ok ? ok(e.data.boxes) : ko(new Error(e.data.error));
    };
    w.addEventListener("message", on);
    w.postMessage({ id: me, image, ortUrl }, [image.data.buffer]);
  });
  const samples = [];
  let prev = null;
  try {
    for (let i = 0; i < times.length; i++) {
      await seek(el, times[i]);
      ctx.drawImage(el, 0, 0, W, H);
      const { data } = ctx.getImageData(0, 0, W, H);
      const x = pickBox(await ask({ data, width: W, height: H }), prev);
      if (x != null) prev = x;
      samples.push({ t: times[i], x });
      onStatus("track", (i + 1) / times.length);
    }
  } finally {
    el.removeAttribute("src"); el.load();
  }
  return smoothPath(samples);
}
