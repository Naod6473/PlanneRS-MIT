/* PlanneRs : logique partagée entre l'interface et le serveur (aucune dépendance au DOM). */
(function (root) {
  "use strict";

  // Statuts affichés : chacun a un mot, une icône et une couleur réservée.
  const STATUS = {
    published: { label: "Publié", icon: "check" },
    idea: { label: "Idée", icon: "bulb" },
    prep: { label: "En préparation", icon: "pen" },
    scheduled: { label: "Programmé", icon: "clock" },
    review: { label: "À valider", icon: "eye" },
    manual: { label: "À la main", icon: "hand" },
    late: { label: "En retard", icon: "alert" },
    failed: { label: "Échec", icon: "x" },
    draft: { label: "Brouillon", icon: "pen" },
    ready: { label: "Prêt", icon: "box" },
  };

  const FORMATS = {
    reel: "Reel", carousel: "Carrousel", image: "Image", story: "Story",
    text: "Texte", video: "Vidéo", document: "Document",
  };

  const STAGES = [
    ["idea", "Idée"], ["writing", "Écriture"], ["media", "Médias"],
    ["caption", "Légende"], ["ready", "Prêt"], ["scheduled", "Programmé"], ["published", "Publié"],
  ];

  // Les 5 étapes affichées partout (tableau, calendrier, liste, fiche). Échec et retard ne sont pas des étapes : ce sont des alertes.
  const STEPS = [["idea", "Idée"], ["prep", "En préparation"], ["review", "À valider"], ["scheduled", "Programmé"], ["published", "Publié"]];

  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const parseYmd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
  const mondayOf = (s) => { const d = parseYmd(s); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return ymd(d); };
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const at = (p) => (p.date && p.time ? p.date + "T" + p.time : null);

  const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const NAMES = {
    fr: [["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"], ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]],
    en: [["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]],
  };
  // Langue des dates : les tableaux sont modifiés sur place (les vues les lisent directement).
  function setLang(l) { const n = NAMES[l] || NAMES.fr; DAYS.splice(0, 7, ...n[0]); MONTHS.splice(0, 12, ...n[1]); }
  function longDate(s) { const d = parseYmd(s); return DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()]; }
  function shortDay(s) { const d = parseYmd(s); return DAYS[d.getDay()].slice(0, 3) + " " + d.getDate(); }

  // Statut affiché d'un post, à l'instant `now` (chaîne "YYYY-MM-DDTHH:MM").
  function displayStatus(p, now) {
    if (p.status === "published") return "published";
    if (p.status === "failed") return "failed";
    if (p.status === "draft") return "draft";
    if (!p.date) return "ready";
    if (p.manual) return at(p) < now ? "late" : "manual";
    if (missed(p, now)) return "late";
    if (!p.captionValidated) return "review";
    return "scheduled";
  }

  // Étape d'un post (une des 5 de STEPS).
  function step(p) {
    if (p.status === "published") return "published";
    if (p.date && p.status !== "draft" && (p.captionValidated || p.manual)) return "scheduled";
    const s = p.stage || "idea";
    if (s === "idea") return "idea";
    if (s === "writing" || s === "media" || (s === "caption" && !p.date)) return "prep";
    return "review";
  }
  // Alerte à afficher en bandeau, quelle que soit l'étape : "failed", "late" ou null.
  function alertOf(p, now) {
    const d = displayStatus(p, now);
    return d === "failed" || d === "late" ? d : null;
  }

  // Manqué : l'heure prévue est passée depuis plus de 24 h et rien n'est publié (échecs à part, ils ont leur carte).
  function missed(p, now) {
    if (!p.date || !p.time || p.status === "published" || p.status === "failed" || p.status === "draft") return false;
    const lim = new Date(new Date(now || nowStamp()).getTime() - 864e5);
    return at(p) < nowStamp(lim);
  }

  // Le robot n'envoie que ce qui est validé, daté, automatique et non publié.
  function willSend(p) {
    return p.status === "scheduled" && !!p.date && !!p.time && !p.manual && !!p.captionValidated;
  }

  function hashtags(text) { return (String(text || "").match(/#[\p{L}\p{N}_]+/gu) || []).length; }

  // Contrôles avant envoi. level : block (ne partira pas), warn, ok.
  // Légende envoyée sur un réseau : sa version propre si elle existe, sinon la légende commune.
  function capFor(p, net) { const c = p && p.captions && p.captions[net]; return (c && c.trim()) ? c : (p && p.caption) || ""; }
  // Limite de texte connue par réseau (pour l'affichage du compteur).
  const TEXT_MAX = { instagram: 2200, facebook: 63206, x: 280, bluesky: 300, threads: 500, mastodon: 500, linkedin: 3000, pinterest: 500, youtube: 5000, tiktok: 2200 };

  // Liens suivis : paramètres UTM ajoutés aux liens vers tes sites (settings.utm.domains), au moment d'envoyer.
  function slug(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60); }
  function utm(text, net, p, settings) {
    const u = settings && settings.utm, doms = ((u && u.domains) || []).map((d) => String(d).toLowerCase().replace(/^www\./, "")).filter(Boolean);
    if (!u || u.enabled === false || !doms.length || !text) return text || "";
    return String(text).replace(/https?:\/\/[^\s<>"')\]]+/g, (raw) => {
      const tail = (raw.match(/[.,;:!?»]+$/) || [""])[0], link = raw.slice(0, raw.length - tail.length);
      let url; try { url = new URL(link); } catch (e) { return raw; }
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      if (!doms.some((d) => host === d || host.endsWith("." + d)) || [...url.searchParams.keys()].some((k) => /^utm_/.test(k))) return raw;
      url.searchParams.set("utm_source", net); url.searchParams.set("utm_medium", u.medium || "social");
      url.searchParams.set("utm_campaign", slug(p && (p.ref || p.title)) || "planners");
      return url.toString() + tail;
    });
  }
  // Texte réellement envoyé sur un réseau : sa légende, avec les liens suivis.
  function textOut(p, net, settings) { return utm(capFor(p, net), net, p, settings); }

  function checks(p, settings) {
    const out = [];
    const rules = (settings && settings.rules) || {};
    const nets = p.networks || [];
    if (p.manual) out.push({ level: "warn", text: "Publication à la main : l'application te le rappellera, rien ne part tout seul." });
    else if (!p.captionValidated && rules.requireValidation !== false)
      out.push({ level: "block", text: p.format === "story" ? "Story pas encore validée : elle ne partira pas sans validation." : "Légende pas encore validée : ce post ne partira pas sans validation." });
    else out.push({ level: "ok", text: p.format === "story" ? "Story validée (une story n'a pas de légende)." : "Légende validée." });
    if (!p.date && p.status !== "published") out.push({ level: "warn", text: "Pas encore de date : il attend dans « Prêts à programmer »." });
    if (nets.includes("instagram") && !(p.media && p.media.length) && p.format !== "text")
      out.push({ level: "block", text: "Aucun média : Instagram exige une image ou une vidéo." });
    const max = rules.maxHashtags || 0;
    const n = Math.max(hashtags(p.caption), ...nets.map((x) => hashtags(capFor(p, x)))) + hashtags(p.firstComment);
    if (max && n > max) out.push({ level: "block", text: n + " hashtags : la limite fixée est " + max + "." });
    if (capFor(p, "instagram").length > 2200 && nets.includes("instagram"))
      out.push({ level: "block", text: "Légende trop longue pour Instagram (2 200 caractères max)." });
    [["x", "X", 280], ["bluesky", "Bluesky", 300], ["threads", "Threads", 500], ["mastodon", "Mastodon", 500], ["linkedin", "LinkedIn", 3000]].forEach(([id, name, max]) => {
      const len = [...capFor(p, id)].length;
      if (nets.includes(id) && p.format !== "story" && len > max) out.push({ level: "block", text: "Texte trop long pour " + name + " (" + len + " caractères, " + max + " max)." });
    });
    if (p.linkCheck && p.linkCheck.bad && p.linkCheck.bad.length && p.status !== "published")
      out.push({ level: "warn", text: (p.linkCheck.bad.length > 1 ? p.linkCheck.bad.length + " liens ne répondent pas : " : "Un lien ne répond pas : ") + p.linkCheck.bad.map((b) => b.url + (b.status ? " (" + b.status + ")" : "")).join(", ") + "." });
    if (p.expires && p.date && p.date > p.expires)
      out.push({ level: "warn", text: "Contenu d'actualité : il se périme le " + longDate(p.expires) + "." });
    mediaChecks(p).forEach((c) => out.push(c));
    (settings && settings.customChecks || []).forEach((c) => {
      if (c.contains && !(p.caption || "").includes(c.contains)) out.push({ level: "warn", text: c.label });
    });
    return out;
  }

  // Contrôle des médias selon les réseaux cochés. Ne juge que ce qui est connu (durée, taille, dimensions
  // relevées à l'ajout du fichier) : un média sans ces informations n'est pas bloqué.
  const MB = 1024 * 1024;
  const VID = { // durée min/max (s), poids max (Mo)
    instagram: { reel: [3, 900, 1000], story: [1, 60, 100] }, facebook: { reel: [3, 90, 1000] }, tiktok: { any: [3, 600, 4000] },
    youtube: { any: [1, 43200, 256000] }, x: { any: [0.5, 140, 512] }, linkedin: { any: [3, 1800, 5000] }, threads: { any: [0, 300, 1000] }, bluesky: { any: [0, 180, 100] },
  };
  const MNAMES = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube", x: "X", linkedin: "LinkedIn", threads: "Threads", bluesky: "Bluesky", pinterest: "Pinterest", mastodon: "Mastodon" };
  function mediaChecks(p) {
    const out = [], nets = p.networks || [];
    const ms = (p.media || []).filter((m) => m.role !== "guide" && m.role !== "cover");
    const isV = (m) => m.type === "video" || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(m.name || m.url || "");
    const vids = ms.filter(isV), imgs = ms.filter((m) => !isV(m));
    const fmt = (s) => s >= 60 ? Math.floor(s / 60) + " min" + (s % 60 ? " " + Math.round(s % 60) + " s" : "") : Math.round(s * 10) / 10 + " s";
    ["tiktok", "youtube"].forEach((n) => { if (nets.includes(n) && ms.length && !vids.length) out.push({ level: "block", text: MNAMES[n] + " publie des vidéos seulement : ajoute une vidéo, ou retire " + MNAMES[n] + "." }); });
    vids.forEach((m) => nets.forEach((n) => {
      const r = VID[n] && (VID[n][p.format] || VID[n].any); if (!r) return;
      if (m.dur != null && m.dur < r[0]) out.push({ level: "block", text: MNAMES[n] + " : vidéo trop courte (" + fmt(m.dur) + ", minimum " + fmt(r[0]) + ")." });
      if (m.dur != null && m.dur > r[1]) out.push({ level: "block", text: MNAMES[n] + " : vidéo trop longue (" + fmt(m.dur) + ", maximum " + fmt(r[1]) + ")." });
      if (m.size != null && m.size > r[2] * MB) out.push({ level: "block", text: MNAMES[n] + " : fichier trop lourd (" + Math.round(m.size / MB) + " Mo, maximum " + r[2] + " Mo)." });
    }));
    vids.forEach((m) => {
      if (nets.includes("youtube") && m.w && m.h && (m.w > m.h || (m.dur != null && m.dur > 180))) out.push({ level: "warn", text: "YouTube : ce ne sera pas un Short (il faut une vidéo verticale de 3 min au plus) ; elle partira en vidéo classique." });
      if ((p.format === "reel" || p.format === "story") && m.w && m.h && m.w >= m.h && nets.some((n) => ["instagram", "tiktok", "facebook"].includes(n))) out.push({ level: "warn", text: "Vidéo horizontale : en Reel ou en story, elle sera affichée avec des bandes. Le format vertical 9:16 est conseillé." });
    });
    if (nets.includes("instagram") && p.format !== "story") imgs.forEach((m) => {
      if (m.w && m.h) { const r = m.w / m.h; if (r < 0.8 - 0.01 || r > 1.91 + 0.01) out.push({ level: "block", text: "Instagram : image " + m.w + " × " + m.h + " hors format (du 4:5 vertical au 1,91:1 horizontal). Recadre-la." }); }
      if (m.size != null && m.size > 8 * MB) out.push({ level: "block", text: "Instagram : image trop lourde (" + Math.round(m.size / MB) + " Mo, maximum 8 Mo)." });
      if (/\.(png|webp|gif|heic)(\?|$)/i.test(m.name || m.url || "") || /png|webp|gif|heic/.test(m.mime || "")) out.push({ level: "warn", text: "Instagram n'accepte que le JPEG par l'API : « " + (m.name || "image") + " » sera refusée si elle n'est pas convertie." });
    });
    if (nets.includes("instagram") && p.format === "carousel" && ms.length > 20) out.push({ level: "block", text: "Instagram : 20 médias au plus dans un carrousel (" + ms.length + " ici)." });
    if (nets.includes("x") && imgs.length > 4) out.push({ level: "block", text: "X : 4 images au plus (" + imgs.length + " ici)." });
    return out;
  }

  // Créneau type le plus proche (tolérance en minutes), sinon null.
  function slotOf(time, slots, tol) {
    if (!time) return null;
    tol = tol == null ? 10 : tol;
    let best = null, bd = 1e9;
    for (const s of slots) { const d = Math.abs(toMin(s.time) - toMin(time)); if (d <= tol && d < bd) { bd = d; best = s; } }
    return best;
  }

  // ---- Réseaux postés à la main (Réglages › Règles : « À poster à la main », ou post entier « à la main »)
  function manualNets(p, settings) {
    const nets = p.networks || [], mn = ((settings || {}).rules || {}).manualNets || [];
    return p.manual ? nets.slice() : nets.filter((n) => mn.includes(n));
  }
  function autoNets(p, settings) { const m = manualNets(p, settings); return (p.networks || []).filter((n) => !m.includes(n)); }
  function pendingManual(p, settings) { const r = p.results || {}; return manualNets(p, settings).filter((n) => !(r[n] && r[n].status === "ok")); }
  // Lien qui ouvre le réseau avec le texte déjà écrit, quand le réseau le permet (sinon null : texte à coller).
  const PREFILL = {
    x: (t) => "https://x.com/intent/post?text=" + encodeURIComponent(t),
    linkedin: (t) => "https://www.linkedin.com/feed/?shareActive=true&text=" + encodeURIComponent(t),
    threads: (t) => "https://www.threads.net/intent/post?text=" + encodeURIComponent(t),
    bluesky: (t) => "https://bsky.app/intent/compose?text=" + encodeURIComponent(t),
    mastodon: null,
  };
  function prefillUrl(net, text) { const f = PREFILL[net]; return f && text ? f(String(text).slice(0, 3000)) : null; }

  // ---- Recherche, séries, CSV (fonctions pures, testées)
  const fold = (x) => String(x == null ? "" : x).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  // Série d'un post : le champ « series », sinon le début du titre avant « · ép. N » (ex. « L'IA, de zéro à pro · ép. 2/7 : … »).
  function seriesOf(p) {
    if (p.series) return String(p.series).trim();
    const m = /^(.{3,80}?)\s*[·:|-]\s*(?:ép\.?|épisode|ep\.?|episode|partie)\s*\d/i.exec(p.title || "");
    return m ? m[1].trim() : "";
  }
  // Tous les mots de la recherche doivent se trouver dans le titre, le texte, le n°, la série, le premier commentaire ou la note.
  function matchQuery(p, q) {
    const words = fold(q).split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    const hay = fold([p.title, p.caption, p.ref, seriesOf(p), p.firstComment, p.note, Object.values(p.captions || {}).join(" ")].join(" "));
    return words.every((w) => hay.includes(w));
  }
  function parseCsv(txt) {
    txt = String(txt || "").replace(/^\uFEFF/, "");
    const first = txt.split(/\r?\n/)[0] || "", sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ";" : ",";
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && txt[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim()));
  }
  // CSV au point-virgule (Excel en français), une formule n'est jamais exécutée (=, +, -, @ en tête sont protégés).
  function toCsv(rows) {
    return rows.map((r) => r.map((v) => {
      let x = v == null ? "" : String(v);
      if (/^[=+\-@]/.test(x) && !/^-?\d+([.,]\d+)?$/.test(x)) x = "'" + x;
      return /[;"\n\r]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x;
    }).join(";")).join("\r\n") + "\r\n";
  }

  function nowStamp(d) { d = d || new Date(); return ymd(d) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()); }

  const api = { STATUS, FORMATS, STAGES, STEPS, step, alertOf, pad, ymd, parseYmd, addDays, mondayOf, toMin, at, longDate, shortDay, MONTHS, DAYS, setLang,
    displayStatus, missed, willSend, hashtags, checks, mediaChecks, slotOf, nowStamp, fold, seriesOf, matchQuery, parseCsv, toCsv, manualNets, autoNets, pendingManual, prefillUrl, capFor, TEXT_MAX, utm, textOut };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Core = api;
})(typeof self !== "undefined" ? self : this);
