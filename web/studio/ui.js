// « Couper une vidéo » : la découpe des blancs et des « euh » dans PlanneRs.
// Une vidéo → on écoute → on voit ce qui part → on crée la vidéo → elle entre dans La Fabrique.
// Tout tourne dans le navigateur (moteur cut.js, encodage WebCodecs) : la vidéo n'est envoyée nulle part avant l'import.

import { analyse, plan } from "./cut.js";
import { probe, canExport, renderVideo, cropRect, AUDIO_RATE } from "./video.js";
import { bestMoments, MOMENT_REASONS } from "./moments.js";
import { captionGroups } from "./captions.js";
import { transcribe, SAMPLE_RATE, MODEL_MB, srt } from "./speech.js";
import { trackPerson, sampleTimes, posFor, xAt } from "./reframe.js";

const A = window.App, U = window.UI;
const { esc, icon } = U;
const tick = () => new Promise((r) => setTimeout(r, 30));
const mmss = (s) => Math.floor(s / 60) + ":" + String(Math.round(s % 60)).padStart(2, "0");
const human = (s) => (s >= 60 ? Math.floor(s / 60) + " min " + String(Math.round(s % 60)).padStart(2, "0") + " s" : Math.round(s) + " s");

const CSS = `
.cut .sh-body{display:grid;gap:16px;align-content:start}
#cut-tlw{height:100%}
.cut-drop{display:grid;place-items:center;align-content:center;gap:10px;text-align:center;padding:40px 16px;border:2px dashed var(--line2);border-radius:14px;background:var(--panel2)}
.cut-drop.over{border-color:var(--n-fabrique);background:color-mix(in srgb,var(--n-fabrique) 8%,var(--panel))}
.cut-drop .ic{width:56px;height:56px;border-radius:14px;display:grid;place-items:center;background:var(--n-fabrique);color:#fff}
.cut-drop .ic svg{width:26px;height:26px}
.cut-drop h3{margin:0;font-size:18px}
.cut-drop p{margin:0}
.cut-steps{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:6px 0 0;padding:0;list-style:none;color:var(--ink2);font-size:13px}
.cut-steps li{display:flex;gap:6px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:99px;padding:4px 10px}
.cut-steps b{color:var(--n-fabrique)}
.cut-wait{display:grid;gap:8px;padding:24px 0;text-align:center}
.cut-bar{height:8px;border-radius:99px;background:var(--line);overflow:hidden}
.cut-bar i{display:block;height:100%;width:0;background:var(--n-fabrique);transition:width .2s}
.cut-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}
@media (max-width:760px){.cut-grid{grid-template-columns:1fr}}
.cut-vid{width:100%;max-height:52vh;border-radius:12px;background:#000;display:block}
.cut-nums{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr);gap:8px}
.cut-nums div{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:10px}
.cut-nums b{display:block;font-size:20px}
.cut-nums span{font-size:12px;color:var(--ink3)}
.cut-tl{position:relative;height:72px;border-radius:10px;background:var(--panel2);border:1px solid var(--line);overflow:visible;cursor:pointer}
.cut-tl svg{display:block;width:100%;height:100%;border-radius:10px}
.cut-tl .ph{position:absolute;top:-3px;bottom:-3px;width:2px;margin-left:-1px;background:var(--ink);border-radius:2px;pointer-events:none}
.cut-scanw{position:relative;height:72px;border-radius:10px;background:var(--panel2);border:1px solid var(--line);overflow:hidden}
.cut-scanw svg{display:block;width:100%;height:100%}
.cut-pend{position:absolute;top:0;bottom:0;right:0;background:color-mix(in srgb,var(--panel2) 55%,transparent);backdrop-filter:grayscale(1);-webkit-backdrop-filter:grayscale(1)}
.cut-scan{position:absolute;top:0;bottom:0;width:3px;margin-left:-1px;background:var(--n-fabrique);box-shadow:0 0 14px 3px color-mix(in srgb,var(--n-fabrique) 55%,transparent)}
.cut-scan::before{content:"";position:absolute;right:3px;top:0;bottom:0;width:80px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--n-fabrique) 18%,transparent))}
.cut-pills{position:relative;height:12px;margin-bottom:6px}
.cut-pills span{position:absolute;top:2px;height:8px;min-width:4px;border-radius:99px;background:var(--line2)}
.cut-pills span.euh{background:var(--gold)}
.cut-pills span.wait{transform:scale(0);opacity:0}
.cut-pills span.show{animation:cut-pop .4s cubic-bezier(.3,1.6,.5,1) both}
@keyframes cut-pop{from{transform:scale(0);opacity:0}}
.cut-bump{animation:cut-bump .35s}
@keyframes cut-bump{40%{transform:scale(1.12)}}
.cut-proc{display:grid;gap:14px}
.cut-proc .cut-nums{grid-template-columns:repeat(4,minmax(0,1fr))}
@media (max-width:600px){.cut-proc .cut-nums{grid-template-columns:repeat(2,minmax(0,1fr))}}
.cut-nums b{transform-origin:left center}
.cut-stepsl{display:flex;gap:16px;font-size:12.5px;color:var(--ink3)}
.cut-stepsl .on{color:var(--ink);font-weight:600}
.cut-stepsl .done{color:var(--n-fabrique)}
.cut-flash{position:absolute;top:0;bottom:0;border-radius:4px;background:color-mix(in srgb,var(--n-fabrique) 30%,transparent);box-shadow:0 0 20px color-mix(in srgb,var(--n-fabrique) 50%,transparent);animation:cut-fade .75s ease-out forwards;pointer-events:none}
.cut-flash.euh{background:color-mix(in srgb,var(--gold) 50%,transparent);box-shadow:0 0 22px var(--gold)}
@keyframes cut-fade{to{opacity:0}}
.cut-gain{position:absolute;top:-12px;transform:translateX(-50%);font-size:12px;font-weight:800;color:var(--n-fabrique);background:var(--panel);border:1px solid currentColor;padding:2px 8px;border-radius:99px;animation:cut-rise 1.1s ease-out forwards;pointer-events:none;white-space:nowrap;z-index:3}
.cut-gain.euh{color:var(--gold)}
@keyframes cut-rise{0%{opacity:0;transform:translate(-50%,8px)}20%{opacity:1}100%{opacity:0;transform:translate(-50%,-22px)}}
.cut-vid.jump{animation:cut-jump .2s}
@keyframes cut-jump{50%{filter:brightness(1.4)}}
.cut-h{margin:4px 0 0;font-size:14px}
.cut-moms{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.cut-moms li{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:8px 10px}
.cut-moms label{display:flex;gap:8px;align-items:center}
.cut-moms input{width:18px;height:18px;accent-color:var(--n-fabrique)}
.cut-moms .btn{margin-left:auto;min-height:30px}
.cut-why{font-size:12px;color:var(--n-fabrique);font-weight:600}
.cut-moms q{flex-basis:100%;font-style:italic;color:var(--ink2);font-size:13px}
.cut-outs{display:grid;gap:16px}
.cut-outs.many{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.cut-out{display:grid;gap:8px}
.cut-outs:not(.many) .cut-out{grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start}
@media (max-width:760px){.cut-outs:not(.many) .cut-out{grid-template-columns:1fr}}
.cut-out p{margin:4px 0 0}
.cut-wsp{display:flex;gap:4px;height:28px;justify-content:center}
.cut-wsp i{width:4px;height:100%;border-radius:2px;background:var(--n-fabrique);transform:scaleY(.35);animation:cut-wsp .9s ease-in-out infinite}
.cut-wsp i:nth-child(2){animation-delay:.1s}.cut-wsp i:nth-child(3){animation-delay:.2s}.cut-wsp i:nth-child(4){animation-delay:.3s}.cut-wsp i:nth-child(5){animation-delay:.4s}
@keyframes cut-wsp{50%{transform:scaleY(1)}}
@media (prefers-reduced-motion:reduce){.cut-pills span.show,.cut-bump,.cut-flash,.cut-gain,.cut-vid.jump{animation:none}}
.cut{--gold:#B45309}
:root[data-theme="dark"] .cut{--gold:#F5B544}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .cut{--gold:#F5B544}}
.cut-leg{display:flex;gap:14px;font-size:12px;color:var(--ink3)}
.cut-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.cut-opts{display:grid;gap:12px}
.cut-opt{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.cut-opt label{display:flex;gap:8px;align-items:center;font-weight:600}
.cut-opt input[type=checkbox]{width:18px;height:18px;accent-color:var(--n-fabrique)}
.cut-note{font-size:12px;color:var(--ink3);margin:0}
.cut-err{color:var(--fail);background:var(--fail-bg);border-radius:10px;padding:10px 12px;margin:0}
`;

