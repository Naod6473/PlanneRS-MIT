/* PlanneRs : Revue en pile. Les vidéos et posts à relire, une carte à la fois :
   à droite « C'est bon ! » (validé, part à l'heure prévue), à gauche « On retouche » (un mot pour l'équipe),
   vers le haut « plus tard ». Date rapide, légende modifiable, annulation après chaque geste. */
(function () {
  "use strict";
  const C = window.Core, U = window.UI, S = window.Store, A = window.App;
  const { esc, safeUrl, icon, brands } = U;
  const REASONS = ["Accroche trop faible", "Trop long", "Trop court", "Faute dans les sous-titres", "Son ou musique", "Image ou vidéo", "Légende à revoir", "Hors charte"];
  const CONF = ["#10B981", "#F59E0B", "#6D28D9", "#EC4899", "#3B82F6", "#FDE047", "#F97316"];
  const calm = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const me = () => A.me() || "Moi";
  const clone = (o) => JSON.parse(JSON.stringify(o));
  let R = null; // état de la revue ouverte

  const STICK_OK = '<svg viewBox="0 0 150 150" width="150" height="150" aria-hidden="true"><path fill="#FFFFFF" d="M75 4l12 11 16-4 6 15 16 5-2 16 12 12-10 13 4 16-15 7-4 16-16-1-11 12-14-9-14 9-11-12-16 1-4-16-15-7 4-16-10-13 12-12-2-16 16-5 6-15 16 4z"/>' +
    '<path fill="#10B981" d="M75 15l10 9 13-3 5 12 13 4-2 13 10 10-8 11 3 13-12 6-3 13-13-1-9 10-12-7-12 7-9-10-13 1-3-13-12-6 3-13-8-11 10-10-2-13 13-4 5-12 13 3z"/>' +
    '<path fill="none" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" d="M53 64l14 14 30-32"/><text x="75" y="106" text-anchor="middle" font-weight="800" font-size="14.5" fill="#FFFFFF">C\'est bon !</text></svg>';
  const STICK_FIX = '<svg viewBox="0 0 168 112" width="168" height="112" aria-hidden="true"><rect x="6" y="10" width="156" height="92" rx="30" fill="#FFFFFF"/><rect x="14" y="18" width="140" height="76" rx="23" fill="#F97316"/>' +
    '<rect x="58" y="2" width="52" height="18" rx="3" fill="#FDE68A" opacity=".92" transform="rotate(-4 84 11)"/><g transform="translate(28 40)" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 26l4-12L26-4l8 8L16 22z"/><path d="M22 0l8 8"/></g>' +
    '<text x="102" y="52" text-anchor="middle" font-weight="800" font-size="19" fill="#FFFFFF">On</text><text x="102" y="76" text-anchor="middle" font-weight="800" font-size="19" fill="#FFFFFF">retouche</text></svg>';
  const STICK_LATER = '<svg viewBox="0 0 150 80" width="150" height="80" aria-hidden="true"><rect x="4" y="4" width="142" height="72" rx="36" fill="#FFFFFF"/><rect x="11" y="11" width="128" height="58" rx="29" fill="#6D28D9"/>' +
    '<circle cx="40" cy="40" r="13" fill="none" stroke="#FFFFFF" stroke-width="4"/><path d="M40 33v8l5 4" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/><text x="92" y="47" text-anchor="middle" font-weight="800" font-size="19" fill="#FFFFFF">Plus tard</text></svg>';

  // ------------------------------------------------------------ Ouverture
  A.openReview = A.openPile = function (ids) {
    const list = ids && ids.length ? ids : C.reviewPile(S.state.posts.map(A.eff)).map((p) => p.id);
    if (!list.length) { U.toast("Rien à relire pour l'instant"); return; }
    R = { ids: list, i: 0, hist: [], streak: 0, best: 0, t0: Date.now(), sheet: "", picked: {}, focus: document.activeElement };
    let el = document.getElementById("pile");
    if (!el) { el = document.createElement("dialog"); el.id = "pile"; document.body.appendChild(el); }
    el.className = "pile mh"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Revue en pile");
    el.hidden = false; document.body.style.overflow = "hidden";
    U.modal(el, close);
    draw();
    const f = el.querySelector(".pl-act.ok"); if (f) f.focus();
  };
  function close() {
    const el = document.getElementById("pile"); if (!el) return;
    el.hidden = true; el.innerHTML = ""; U.unmodal(el); document.body.style.overflow = "";
    const back = R && R.focus; R = null; A.render();
    if (back && back.focus && document.contains(back)) back.focus();
  }
  const root = () => document.getElementById("pile");
  const cur = () => (R && R.i < R.ids.length ? S.post(R.ids[R.i]) : null);

  // ------------------------------------------------------------ Dessin
  function media(p) {
    const ms = (p.media || []).filter((m) => m.role !== "guide");
    const v = ms.find((m) => (m.type === "video" || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(m.url || m.name || "")) && /^https?:/.test(m.url || ""));
    const cov = A.coverOf ? A.coverOf(p) : "";
    if (v) return '<video class="pl-vid" src="' + safeUrl(v.url) + '"' + (cov ? ' poster="' + safeUrl(cov) + '"' : "") + ' playsinline preload="metadata" loop></video><button class="pl-play" data-pl="play" aria-label="Lire la vidéo">' + icon("right") + "</button>";
    if (cov) return '<img class="pl-vid" src="' + safeUrl(cov) + '" alt="">';
    if (ms.length) return '<span class="pl-none">' + icon(ms[0].type === "video" ? "film" : "image") + '<span data-noi18n>' + esc(ms[0].name || "") + "</span></span>";
    return '<p class="pl-textonly" data-noi18n>' + esc(String(p.caption || "").slice(0, 400)) + "</p>";
  }
  function whenOf(p) { const e = A.eff(p); return e.date ? C.shortDay(e.date) + " " + (e.time || "") : "Sans date"; }
  function card(p) {
    const r = C.reviewOf(A.eff(p), S.state.settings);
    const chips = r.issues.map((c) => '<span class="pl-ck ' + c.level + '" title="' + esc(c.text) + '">' + icon(c.level === "block" ? "x" : "alert") + esc(c.text.replace(/ :.*$/, "").slice(0, 46)) + "</span>").join("") +
      r.good.map((c) => '<span class="pl-ck ok">' + icon("check") + esc(c.text) + "</span>").join("");
    return '<article class="pl-card" data-plcard>' +
      '<div class="pl-media">' + media(p) +
        '<button class="pl-date" data-pl="date" aria-label="Changer la date de publication">' + icon("calendar") + '<span>' + esc(whenOf(p)) + "</span></button>" +
        '<button class="pl-more" data-pl="more" aria-label="Plus d\'options">' + icon("more") + "</button>" +
        "</div>" + '<span class="pl-stk ok" aria-hidden="true">' + STICK_OK + '</span><span class="pl-stk fix" aria-hidden="true">' + STICK_FIX + '</span><span class="pl-stk later" aria-hidden="true">' + STICK_LATER + "</span>" +
      '<div class="pl-info"><div class="pl-h"><h2 data-noi18n>' + esc(p.title) + '</h2><span class="pl-score ' + (r.score >= 8 ? "good" : r.score >= 5 ? "mid" : "low") + '" title="Note de contrôle">' + r.score + "/10</span></div>" +
      '<div class="pl-meta">' + brands(p.networks) + "<span>" + esc(C.FORMATS[p.format] || "") + "</span></div>" +
      (p.caption && (p.media || []).length ? '<p class="pl-cap" data-noi18n>' + esc(p.caption) + "</p>" : "") +
      '<div class="pl-cks">' + chips + "</div></div></article>";
  }
  function draw() {
    const el = root(); if (!el || !R) return;
    const n = R.ids.length, p = cur(), done = !p;
    const nextP = R.i + 1 < n ? S.post(R.ids[R.i + 1]) : null;
    const nextV = nextP && (nextP.media || []).find((m) => m.type === "video" && /^https?:/.test(m.url || ""));
    el.innerHTML = '<header class="pl-top"><div class="pl-tt"><span class="eyebrow">Revue rapide</span><h1>À relire</h1></div>' +
      (R.streak >= 3 ? '<span class="pl-streak" aria-live="polite">🔥 ' + R.streak + " d'affilée</span>" : "") +
      '<span class="pl-n">' + Math.min(R.i + 1, n) + " / " + n + '</span><button class="iconbtn" data-pl="close" aria-label="Fermer la revue">' + icon("x") + "</button></header>" +
      '<div class="pl-bar"><i style="width:' + Math.round((Math.min(R.i, n) / n) * 100) + '%"></i></div>' +
      (done ? end() :
        '<div class="pl-stage">' + (nextP ? '<div class="pl-back" aria-hidden="true"></div>' : "") + card(p) + "</div>" +
        '<p class="pl-hint">À droite : c\'est bon. À gauche : on retouche. Vers le haut : plus tard.<span class="desk"> Clavier : → ← ↑, D pour la date, Z pour annuler.</span></p>' +
        '<div class="pl-acts"><button class="pl-act fix" data-pl="fix" aria-label="On retouche">' + icon("pen") + '</button><button class="pl-act sm" data-pl="undo" aria-label="Annuler le dernier geste"' + (R.hist.length ? "" : " disabled") + ">" + icon("undo") + "</button>" +
        '<button class="pl-act sm" data-pl="later" aria-label="Plus tard">' + icon("clock") + '</button><button class="pl-act sm" data-pl="date" aria-label="Changer la date">' + icon("calendar") + "</button>" +
        '<button class="pl-act ok" data-pl="ok" aria-label="C\'est bon, valider">' + icon("check") + "</button></div>") +
      (nextV ? '<video src="' + safeUrl(nextV.url) + '" preload="auto" muted hidden></video>' : "") +
      '<div class="pl-fx" aria-hidden="true"></div><div class="pl-toast" role="status"></div>' + sheet(p);
    bindDrag();
    const ta = el.querySelector(".pl-sheet textarea"); if (ta) ta.focus();
  }
  function end() {
    const ok = R.hist.filter((h) => h.kind === "ok").length, fix = R.hist.filter((h) => h.kind === "fix").length;
    const min = Math.max(1, Math.round((Date.now() - R.t0) / 60000));
    const rows = R.hist.filter((h) => h.kind !== "date" && h.kind !== "later").map((h) => '<li><i class="dot ' + h.kind + '"></i><span><b data-noi18n>' + esc(h.title) + "</b><span class=\"muted\">" + esc(h.detail) + "</span></span></li>").join("");
    return '<div class="pl-end"><div class="pl-endic">' + icon("check") + '</div><h2>Pile terminée !</h2><p>' + ok + " validée" + (ok > 1 ? "s" : "") + ", " + fix + " en retouche, en " + min + " min." + (R.best >= 3 ? " Meilleure série : " + R.best + " d'affilée." : "") + "</p>" +
      (rows ? "<ul>" + rows + "</ul>" : "") + '<div class="pl-endb">' + (R.hist.length ? '<button class="btn" data-pl="undo">' + icon("undo") + "Annuler le dernier</button>" : "") + '<button class="btn primary" data-pl="close">Terminer</button></div></div>';
  }
  function sheet(p) {
    if (!R.sheet || !p) return "";
    const top = (t, sub) => '<div class="pl-scrim" data-pl="shut"></div><div class="pl-sheet" role="dialog" aria-label="' + esc(t) + '"><span class="grab" aria-hidden="true"></span><h2>' + esc(t) + "</h2>" + (sub ? '<p class="muted" data-noi18n>' + esc(sub) + "</p>" : "");
    if (R.sheet === "fix") {
      return top("Qu'est-ce qu'on retouche ?", p.title) + '<div class="pl-chips">' + REASONS.map((r) => '<button class="pl-chip' + (R.picked[r] ? " on" : "") + '" data-plr="' + esc(r) + '" aria-pressed="' + !!R.picked[r] + '">' + esc(r) + "</button>").join("") + "</div>" +
        '<label class="pl-lab">Ton mot pour l\'équipe<textarea rows="3" id="pl-txt" maxlength="1000" placeholder="Ex. : la 2e phrase est coupée à 0:12"></textarea></label>' +
        '<p class="muted small">Le mot arrive dans les commentaires de la vidéo et dans La Fabrique ; Claude le lit aussi par le lien MCP.</p>' +
        '<div class="pl-sb"><button class="btn" data-pl="shut">Annuler</button><button class="btn pl-fixgo" data-pl="send">Envoyer les retouches</button></div></div>';
    }
    if (R.sheet === "date") {
      const e = A.eff(p), t = C.ymd(new Date());
      const days = [0, 1, 2, 3, 4, 5, 6].map((k) => C.addDays(t, k));
      const slots = (S.state.settings.slots || []).map((s) => s.time);
      R.day = R.day || e.date || t; R.hour = R.hour || e.time || slots[0] || "12:00";
      const dl = (d, k) => (k === 0 ? "Aujourd'hui" : k === 1 ? "Demain" : C.shortDay(d));
      return top("Quand est-ce qu'elle part ?", p.title + " · " + whenOf(p)) +
        '<span class="pl-k">Jour</span><div class="pl-chips">' + days.map((d, k) => '<button class="pl-chip d' + (R.day === d ? " on" : "") + '" data-plday="' + d + '">' + esc(dl(d, k)) + "</button>").join("") +
        '<input type="date" class="pl-in" data-plday-in value="' + esc(R.day) + '" aria-label="Autre jour"></div>' +
        '<span class="pl-k">Heure</span><div class="pl-chips">' + slots.map((h) => '<button class="pl-chip d' + (R.hour === h ? " on" : "") + '" data-plhour="' + h + '">' + h + "</button>").join("") +
        '<input type="time" class="pl-in" data-plhour-in value="' + esc(R.hour) + '" aria-label="Autre heure"></div>' +
        '<div class="pl-sb">' + (e.date ? '<button class="btn" data-pl="nodate">Sans date</button>' : "") + '<button class="btn primary" data-pl="setdate">Programmer ' + esc(C.shortDay(R.day)) + " " + esc(R.hour) + "</button></div></div>";
    }
    if (R.sheet === "cap") {
      return top("Modifier la légende", p.title) + '<textarea class="caption pl-captxt" id="pl-cap" rows="8" maxlength="5000">' + esc(p.caption || "") + "</textarea>" +
        '<div class="pl-sb"><button class="btn" data-pl="shut">Annuler</button><button class="btn primary" data-pl="savecap">Garder cette légende</button></div></div>';
    }
    const fab = C.inFabrique(p);
    const opt = (k, ic, l, h) => '<button class="pl-opt" data-pl="' + k + '"><span class="ic">' + icon(ic) + "</span><span><b>" + esc(l) + "</b><small>" + esc(h) + "</small></span></button>";
    return top("Plus d'options", p.title) + opt("date", "calendar", "Changer la date", "Jour et heure en deux touches") + opt("cap", "pen", "Modifier la légende", "Corrige le texte sans quitter la pile") +
      opt("later", "clock", "Revoir plus tard", "La carte passe en fin de pile") + opt("post", "contents", "Ouvrir la fiche du post", "Médias, réseaux, commentaires") +
      (fab ? opt("fab", "film", "Ouvrir dans La Fabrique", "Storyboard et étapes") : "") + opt("idea", "bulb", "Ne pas publier", "Range la vidéo dans les idées, sans date") + "</div>";
  }

  // ------------------------------------------------------------ Glisser
  function bindDrag() {
    const c = root().querySelector("[data-plcard]"); if (!c) return;
    let x0 = 0, y0 = 0, dx = 0, dy = 0, on = false;
    const stk = (k) => c.querySelector(".pl-stk." + k);
    const paint = () => {
      const p = Math.min(1, Math.abs(dx) / 110), up = dy < -30 && Math.abs(dy) > Math.abs(dx);
      c.style.transform = "translate(" + dx + "px," + Math.min(0, dy) * (up ? 1 : 0.2) + "px) rotate(" + dx / 16 + "deg)";
      const set = (el, show, k) => { el.style.opacity = show ? Math.min(1, k * 1.6) : 0; el.style.setProperty("--s", show ? (k >= 1 ? 1.08 : 0.35 + 0.65 * k) : 0.3); };
      set(stk("ok"), dx > 0 && !up, p); set(stk("fix"), dx < 0 && !up, p); set(stk("later"), up, Math.min(1, -dy / 120));
      const b = root().querySelector(".pl-back"); if (b) b.style.setProperty("--p", Math.max(p, up ? Math.min(1, -dy / 120) : 0));
    };
    c.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button,a,video[controls]") || R.sheet) return;
      on = true; x0 = e.clientX; y0 = e.clientY; dx = dy = 0; c.classList.add("drag"); c.setPointerCapture && c.setPointerCapture(e.pointerId);
    });
    c.addEventListener("pointermove", (e) => { if (!on) return; dx = e.clientX - x0; dy = e.clientY - y0; paint(); });
    const up = () => {
      if (!on) return; on = false; c.classList.remove("drag");
      if (dx > 110) return approve();
      if (dx < -110) { c.style.transform = "translateX(-70px) rotate(-4deg)"; return open("fix"); }
      if (dy < -120 && Math.abs(dx) < 90) return later();
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; // simple toucher
      dx = dy = 0; c.style.transform = ""; [stk("ok"), stk("fix"), stk("later")].forEach((s) => { s.style.opacity = 0; }); const b = root().querySelector(".pl-back"); if (b) b.style.setProperty("--p", 0);
    };
    c.addEventListener("pointerup", up); c.addEventListener("pointercancel", () => { dx = dy = 0; up(); });
  }
  function fly(dir, then) {
    const c = root().querySelector("[data-plcard]");
    if (!c || calm()) return then();
    const s = c.querySelector(".pl-stk." + dir); if (s) { s.style.opacity = 1; s.style.setProperty("--s", 1.08); }
    c.classList.add("fly-" + dir);
    setTimeout(then, 300);
  }
  function confetti() {
    if (calm()) return;
    const fx = root().querySelector(".pl-fx"); if (!fx) return;
    fx.innerHTML = "";
    const n = 46;
    for (let j = 0; j < n; j++) {
      const a = (Math.PI * 2 * j) / n + Math.random() * 0.5, sp = 90 + Math.random() * 160;
      const w = 6 + Math.random() * 6, round = Math.random() < 0.35, h = round ? w : 10 + Math.random() * 8;
      const i = document.createElement("i");
      i.style.cssText = "width:" + w + "px;height:" + h + "px;margin:" + -h / 2 + "px 0 0 " + -w / 2 + "px;border-radius:" + (round ? "50%" : "2px") + ";background:" + CONF[j % CONF.length] +
        ";--tx:" + Math.round(Math.cos(a) * sp) + "px;--ty:" + Math.round(Math.sin(a) * sp * 0.8 - 130 - Math.random() * 90) + "px;--r:" + Math.round((Math.random() - 0.5) * 900) + "deg;animation-duration:" + Math.round(1000 + Math.random() * 500) + "ms;animation-delay:" + Math.round(Math.random() * 60) + "ms";
      fx.appendChild(i);
    }
    const ring = document.createElement("b"); fx.appendChild(ring);
    setTimeout(() => { if (fx.isConnected) fx.innerHTML = ""; }, 1700);
  }
  function toast(msg, undo) {
    const t = root() && root().querySelector(".pl-toast"); if (!t) return U.toast(msg);
    t.innerHTML = "<span>" + esc(msg) + "</span>" + (undo ? '<button data-pl="undo">Annuler</button>' : "");
    t.classList.remove("on"); void t.offsetWidth; t.classList.add("on");
    clearTimeout(R.tt); R.tt = setTimeout(() => t.classList.remove("on"), undo ? 6000 : 3200);
  }

  // ------------------------------------------------------------ Gestes
  const snap = (p) => [p].concat(S.state.posts.filter((k) => k.parent === p.id)).map(clone);
  async function restore(list) {
    const back = list.map((o) => { const p = S.post(o.id); if (!p) return null; Object.keys(p).forEach((k) => delete p[k]); return Object.assign(p, o); }).filter(Boolean);
    await S.savePosts(back);
  }
  function next(entry, msg) {
    R.hist.push(entry); R.i++; R.sheet = ""; R.picked = {}; R.day = R.hour = "";
    draw(); if (msg) toast(msg, true);
    const f = root().querySelector(".pl-act.ok") || root().querySelector(".pl-end .btn.primary"); if (f) f.focus();
  }
  async function approve() {
    const p = cur(); if (!p) return;
    const r = C.reviewOf(A.eff(p), S.state.settings);
    const c = root().querySelector("[data-plcard]");
    const nope = (msg) => { if (c) { c.style.transform = ""; c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake"); c.querySelectorAll(".pl-stk").forEach((s) => { s.style.opacity = 0; }); } toast(msg); };
    if (!A.canValidate()) return nope("Seuls les validateurs désignés peuvent valider (Réglages › Espace)");
    if (r.blocked) return nope("Impossible de valider : " + r.issues[0].text);
    const before = snap(p), when = whenOf(p);
    if (navigator.vibrate) try { navigator.vibrate(25); } catch (e) { /* rien */ }
    confetti();
    fly("ok", async () => {
      p.captionValidated = true;
      if (C.inFabrique(p)) {
        p.prod = p.prod || {}; p.prod.steps = Object.assign({}, p.prod.steps);
        C.PROD_STEPS.forEach(([k]) => { const o = p.prod.steps[k] || {}; if (o.state !== "done") p.prod.steps[k] = { state: "done", by: o.by || me(), at: C.nowStamp() }; });
        delete p.prod.review;
      }
      if (p.date && (p.status === "draft" || p.status === "ready")) { p.status = "scheduled"; p.stage = "scheduled"; }
      else if (!p.date && p.status === "draft") { p.status = "ready"; p.stage = "ready"; }
      else if (p.stage === "caption") p.stage = "ready";
      await S.savePosts([p]);
      await S.log({ level: "change", text: "Revue en pile : « " + p.title + " » validée", postId: p.id });
      R.streak++; R.best = Math.max(R.best, R.streak);
      next({ kind: "ok", id: p.id, before, title: p.title, detail: p.date ? "Validée · part " + when : "Validée · à programmer" }, p.date ? "C'est parti : « " + p.title + " » part " + when : "« " + p.title + " » est validée");
    });
  }
  async function sendFix() {
    const p = cur(); if (!p) return;
    const reasons = REASONS.filter((r) => R.picked[r]), word = (root().querySelector("#pl-txt") || {}).value || "";
    if (!reasons.length && !word.trim()) { toast("Coche une raison ou écris un mot pour l'équipe"); return; }
    const before = snap(p), at = C.nowStamp();
    const text = "À retoucher" + (reasons.length ? " : " + reasons.join(", ") : "") + (word.trim() ? "\n" + word.trim() : "");
    R.sheet = ""; draw();
    fly("fix", async () => {
      (p.comments = p.comments || []).push({ at, by: me(), text });
      p.captionValidated = false;
      p.prod = p.prod || {}; p.prod.steps = Object.assign({}, p.prod.steps);
      C.prodOf(p).steps.forEach((x) => { if (!p.prod.steps[x.key]) p.prod.steps[x.key] = { state: x.state }; });
      p.prod.steps.check = { state: "todo", by: "", at, note: text };
      p.prod.review = { at, by: me(), reasons, text: word.trim().slice(0, 1000) };
      await S.savePosts([p]);
      await S.log({ level: "change", text: "Revue en pile : « " + p.title + " » à retoucher", why: text, postId: p.id });
      R.streak = 0;
      next({ kind: "fix", id: p.id, before, title: p.title, detail: "En retouche" + (reasons.length ? " · " + reasons.join(", ") : "") }, "« " + p.title + " » part en retouche avec ton mot");
    });
  }
  function later() {
    const p = cur(); if (!p) return;
    if (R.i >= R.ids.length - 1) { toast("C'est la dernière carte"); draw(); return; }
    fly("later", () => {
      R.ids.splice(R.i, 1); R.ids.push(p.id);
      R.hist.push({ kind: "later", id: p.id, title: p.title, detail: "" });
      R.sheet = ""; draw(); toast("« " + p.title + " » repasse en fin de pile", true);
    });
  }
  async function moveNow(p, to) {
    const keep = A.pending, say = U.toast; A.pending = []; U.toast = () => {}; // la revue affiche son propre message
    try { A.queueMove(p.id, to); await A.applyPending(); } finally { U.toast = say; A.pending = keep; A.renderPending(); }
  }
  async function setDate(to) {
    const p = cur(); if (!p) return;
    const before = snap(p);
    await moveNow(p, to);
    R.hist.push({ kind: "date", id: p.id, before, title: p.title, detail: "" });
    R.sheet = ""; R.day = R.hour = ""; draw();
    toast(to.date ? "Déplacée : " + C.shortDay(to.date) + " " + to.time : "Date retirée : elle attend dans « Prêts à programmer »", true);
  }
  async function undo() {
    const h = R.hist.pop(); if (!h) return;
    if (h.kind === "later") { const k = R.ids.lastIndexOf(h.id); R.ids.splice(k, 1); R.ids.splice(R.i, 0, h.id); }
    else {
      await restore(h.before);
      if (h.kind !== "date") { R.i = Math.max(0, R.i - 1); if (R.ids[R.i] !== h.id) R.i = Math.max(0, R.ids.indexOf(h.id)); }
      if (h.kind === "ok") R.streak = Math.max(0, R.streak - 1);
      await S.log({ level: "change", text: "Revue en pile : retour en arrière sur « " + h.title + " »", postId: h.id });
    }
    R.sheet = ""; draw(); toast("Annulé");
    const c = root().querySelector("[data-plcard]"); if (c && !calm()) c.classList.add("back-in");
  }
  function open(k) {
    R.sheet = k;
    if (k === "fix") { R.picked = {}; const p = cur(); if (p) C.reviewOf(A.eff(p), S.state.settings).hints.forEach((h) => { R.picked[h] = true; }); }
    draw();
  }

  // ------------------------------------------------------------ Événements
  document.addEventListener("click", async (e) => {
    const el = root(); if (!el || el.hidden || !R || !el.contains(e.target)) return;
    const b = e.target.closest("[data-pl],[data-plr],[data-plday],[data-plhour]"); if (!b) return;
    const p = cur();
    if (b.dataset.plr) { R.picked[b.dataset.plr] = !R.picked[b.dataset.plr]; b.classList.toggle("on"); b.setAttribute("aria-pressed", String(!!R.picked[b.dataset.plr])); return; }
    if (b.dataset.plday) { R.day = b.dataset.plday; draw(); return; }
    if (b.dataset.plhour) { R.hour = b.dataset.plhour; draw(); return; }
    switch (b.dataset.pl) {
      case "close": return close();
      case "ok": return approve();
      case "fix": return open("fix");
      case "send": return sendFix();
      case "later": return later();
      case "undo": return undo();
      case "date": R.day = R.hour = ""; return open("date");
      case "more": return open("more");
      case "cap": return open("cap");
      case "shut": { R.sheet = ""; draw(); return; }
      case "setdate": return setDate({ date: R.day, time: R.hour });
      case "nodate": return setDate({ date: null, time: null });
      case "savecap": {
        const v = root().querySelector("#pl-cap").value, before = snap(p);
        p.caption = v; p.captionValidated = false; await S.savePosts([p]);
        await S.log({ level: "change", text: "Revue en pile : légende modifiée, « " + p.title + " »", postId: p.id });
        R.hist.push({ kind: "date", id: p.id, before, title: p.title, detail: "" }); R.sheet = ""; draw(); toast("Légende modifiée", true); return;
      }
      case "post": { const id = p.id; close(); A.openPost(id); return; }
      case "fab": { const id = p.id; close(); A.openFab(id); return; }
      case "idea": {
        const before = snap(p);
        R.sheet = ""; draw();
        fly("fix", async () => {
          await moveNow(p, { date: null, time: null });
          p.stage = "idea"; p.status = "draft"; p.captionValidated = false; await S.savePosts([p]);
          await S.log({ level: "change", text: "Revue en pile : « " + p.title + " » rangée dans les idées", postId: p.id });
          R.streak = 0;
          next({ kind: "idea", id: p.id, before, title: p.title, detail: "Rangée dans les idées" }, "« " + p.title + " » rangée dans les idées");
        });
        return;
      }
      case "play": {
        const v = root().querySelector(".pl-vid"); if (!v || v.tagName !== "VIDEO") return;
        if (v.paused) { v.play().catch(() => {}); b.classList.add("on"); b.setAttribute("aria-label", "Mettre en pause"); } else { v.pause(); b.classList.remove("on"); b.setAttribute("aria-label", "Lire la vidéo"); }
        return;
      }
    }
  });
  document.addEventListener("change", (e) => {
    if (!R || !root() || !root().contains(e.target)) return;
    if (e.target.matches("[data-plday-in]") && e.target.value) { R.day = e.target.value; draw(); }
    if (e.target.matches("[data-plhour-in]") && e.target.value) { R.hour = e.target.value; draw(); }
  });
  document.addEventListener("keydown", (e) => {
    const el = root(); if (!el || el.hidden || !R) return;
    e.stopPropagation(); // les raccourcis de l'application restent en pause pendant la revue
    const typing = /^(TEXTAREA|INPUT|SELECT)$/.test(e.target.tagName);
    if (e.key === "Escape") { e.preventDefault(); if (R.sheet) { R.sheet = ""; draw(); } else close(); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (R.sheet) return;
    const k = e.key.toLowerCase();
    if (!cur()) { if (k === "z") { e.preventDefault(); undo(); } return; }
    if (e.key === "ArrowRight") { e.preventDefault(); approve(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); open("fix"); }
    else if (e.key === "ArrowUp") { e.preventDefault(); later(); }
    else if (k === "d") { e.preventDefault(); R.day = R.hour = ""; open("date"); }
    else if (k === "z" || e.key === "Backspace") { e.preventDefault(); undo(); }
  }, true);
})();
