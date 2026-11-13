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
  // Noms des jours et des mois donnés par Intl (toute langue que le navigateur connaît), sinon la liste ci-dessus.
  function intlNames(l) {
    try {
      const f = (o) => new Intl.DateTimeFormat(l, o);
      const d = [0, 1, 2, 3, 4, 5, 6].map((i) => f({ weekday: "long" }).format(new Date(2026, 0, 4 + i))); // 4 janvier 2026 : un dimanche
      const m = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => f({ month: "long" }).format(new Date(2026, i, 15)));
      return d.every((x) => x && !/\d/.test(x)) && m.every((x) => x && !/\d/.test(x)) ? [d, m] : null;
    } catch (e) { return null; }
  }
  function setLang(l) { const n = intlNames(l) || NAMES[l] || NAMES.fr; DAYS.splice(0, 7, ...n[0]); MONTHS.splice(0, 12, ...n[1]); }
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
  // Titre à coller sur un réseau qui en demande un (YouTube : 100 caractères max, #Shorts pour une vidéo verticale).
  function titleFor(p, net) {
    let t = String((p.titles && p.titles[net]) || p.title || "").trim();
    if (net === "youtube") {
      const short = (p.format === "reel" || p.format === "video") && !/#shorts\b/i.test(t);
      const tag = short ? " #Shorts" : "";
      if (t.length + tag.length > 100) t = t.slice(0, 100 - tag.length - 1).trimEnd() + "…";
      t += tag;
    }
    return t;
  }
  // ---- Posts texte : fils, versions par réseau, coupure « voir plus ».
  // Un fil = des messages séparés par une ligne « --- ». Seuls ces réseaux publient un fil ; ailleurs, les messages sont recollés.
  const THREAD_NETS = { x: 1, bluesky: 1, threads: 1, mastodon: 1 };
  const SEP = /\n[ \t]*-{3,}[ \t]*(?:\n|$)/;
  const isThread = (t) => SEP.test("\n" + String(t || "") + "\n") && threadParts(t).length > 1;
  function threadParts(t, number) {
    const parts = String(t || "").split(/\n[ \t]*-{3,}[ \t]*(?:\n|$)/).map((x) => x.trim()).filter(Boolean);
    return number && parts.length > 1 ? parts.map((x, i) => x + " " + (i + 1) + "/" + parts.length) : parts;
  }
  const unthread = (t) => threadParts(t).join("\n\n");
  // Découpe un long texte en messages de max caractères (numéro compris), aux fins de paragraphe, de phrase, sinon de mot.
  function splitThread(t, max) {
    const room = (max || 280) - 6, out = [];
    const chunks = [];
    unthread(t).split(/\n{2,}/).forEach((para) => { (para.match(/[^.!?…]+[.!?…]+["»)]?\s*|[^.!?…]+$/g) || [para]).forEach((x) => chunks.push(x.trim())); chunks.push("\n"); });
    let cur = "";
    const push = () => { if (cur.trim()) out.push(cur.trim()); cur = ""; };
    for (const c of chunks) {
      if (c === "\n") { if ([...cur].length > room * 0.6) push(); else if (cur) cur += "\n\n"; continue; }
      if ([...(cur + (cur && !/\n$/.test(cur) ? " " : "") + c)].length <= room) { cur += (cur && !/\n$/.test(cur) ? " " : "") + c; continue; }
      push();
      if ([...c].length <= room) { cur = c; continue; }
      c.split(/\s+/).forEach((w) => { if ([...(cur + " " + w)].length > room) push(); cur += (cur ? " " : "") + w; });
    }
    push();
    return out.join("\n---\n");
  }
  // Ce qu'on voit avant « … voir plus » (environ) : LinkedIn ~210 caractères, Instagram ~125, Facebook ~480.
  const FOLD = { linkedin: 210, instagram: 125, facebook: 480 };
  function foldOf(t, net) { const n = FOLD[net]; const a = [...String(t || "")]; return n && a.length > n ? { shown: a.slice(0, n).join(""), hidden: a.length - n } : null; }
  // Versions par réseau sans IA : X (court, 2 hashtags au plus) et LinkedIn (accroche, lignes aérées, question, 3 hashtags au plus).
  function tagsOf(t) { return (String(t || "").match(/#[\p{L}\p{N}_]+/gu) || []); }
  function plain(t) { return unthread(t).replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(); }
  function sentences(t) { return (plain(t).replace(/\n+/g, " ").match(/[^.!?…]+[.!?…]+["»)]?|[^.!?…]+$/g) || []).map((x) => x.trim()).filter(Boolean); }
  function versionFor(t, net) {
    const tags = tagsOf(t), ss = sentences(t);
    if (net === "linkedin") {
      const q = /\?\s*$/.test(ss[ss.length - 1] || "") && ss.length > 1 ? ss[ss.length - 1] : null; // la question de fin, si le texte en a une
      const body = ss.filter((x) => x !== q);
      const cta = q || (/comment|partage|dis-(nous|moi)|écris|abonne|suis-nous|\?/i.test(ss.slice(-2).join(" ")) ? "" : "Et vous, qu'en pensez-vous ?");
      return [body[0] || "", "", ...body.slice(1).map((x) => x + "\n"), cta, "", tags.slice(0, 3).join(" ")].join("\n").replace(/\n{3,}/g, "\n\n").trim();
    }
    const max = TEXT_MAX[net] || 280, tg = tags.slice(0, 2).join(" ");
    let out = "";
    for (const x of ss) { const n = (out ? out + " " : "") + x; if ([...(n + (tg ? " " + tg : ""))].length > max) break; out = n; }
    if (!out && ss[0]) out = [...ss[0]].slice(0, max - (tg ? tg.length + 2 : 1) - 1).join("") + "…";
    return (out + (tg ? "\n\n" + tg : "")).trim();
  }
  // Créneaux texte (ex. LinkedIn mardi et jeudi 08:30) : jours 1 = lundi … 7 = dimanche.
  const isTextPost = (p) => p.format === "text" || p.format === "document" || !(p.media || []).some((m) => m.role !== "guide" && m.role !== "cover");
  function textSlotsFor(p, week, textSlots) {
    const out = [];
    (textSlots || []).filter((t) => t.time && (p.networks || []).includes(t.net)).forEach((t) => (t.days || []).forEach((k) => out.push({ date: addDays(week, k - 1), time: t.time.slice(0, 5), net: t.net })));
    return out.sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
  }
  function textOut(p, net, settings) { const t = capFor(p, net); return utm(THREAD_NETS[net] ? t : isThread(t) ? unthread(t) : t, net, p, settings); }

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
      const t = capFor(p, id), len = THREAD_NETS[id] && isThread(t) ? Math.max(...threadParts(t, true).map((x) => [...x].length)) : [...(isThread(t) ? unthread(t) : t)].length;
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
    const isD = (m) => m.type === "document" || /\.pdf(\?|$)/i.test(m.name || m.url || "");
    const vids = ms.filter(isV), docs = ms.filter(isD), imgs = ms.filter((m) => !isV(m) && !isD(m));
    if (docs.length && nets.some((n) => n !== "linkedin")) { out.push({ level: "block", text: "Le PDF (carrousel) ne part que sur LinkedIn : retire les autres réseaux, ou fais-en un post à part." }); }
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

  // ---------------------------------------------------------------- La Fabrique (production des vidéos)
  // Cinq étapes, faites par une personne ou une IA (by). state : todo | doing | done.
  const PROD_STEPS = [["script", "Script"], ["voice", "Voix"], ["edit", "Montage"], ["subs", "Sous-titres"], ["check", "Relu"]];
  const isVideoFmt = (f) => f === "reel" || f === "video";
  const hasVideo = (p) => (p.media || []).some((m) => m.type === "video" || /\.(mp4|mov|webm)(\?|$)/i.test(m.url || m.name || ""));
  // Dans La Fabrique : vidéo pas encore publiée (ou tout post qui a une fiche de production).
  function inFabrique(p) { return !p.parent && p.status !== "published" && (!!p.prod || isVideoFmt(p.format)); }
  // État de production : les étapes enregistrées, sinon déduites (texte écrit, vidéo déposée, légende validée).
  function prodOf(p) {
    const own = (p.prod && p.prod.steps) || {}, vid = hasVideo(p), text = !!(p.caption || p.note || (p.prod && (p.prod.shots || []).length));
    const guess = { script: text, voice: vid, edit: vid, subs: vid, check: !!p.captionValidated && vid };
    const steps = PROD_STEPS.map(([k, label]) => {
      const o = own[k] || {};
      return { key: k, label, state: o.state || (guess[k] ? "done" : "todo"), by: o.by || "", at: o.at || "", note: o.note || "" };
    });
    const done = steps.filter((x) => x.state === "done").length;
    const current = steps.find((x) => x.state === "doing") || steps.find((x) => x.state !== "done") || null;
    const shots = ((p.prod && p.prod.shots) || []).map((x, i) => ({ n: i + 1, dur: +x.dur || 0, screen: x.screen || "", voice: x.voice || "", visual: x.visual || "", music: x.music || "" }));
    const duration = shots.reduce((n, x) => n + x.dur, 0);
    return { steps, done, total: steps.length, current, ready: done === steps.length, shots, duration, tooLong: isVideoFmt(p.format) && duration > ((p.prod && p.prod.maxSec) || 30), video: (p.media || []).find((m) => m.type === "video" || /\.(mp4|mov|webm)(\?|$)/i.test(m.url || m.name || "")) || null };
  }

  // Revue en pile : ce qui attend un « c'est bon » (légende pas validée, ou vidéo de La Fabrique pas relue).
  // Une vidéo renvoyée en retouche n'y revient qu'après un nouveau travail sur une étape.
  function needsFix(p) {
    const r = p.prod && p.prod.review; if (!r || !r.at) return false;
    const steps = (p.prod && p.prod.steps) || {};
    return !Object.keys(steps).some((k) => k !== "check" && steps[k] && steps[k].at && steps[k].at > r.at);
  }
  function reviewPile(posts) {
    return (posts || []).filter((p) => !p.parent && !p.ignored && p.status !== "published" && p.status !== "failed" &&
      (String(p.caption || "").trim() || (p.media || []).some((m) => m.role !== "guide")) &&
      (!p.captionValidated || (inFabrique(p) && !prodOf(p).ready)) && !needsFix(p))
      .sort((a, b) => (at(a) || "9999").localeCompare(at(b) || "9999"));
  }
  // Note sur 10 et points de contrôle d'une carte : ce qui bloque (impossible de valider), ce qui gêne, ce qui va.
  const FIX_HINTS = [[/longue|long|durée/i, "Trop long"], [/courte/i, "Trop court"], [/hashtag|caractères|légende/i, "Légende à revoir"], [/média|vidéo|image|lourd/i, "Image ou vidéo"]];
  function reviewOf(p, settings) {
    const out = [];
    const all = checks(Object.assign({}, p, { captionValidated: true, manual: false }), settings).concat(mediaChecks(p))
      .filter((c) => c.level !== "ok" && !/Pas encore de date/.test(c.text));
    const cap = String(p.caption || "").trim(), text = p.format !== "story";
    if (text && !cap) all.unshift({ level: "block", text: "Légende vide : écris-la avant de valider." });
    const pr = prodOf(p);
    if (pr.tooLong) all.push({ level: "warn", text: "Storyboard plus long que prévu." });
    if (text && cap) out.push({ level: "ok", text: "Légende écrite" });
    const n = hashtags(p.caption);
    if (n) out.push({ level: "ok", text: n + " hashtag" + (n > 1 ? "s" : "") });
    const v = pr.video;
    if (v) out.push({ level: "ok", text: v.dur ? "Vidéo " + Math.round(v.dur) + " s" : "Vidéo" });
    else if ((p.media || []).length) out.push({ level: "ok", text: "Média" });
    const blocks = all.filter((c) => c.level === "block"), warns = all.filter((c) => c.level !== "block");
    const score = Math.max(0, Math.min(10, Math.round(10 - blocks.length * 4 - warns.length * 1.5)));
    const hints = [];
    warns.concat(blocks).forEach((c) => { const h = FIX_HINTS.find(([re]) => re.test(c.text)); if (h && !hints.includes(h[1])) hints.push(h[1]); });
    return { score, blocked: blocks.length > 0, issues: blocks.concat(warns), good: out, hints };
  }

  // Succès : des paliers atteints (vues, abonnés, régularité, publications, réactions), rien à débloquer,
  // juste de quoi fêter et partager. Tout est recalculé à partir des posts et des statistiques relevées.
  const ACH = [
    { g: "views", title: "Vues", unit: "vues sur une publication", one: "vue sur une publication", steps: [100, 500, 1000, 5000, 10000, 100000], color: "#6D28D9" },
    { g: "followers", title: "Abonnés", unit: "abonnés", one: "abonné", steps: [100, 500, 1000, 5000, 10000, 50000], color: "#DB2777" },
    { g: "streak", title: "Régularité", unit: "semaines d'affilée avec une publication", steps: [2, 4, 8, 12, 26, 52], color: "#EA580C" },
    { g: "posts", title: "Publications", unit: "publications", one: "publication", steps: [1, 10, 25, 50, 100, 250, 500], color: "#0E9F6E" },
    { g: "likes", title: "Réactions", unit: "j'aime et commentaires sur une publication", steps: [50, 100, 500, 1000, 5000], color: "#2563EB" },
  ];
  const weekOf = (d) => { const x = parseYmd(d); return addDays(d, -((x.getDay() + 6) % 7)); };
  function achievements(posts, stats, now) {
    const t = String(now || nowStamp()).slice(0, 10);
    const st = stats || {}, pub = (posts || []).filter((p) => !p.parent && p.status === "published" && p.date).sort((a, b) => (at(a) || a.date).localeCompare(at(b) || b.date));
    const media = [].concat(...["instagram", "facebook", "youtube", "tiktok"].map((n) => ((st[n] || {}).media || []).map((m) => Object.assign({ net: n }, m))));
    const best = (f) => media.reduce((b, m) => (f(m) > (b ? f(b) : -1) ? m : b), null);
    const bv = best((m) => +m.views || 0), bl = best((m) => (+m.likes || 0) + (+m.comments || 0));
    const fol = Math.max(0, ...["instagram", "facebook", "youtube"].map((n) => +(((st[n] || {}).account || {}).followers) || 0));
    // Semaines avec au moins une publication : meilleure série, et série en cours (cette semaine ou la précédente)
    const weeks = [...new Set(pub.map((p) => weekOf(p.date)))].sort();
    let run = 0, bestRun = 0, bestEnd = "", prev = "";
    weeks.forEach((w) => { run = prev && addDays(prev, 7) === w ? run + 1 : 1; if (run > bestRun) { bestRun = run; bestEnd = w; } prev = w; });
    const tw = weekOf(t), last = weeks[weeks.length - 1];
    const current = last === tw || last === addDays(tw, -7) ? run : 0;
    const val = { views: bv ? +bv.views || 0 : 0, likes: bl ? (+bl.likes || 0) + (+bl.comments || 0) : 0, followers: fol, posts: pub.length, streak: bestRun };
    const when = {
      views: (n) => (bv && val.views >= n ? String(bv.at || "").slice(0, 10) : ""),
      likes: (n) => (bl && val.likes >= n ? String(bl.at || "").slice(0, 10) : ""),
      followers: (n) => { const h = (st.history || []).find((x) => Math.max(+x.ig || 0, +x.fb || 0) >= n); return h ? h.d : fol >= n ? t : ""; },
      posts: (n) => (pub[n - 1] ? pub[n - 1].date : ""),
      streak: (n) => (bestRun >= n ? addDays(bestEnd, -7 * (bestRun - n)) : ""),
    };
    const groups = ACH.map((a) => {
      const v = val[a.g], levels = a.steps.map((n) => ({ key: a.g + ":" + n, n, got: v >= n, at: v >= n ? when[a.g](n) : "" }));
      const next = levels.find((l) => !l.got) || null, prevN = levels.filter((l) => l.got).slice(-1)[0];
      const top = a.g === "views" ? bv : a.g === "likes" ? bl : null;
      return { g: a.g, title: a.title, unit: a.unit, one: a.one || a.unit, color: a.color, value: v, levels, next, top: prevN || null,
        progress: next ? Math.max(0, Math.min(1, v / next.n)) : 1,
        current: a.g === "streak" ? current : undefined, from: top ? { url: top.url || "", caption: String(top.caption || "").slice(0, 80), net: top.net } : null };
    });
    return { groups, unlocked: [].concat(...groups.map((g) => g.levels.filter((l) => l.got).map((l) => l.key))), total: ACH.reduce((n, a) => n + a.steps.length, 0) };
  }
  function achText(g, n) { const I = typeof window !== "undefined" && window.I18N; const u = n > 1 ? g.unit : g.one; return n.toLocaleString(I && I.lang === "en" ? "en-US" : "fr-FR").replace(/\u202f|\u00a0/g, " ") + " " + (I && I.lang === "en" ? I.t(u) : u); }

  // Équipe d'agents : un rôle par métier, avec ses consignes et qui le tient (Claude par MCP, clé API, ou toi).
  // Seuls les rôles d'écriture (script, légende) peuvent tourner tout seuls avec la clé API.
  const CREW = [
    { key: "script", name: "Scénariste", steps: ["script"], api: true, brief: "Écris un script court et clair : une accroche dans les 2 premières secondes, une idée par plan, une fin qui invite à commenter. Remplis le storyboard plan par plan (texte à l'écran, voix, image, son) sans dépasser la durée maximale." },
    { key: "voice", name: "Voix", steps: ["voice"], brief: "Enregistre ou génère la voix off à partir des répliques du storyboard, une réplique par fichier, sans changer le texte." },
    { key: "edit", name: "Monteur", steps: ["edit"], brief: "Monte la vidéo d'après le storyboard : rythme rapide, coupe les blancs et les hésitations, musique sous la voix." },
    { key: "subs", name: "Sous-titres", steps: ["subs"], brief: "Sous-titres incrustés, lisibles sur téléphone, mots-clés mis en valeur, pas plus de deux lignes." },
    { key: "caption", name: "Légendes", steps: [], api: true, brief: "Écris la légende : accroche dans la première ligne, deux ou trois phrases utiles, une question pour faire réagir, quelques hashtags." },
    { key: "check", name: "Contrôle qualité", steps: ["check"], brief: "Relis la vidéo finie : durée, orthographe des sous-titres, son, chiffres et sources. Note ce qui ne va pas, ne valide jamais la légende." },
  ];
  const CREW_WHO = { mcp: "Claude (lien MCP)", api: "Claude (clé API)", me: "Toi" };
  function crewOf(settings) {
    const own = (settings && settings.crew) || {};
    return CREW.map((r) => {
      const o = own[r.key] || {};
      const who = CREW_WHO[o.who] && (o.who !== "api" || r.api) ? o.who : r.key === "check" || r.key === "voice" ? "me" : "mcp";
      return Object.assign({}, r, { brief: typeof o.brief === "string" && o.brief.trim() ? o.brief : r.brief, who, custom: !!(o.brief && o.brief.trim()) });
    });
  }
  // Ce qu'un rôle a fait : les étapes des vidéos signées de son nom (ex. « Claude · Scénariste »).
  function crewWork(posts, role) {
    const out = [], needle = role.name.toLowerCase();
    (posts || []).forEach((p) => Object.entries((p.prod && p.prod.steps) || {}).forEach(([k, o]) => {
      if (o && o.by && String(o.by).toLowerCase().includes(needle)) out.push({ id: p.id, title: p.title, step: k, state: o.state, at: o.at || "", note: o.note || "" });
    }));
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }

  function nowStamp(d) { d = d || new Date(); return ymd(d) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()); }

  // Contenus intemporels à reprendre : publiés, marqués « intemporel », sans date de péremption,
  // et pas repris (ni publiés) depuis `gap` jours. Les plus anciennement repris d'abord.
  function evergreen(posts, today, gap) {
    gap = gap || 60;
    const top = (posts || []).filter((p) => !p.parent), last = {};
    top.forEach((p) => { const k = p.repostOf; if (k && p.date && (!last[k] || p.date > last[k])) last[k] = p.date; });
    const limit = addDays(today, -gap);
    return top.filter((p) => p.evergreen && p.status === "published" && !p.repostOf && !p.expires && p.date && p.date <= limit && !(last[p.id] && last[p.id] > limit))
      .sort((a, b) => (last[a.id] || a.date).localeCompare(last[b.id] || b.date));
  }
  // Copie d'un post pour le republier : nouveaux identifiant et date, légende à revalider.
  function repostOf(p, date, time, id) {
    const c = JSON.parse(JSON.stringify(p));
    c.id = id; c.date = date; c.time = time; c.status = "scheduled"; c.stage = "caption"; c.captionValidated = false;
    c.title = String(p.title || "").replace(/ \(reprise\)$/, "") + " (reprise)"; c.repostOf = p.id; delete c.evergreen;
    ["results", "failure", "url", "job", "ignored", "needsAttention", "reminded", "attempts", "comments", "ref", "tries", "plugs"].forEach((k) => delete c[k]);
    return c;
  }
  // Date et heure écrites par un autre outil (Buffer, Later, Metricool, Hootsuite…) : « 2026-11-13 12:30 »,
  // « 2026-11-13T12:30:00Z » (UTC, ramené à l'heure locale), « 13/11/2026 12:30 », « 11/13/2026 1:30 PM ».
  function parseWhen(v) {
    v = String(v || "").trim(); if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(v)) { const d = new Date(v); if (!isNaN(d)) return { date: ymd(d), time: pad(d.getHours()) + ":" + pad(d.getMinutes()) }; }
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2})[:h](\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?)?$/i.exec(v), y, mo, d;
    if (m) { y = m[1]; mo = m[2]; d = m[3]; }
    else {
      m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})(?:[ ,T]+(\d{1,2})[:h](\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?)?$/i.exec(v); if (!m) return null;
      y = m[3].length === 2 ? "20" + m[3] : m[3];
      // Jour d'abord (usage français), sauf si c'est impossible ou si l'heure est en AM/PM (usage américain).
      const us = !!m[6];
      if (+m[1] > 12) { d = m[1]; mo = m[2]; } else if (+m[2] > 12 || us) { mo = m[1]; d = m[2]; } else { d = m[1]; mo = m[2]; }
    }
    if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null;
    let time = null;
    if (m[4] != null) { let h = +m[4]; const pm = m[6] && /^p/i.test(m[6]); if (m[6]) { if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; } if (h > 23 || +m[5] > 59) return null; time = pad(h) + ":" + m[5]; }
    return { date: y + "-" + pad(+mo) + "-" + pad(+d), time };
  }
  const api = { parseWhen, evergreen, repostOf, STATUS, FORMATS, STAGES, STEPS, step, alertOf, pad, ymd, parseYmd, addDays, mondayOf, toMin, at, longDate, shortDay, MONTHS, DAYS, setLang,
    displayStatus, missed, willSend, hashtags, checks, mediaChecks, slotOf, nowStamp, fold, seriesOf, matchQuery, parseCsv, toCsv, manualNets, autoNets, pendingManual, prefillUrl, titleFor, capFor, TEXT_MAX, utm, textOut, THREAD_NETS, isThread, threadParts, unthread, splitThread, foldOf, versionFor, isTextPost, textSlotsFor, PROD_STEPS, inFabrique, prodOf, CREW, CREW_WHO, crewOf, crewWork, reviewPile, reviewOf, needsFix, achievements, achText };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Core = api;
})(typeof self !== "undefined" ? self : this);