let st = null;

export function open() {
  if (!document.getElementById("cut-css")) { const s = document.createElement("style"); s.id = "cut-css"; s.textContent = CSS; document.head.appendChild(s); }
  st = { focus: document.activeElement, busy: false, file: null, url: "", v: null, ch: null, a: null, blanks: true, ums: true, preset: "normale", vertical: false, follow: true, path: null, pathKey: "", mode: "full", subs: false, cues: null, moments: [], off: new Set(), outs: [] };
  A.beforeClose = () => { if (st && st.busy) { U.toast("Attends la fin du calcul pour fermer."); return false; } cleanup(); return true; };
  pick();
}

function cleanup() {
  if (!st) return;
  if (st.url) URL.revokeObjectURL(st.url);
  (st.outs || []).forEach((o) => URL.revokeObjectURL(o.url));
  st = null;
}

function layer(body, foot) {
  A.openLayer('<div class="sh-top"><b>Couper une vidéo</b><span class="muted">Blancs et « euh »</span><span style="flex:1"></span><button class="iconbtn" data-close aria-label="Fermer">' + icon("x") + "</button></div>" +
    '<div class="sh-body">' + body + "</div>" + (foot ? '<div class="sh-foot">' + foot + "</div>" : ""), "Couper une vidéo");
  const L = document.getElementById("layer");
  const sh = L.querySelector(".sheet"); sh.classList.add("wide", "cut");
  if (st) A.lastFocus = st.focus;
  return L;
}

// 1. Choisir la vidéo
function pick(error) {
  if (st) st.busy = false;
  const L = layer((error ? '<p class="cut-err" role="alert">' + esc(error) + "</p>" : "") +
    '<div class="cut-drop" id="cut-drop"><span class="ic">' + icon("film") + "</span><h3>Dépose ta vidéo ici</h3>" +
    '<p class="muted">MP4 ou MOV, filmée face caméra ou en voix off. Elle reste sur ton ordinateur pendant la découpe.</p>' +
    '<label class="btn primary"><input type="file" accept="video/mp4,video/quicktime,.mp4,.mov,.m4v" id="cut-file" hidden>' + icon("plus") + "Choisir une vidéo</label>" +
    '<ol class="cut-steps"><li><b>1</b>On repère les blancs et les « euh »</li><li><b>2</b>Tu regardes ce qui part</li><li><b>3</b>La vidéo coupée entre dans La Fabrique</li></ol></div>',
  '<button class="btn quiet" data-close>Annuler</button>');
  const drop = L.querySelector("#cut-drop"), input = L.querySelector("#cut-file");
  input.addEventListener("change", () => input.files[0] && load(input.files[0]));
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) load(f); });
}

