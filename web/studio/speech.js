// Sous-titres et noms tirés des paroles : la page envoie le son (mono, 16 kHz) au worker de reconnaissance.

export const SAMPLE_RATE = 16000;
export const MODEL_MB = { fast: 40, precise: 80 };

let worker = null;
let seq = 0;
const pending = new Map();
let listener = null;

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./asr-worker.js", import.meta.url), { type: "module" });
  worker.onmessage = (e) => {
    const msg = e.data;
    if (msg.gpuFailed) {
      gpuOff(true);
      return;
    }
    if (msg.progress) {
      watchGpu(msg.progress);
      if (listener) listener(msg.progress);
      return;
    }
    const job = pending.get(msg.id);
    if (!job) return;
    pending.delete(msg.id);
    clearTimeout(job.watch);
    if (msg.ok) job.resolve(msg.result);
    else job.reject(new Error(msg.error));
  };
  worker.onerror = (e) => retryOnCpu(e.message);
  return worker;
}

// Le worker a planté ou la carte graphique traîne : les travaux lancés sur la carte graphique sont refaits
// sur le processeur, et ce navigateur n'essaiera plus la carte graphique
function retryOnCpu(message = "") {
  const jobs = [...pending.entries()];
  pending.clear();
  if (worker) worker.terminate();
  worker = null;
  for (const [id, job] of jobs) {
    clearTimeout(job.watch);
    if (job.gpu) {
      gpuOff(true);
      job.gpu = false;
      job.watch = null;
      job.running = false;
      pending.set(id, job);
      getWorker().postMessage({ ...job.msg, preferGpu: false });
    } else job.reject(new Error(message || "asr"));
  }
}

// Garde-fou de la carte graphique : pendant le chargement, 90 s au plus sans nouvelles (le téléchargement
// en donne sans cesse) ; ensuite, la reconnaissance doit aller au moins aussi vite que la parole. Sinon, le processeur.
function watchGpu(progress = null) {
  for (const job of pending.values()) {
    if (!job.gpu || job.running) continue;
    clearTimeout(job.watch);
    if (progress && progress.status === "transcribing" && progress.device === "cpu") continue;
    let wait = 90;
    if (progress && progress.status === "transcribing") {
      job.running = true;
      wait = Math.max(60, job.msg.audio.length / SAMPLE_RATE);
    }
    job.watch = setTimeout(() => retryOnCpu(), wait * 1000);
  }
}

function gpuOff(set = false) {
  try {
    if (set) localStorage.setItem("planners.asrGpuOff", "1");
    return localStorage.getItem("planners.asrGpuOff") === "1";
  } catch {
    return set;
  }
}

// Téléchargement du modèle : part reçue de l'ensemble des fichiers (0 à 1), ou null quand il est prêt
function downloadShare(files, p) {
  if (p.status === "progress" && p.file && p.total) files.set(p.file, [p.loaded || 0, p.total]);
  if (p.status === "done" && p.file && files.has(p.file)) files.set(p.file, [files.get(p.file)[1], files.get(p.file)[1]]);
  let loaded = 0;
  let total = 0;
  for (const [l, t] of files.values()) {
    loaded += l;
    total += t;
  }
  return total ? loaded / total : 0;
}

// Transcrit `audio` (Float32Array mono 16 kHz). onStatus("download", part) puis onStatus("transcribe").
// Renvoie { text, chunks: [{ start, end, text }] } en secondes.
// La carte graphique sert pour plus de 2 minutes de parole : son modèle est plus gros à télécharger.
export function transcribe(audio, { language = "", model = "fast", ortUrl = "" } = {}, onStatus = () => {}) {
  const preferGpu = audio.length > SAMPLE_RATE * 120 && !gpuOff();
  const files = new Map();
  listener = (p) => {
    if (p.status === "transcribing") onStatus("transcribe");
    else if (p.status === "progress" || p.status === "done" || p.status === "initiate") onStatus("download", downloadShare(files, p));
  };
  const id = ++seq;
  return new Promise((resolve, reject) => {
    // Le son est gardé (pas transféré) quand la carte graphique est essayée : il resservira si elle plante
    const msg = { id, audio, language, model, ortUrl, preferGpu };
    pending.set(id, { resolve, reject, gpu: preferGpu, msg: preferGpu ? msg : null });
    getWorker().postMessage(msg, preferGpu ? [] : [audio.buffer]);
    if (preferGpu) watchGpu();
  });
}

// --- Fichiers .srt ------------------------------------------------------------------

const pad = (n, w = 2) => String(n).padStart(w, "0");

function stamp(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}

export function srt(cues) {
  return cues
    .filter((c) => c.text && c.end > c.start)
    .map((c, i) => `${i + 1}\r\n${stamp(c.start)} --> ${stamp(c.end)}\r\n${c.text}\r\n`)
    .join("\r\n");
}
