/* PlanneRs : cartes de statistiques par compte et par période (7, 30 ou 90 jours).
   Chaque carte : le total de la période, l'écart avec la période précédente et la courbe jour par jour.
   Sources, dans l'ordre : totaux renvoyés par l'API pour 7 et 30 jours, relevés quotidiens (historique),
   puis chiffres des publications de la période (par date de publication). */
(function () {
  "use strict";
  const C = window.Core, U = window.UI, A = window.App;
  const { esc, brand } = U;

  const PERIODS = [[7, "7 jours"], [30, "30 jours"], [90, "90 jours"]];
  // [clé API, libellé, champ de l'historique, champ des publications, couleur]
  const CARDS = {
    instagram: [["followers", "Abonnés", "ig", null, 3], ["reach", "Comptes touchés", "igReach", "reach", 1], ["views", "Vues", "igViews", "views", 3],
      ["likes", "Likes", "igLikes", "likes", 2], ["comments", "Commentaires", "igComments", "comments", 1], ["shares", "Partages", "igShares", "shares", 2],
      ["saves", "Enregistrements", "igSaves", "saved", 3], ["replies", "Réponses aux stories", "igReplies", null, 1], ["profile_views", "Visites du profil", "igProfile", null, 2]],
    facebook: [["followers", "Abonnés", "fb", null, 3], ["likes", "Réactions", null, "likes", 2], ["comments", "Commentaires", null, "comments", 1], ["shares", "Partages", null, "shares", 2]],
  };
  const fmt = (n) => (n == null ? "—" : Math.abs(n) >= 10000 ? (n / 1000).toFixed(Math.abs(n) >= 1e5 ? 0 : 1).replace(".", ",") + " k" : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " "));

  function days(end, n) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(C.addDays(end, -i)); return out; }

  // Valeurs jour par jour d'une carte sur une liste de jours (null = pas de donnée ce jour-là).
  function series(st, net, card, list) {
    const [, , hf, mf] = card;
    const hist = new Map((st.history || []).map((h) => [h.d, h]));
    const fromHist = hf ? list.map((d) => { const h = hist.get(d); return h && h[hf] != null ? +h[hf] : null; }) : list.map(() => null);
    if (!mf || card[0] === "followers") return { v: fromHist, src: "hist" };
    const media = ((st[net] || {}).media || []).filter((m) => m.at);
    const per = {}; let any = false;
    for (const m of media) { const d = String(m.at).slice(0, 10); if (m[mf] != null) { per[d] = (per[d] || 0) + (+m[mf] || 0); any = true; } }
    const fromMedia = list.map((d) => (any ? per[d] || 0 : null));
    return fromHist.filter((x) => x != null).length >= Math.min(2, list.length) ? { v: fromHist, src: "hist" } : { v: fromMedia, src: "media" };
  }
  const total = (vals) => (vals.some((x) => x != null) ? vals.reduce((a, x) => a + (x || 0), 0) : null);

  // Chiffres d'une carte pour la période choisie : { value, prev, delta (en %), diff (abonnés), pts }.
  A.statCard = function (st, net, card, n, today) {
    const key = card[0], acc = st[net] || {};
    const cur = days(today, n), before = days(C.addDays(today, -n), n);
    const s = series(st, net, card, cur), sp = series(st, net, card, before);
    if (key === "followers") {
      const now = acc.account ? acc.account.followers : null;
      const known = s.v.filter((x) => x != null), start = known.length ? known[0] : null;
      const pts = cur.map((d, i) => ({ d, v: s.v[i] }));
      if (now != null && pts.length) pts[pts.length - 1].v = now;
      return { value: now, diff: now != null && start != null && known.length > 1 ? now - start : null, pts };
    }
    const win = n === 7 ? acc.week : n === 30 ? acc.month : null, pwin = n === 7 ? acc.prevWeek : n === 30 ? acc.prevMonth : null;
    const value = win && win[key] != null ? +win[key] : total(s.v);
    const prev = pwin && pwin[key] != null ? +pwin[key] : sp.src === s.src ? total(sp.v) : null;
    const delta = value != null && prev ? Math.round(((value - prev) / prev) * 100) : null;
    return { value, prev, delta, pts: cur.map((d, i) => ({ d, v: s.v[i] })), src: win && win[key] != null ? "api" : s.src };
  };

  // Courbe en aire, une seule échelle, info-bulle par jour.
  // Courbe lissée sans dépasser les valeurs (spline monotone) : pas de creux ou de bosse inventés entre deux jours.
  function smooth(P) {
    const n = P.length; if (n < 3) return P.map((p, k) => (k ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const dx = [], m = [], t = [];
    for (let k = 0; k < n - 1; k++) { dx[k] = P[k + 1][0] - P[k][0]; m[k] = (P[k + 1][1] - P[k][1]) / (dx[k] || 1); }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (let k = 1; k < n - 1; k++) t[k] = m[k - 1] * m[k] <= 0 ? 0 : (3 * (dx[k - 1] + dx[k])) / ((2 * dx[k] + dx[k - 1]) / m[k - 1] + (dx[k] + 2 * dx[k - 1]) / m[k]);
    let d = "M" + P[0][0].toFixed(1) + " " + P[0][1].toFixed(1);
    for (let k = 0; k < n - 1; k++) {
      const h = dx[k] / 3;
      d += " C" + (P[k][0] + h).toFixed(1) + " " + (P[k][1] + h * t[k]).toFixed(1) + " " + (P[k + 1][0] - h).toFixed(1) + " " + (P[k + 1][1] - h * t[k + 1]).toFixed(1) + " " + P[k + 1][0].toFixed(1) + " " + P[k + 1][1].toFixed(1);
    }
    return d;
  }
  // Courbe en aire, une seule échelle. Au survol (ou au doigt) : un point et une bulle « jour : valeur ».
  function area(pts, color, label, rel) {
    const ok = pts.map((p, i) => [i, p]).filter(([, p]) => p.v != null);
    if (ok.length < 2) return '<div class="sc-none">' + (ok.length ? "La courbe se dessine au fil des relevés quotidiens." : "Pas encore de relevé jour par jour.") + "</div>";
    const W = 300, H = 90, n = pts.length - 1 || 1;
    const vs = ok.map(([, p]) => p.v), hi = Math.max(...vs, 1), lo = rel ? Math.min(...vs) - (Math.max(...vs) - Math.min(...vs) || 1) : Math.min(0, ...vs);
    const X = (i) => (i * W) / n, Y = (v) => H - 4 - ((v - lo) / (hi - lo || 1)) * (H - 10);
    const P = ok.map(([i, p]) => [X(i), Y(p.v)]);
    const line = smooth(P);
    const fill = line + " L" + P[P.length - 1][0].toFixed(1) + " " + H + " L" + P[0][0].toFixed(1) + " " + H + " Z";
    const id = "g" + Math.random().toString(36).slice(2, 8);
    const data = ok.map(([, p], k) => [+(P[k][0] / W).toFixed(4), +(P[k][1] / H).toFixed(4), C.shortDay(p.d), fmt(p.v)]);
    return '<div class="sc-wrap" data-sc="' + esc(JSON.stringify(data)) + '" style="--c:' + color + '"><svg class="sc-chart" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(label + " jour par jour, de " + fmt(Math.min(...vs)) + " à " + fmt(hi)) + '">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".55"/><stop offset="1" stop-color="' + color + '" stop-opacity=".04"/></linearGradient></defs>' +
      '<path d="' + fill + '" fill="url(#' + id + ')"/><path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>' +
      '<i class="sc-dot" hidden></i><span class="sc-tip" role="status" hidden></span></div>';
  }
  function hover(e) {
    const w = e.target.closest && e.target.closest(".sc-wrap");
    document.querySelectorAll(".sc-wrap.on").forEach((x) => { if (x !== w) { x.classList.remove("on"); x.querySelector(".sc-dot").hidden = true; x.querySelector(".sc-tip").hidden = true; } });
    if (!w) return;
    const data = JSON.parse(w.dataset.sc), r = w.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width;
    let best = data[0]; for (const d of data) if (Math.abs(d[0] - fx) < Math.abs(best[0] - fx)) best = d;
    const dot = w.querySelector(".sc-dot"), tip = w.querySelector(".sc-tip");
    w.classList.add("on"); dot.hidden = false; tip.hidden = false;
    dot.style.left = best[0] * 100 + "%"; dot.style.top = best[1] * 100 + "%";
    tip.innerHTML = "<b>" + esc(best[2]) + "</b><span>" + esc(best[3]) + "</span>";
    tip.style.left = best[0] * 100 + "%"; tip.style.top = best[1] * 100 + "%";
    tip.classList.toggle("right", best[0] > 0.6);
  }
  document.addEventListener("pointermove", hover);
  document.addEventListener("pointerdown", hover);

  A.statCardsHtml = function (st, today) {
    const nets = ["instagram", "facebook"].filter((n) => st[n] && (st[n].account || (st[n].media || []).length));
    if (!nets.length) return "";
    const net = nets.includes(A.statChan) ? A.statChan : nets[0];
    const n = PERIODS.some(([d]) => d === A.statDays) ? A.statDays : 7;
    const acc = st[net] || {};
    const name = (x) => (x === "instagram" ? "@" + ((st.instagram.account || {}).username || "Instagram") : (st.facebook.account || {}).name || "Page Facebook");
    const side = '<nav class="sc-side" aria-label="Comptes"><h2>Comptes</h2>' + nets.map((x) => '<button type="button" data-stat-chan="' + x + '" aria-pressed="' + (x === net) + '">' + brand(x, "lg") + '<span data-noi18n>' + esc(name(x)) + "</span></button>").join("") + "</nav>";
    const cards = CARDS[net].map((card) => {
      const r = A.statCard(st, net, card, n, today);
      if (r.value == null && !r.pts.some((p) => p.v != null)) return "";
      const color = "var(--sc" + card[4] + ")";
      const badge = card[0] === "followers" ? (r.diff != null ? '<span class="sc-d ' + (r.diff > 0 ? "up" : r.diff < 0 ? "down" : "") + '">' + (r.diff > 0 ? "▲ +" : r.diff < 0 ? "▼ " : "") + r.diff + "</span>" : "")
        : r.delta != null ? '<span class="sc-d ' + (r.delta > 0 ? "up" : r.delta < 0 ? "down" : "") + '" title="Par rapport aux ' + n + ' jours d\'avant (' + fmt(r.prev) + ')">' + (r.delta > 0 ? "▲ " : r.delta < 0 ? "▼ " : "") + Math.abs(r.delta) + " %</span>" : "";
      return '<section class="sc-card"><div class="sc-h"><i style="background:' + color + '"></i><span>' + esc(card[1]) + "</span>" + badge + "</div>" + area(r.pts, color, card[1], card[0] === "followers") + '<b class="sc-v">' + fmt(r.value) + "</b></section>";
    }).join("");
    const err = acc.insightsError ? '<p class="muted small">Une partie des chiffres manque : ' + esc(acc.insightsError) + "</p>" : "";
    return '<div class="sc">' + side + '<div class="sc-main"><div class="sc-top"><label><span class="sr">Période</span><select data-stat-days>' + PERIODS.map(([d, l]) => '<option value="' + d + '"' + (d === n ? " selected" : "") + ">" + l + "</option>").join("") + "</select></label>" +
      '<span class="muted small">Écart : par rapport aux ' + n + " jours d'avant</span></div>" + err + '<div class="sc-grid">' + cards + "</div></div></div>";
  };
})();