function wait(text, pct) {
  if (!st) return;
  const L = document.getElementById("layer");
  let w = L.querySelector(".cut-wait");
  if (!w) {
    layer('<div class="cut-wait" role="status"><b id="cut-wt"></b><div class="cut-bar"><i id="cut-wp"></i></div><p class="cut-note">Tout se calcule sur ton ordinateur.</p></div>', "");
    w = L.querySelector(".cut-wait");
  }
  L.querySelector("#cut-wt").textContent = text;
  L.querySelector("#cut-wp").style.width = Math.round((pct || 0) * 100) + "%";
}

// 2. Lire la vidéo et son son, chercher les blancs et les « euh »
async function load(file) {
  st.file = file; st.busy = true;
  wait("Lecture de " + file.name + "…", 0.05);
  await tick();
  try {
    st.v = await probe(file);
    if (!st.v) return pick("Cette vidéo n'est pas lisible ici. Seuls les fichiers MP4 et MOV sont pris en charge pour l'instant.");
    const why = await canExport(st.v);
    if (why === "webcodecs") return pick("Ce navigateur ne sait pas créer de vidéo. Utilise Chrome ou Edge à jour sur ordinateur.");
    if (why) return pick("Ce navigateur ne sait pas lire ou écrire ce type de vidéo (" + st.v.codec + "). Essaie avec Chrome ou Edge à jour.");
    wait("Lecture du son…", 0.25);
    await tick();
    const buf = await new OfflineAudioContext(2, 1, AUDIO_RATE).decodeAudioData(await file.arrayBuffer());
    st.ch = Array.from({ length: Math.min(2, buf.numberOfChannels) }, (_, i) => buf.getChannelData(i));
    wait("Recherche des blancs et des « euh »…", 0.6);
    await tick();
    st.a = analyse(st.ch, AUDIO_RATE, { preset: st.preset });
    st.url = URL.createObjectURL(file);
    await sweep();
    if (!st) return;
    st.busy = false;
    review();
  } catch (e) {
    console.error(e);
    st.busy = false;
    pick("Lecture impossible : " + (e.message || e) + ". La vidéo a-t-elle du son ?");
  }
}

function pieces() { return plan(st.a, { blanks: st.blanks, ums: st.ums }); }

