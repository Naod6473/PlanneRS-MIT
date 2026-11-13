/* PlanneRs : Pépites. Les publications des comptes que tu suis (5 au plus) qui marchent bien mieux
   que d'habitude, et « Faire ma version », qui ouvre l'atelier (maversion.js) : la recette, jamais une copie.
   Onglet de l'écran Stats. Le relevé se fait côté Worker (worker/src/pepites.js), chaque matin. */
(function () {
  "use strict";
  const C = window.Core, U = window.UI, S = window.Store, A = window.App;
  const { esc, safeUrl, icon, brands } = U;
  const MAX = 5;
  const fmtN = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",") + " M" : n >= 1e4 ? Math.round(n / 1e3) + " k" : String(n));
  const xs = (n) => "×" + String(n).replace(".", ",");
  const rivals = () => (S.state.settings.rivals || []).slice(0, MAX);

  // Démo : des comptes et des pépites d'exemple, pour voir l'écran.
  function demo() {
    const d = (k) => new Date(Date.now() - k * 864e5).toISOString();
    const it = (handle, net, kind, caption, metric, sc, k) => ({ id: net.slice(0, 2) + ":" + handle + k, handle, net, kind, caption, metric, score: sc, unit: net === "youtube" ? "vues" : "interactions", at: d(k), url: "https://example.com/" + handle + "/" + k, thumb: "" });
    return { updated: d(0.2), accounts: [{ net: "instagram", handle: "boulangerie.martin", name: "Boulangerie Martin", count: 24 }, { net: "youtube", handle: "PainMaison", name: "Pain Maison", count: 15 }],
      top: [it("boulangerie.martin", "instagram", "reel", "3 erreurs qui ratent ta baguette (la 2e, tout le monde la fait)", 4210, 5.8, 3),
        it("PainMaison", "youtube", "short", "Le levain en 30 secondes : vivant ou mort ?", 182000, 4.1, 6),
        it("boulangerie.martin", "instagram", "carousel", "Pourquoi le pain de supermarché sèche si vite (et le nôtre non)", 1980, 2.7, 12),
        it("PainMaison", "youtube", "short", "J'ai testé 5 farines : le résultat m'a surpris", 96000, 2.2, 20)] };
  }
  const data = () => (S.mode === "demo" ? (A.pepDemo = A.pepDemo || demo()) : S.state.pepites || {});

  function follow() {
    const list = rivals();
    const chips = list.map((r, i) => '<span class="chip pep-acc">' + brands([r.net]) + '<span data-noi18n>@' + esc(r.handle) + '</span><button class="iconbtn sm" data-pep-del="' + i + '" aria-label="Ne plus suivre @' + esc(r.handle) + '">' + icon("x") + "</button></span>").join("");
    const form = list.length < MAX ? '<form class="pep-add" data-pep-add><select name="net" aria-label="Réseau"><option value="instagram">Instagram</option><option value="youtube">YouTube</option></select>' +
      '<input name="handle" placeholder="@compte ou lien" aria-label="Compte à suivre" required maxlength="120" pattern="@?[\\w.\\-]{1,60}|https?://.+" aria-describedby="pep-err"><button class="btn" type="submit">' + icon("plus") + 'Suivre</button><span class="ferr" id="pep-err">Écris le nom du compte (ex. @boulangerie) ou colle son lien.</span></form>' : '<p class="muted small">5 comptes au plus : retires-en un pour en suivre un autre.</p>';
    return '<section class="panel"><h2 class="sec-h"><span>Comptes suivis</span><span>' + list.length + "/" + MAX + "</span></h2>" +
      (chips ? '<div class="pep-accs">' + chips + "</div>" : '<p class="muted">Choisis jusqu\'à 5 comptes qui parlent de ton sujet : chaque matin, PlanneRs repère leurs publications qui marchent bien mieux que d\'habitude.</p>') + form +
      '<p class="muted small pep-lim">Instagram : comptes professionnels seulement, likes et commentaires (pas les vues), avec ton compte Instagram connecté. YouTube : vues publiques des dernières vidéos. TikTok n\'a pas d\'accès public.</p></section>';
  }

  function card(x) {
    return '<article class="pep">' + (x.thumb ? '<img src="' + safeUrl(x.thumb) + '" alt="" loading="lazy">' : '<span class="noimg">' + icon(x.kind === "carousel" || x.kind === "image" ? "contents" : "film") + "</span>") +
      '<div class="pep-b"><div class="pep-h">' + brands([x.net]) + '<b data-noi18n>@' + esc(x.handle) + '</b><span class="pep-sc" title="Fois sa moyenne">' + xs(x.score) + "</span></div>" +
      '<p class="pep-cap" data-noi18n>' + esc((x.caption || "").slice(0, 160)) + "</p>" +
      '<span class="muted small">' + fmtN(x.metric) + " " + esc(x.unit) + (x.at ? " · " + esc(C.shortDay(x.at.slice(0, 10))) : "") + "</span>" +
      '<span class="acts"><a class="btn sm quiet" href="' + safeUrl(x.url) + '" target="_blank" rel="noopener">Voir</a><button class="btn sm primary" data-pep-remix="' + esc(x.id) + '">' + icon("spark") + "Faire ma version</button></span></div></article>";
  }

  A.pepitesHtml = function () {
    const d = data(), top = d.top || [], errs = (d.accounts || []).filter((a) => a.error);
    const list = rivals().length || S.mode === "demo"
      ? '<section class="panel"><h2 class="sec-h"><span>Pépites</span><span>' + top.length + "</span></h2>" +
        '<p class="muted small" style="margin:0 0 10px">Des publications au moins deux fois au-dessus de la moyenne de leur compte, sur les 60 derniers jours. Inspire-toi de la recette (accroche, structure, format), pas du contenu.</p>' +
        (top.length ? '<div class="pep-grid">' + top.map(card).join("") + "</div>" : '<div class="empty" data-fx="gem">' + (d.updated ? "Pas de pépite en ce moment : rien ne sort du lot." : "Pas encore de relevé : clique sur « Actualiser ».") + "</div>") + "</section>"
      : "";
    return (errs.length ? '<div class="banner warn">' + errs.map((a) => "@" + esc(a.handle) + " : " + esc(a.error)).join("<br>") + "</div>" : "") + follow() + list;
  };
  A.pepitesTools = function () {
    const d = data();
    return (d.updated ? '<span class="muted">Relevé ' + esc(A.agoText ? A.agoText(d.updated) : d.updated.slice(0, 10)) + "</span>" : "") + '<button class="btn" data-pep-refresh aria-label="Actualiser les pépites">' + icon("undo") + '<span class="lbl">Actualiser</span></button>';
  };

  async function saveRivals(list) {
    const st = Object.assign({}, S.state.settings, { rivals: list });
    await S.saveSettings(st);
  }
  function parse(net, raw) {
    const h = String(raw || "").trim().replace(/^https?:\/\/((www|m)\.)?(instagram\.com|youtube\.com)\//i, "").replace(/^(channel|c|user)\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
    return /^[\w.-]{1,60}$/.test(h) ? { net: net === "youtube" ? "youtube" : "instagram", handle: h } : null;
  }

  document.addEventListener("submit", async (e) => {
    const f = e.target.closest("[data-pep-add]"); if (!f) return;
    e.preventDefault();
    const r = parse(f.net.value, f.handle.value);
    if (!r) { U.toast("Compte illisible : écris le nom du compte, par exemple @boulangerie"); return; }
    if (rivals().some((x) => x.net === r.net && x.handle.toLowerCase() === r.handle.toLowerCase())) { U.toast("Tu suis déjà @" + r.handle); return; }
    await saveRivals(rivals().concat([r]));
    A.render(); U.toast("@" + r.handle + " suivi. Les pépites arrivent au prochain relevé, ou avec « Actualiser ».");
  });
  document.addEventListener("click", async (e) => {
    const del = e.target.closest("[data-pep-del]"), ref = e.target.closest("[data-pep-refresh]"), tab = e.target.closest("[data-stattab]");
    if (tab) { A.statTab = ["pep", "ach", "mv"].includes(tab.dataset.stattab) ? tab.dataset.stattab : ""; A.render(); return; }
    if (del) { const l = rivals(); l.splice(+del.dataset.pepDel, 1); await saveRivals(l); A.render(); return; }
    if (ref) {
      if (S.mode !== "api") { U.toast("Mode démo : pépites d'exemple"); return; }
      ref.disabled = true; U.toast("Relevé des comptes suivis…");
      try { S.state.pepites = await S.call("POST", "pepites/refresh"); U.toast("Pépites à jour"); } catch (x) { U.toast("Relevé impossible : " + x.message); }
      A.render(); return;
    }
  });
})();
