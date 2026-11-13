// Moteur de découpe de PlanneRs : repère les blancs et les hésitations (« euh ») d'une voix.
// Repris du moteur d'Autocut (autocut/core.py : envelope, detect_segments, estimate_threshold,
// _voice_frames, find_hesitations), réécrit en JavaScript pour tourner dans le navigateur sans Python.
// Tout se calcule ici, sur l'ordinateur : rien n'est envoyé.

export const PRESETS = {
  douce: { min_silence_ms: 700, min_sound_ms: 250, padding_ms: 150 },
  normale: { min_silence_ms: 450, min_sound_ms: 250, padding_ms: 100 },
  serree: { min_silence_ms: 250, min_sound_ms: 150, padding_ms: 60 },
};

const msToFrames = (ms, sr) => Math.max(0, Math.round((ms * sr) / 1000));

// Centile avec interpolation linéaire (comme numpy.percentile)
export function percentile(values, p) {
  const a = Float64Array.from(values).sort();
  if (!a.length) return 0;
  const pos = (p / 100) * (a.length - 1);
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}

// Niveau RMS en dB par fenêtre de `windowMs` (crête des canaux à chaque instant). Renvoie { levels, hop }.
export function envelope(channels, sr, windowMs = 10) {
  const hop = Math.max(1, msToFrames(windowMs, sr));
  const len = channels[0].length;
  const n = Math.ceil(len / hop);
  const levels = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    let sum = 0;
    const a = k * hop, b = Math.min(len, a + hop);
    for (let i = a; i < b; i++) {
      let m = Math.abs(channels[0][i]);
      for (let c = 1; c < channels.length; c++) { const v = Math.abs(channels[c][i]); if (v > m) m = v; }
      sum += m * m;
    }
    levels[k] = 20 * Math.log10(Math.max(Math.sqrt(sum / hop), 1e-10));
  }
  return { levels, hop };
}

// Seuil de silence d'après le bruit de fond : niveau des passages calmes + 12 dB, nettement sous les plus forts
export function estimateThreshold(env) {
  if (!env.levels.length) return -45;
  const floor = percentile(env.levels, 10), loud = percentile(env.levels, 99);
  let t = Math.min(Math.max(floor + 12, -65), -15);
  t = Math.min(t, loud - 10);
  return Math.round(t);
}

// Passages de voix séparés par des silences : [{ start, end }] en échantillons (fin exclue)
export function detectSegments(env, sr, total, s) {
  const { levels, hop } = env;
  const runs = [];
  let open = -1;
  for (let k = 0; k <= levels.length; k++) {
    const loud = k < levels.length && levels[k] > s.threshold_db;
    if (loud && open < 0) open = k;
    else if (!loud && open >= 0) { runs.push([open, k]); open = -1; }
  }
  if (!runs.length) return [];
  const minGap = Math.max(1, Math.ceil(((s.min_silence_ms / 1000) * sr) / hop));
  const regions = [runs[0].slice()];
  for (const [a, b] of runs.slice(1)) {
    const last = regions[regions.length - 1];
    if (a - last[1] < minGap) last[1] = b;
    else regions.push([a, b]);
  }
  const pad = msToFrames(s.padding_ms, sr), minLen = msToFrames(s.min_sound_ms, sr);
  const segs = [];
  for (const [a, b] of regions) {
    if ((b - a) * hop < minLen) continue;
    segs.push({ start: Math.max(0, a * hop - pad), end: Math.min(total, b * hop + pad) });
  }
  for (let i = 0; i + 1 < segs.length; i++) {
    if (segs[i].end > segs[i + 1].start) { const mid = Math.floor((segs[i].end + segs[i + 1].start) / 2); segs[i].end = mid; segs[i + 1].start = mid; }
  }
  return segs;
}

// --- Analyse de la voix ----------------------------------------------------------------

// FFT complexe en place (taille puissance de 2)
function fft(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / size;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += size) {
      let cr = 1, ci = 0;
      for (let k = 0; k < size / 2; k++) {
        const a = i + k, b = a + size / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

// Fenêtres de 32 ms tous les 10 ms, à 16 kHz environ : niveau (dB), netteté de la hauteur (0-1),
// hauteur (Hz) et variation du timbre (dB) d'une fenêtre à la suivante.
export function voiceFrames(mono, sr) {
  const step = Math.max(1, Math.round(sr / 16000));
  let x = mono;
  if (step > 1) {
    const n = Math.floor(mono.length / step);
    x = new Float64Array(n);
    for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < step; k++) s += mono[i * step + k]; x[i] = s / step; }
  }
  const rate = sr / step, win = 512, N = 1024, bins = win + 1;
  const hop = Math.max(1, Math.round(rate * 0.01));
  const out = { level: [], clarity: [], f0: [], flux: [], hop: hop * step, win: win * step };
  if (x.length < win) return out;
  const count = 1 + Math.floor((x.length - win) / hop);
  const hann = new Float64Array(win).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1)));
  const lo = Math.floor(rate / 400), hi = Math.floor(rate / 70);
  const edges = Array.from({ length: 21 }, (_, i) => 100 * Math.pow(Math.min(4000, rate / 2 - 1) / 100, i / 20));
  const bandOf = new Int8Array(bins).fill(-1);
  for (let k = 0; k < bins; k++) { const f = (k * rate) / N; for (let b = 0; b < 20; b++) if (f >= edges[b] && f < edges[b + 1]) { bandOf[k] = b; break; } }
  const re = new Float64Array(N), im = new Float64Array(N), spec = new Float64Array(bins);
  let prev = null;
  for (let c = 0; c < count; c++) {
    re.fill(0); im.fill(0);
    for (let i = 0; i < win; i++) re[i] = x[c * hop + i] * hann[i];
    fft(re, im);
    let total = 0;
    const bands = new Float64Array(20);
    for (let k = 0; k < bins; k++) { spec[k] = re[k] * re[k] + im[k] * im[k]; total += spec[k]; if (bandOf[k] >= 0) bands[bandOf[k]] += spec[k]; }
    out.level.push(10 * Math.log10(Math.max(total / win, 1e-12)));
    // Autocorrélation = transformée inverse du spectre de puissance
    for (let k = 0; k < N; k++) { re[k] = spec[k <= win ? k : N - k]; im[k] = 0; }
    fft(re, im, true);
    let lag = lo;
    for (let k = lo; k < hi; k++) if (re[k] > re[lag]) lag = k;
    out.clarity.push(re[lag] / Math.max(re[0], 1e-12));
    out.f0.push(rate / lag);
    for (let b = 0; b < 20; b++) bands[b] = 10 * Math.log10(Math.max(bands[b], 1e-12));
    if (!prev) out.flux.push(99);
    else { let s = 0; for (let b = 0; b < 20; b++) s += Math.abs(bands[b] - prev[b]); out.flux.push(s / 20); }
    prev = bands;
  }
  return out;
}