// 3. Voir ce qui part, régler, créer
function review() {
  const L = layer(
    '<div class="cut-grid"><div><video class="cut-vid" id="cut-v" src="' + st.url + '" playsinline controls preload="metadata"></video>' +
    '<p class="cut-note">L\'aperçu saute déjà les passages coupés.</p></div>' +
    '<div class="cut-opts"><div class="cut-opt"><span><b>Je veux</b></span><div class="seg" role="group" aria-label="Résultat">' + [["full", "La vidéo entière"], ["shorts", "3 shorts"]].map(([k, l]) => '<button data-cutm="' + k + '" aria-pressed="' + (st.mode === k) + '">' + l + "</button>").join("") + "</div></div>" +
    '<div class="cut-nums" id="cut-nums"></div>' +
    '<div class="cut-tl" id="cut-tl" role="img" aria-label="Onde du son : en couleur ce qui est gardé"><div id="cut-tlw"></div><div class="ph" id="cut-ph" style="left:0"></div></div>' +
    '<div class="cut-leg"><span><i style="background:var(--n-fabrique)"></i>Gardé</span><span><i style="background:var(--line2)"></i>Blanc coupé</span><span><i style="background:var(--gold)"></i>« euh » coupé</span></div>' +
    '<div class="cut-opt"><label><input type="checkbox" id="cut-b"' + (st.blanks ? " checked" : "") + ">Couper les blancs</label>" +
    '<div class="seg" role="group" aria-label="Coupe des blancs">' + [["douce", "Douce"], ["normale", "Normale"], ["serree", "Serrée"]].map(([k, l]) => '<button data-cutp="' + k + '" aria-pressed="' + (st.preset === k) + '">' + l + "</button>").join("") + "</div></div>" +
    '<div class="cut-opt"><label><input type="checkbox" id="cut-u"' + (st.ums ? " checked" : "") + ">Couper les « euh »</label></div>" +
    '<div class="cut-opt"><span><b>Format</b></span><div class="seg" role="group" aria-label="Format">' + [["0", "D'origine"], ["1", "Vertical 9:16"]].map(([k, l]) => '<button data-cutf="' + k + '" aria-pressed="' + (String(+st.vertical) === k) + '">' + l + "</button>").join("") + "</div></div>" +
    '<div class="cut-opt" id="cut-fw"' + (st.vertical ? "" : " hidden") + '><label><input type="checkbox" id="cut-f"' + (st.follow ? " checked" : "") + ">Le cadre suit la personne</label></div>" +
    '<div class="cut-opt"><label><input type="checkbox" id="cut-s"' + (st.subs ? " checked" : "") + ">Sous-titres incrustés</label>" + (st.cues ? '<span class="cut-note">' + st.cues.length + " phrases reconnues</span>" : "") + "</div>" +
    '<p class="cut-note">Douce garde les respirations, Serrée enchaîne les phrases. En vertical, le cadre suit la personne qui parle (modèle d\'environ 10 Mo la première fois), sinon il garde le centre. Les sous-titres viennent d\'une reconnaissance de la parole faite dans ton navigateur (environ ' + MODEL_MB.precise + " Mo à télécharger la première fois).</p>" +
    '<div id="cut-mom"></div></div></div>',
    '<button class="btn" data-cutagain>Autre vidéo</button><span style="flex:1"></span><button class="btn primary" data-cutgo>' + icon("film") + "Créer la vidéo coupée</button>");
  const vid = L.querySelector("#cut-v");
  vid.addEventListener("timeupdate", () => skip(vid));
  const ph = L.querySelector("#cut-ph"), dur = st.a.total / st.a.sr;
  const move = () => { if (!st || !ph.isConnected) return; ph.style.left = (vid.currentTime / dur) * 100 + "%"; if (!vid.paused) requestAnimationFrame(move); };
  vid.addEventListener("play", move); vid.addEventListener("seeked", move);
  vid.addEventListener("seeked", () => skip(vid));
  L.querySelector("#cut-tl").addEventListener("click", (e) => { const r = e.currentTarget.getBoundingClientRect(); vid.currentTime = ((e.clientX - r.left) / r.width) * (st.a.total / st.a.sr); });
  L.querySelector("#cut-b").addEventListener("change", (e) => { st.blanks = e.target.checked; draw(); });
  L.querySelector("#cut-u").addEventListener("change", (e) => { st.ums = e.target.checked; draw(); });
  L.querySelectorAll("[data-cutp]").forEach((b) => b.addEventListener("click", () => {
    st.preset = b.dataset.cutp; st.a = analyse(st.ch, AUDIO_RATE, { preset: st.preset, threshold: st.a.threshold });
    L.querySelectorAll("[data-cutp]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); draw();
  }));
  L.querySelectorAll("[data-cutf]").forEach((b) => b.addEventListener("click", () => {
    st.vertical = b.dataset.cutf === "1"; L.querySelectorAll("[data-cutf]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    L.querySelector("#cut-fw").hidden = !st.vertical;
  }));
  L.querySelector("#cut-f").addEventListener("change", (e) => { st.follow = e.target.checked; });
  L.querySelector("[data-cutagain]").addEventListener("click", () => { if (st.url) URL.revokeObjectURL(st.url); st.url = ""; pick(); });
  L.querySelector("[data-cutgo]").addEventListener("click", make);
  L.querySelector("#cut-s").addEventListener("change", (e) => { st.subs = e.target.checked; });
  L.querySelectorAll("[data-cutm]").forEach((b) => b.addEventListener("click", () => {
    st.mode = b.dataset.cutm;
    if (st.mode === "shorts" && !st.vertical) { st.vertical = true; L.querySelector("#cut-fw").hidden = false; L.querySelectorAll("[data-cutf]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.cutf === "1"))); }
    L.querySelectorAll("[data-cutm]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); draw();
  }));
  L.querySelector("#cut-mom").addEventListener("click", async (e) => {
    const see = e.target.closest("[data-see]"), box = e.target.closest("[data-mom]");
    if (see) { const m = st.moments[+see.dataset.see]; st.stopAt = m.end; vid.currentTime = m.start; vid.play().catch(() => {}); }
    if (box) { const k = +box.dataset.mom; if (box.checked) st.off.delete(k); else st.off.add(k); draw(true); }
    if (e.target.closest("[data-cutlisten]")) { await listen(); if (st) review(); }
  });
  vid.addEventListener("timeupdate", () => { if (st && st.stopAt && vid.currentTime >= st.stopAt) { vid.pause(); st.stopAt = 0; } });
  draw();
}

function skip(vid) {
  if (vid.paused && !vid.seeking) return;
  const t = vid.currentTime, ps = pieces();
  if (ps.some((p) => t >= p.start && t < p.end - 0.02)) return;
  const next = ps.find((p) => p.start > t);
  if (next) { if (!vid.seeking) flash(t, next.start); vid.currentTime = next.start; } else if (!vid.paused) vid.pause();
}

// Passage d'une coupe dans l'aperçu : éclair sur l'onde et temps gagné qui monte
function flash(a, b) {
  const L = document.getElementById("layer"), w = L && L.querySelector("#cut-tl");
  if (!w || b - a < 0.05) return;
  const dur = st.a.total / st.a.sr, euh = st.ums && st.a.hesitations.some(([x, y]) => x / st.a.sr < b && y / st.a.sr > a);
  const left = (a / dur) * 100, width = ((b - a) / dur) * 100;
  w.insertAdjacentHTML("beforeend", '<div class="cut-flash' + (euh ? " euh" : "") + '" style="left:' + left + "%;width:" + Math.max(width, 0.6) + '%"></div><div class="cut-gain' + (euh ? " euh" : "") + '" style="left:' + (left + width / 2) + '%">' + (euh ? "« euh » " : "") + "−" + (b - a).toFixed(1).replace(".", ",") + " s</div>");
  setTimeout(() => w.querySelectorAll(".cut-flash,.cut-gain").forEach((e, q, all) => q < all.length - 2 && e.remove()), 1200);
  const v = L.querySelector("#cut-v"); if (v) { v.classList.remove("jump"); void v.offsetWidth; v.classList.add("jump"); }
}

// --- Onde du son -------------------------------------------------------------------------

const peaksCache = new WeakMap();
function peaks(n) {
  const c = st.ch[0];
  let m = peaksCache.get(c);
  if (m && m[n]) return m[n];
  const out = new Float32Array(n), step = c.length / n;
  let top = 1e-6;
  for (let i = 0; i < n; i++) {
    let p = 0;
    const a = Math.floor(i * step), b = Math.min(c.length, Math.floor((i + 1) * step));
    for (let k = a; k < b; k += 16) { const v = Math.abs(c[k]); if (v > p) p = v; }
    out[i] = p; if (p > top) top = p;
  }
  for (let i = 0; i < n; i++) out[i] = Math.sqrt(out[i] / top);
  if (!m) { m = {}; peaksCache.set(c, m); }
  return (m[n] = out);
}

// Coupes : trous entre les passages gardés, « euh » ou blanc. En secondes.
function cuts() {
  const dur = st.a.total / st.a.sr, out = [];
  let at = 0;
  for (const p of pieces()) { if (p.start - at > 0.02) out.push({ a: at, b: p.start }); at = p.end; }
  if (dur - at > 0.02) out.push({ a: at, b: dur });
  const H = st.a.hesitations.map(([x, y]) => [x / st.a.sr, y / st.a.sr]);
  out.forEach((c) => (c.euh = st.ums && H.some(([x, y]) => x < c.b && y > c.a) && c.b - c.a < 1.5));
  return out;
}

function waveSVG({ pending = false, n = 220 } = {}) {
  const dur = st.a.total / st.a.sr, P = peaks(n), cs = pending ? [] : cuts();
  const at = (t) => cs.find((c) => t >= c.a && t < c.b);
  let o = '<svg viewBox="0 0 ' + n + ' 72" preserveAspectRatio="none" aria-hidden="true">';
  if (!pending && st.mode === "shorts") st.moments.forEach((m, i) => { if (!st.off.has(i)) o += '<rect x="' + ((m.start / dur) * n).toFixed(2) + '" y="1" width="' + (((m.end - m.start) / dur) * n).toFixed(2) + '" height="70" rx="2" fill="var(--n-fabrique)" opacity=".12"/>'; });
  for (const c of cs) o += '<rect x="' + ((c.a / dur) * n).toFixed(2) + '" y="0" width="' + (((c.b - c.a) / dur) * n).toFixed(2) + '" height="72" fill="' + (c.euh ? "var(--gold)" : "var(--line2)") + '" opacity=".16"/>';
  for (let i = 0; i < n; i++) {
    const c = at(((i + 0.5) / n) * dur), h = Math.max(2, P[i] * 64);
    o += '<rect x="' + (i + 0.18) + '" y="' + ((72 - h) / 2).toFixed(1) + '" width=".64" height="' + h.toFixed(1) + '" rx=".3" fill="' + (pending || !c ? "var(--n-fabrique)" : c.euh ? "var(--gold)" : "var(--line2)") + '"/>';
  }
  return o + "</svg>";
}

const bump = (el) => { if (!el) return; el.classList.remove("cut-bump"); void el.offsetWidth; el.classList.add("cut-bump"); };
const still = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Balayage animé : la ligne parcourt l'onde, les coupes apparaissent quand elle les dépasse
function sweep() {
  const dur = st.a.total / st.a.sr, cs = cuts();
  const L = layer('<div class="cut-proc" role="status" aria-live="polite"><div class="cut-nums">' +
    '<div><b id="cp-p">0 %</b><span>progression</span></div><div><b id="cp-s">' + st.a.threshold + ' dB</b><span>seuil du silence</span></div>' +
    '<div><b id="cp-c">0</b><span>coupes trouvées</span></div><div><b id="cp-e">0</b><span>« euh »</span></div></div>' +
    '<div class="cut-stepsl" id="cp-st"><span class="done">Lecture</span><span>Silences</span><span>Hésitations</span><span>Montage</span></div>' +
    '<div><div class="cut-pills" id="cp-pl">' + cs.map((c) => '<span class="wait' + (c.euh ? " euh" : "") + '" data-a="' + c.a + '" style="left:' + (c.a / dur) * 100 + "%;width:" + ((c.b - c.a) / dur) * 100 + '%"></span>').join("") + "</div>" +
    '<div class="cut-scanw">' + waveSVG() + '<div class="cut-pend" id="cp-pd" style="left:0"></div><div class="cut-scan" id="cp-sc" style="left:0"></div></div></div>' +
    '<p class="cut-note" data-noi18n>' + esc(st.file.name) + " · " + mmss(dur) + "</p></div>", "");
  bump(L.querySelector("#cp-s"));
  if (still()) return Promise.resolve();
  const ms = Math.min(1800, 800 + dur * 6), t0 = performance.now();
  const steps = [...L.querySelector("#cp-st").children], pills = [...L.querySelectorAll("#cp-pl span")];
  let nc = 0, ne = 0;
  return new Promise((resolve) => {
    const frame = (now) => {
      if (!st || !document.getElementById("cp-sc")) return resolve();
      const p = Math.min(1, (now - t0) / ms);
      L.querySelector("#cp-p").textContent = Math.round(p * 100) + " %";
      L.querySelector("#cp-pd").style.left = L.querySelector("#cp-sc").style.left = p * 100 + "%";
      if (p >= 1) L.querySelector("#cp-sc").style.opacity = 0;
      const k = Math.min(steps.length - 1, 1 + Math.floor(p * (steps.length - 1)));
      steps.forEach((x, q) => (x.className = q < k || p >= 1 ? "done" : q === k ? "on" : ""));
      pills.forEach((x) => {
        if (x.classList.contains("wait") && +x.dataset.a <= p * dur) {
          x.classList.replace("wait", "show");
          nc++; L.querySelector("#cp-c").textContent = nc; bump(L.querySelector("#cp-c"));
          if (x.classList.contains("euh")) { ne++; L.querySelector("#cp-e").textContent = ne; bump(L.querySelector("#cp-e")); }
        }
      });
      if (p < 1) requestAnimationFrame(frame); else setTimeout(resolve, 450);
    };
    requestAnimationFrame(frame);
  });
}

function stats() {
  const dur = st.a.total / st.a.sr, ps = pieces();
  const kept = ps.reduce((n, p) => n + p.end - p.start, 0);
  const blanks = st.blanks ? Math.max(0, st.a.segments.length - 1) + (st.a.segments[0] && st.a.segments[0].start > 0 ? 1 : 0) : 0;
  return { dur, kept, ps, blanks, ums: st.ums ? st.a.hesitations.length : 0 };
}

function draw(keepPicks = false) {
  const L = document.getElementById("layer"), s = stats();
  L.querySelector("#cut-nums").innerHTML =
    "<div><b>" + mmss(s.dur) + " → " + mmss(s.kept) + "</b><span>" + (s.dur - s.kept >= 1 ? human(s.dur - s.kept) + " en moins" : "Rien de coupé") + "</span></div>" +
    "<div><b>" + s.blanks + "</b><span>blanc" + (s.blanks > 1 ? "s" : "") + " coupé" + (s.blanks > 1 ? "s" : "") + "</span></div>" +
    "<div><b>" + s.ums + "</b><span>« euh » coupé" + (s.ums > 1 ? "s" : "") + "</span></div>";
  L.querySelector("#cut-tlw").innerHTML = waveSVG();
  const go = L.querySelector("[data-cutgo]"), mom = L.querySelector("#cut-mom");
  if (st.mode === "shorts") {
    if (!keepPicks) { st.moments = moments(); st.off = new Set(); }
    const n = st.moments.filter((_, i) => !st.off.has(i)).length;
    mom.innerHTML = '<h3 class="cut-h">Les meilleurs passages</h3>' + (st.moments.length ? '<ol class="cut-moms">' + st.moments.map((m, i) =>
      '<li><label><input type="checkbox" data-mom="' + i + '"' + (st.off.has(i) ? "" : " checked") + "><b>Short " + (i + 1) + "</b></label>" +
      '<span class="mono">' + mmss(m.start) + " → " + mmss(m.end) + " · " + Math.round(m.duration) + " s</span>" +
      (m.reasons.length ? '<span class="cut-why">' + m.reasons.map((r) => esc(MOMENT_REASONS[r] || r)).join(" · ") + "</span>" : "") +
      (m.hook ? '<q data-noi18n>' + esc(m.hook) + "</q>" : "") +
      '<button class="btn quiet" data-see="' + i + '">' + icon("eye") + "Voir</button></li>").join("") + "</ol>" : '<p class="cut-note">Vidéo trop courte pour en tirer des shorts.</p>') +
      (st.cues ? "" : '<p class="cut-note">Choisis d\'après le son de la voix. <button class="lk" data-cutlisten>Affiner avec les paroles</button> pour tenir compte de ce qui est dit (questions, rires) et proposer une accroche.</p>');
    go.innerHTML = icon("film") + "Créer " + n + " short" + (n > 1 ? "s" : "");
    go.disabled = !n;
  } else {
    mom.innerHTML = "";
    go.innerHTML = icon("film") + "Créer la vidéo coupée";
    go.disabled = !s.ps.length;
  }
}

// Les 3 meilleurs passages d'environ 30 s, pris dans ce qui est gardé
function moments() {
  return bestMoments({ passages: pieces().map((p) => [p.start, p.end]), levels: st.a.env.levels, hop: st.a.env.hop / st.a.sr, cues: st.cues || [], target: 30, count: 3 });
}

// --- Paroles (sous-titres, accroches) ----------------------------------------------------

// Reconnaissance de la parole sur toute la vidéo, une fois : phrases [{ start, end, text }] en secondes
async function listen() {
  if (st.cues) return true;
  const back = st.busy; st.busy = true;
  layer('<div class="cut-proc" role="status"><b id="cut-wt">Préparation de la reconnaissance de la parole…</b><div class="cut-bar"><i id="cut-wp"></i></div>' +
    '<div class="cut-wsp" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><p class="cut-note">La première fois, le modèle (environ ' + MODEL_MB.precise + " Mo) est téléchargé puis gardé par le navigateur. La voix ne quitte pas ton ordinateur.</p></div>", "");
  try {
    const total = st.ch[0].length, n = Math.ceil((total * SAMPLE_RATE) / AUDIO_RATE);
    const ctx = new OfflineAudioContext(1, n, SAMPLE_RATE);
    const buf = ctx.createBuffer(st.ch.length, total, AUDIO_RATE);
    st.ch.forEach((c, i) => buf.copyToChannel(c, i));
    const node = ctx.createBufferSource(); node.buffer = buf; node.connect(ctx.destination); node.start();
    const audio16 = (await ctx.startRendering()).getChannelData(0).slice();
    const set = (t, f) => { const L = document.getElementById("layer"); if (!st || !L) return; const a = L.querySelector("#cut-wt"), b = L.querySelector("#cut-wp"); if (a) a.textContent = t; if (b) b.style.width = Math.round(f * 100) + "%"; };
    const out = await transcribe(audio16, { language: (window.I18N || {}).lang === "en" ? "en" : "fr", model: "precise", ortUrl: new URL("./ort/", import.meta.url).href }, (stage, part) => {
      if (stage === "download") set("Téléchargement du modèle… " + Math.round((part || 0) * 100) + " %", part || 0);
      else set("Écoute de la voix…", 1);
    });
    const dur = total / AUDIO_RATE;
    st.cues = (out.chunks || []).filter((c) => c.text).map((c, i, all) => ({ start: c.start || 0, end: c.end || (all[i + 1] ? all[i + 1].start : Math.min(dur, (c.start || 0) + 3)), text: c.text }));
    st.busy = back;
    return true;
  } catch (e) {
    console.error(e);
    st.busy = back;
    U.toast("Reconnaissance de la parole impossible : " + (e.message || e));
    return false;
  }
}

// Phrases de la vidéo d'origine → temps de la vidéo coupée (les mots d'une phrase coupée sont répartis)
function onTimeline(cues, ps) {
  const out = [];
  let off = 0;
  for (const p of ps) {
    for (const c of cues) {
      const a = Math.max(c.start, p.start), b = Math.min(c.end, p.end);
      if (b - a < 0.05) continue;
      const words = c.text.split(/\s+/).filter(Boolean), len = Math.max(0.01, c.end - c.start);
      const w0 = Math.floor(((a - c.start) / len) * words.length), w1 = Math.ceil(((b - c.start) / len) * words.length);
      const text = words.slice(w0, Math.max(w0 + 1, w1)).join(" ");
      if (text) out.push({ start: off + a - p.start, end: off + b - p.start, text });
    }
    off += p.end - p.start;
  }
  return out;
}
const textOf = (ps) => (st.cues || []).filter((c) => ps.some((p) => c.end > p.start && c.start < p.end)).map((c) => c.text).join(" ").trim();

// Son d'un passage : stéréo 48 kHz, avec un fondu de 3 ms à chaque coupe pour éviter les clics
function audioFor(p) {
  const a = Math.max(0, Math.round(p.first * AUDIO_RATE)), n = Math.max(1, Math.round(p.duration * AUDIO_RATE));
  const fade = Math.min(Math.round(0.003 * AUDIO_RATE), Math.floor(n / 2));
  return st.ch.map((c) => {
    const out = new Float32Array(n);
    out.set(c.subarray(a, Math.min(c.length, a + n)));
    for (let i = 0; i < fade; i++) { const g = i / fade; out[i] *= g; out[n - 1 - i] *= g; }
    return out;
  });
}

// 4. Créer la vidéo coupée, ou les shorts
async function make() {
  const s = stats(), base = st.file.name.replace(/\.[^.]+$/, "");
  st.busy = true;
  if (st.subs && !(await listen())) st.subs = false;
  const jobs = st.mode === "shorts"
    ? st.moments.map((m, i) => ({ m, i })).filter((x) => !st.off.has(x.i)).map(({ m, i }) => ({ ps: m.pieces.map(([a, b]) => ({ start: a, end: b })), name: base + "_short" + (i + 1) + ".mp4", hook: m.hook, label: "Short " + (i + 1) }))
    : [{ ps: s.ps, name: base + (st.vertical ? "_vertical" : "") + "_coupe.mp4", hook: "", label: "Vidéo" }];
  const crop = st.vertical ? await frame(jobs.flatMap((j) => j.ps)) : null;
  st.outs.forEach((o) => URL.revokeObjectURL(o.url)); st.outs = [];
  layer('<div class="cut-proc" role="status"><b id="cut-wt">Création… 0 %</b><div class="cut-scanw">' + waveSVG() + '<div class="cut-pend" id="cp-pd" style="left:0"></div><div class="cut-scan" id="cp-sc" style="left:0"></div></div>' +
    '<div class="cut-bar"><i id="cut-wp"></i></div><p class="cut-note">Tout se calcule sur ton ordinateur. Garde cet onglet ouvert.</p></div>', "");
  try {
    for (let j = 0; j < jobs.length; j++) {
      const job = jobs[j];
      const caps = st.subs && st.cues ? captionGroups(onTimeline(st.cues, job.ps), { maxChars: st.vertical ? 14 : 22 }) : null;
      const blob = await renderVideo(st.file, st.v, job.ps, audioFor, (f) => progress(f, job.ps, (jobs.length > 1 ? job.label + " · " : "") + "Création… " + Math.round(((j + f) / jobs.length) * 100) + " %", (j + f) / jobs.length), { crop, captions: caps });
      if (!blob) continue;
      const file = new File([blob], job.name, { type: "video/mp4" });
      const len = job.ps.reduce((n, p) => n + p.end - p.start, 0), text = textOf(job.ps);
      const note = (st.mode === "shorts" ? job.label + " (meilleur passage, " + human(len) + ")" : "Découpe auto : " + human(s.dur) + " → " + human(s.kept) + " (" + s.blanks + " blancs, " + s.ums + " « euh » coupés)") +
        (st.vertical ? ", vertical 9:16" : "") + (caps ? ", sous-titres incrustés" : "") + "." + (job.hook ? "\nAccroche proposée : " + job.hook : "") + (text ? "\n\nTranscription :\n" + text : "");
      st.outs.push({ file, url: URL.createObjectURL(file), note, subs: !!caps, label: job.label, srt: st.cues ? srt(onTimeline(st.cues, job.ps)) : "" });
    }
    st.busy = false;
    if (!st.outs.length) throw new Error("aucune image gardée");
    done();
  } catch (e) {
    console.error(e);
    st.busy = false;
    pick("La création de la vidéo a échoué : " + (e.message || e) + ".");
  }
}

// Cadre vertical : fixe au centre, ou qui suit la personne (repérée dans les passages gardés)
async function frame(ps) {
  const fixed = cropRect(st.v, 9 / 16, 0.5);
  const turned = st.v.rotation % 180 !== 0;
  const [dw, dh] = turned ? [st.v.height, st.v.width] : [st.v.width, st.v.height];
  if (!st.follow || dw / dh <= 9 / 16 + 0.01) return fixed;
  const times = sampleTimes(ps), key = times.join(",");
  if (st.pathKey !== key) {
    layer('<div class="cut-proc" role="status"><b id="cut-wt">Recherche de la personne…</b><div class="cut-bar"><i id="cut-wp"></i></div>' +
      '<p class="cut-note">La première fois, le modèle (environ 10 Mo) est téléchargé puis gardé par le navigateur. L\'image ne quitte pas ton ordinateur.</p></div>', "");
    const set = (t, f) => { const L = document.getElementById("layer"); if (!st || !L) return; const a = L.querySelector("#cut-wt"), b = L.querySelector("#cut-wp"); if (a) a.textContent = t; if (b) b.style.width = Math.round(f * 100) + "%"; };
    try {
      st.path = await trackPerson(st.url, times, { ortUrl: new URL("./ort/", import.meta.url).href }, (stage, f) =>
        set(stage === "model" ? "Téléchargement du modèle… " + Math.round(f * 100) + " %" : "Recherche de la personne… " + Math.round(f * 100) + " %", f));
      st.pathKey = key;
      if (!st.path) U.toast("Personne n'a été repérée : le cadre reste au centre.");
    } catch (e) {
      console.error(e);
      U.toast("Suivi de la personne impossible, le cadre reste au centre : " + (e.message || e));
      st.path = null; st.pathKey = "";
    }
  }
  if (!st.path) return fixed;
  const frac = (dh * 9) / 16 / dw, path = st.path;
  return (t) => cropRect(st.v, 9 / 16, posFor(xAt(path, t), frac));
}

// Avancement de l'export : la ligne avance sur l'onde au fil des images écrites
function progress(f, ps, text, all) {
  const L = document.getElementById("layer"); if (!st || !L) return;
  const t = L.querySelector("#cut-wt"); if (t) t.textContent = text;
  const b = L.querySelector("#cut-wp"); if (b) b.style.width = all * 100 + "%";
  // Position dans la vidéo d'origine : on suit les passages gardés
  const total = ps.reduce((n, p) => n + p.end - p.start, 0), dur = st.a.total / st.a.sr;
  let left = f * total, x = 0;
  for (const p of ps) { const d = p.end - p.start; if (left <= d) { x = p.start + left; break; } left -= d; x = p.end; }
  const sc = L.querySelector("#cp-sc"), pd = L.querySelector("#cp-pd");
  if (sc) sc.style.left = pd.style.left = (x / dur) * 100 + "%";
}

// 5. Importer dans PlanneRs
function done() {
  const n = st.outs.length;
  const L = layer('<div class="cut-outs' + (n > 1 ? " many" : "") + '">' + st.outs.map((o, i) => '<div class="cut-out"><video class="cut-vid" src="' + o.url + '" playsinline controls preload="metadata"></video>' +
    '<div><b data-noi18n>' + esc(o.file.name) + '</b><p class="cut-note" data-noi18n>' + esc(o.note.split("\n")[0]) + "</p>" +
    '<p class="cut-dl"><a class="lk" href="' + o.url + '" download="' + esc(o.file.name) + '">Télécharger la vidéo</a>' + (o.srt ? ' · <button class="lk" data-srt="' + i + '">Sous-titres .srt</button>' : "") + "</p></div></div>").join("") + "</div>" +
    '<p class="cut-note">« Importer dans PlanneRs » crée ' + (n > 1 ? n + " Reels" : "un Reel") + " dans La Fabrique, à relire puis à programmer." + (st.cues ? " La transcription est jointe : une IA peut en tirer la légende." : " La légende reste à écrire.") + "</p>",
  '<button class="btn" data-cutback>Revenir aux réglages</button><span style="flex:1"></span><button class="btn primary" data-cutin>' + icon("plus") + "Importer " + (n > 1 ? n + " vidéos " : "") + "dans PlanneRs</button>");
  L.querySelector("[data-cutback]").addEventListener("click", review);
  L.querySelectorAll("[data-srt]").forEach((b) => b.addEventListener("click", () => {
    const o = st.outs[+b.dataset.srt], url = URL.createObjectURL(new Blob([o.srt], { type: "text/plain" }));
    const a = document.createElement("a"); a.href = url; a.download = o.file.name.replace(/\.mp4$/, ".srt"); a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }));
  L.querySelector("[data-cutin]").addEventListener("click", async () => {
    const outs = st.outs.slice();
    st.outs = [];
    A.beforeClose = null; A.closeLayer(); cleanup();
    const by = "Découpe auto";
    await A.receiveStudio({ files: outs.map((o) => o.file), items: outs.map((o) => ({ note: o.note })),
      steps: { script: { state: "done", by: "Tournage" }, voice: { state: "done", by: "Tournage" }, edit: { state: "done", by }, subs: outs.every((o) => o.subs) ? { state: "done", by } : { state: "todo" }, check: { state: "todo" } } });
    outs.forEach((o) => setTimeout(() => URL.revokeObjectURL(o.url), 60000));
  });
}
