/* PlanneRs : logique partagée entre l'interface et le serveur (aucune dépendance au DOM). */
(function (root) {
  "use strict";

  // Statuts affichés : chacun a un mot, une icône et une couleur réservée.
  const STATUS = {
    published: { label: "Publié", icon: "check" },
    scheduled: { label: "Planifié", icon: "clock" },
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
    (settings && settings.customChecks || []).forEach((c) => {
      if (c.contains && !(p.caption || "").includes(c.contains)) out.push({ level: "warn", text: c.label });
    });
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

  function nowStamp(d) { d = d || new Date(); return ymd(d) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()); }

  const api = { STATUS, FORMATS, STAGES, pad, ymd, parseYmd, addDays, mondayOf, toMin, at, longDate, shortDay, MONTHS, DAYS, setLang,
    displayStatus, missed, willSend, hashtags, checks, slotOf, nowStamp, capFor, TEXT_MAX, utm, textOut };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Core = api;
})(typeof self !== "undefined" ? self : this);
