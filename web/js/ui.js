/* PlanneRs : petits outils d'interface (icônes, logos, cartes de post, toasts). */
(function () {
  "use strict";
  const C = window.Core;

  const ICONS = {
    today: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><circle cx="12" cy="15" r="2"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M8 13h2M14 13h2M8 17h2"/>',
    contents: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z"/>',
    send: '<path d="M22 3 9.2 10.1M22 3l-6.8 18-3.9-8.4L3 8.6z"/>',
    bookmark: '<path d="M19 21l-7-5-7 5V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1z"/>',
    dot: '<circle cx="12" cy="12" r="4"/>',
    more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    check: '<path d="m5 12 5 5 9-10"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    hand: '<path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
    alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17v.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>', pen: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/>',
    box: '<path d="M3 7h18v13H3zM3 7l2-4h14l2 4M10 11h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>', open: '<path d="M14 3h7v7M10 14 21 3M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
    moon: '<path d="M20 15A8 8 0 1 1 9 4a7 7 0 0 0 11 11Z"/>', grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    cloud: '<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 10 4 4 0 0 1 18 18H7Z"/>', bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2ZM10 21h4"/>',
    hook: '<path d="M18 16a3 3 0 1 0-3-3H9a3 3 0 1 1-3-3"/>', undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', dup: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V4h12"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>', heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/>', bubble: '<path d="M4 5h16v11H9l-5 4V5Z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>', swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z"/>', image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>', folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M17 8h4M3 16h4M17 16h4"/>',
  };
  const icon = (name, cls) => '<svg class="i ' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Adresse sûre pour href/src : http(s), blob ou chemin du site ; sinon « # » (jamais javascript:).
  const safeUrl = (u) => esc(/^(https?:|blob:)/i.test(String(u || "")) || /^\/(?!\/)/.test(String(u || "")) ? u : "#");

  const DARK_BRANDS = { x: 1, threads: 1, tiktok: 1, buffer: 1, ghpages: 1 };
  function brand(id, size) {
    const b = window.BRANDS[id];
    const cls = "brand b-" + id + (size ? " " + size : "") + (DARK_BRANDS[id] ? " dark" : "");
    if (!b) return '<span class="' + cls + '" style="background:var(--ink3)">' + icon(id === "webhook" ? "hook" : "cloud") + "</span>";
    const bg = id === "instagram" ? "" : ' style="background:' + b.color + '"';
    return '<span class="' + cls + '"' + bg + ' title="' + esc(b.title) + '"><svg viewBox="0 0 24 24" role="img" aria-label="' + esc(b.title) + '"><path d="' + b.path + '"/></svg></span>';
  }
  const brands = (nets, size) => '<span class="brands">' + (nets || []).map((n) => brand(n, size)).join("") + "</span>";

  function status(key) {
    const s = C.STATUS[key];
    return '<span class="st st-' + key + '">' + icon(s.icon) + s.label + "</span>";
  }

  // Étape (une des 5), alerte éventuelle (échec, retard) et petite main « à poster à la main ».
  function look(p, now) {
    const st = C.step(p), al = C.alertOf(p, now || C.nowStamp());
    const set = ((window.Store || {}).state || {}).settings;
    const hand = st !== "published" && C.manualNets(p, set).length > 0;
    return { st, al, hand, cls: "is-" + st + (al ? " is-" + al : "") + (hand ? " has-hand" : "") };
  }
  function lateBy(p, now) {
    const a = C.at(p); if (!a) return "";
    const ms = new Date(now.replace(" ", "T")) - new Date(a); if (!(ms > 0)) return "";
    const m = Math.round(ms / 60000);
    return m < 60 ? m + " min" : m < 48 * 60 ? Math.round(m / 60) + " h" : Math.round(m / 1440) + " j";
  }
  // Bandeau rouge d'alerte, posé en haut de la carte.
  function abar(p, now, short) {
    now = now || C.nowStamp();
    const al = C.alertOf(p, now); if (!al) return "";
    const txt = short ? C.STATUS[al].label : al === "failed" ? (p.failure && p.failure.what ? "Échec : " + p.failure.what : "Échec") : "En retard" + (lateBy(p, now) ? " de " + lateBy(p, now) : "");
    return '<span class="abar a-' + al + '">' + icon(al === "failed" ? "x" : "alert") + '<span class="t">' + esc(txt) + "</span></span>";
  }
  // Pastille d'étape (+ main violette si une partie est à poster à la main).
  function badge(p, now) {
    const l = look(p, now);
    return status(l.st) + (l.hand ? '<span class="hand" title="À poster à la main">' + icon("hand") + "</span>" : "");
  }

  // Composant unique « carte de post ». size : "card" (défaut) ou "compact".
  function card(p, opts) {
    opts = opts || {};
    const now = C.nowStamp();
    const L = look(p, now), st = L.st;
    const kids = (opts.kids || []).map((k) => C.FORMATS[k.format] === "Story" && k.role === "teaser" ? "+ teaser " + k.time : "+ " + (C.FORMATS[k.format] || "") + " " + (k.time || "")).join(" · ");
    const thumb = p.thumb ? '<img class="thumb" src="' + safeUrl(p.thumb) + '" alt="" draggable="false">' : "";
    const drag = opts.draggable ? ' data-drag="' + esc(p.id) + '"' : "";
    if (opts.size === "mini") {
      const label = p.title + ", " + C.STATUS[st].label + (L.al ? ", " + C.STATUS[L.al].label : "") + (kids ? " (" + kids + ")" : "");
      // Mode « Détaillé » du calendrier : grande miniature en haut de la carte.
      const cov = !(window.App || {}).calCompact && (window.App || {}).coverOf ? window.App.coverOf(p) : "";
      return '<button class="pc mini ' + L.cls + ((window.App || {}).calCompact ? "" : " big") + '" data-open="' + esc(p.id) + '"' + drag + ' aria-label="' + esc(label) + '">' +
        abar(p, now, true) + (cov ? '<img class="mthumb" src="' + safeUrl(cov) + '" alt="" loading="lazy" draggable="false">' : "") +
        '<span class="row1">' + (cov ? "" : thumb) + brands(p.networks) + (L.hand ? '<span class="hand">' + icon("hand") + "</span>" : "") + '<span class="sti c-' + st + '">' + icon(C.STATUS[st].icon) + "</span></span>" +
        '<span class="ttl"><span class="fmtp">' + esc(C.FORMATS[p.format] || "") + " · </span>" + esc(p.title) + "</span>" + (kids ? '<span class="kids">' + esc(kids) + "</span>" : "") + "</button>";
    }
    if (opts.size === "compact") {
      return '<button class="pc compact ' + L.cls + '" data-open="' + esc(p.id) + '"' + drag + ">" + abar(p, now) + brands(p.networks) +
        '<span class="ttl">' + (p.time ? '<span class="mono">' + p.time + "</span> " : "") + esc(p.title) + "</span>" + badge(p, now) + "</button>";
    }
    return '<button class="pc ' + L.cls + '" data-open="' + esc(p.id) + '"' + drag + ' aria-label="' + esc(p.title + ", " + C.STATUS[st].label + (L.al ? ", " + C.STATUS[L.al].label : "")) + '">' +
      abar(p, now) + '<span class="row1">' + thumb + brands(p.networks) + (p.ref ? '<span class="ref">' + esc(p.ref) + "</span>" : "") + "</span>" +
      '<span class="ttl">' + esc(p.title) + "</span>" +
      (opts.showTime && p.time ? '<span class="sub mono">' + p.time + " · " + (C.FORMATS[p.format] || "") + "</span>" : "") +
      '<span class="bdg">' + badge(p, now) + "</span>" +
      (kids ? '<span class="kids">' + esc(kids) + "</span>" : "") +
      (p.expires && !p.date ? '<span class="sub exp" style="color:var(--main)">Se périme le ' + esc(C.longDate(p.expires)) + "</span>" : "") +
      "</button>";
  }

  let toastBox;
  // action : { label, fn } facultatif (ex. « Annuler »).
  function toast(msg, action) {
    if (!toastBox) { toastBox = document.querySelector(".toasts"); }
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    if (action) { const b = document.createElement("button"); b.className = "tact"; b.textContent = action.label; b.onclick = () => { t.remove(); action.fn(); }; t.appendChild(b); }
    toastBox.appendChild(t);
    setTimeout(() => t.remove(), action ? 6000 : 3200);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast("Texte copié"); }
    catch (e) {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast("Texte copié"); } catch (e2) { toast("Copie impossible : sélectionne le texte à la main"); }
      ta.remove();
    }
  }

  window.UI = { icon, esc, safeUrl, brand, brands, status, card, look, abar, badge, toast, copy, ICONS };
})();
