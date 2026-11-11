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
  function area(pts, color, label, rel) {
    const ok = pts.map((p, i) => [i, p]).filter(([, p]) => p.v != null);
    if (ok.length < 2) return '<div class="sc-none">' + (ok.length ? "La courbe se dessine au fil des relevés quotidiens." : "Pas encore de relevé jour par jour.") + "</div>";
    const W = 300, H = 90, n = pts.length - 1 || 1;
    const vs = ok.map(([, p]) => p.v), hi = Math.max(...vs, 1), lo = rel ? Math.min(...vs) - (Math.max(...vs) - Math.min(...vs) || 1) : Math.min(0, ...vs);
    const X = (i) => (i * W) / n, Y = (v) => H - 4 - ((v - lo) / (hi - lo || 1)) * (H - 10);
    const line = ok.map(([i, p], k) => (k ? "L" : "M") + X(i).toFixed(1) + " " + Y(p.v).toFixed(1)).join(" ");
    const fill = line + " L" + X(ok[ok.length - 1][0]).toFixed(1) + " " + H + " L" + X(ok[0][0]).toFixed(1) + " " + H + " Z";
    const id = "g" + Math.random().toString(36).slice(2, 8);
    return '<svg class="sc-chart" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(label + " jour par jour, de " + fmt(Math.min(...vs)) + " à " + fmt(hi)) + '">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".55"/><stop offset="1" stop-color="' + color + '" stop-opacity=".04"/></linearGradient></defs>' +
      '<path d="' + fill + '" fill="url(#' + id + ')"/><path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>' +
      ok.map(([i, p]) => '<rect x="' + (X(i) - W / n / 2).toFixed(1) + '" y="0" width="' + (W / n).toFixed(1) + '" height="' + H + '" fill="transparent"><title>' + esc(C.shortDay(p.d) + " : " + fmt(p.v)) + "</title></rect>").join("") + "</svg>";
  }

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
