// Les meilleurs passages d'une vidéo pour en faire des shorts, calculés dans le navigateur.
// Repris du moteur d'Autocut (web/static/shorts.js) : niveau, voix expressive, débit, questions, rires.

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// --- Meilleurs moments ----------------------------------------------------------------------

export const MOMENT_REASONS = {
  loud: "Ton qui monte",
  dyn: "Voix expressive",
  peaks: "Temps forts",
  rate: "Débit rapide",
  punct: "Questions et exclamations",
  laugh: "Rires",
  dense: "Sans temps mort",
};
const WEIGHTS = { loud: 1, dyn: 0.8, peaks: 1, rate: 0.6, punct: 0.6, laugh: 0.8, dense: 0.5 };

function quantile(sorted, q) {
  if (!sorted.length) return -120;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
}

// Les `count` meilleurs extraits d'environ `target` secondes (silences retirés), sans chevauchement.
// passages : [[début, fin], …] en secondes, triés ; levels : dB par fenêtre de `hop` secondes ;
// cues : phrases reconnues [{ start, end, text }] (facultatif, affine le score et donne l'accroche).
export function bestMoments({ passages, levels, hop, cues = [], target = 30, count = 3 }) {
  if (!passages.length) return [];
  const frames = (a, b) => [Math.max(0, Math.floor(a / hop)), Math.min(levels.length, Math.ceil(b / hop))];
  const voiced = [];
  for (const [a, b] of passages) {
    const [i0, i1] = frames(a, b);
    for (let i = i0; i < i1; i++) if (levels[i] > -70) voiced.push(levels[i]);
  }
  voiced.sort((x, y) => x - y);
  const med = quantile(voiced, 0.5);
  const p90 = quantile(voiced, 0.9);
  // Mesures de chaque passage, additionnées ensuite pour chaque extrait
  const per = passages.map(([a, b]) => {
    const [i0, i1] = frames(a, b);
    let n = 0;
    let sum = 0;
    let sum2 = 0;
    let peaks = 0;
    for (let i = i0; i < i1; i++) {
      const v = levels[i];
      if (!(v > -70)) continue;
      n++;
      sum += v;
      sum2 += v * v;
      if (v >= p90) peaks++;
    }
    let words = 0;
    let punct = 0;
    let laugh = 0;
    for (const c of cues) {
      const ov = Math.min(b, c.end) - Math.max(a, c.start);
      if (ov <= 0) continue;
      const share = ov / Math.max(0.05, c.end - c.start);
      const text = String(c.text || "");
      words += share * text.split(/\s+/).filter(Boolean).length;
      punct += share * (text.match(/[!?]/g) || []).length;
      laugh += share * (text.match(/\b(rires?|ha(ha)+|hi(hi)+|mdr|lol|laughs?|laughter)\b/gi) || []).length;
    }
    return { a, b, len: b - a, n, sum, sum2, peaks, words, punct, laugh };
  });
  const total = passages.reduce((s, [a, b]) => s + (b - a), 0);
  const want = Math.min(target, total);
  const lo = want * 0.7;
  const hi = want * 1.2;
  // Extraits candidats : des passages qui se suivent, le plus proche de la durée voulue pour chaque début
  const cands = [];
  for (let i = 0; i < per.length; i++) {
    let len = 0;
    let best = null;
    for (let j = i; j < per.length; j++) {
      len += per[j].len;
      if (len > hi && j > i) break;
      if (len >= lo && (!best || Math.abs(len - want) < Math.abs(best.len - want))) best = { i, j, len };
    }
    if (best) cands.push(best);
  }
  if (!cands.length) cands.push({ i: 0, j: per.length - 1, len: total });
  const feats = cands.map(({ i, j, len }) => {
    let n = 0;
    let sum = 0;
    let sum2 = 0;
    let peaks = 0;
    let words = 0;
    let punct = 0;
    let laugh = 0;
    for (let k = i; k <= j; k++) {
      const p = per[k];
      n += p.n;
      sum += p.sum;
      sum2 += p.sum2;
      peaks += p.peaks;
      words += p.words;
      punct += p.punct;
      laugh += p.laugh;
    }
    const mean = n ? sum / n : -120;
    const span = per[j].b - per[i].a;
    return {
      loud: mean - med,
      dyn: n ? Math.sqrt(Math.max(0, sum2 / n - mean * mean)) : 0,
      peaks: n ? peaks / n : 0,
      rate: words / Math.max(1, len),
      punct: punct / Math.max(1, len),
      laugh: laugh / Math.max(1, len),
      dense: len / Math.max(0.1, span),
    };
  });
  // Chaque mesure est centrée et réduite sur l'ensemble des candidats, puis pondérée
  const z = {};
  for (const k of Object.keys(WEIGHTS)) {
    const vals = feats.map((f) => f[k]);
    const m = vals.reduce((s, v) => s + v, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((s, v) => s + (v - m) * (v - m), 0) / vals.length);
    z[k] = vals.map((v) => (sd > 1e-6 ? (v - m) / sd : 0));
  }
  const scored = cands.map((c, idx) => {
    let score = 0;
    for (const k of Object.keys(WEIGHTS)) score += WEIGHTS[k] * z[k][idx];
    const start = per[c.i].a;
    // Un extrait qui commence au début d'une phrase se comprend mieux
    if (cues.length && cues.some((q) => Math.abs(q.start - start) < 0.4)) score += 0.3;
    const reasons = Object.keys(WEIGHTS).filter((k) => z[k][idx] > 0.6).sort((a, b) => z[b][idx] - z[a][idx]).slice(0, 2);
    return { ...c, score, reasons };
  });
  scored.sort((a, b) => b.score - a.score);
  const picked = [];
  for (const c of scored) {
    const a = per[c.i].a;
    const b = per[c.j].b;
    if (picked.some((p) => a < p.end && b > p.start)) continue;
    const inside = cues.filter((q) => q.end > a && q.start < b);
    picked.push({
      start: a, end: b, duration: c.len, score: c.score, reasons: c.reasons,
      pieces: per.slice(c.i, c.j + 1).map((p) => [p.a, p.b]),
      text: inside.map((q) => q.text).join(" ").trim(),
      hook: hookFrom(inside),
    });
    if (picked.length >= count) break;
  }
  return picked;
}

// Accroche : la phrase la plus vive du début de l'extrait (une question ou une exclamation de préférence)
export function hookFrom(cues, max = 60) {
  const list = cues.map((q) => String(q.text || "").trim()).filter(Boolean).slice(0, 4);
  if (!list.length) return "";
  const pick = list.find((s) => /[!?]$/.test(s)) || list[0];
  return shorten(pick, max);
}

export function shorten(text, max = 60) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1);
  const at = cut.lastIndexOf(" ");
  return `${cut.slice(0, at > max * 0.5 ? at : max).replace(/[,;:.\s]+$/, "")}…`;
}

