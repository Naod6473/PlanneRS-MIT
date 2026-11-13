// Sous-titres incrustés dans l'image, façon Shorts : quelques mots à la fois, le mot prononcé en couleur.
// La reconnaissance ne donne que le début et la fin de chaque phrase : le temps de chaque mot est estimé
// d'après sa longueur, ce qui suffit à suivre la parole à l'œil.

// Phrases [{ start, end, text }] (secondes) → groupes de mots minutés [{ start, end, words: [{ text, start, end }] }]
export function captionGroups(cues, { maxChars = 18 } = {}) {
  const groups = [];
  for (const c of cues) {
    const words = String(c.text || "").split(/\s+/).filter(Boolean);
    if (!words.length || !(c.end > c.start)) continue;
    const weights = words.map((w) => w.length + 2);
    const sum = weights.reduce((a, b) => a + b, 0);
    let at = c.start;
    let group = null;
    words.forEach((text, i) => {
      const end = at + ((c.end - c.start) * weights[i]) / sum;
      const word = { text, start: at, end };
      at = end;
      const chars = group ? group.words.reduce((n, w) => n + w.text.length + 1, 0) + text.length : 0;
      if (!group || chars > maxChars) {
        group = { start: word.start, end: word.end, words: [] };
        groups.push(group);
      }
      group.words.push(word);
      group.end = word.end;
      if (/[.!?…;:]$/.test(text)) group = null; // une fin de phrase ferme le groupe
    });
  }
  // Un groupe reste affiché jusqu'au suivant quand le trou est court : moins de clignotements
  groups.forEach((g, i) => {
    const next = groups[i + 1];
    if (next && next.start - g.end < 0.35) g.end = next.start;
  });
  return groups;
}

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
export const CAPTION_COLOR = "#ffd23f";

// Positions et tailles proposées des sous-titres
export const CAPTION_POS = { low: null, mid: 0.5, high: 0.2 };
export const CAPTION_SIZES = { s: 0.8, m: 1, l: 1.25 };
const norm = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

// Dessine sur `ctx` (image de W × H) le groupe affiché au temps `t`, s'il y en a un.
// style : "karaoke" (le mot prononcé en couleur), "box" (bandeau sombre, mot prononcé surligné),
// "pop" (le mot prononcé grossit), "plain" (blanc, sans surlignage) ; keywords : mots toujours en couleur.
export function drawCaption(ctx, W, H, groups, t, { color = CAPTION_COLOR, font = FONT, style = "karaoke", pos = "low", size = "m", upper = false, keywords = "" } = {}) {
  const g = groups.find((x) => t >= x.start && t < x.end);
  if (!g) return;
  const accent = color || CAPTION_COLOR;
  const keys = new Set(String(keywords || "").split(/[,;\n]+/).map(norm).filter(Boolean));
  const px = Math.max(14, Math.round(Math.min(W, H) * 0.075 * (CAPTION_SIZES[size] || 1)));
  ctx.save();
  ctx.font = `800 ${px}px ${font || FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  // Mots répartis en lignes de 86 % de la largeur au plus
  const space = ctx.measureText(" ").width;
  const lines = [];
  let line = [];
  let width = 0;
  for (const w0 of g.words) {
    const w = { ...w0, text: upper ? w0.text.toUpperCase() : w0.text };
    const ww = ctx.measureText(w.text).width;
    if (line.length && width + space + ww > W * 0.86) {
      lines.push({ words: line, width });
      line = [];
      width = 0;
    }
    width += (line.length ? space : 0) + ww;
    line.push({ ...w, width: ww });
  }
  if (line.length) lines.push({ words: line, width });
  const lh = px * (style === "box" ? 1.32 : 1.18);
  const centerY = H * (CAPTION_POS[pos] ?? (H > W ? 0.7 : 0.82));
  let y = centerY - ((lines.length - 1) * lh) / 2;
  if (style === "box") {
    // Bandeau arrondi derrière toutes les lignes
    const bw = Math.max(...lines.map((l) => l.width)) + px * 0.9;
    const bh = lines.length * lh + px * 0.3;
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    roundRect(ctx, (W - bw) / 2, centerY - bh / 2, bw, bh, px * 0.3);
    ctx.fill();
  }
  for (const l of lines) {
    let x = (W - l.width) / 2;
    for (const w of l.words) {
      const now = t >= w.start && t < w.end;
      const key = keys.size && keys.has(norm(w.text));
      if (style === "box" && now) {
        ctx.fillStyle = accent;
        roundRect(ctx, x - px * 0.12, y - px * 0.6, w.width + px * 0.24, px * 1.2, px * 0.18);
        ctx.fill();
      }
      ctx.save();
      if (style === "pop" && now) {
        // Le mot prononcé grossit autour de son centre
        const cx = x + w.width / 2;
        ctx.translate(cx, y);
        ctx.scale(1.18, 1.18);
        ctx.translate(-cx, -y);
      }
      if (style !== "box") {
        ctx.lineWidth = px * 0.2;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.92)";
        if (style === "plain") {
          ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
          ctx.shadowBlur = px * 0.25;
          ctx.lineWidth = px * 0.08;
        }
        ctx.strokeText(w.text, x, y);
      }
      const lit = style === "box" ? (now ? "#111111" : key ? accent : "#ffffff") : (now && style !== "plain") || key ? accent : "#ffffff";
      ctx.fillStyle = lit;
      ctx.fillText(w.text, x, y);
      ctx.restore();
      x += w.width + space;
    }
    y += lh;
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}