// Hésitations (« euh », « heu », « mmm ») : une voyelle tenue sans bouger pendant au moins `minMs`.
// Renvoie [[début, fin]] en échantillons, dans les passages de voix.
export function findHesitations(mono, sr, segments, minMs = 300) {
  const found = [];
  const need = Math.max(3, Math.round(minMs / 10));
  for (const seg of segments) {
    const clip = mono.subarray(Math.max(0, seg.start), Math.min(mono.length, seg.end));
    const { level, clarity, f0, flux, hop, win } = voiceFrames(clip, sr);
    const n = level.length;
    if (n < need) continue;
    const top = Math.max(...level);
    const still = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const steady = i > 0 && Math.abs(Math.log2(f0[i] / f0[i - 1])) < 0.05;
      still[i] = level[i] > top - 28 && clarity[i] > 0.5 && flux[i] < 2.2 && steady ? 1 : 0;
    }
    const gap = still.slice();
    for (let i = 1; i < n - 1; i++) if (still[i - 1] && still[i + 1]) gap[i] = 1;
    for (let a = 0; a < n;) {
      if (!gap[a]) { a++; continue; }
      let b = a;
      while (b < n && gap[b]) b++;
      if (b - a >= need) {
        let fl = 0;
        for (let i = a + 1; i < b; i++) fl += flux[i];
        fl /= Math.max(1, b - a - 1);
        const p10 = percentile(f0.slice(a, b), 10), p90 = percentile(f0.slice(a, b), 90);
        if (fl < 1.1 && 12 * Math.log2(p90 / p10) < 3) found.push([seg.start + a * hop, Math.min(seg.end, seg.start + (b - 1) * hop + win)]);
      }
      a = b;
    }
  }
  return found;
}

// Retire des passages [a, b] des segments : un segment coupé au milieu devient deux
export function carve(segments, ranges, sr) {
  const minLen = Math.round(0.05 * sr);
  const sorted = [...ranges].sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const s of segments) {
    let pieces = [{ ...s }];
    for (const [a, b] of sorted) {
      const next = [];
      for (const p of pieces) {
        if (b <= p.start || a >= p.end) { next.push(p); continue; }
        if (a - p.start >= minLen) next.push({ start: p.start, end: a });
        if (p.end - b >= minLen) next.push({ start: b, end: p.end });
      }
      pieces = next;
    }
    out.push(...pieces);
  }
  return out;
}

// Analyse complète. `channels` : Float32Array par canal, `sr` : fréquence.
// Renvoie { threshold, segments, hesitations, duration } (échantillons) ; `plan()` en tire les passages à garder.
export function analyse(channels, sr, { preset = "normale", threshold = null } = {}) {
  const env = envelope(channels, sr);
  const th = threshold == null ? estimateThreshold(env) : threshold;
  const settings = { threshold_db: th, ...(PRESETS[preset] || PRESETS.normale) };
  const total = channels[0].length;
  const segments = detectSegments(env, sr, total, settings);
  let mono = channels[0];
  if (channels.length > 1) {
    mono = new Float32Array(total);
    for (const ch of channels) for (let i = 0; i < total; i++) mono[i] += ch[i] / channels.length;
  }
  const hesitations = findHesitations(mono, sr, segments);
  return { threshold: th, segments, hesitations, total, sr, env };
}

// Passages gardés, en secondes : [{ start, end }]. Sans couper les blancs, toute la vidéo est gardée.
export function plan(a, { blanks = true, ums = true } = {}) {
  let keep = blanks ? a.segments.map((s) => ({ ...s })) : [{ start: 0, end: a.total }];
  if (ums && a.hesitations.length) keep = carve(keep, a.hesitations, a.sr);
  const merged = [];
  for (const p of keep.sort((x, y) => x.start - y.start)) {
    const last = merged[merged.length - 1];
    if (last && p.start <= last.end) last.end = Math.max(last.end, p.end);
    else merged.push({ ...p });
  }
  return merged.map((p) => ({ start: p.start / a.sr, end: p.end / a.sr }));
}
