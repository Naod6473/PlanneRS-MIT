/* PlanneRs : Succès. Des paliers atteints (vues, abonnés, régularité, publications, réactions), rien à débloquer :
   juste de quoi fêter le chemin parcouru et le partager. Onglet de l'écran Stats. Chaque succès devient une image
   (1080 × 1080) à partager ; rien ne se publie tout seul. */
(function () {
  "use strict";
  const C = window.Core, U = window.UI, S = window.Store, A = window.App;
  const { esc, icon } = U;
  const SITE = "https://github.com/Naod6473/PlanneRS-MIT";
  const SEEN = "planners-ach-seen";
  const WORD = { views: "vues", followers: "abonnés", streak: "semaines", posts: "publications", likes: "réactions" };
  const stats = () => S.state.stats || (S.mode === "demo" ? (A._demoSt = A._demoSt || A.demoStats()) : null) || {};
  const data = () => C.achievements(S.state.posts, stats(), C.nowStamp());
  const fmt = (n) => Number(n).toLocaleString("fr-FR").replace(/ | /g, " ");
  const short = (n) => (n >= 1e6 ? fmt(n / 1e6) + " M" : n >= 1e4 ? fmt(Math.round(n / 1e3)) + " k" : fmt(n));
  const longDay = (d) => (d ? C.longDate(d) + " " + d.slice(0, 4) : "");

  // Badge étoilé (le même dessin que les stickers de la revue en pile)
  function burst(cx, cy, r, k = 0.86, n = 16) {
    let d = "";
    for (let i = 0; i < n * 2; i++) { const a = (Math.PI * i) / n - Math.PI / 2, rr = i % 2 ? r * k : r; d += (i ? "L" : "M") + (cx + Math.cos(a) * rr).toFixed(1) + " " + (cy + Math.sin(a) * rr).toFixed(1); }
    return d + "Z";
  }
  function badge(color, label, got, size) {
    return '<svg class="ach-b" viewBox="0 0 100 100" width="' + size + '" height="' + size + '" aria-hidden="true"><path d="' + burst(50, 50, 48) + '" fill="' + (got ? "#FFFFFF" : "var(--line)") + '"/>' +
      '<path d="' + burst(50, 50, 41) + '" fill="' + (got ? color : "var(--panel2)") + '"/><text x="50" y="' + (label.length > 4 ? 56 : 58) + '" text-anchor="middle" font-weight="800" font-size="' + (label.length > 5 ? 17 : label.length > 3 ? 21 : 26) + '" fill="' + (got ? "#FFFFFF" : "var(--ink3)") + '">' + esc(label) + "</text></svg>";
  }

  A.successHtml = function () {
    const d = data(), n = d.unlocked.length;
    const groups = d.groups.map((g) => {
      const top = g.top, nx = g.next;
      const lv = g.levels.map((l) => '<button class="ach-lv' + (l.got ? " got" : "") + '"' + (l.got ? ' data-ach="' + esc(l.key) + '" aria-label="Partager : ' + esc(C.achText(g, l.n)) + '"' : " disabled aria-label=\"Pas encore : " + esc(C.achText(g, l.n)) + '"') + ' title="' + esc(C.achText(g, l.n)) + (l.at ? " · " + esc(longDay(l.at)) : "") + '">' + badge(g.color, short(l.n), l.got, 46) + "</button>").join("");
      return '<section class="panel ach-g" style="--ach:' + g.color + '"><div class="ach-main">' +
        (top ? '<button class="ach-big" data-ach="' + esc(top.key) + '" aria-label="Partager ce succès">' + badge(g.color, short(top.n), true, 92) + "</button>" : '<span class="ach-big">' + badge(g.color, "?", false, 92) + "</span>") +
        '<div class="ach-txt"><span class="eyebrow">' + esc(g.title) + "</span><b>" + (top ? esc(C.achText(g, top.n)) : "Pas encore de palier") + "</b>" +
        (top && top.at ? '<span class="muted small">Atteint le ' + esc(longDay(top.at)) + "</span>" : "") +
        (g.g === "streak" ? '<span class="muted small">Série en cours : ' + g.current + " semaine" + (g.current > 1 ? "s" : "") + "</span>" : "") +
        (nx ? '<span class="ach-next"><span class="ach-bar"><i style="width:' + Math.round(g.progress * 100) + '%"></i></span><span class="muted small">Prochain : ' + esc(C.achText(g, nx.n)) + " (" + fmt(g.value) + " / " + fmt(nx.n) + ")</span></span>" : '<span class="muted small">Tous les paliers sont atteints. Bravo !</span>') +
        (top ? '<button class="btn sm" data-ach="' + esc(top.key) + '">' + icon("send") + "Partager</button>" : "") + "</div></div>" +
        '<div class="ach-lvs" role="group" aria-label="Paliers ' + esc(g.title) + '">' + lv + "</div></section>";
    }).join("");
    return '<section class="pband"><div class="pband-h"><h2>🏆 ' + n + " succès sur " + d.total + "</h2></div>" +
      '<p class="muted" style="margin:4px 0 0">Rien à débloquer : ce sont tes paliers, calculés à partir de tes publications et des statistiques relevées chaque matin. Touche un succès pour en faire une image à partager. Rien ne se publie tout seul.</p></section>' +
      '<div class="ach-grid">' + groups + "</div>";
  };

  // ------------------------------------------------------------ Image à partager (1080 × 1080)
  function rnd(seed) { let s = seed; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }
  function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return "rgb(" + f(n >> 16) + "," + f((n >> 8) & 255) + "," + f(n & 255) + ")"; }
  function lines(ctx, text, max) {
    const out = []; let cur = "";
    text.split(" ").forEach((w) => { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > max && cur) { out.push(cur); cur = w; } else cur = t; });
    if (cur) out.push(cur); return out;
  }
  async function image(g, l) {
    try { await document.fonts.ready; } catch (e) { /* rien */ }
    const W = 1080, cv = document.createElement("canvas"); cv.width = cv.height = W;
    const x = cv.getContext("2d"), font = getComputedStyle(document.body).fontFamily;
    const grad = x.createLinearGradient(0, 0, W, W); grad.addColorStop(0, g.color); grad.addColorStop(1, shade(g.color, 0.55));
    x.fillStyle = grad; x.fillRect(0, 0, W, W);
    const r = rnd(l.n + g.g.length * 97), COL = ["#FDE047", "#FFFFFF", "#F9A8D4", "#86EFAC", "#93C5FD", "#FDBA74"];
    for (let i = 0; i < 70; i++) {
      const px = r() * W, py = r() * W, side = px < 110 || px > 970;
      if (Math.hypot(px - W / 2, py - 470) < 330 || (!side && (py < 140 || py > 770))) continue;
      x.save(); x.translate(px, py); x.rotate(r() * Math.PI); x.globalAlpha = 0.55 + r() * 0.45; x.fillStyle = COL[i % COL.length];
      if (r() < 0.35) { x.beginPath(); x.arc(0, 0, 7 + r() * 6, 0, Math.PI * 2); x.fill(); } else x.fillRect(-6, -12, 12 + r() * 6, 24 + r() * 10);
      x.restore();
    }
    const star = (rad, k, fill) => { x.beginPath(); for (let i = 0; i < 32; i++) { const a = (Math.PI * i) / 16 - Math.PI / 2, rr = i % 2 ? rad * k : rad; x[i ? "lineTo" : "moveTo"](W / 2 + Math.cos(a) * rr, 470 + Math.sin(a) * rr); } x.closePath(); x.fillStyle = fill; x.fill(); };
    x.save(); x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = 40; x.shadowOffsetY = 16; star(300, 0.86, "#FFFFFF"); x.restore();
    star(262, 0.86, g.color);
    x.fillStyle = "#FFFFFF"; x.textAlign = "center"; x.textBaseline = "middle";
    const num = fmt(l.n); let fs = 170; x.font = "800 " + fs + "px " + font; while (x.measureText(num).width > 400 && fs > 60) { fs -= 8; x.font = "800 " + fs + "px " + font; }
    x.fillText(num, W / 2, 455);
    x.font = "700 46px " + font; x.fillText(WORD[g.g] || "", W / 2, 560);
    const who = ((stats().instagram || {}).account || {}).username, ws = ((S.state.settings || {}).workspace || {}).name;
    x.globalAlpha = 0.9; x.font = "600 40px " + font; x.fillText(who ? "@" + who : ws || "", W / 2, 96); x.globalAlpha = 1;
    x.font = "800 54px " + font;
    lines(x, C.achText(g, l.n) + " !", 900).slice(0, 2).forEach((t, i) => x.fillText(t, W / 2, 840 + i * 64));
    x.globalAlpha = 0.85; x.font = "500 32px " + font;
    if (l.at) x.fillText("Atteint le " + longDay(l.at), W / 2, 975);
    x.font = "700 30px " + font; x.fillText("Fait avec PlanneRs", W / 2, 1030); x.globalAlpha = 1;
    return cv;
  }

  // ------------------------------------------------------------ Partager
  async function share(key) {
    const d = data(), g = d.groups.find((x) => key.startsWith(x.g + ":")), l = g && g.levels.find((y) => y.key === key);
    if (!l || !l.got) return;
    const cv = await image(g, l);
    const blob = await new Promise((ok) => cv.toBlob(ok, "image/png"));
    const file = new File([blob], "succes-" + g.g + "-" + l.n + ".png", { type: "image/png" }), url = URL.createObjectURL(blob);
    const text = "🎉 " + C.achText(g, l.n) + " ! Merci à vous 🙏\nOrganisé avec PlanneRs, l'outil libre pour planifier ses réseaux : " + SITE;
    const canFile = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    A.openLayer('<div class="sh-top"><b>Partager ce succès</b><span style="flex:1"></span><button class="iconbtn" data-close aria-label="Fermer">' + icon("x") + "</button></div>" +
      '<div class="sh-body ach-share"><img src="' + url + '" alt="' + esc(C.achText(g, l.n)) + '" width="1080" height="1080">' +
      '<label>Texte<textarea id="ach-txt" rows="4">' + esc(text) + "</textarea></label>" +
      '<p class="muted small" style="margin:0">X, Facebook et LinkedIn reçoivent le texte et le lien ; pour mettre l\'image, télécharge-la puis ajoute-la à ton post. Rien ne part sans toi.</p></div>' +
      '<div class="sh-foot">' + (canFile ? '<button class="btn primary" data-achgo="share">' + icon("send") + "Partager</button>" : "") +
      '<a class="btn' + (canFile ? "" : " primary") + '" href="' + url + '" download="' + esc(file.name) + '">' + icon("download") + "Télécharger l'image</a>" +
      '<button class="btn" data-achgo="x">X</button><button class="btn" data-achgo="fb">Facebook</button><button class="btn" data-achgo="li">LinkedIn</button><button class="btn quiet" data-achgo="copy">' + icon("copy") + "Copier le texte</button></div>", "Partager ce succès");
    const L = document.getElementById("layer");
    L.querySelector(".sheet").classList.add("wide");
    const txt = () => L.querySelector("#ach-txt").value;
    const go = (u) => window.open(u, "_blank", "noopener");
    L.querySelectorAll("[data-achgo]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.achgo;
      if (k === "share") navigator.share({ files: [file], text: txt() }).catch(() => {});
      if (k === "x") go("https://x.com/intent/post?text=" + encodeURIComponent(txt()));
      if (k === "fb") { U.copy(txt()); go("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(SITE)); }
      if (k === "li") { U.copy(txt()); go("https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(SITE)); }
      if (k === "copy") U.copy(txt());
    }));
    const mo = new MutationObserver(() => { if (!L.innerHTML) { URL.revokeObjectURL(url); mo.disconnect(); } }); mo.observe(L, { childList: true });
  }
  A.shareSuccess = share;
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-ach]"); if (b && !b.disabled) { A.lastFocus = b; share(b.dataset.ach); } });

  // Nouveau palier depuis la dernière visite : un message pour le fêter (la première fois, on note sans rien dire).
  function check() {
    if (!S.state || !S.state.posts) return;
    let seen = null; try { seen = JSON.parse(localStorage.getItem(SEEN) || "null"); } catch (e) { seen = null; }
    const d = data(), fresh = seen ? d.unlocked.filter((k) => !seen.includes(k)) : [];
    try { localStorage.setItem(SEEN, JSON.stringify(d.unlocked)); } catch (e) { /* rien */ }
    if (!fresh.length) return;
    const k = fresh[fresh.length - 1], g = d.groups.find((x) => k.startsWith(x.g + ":")), n = +k.split(":")[1];
    U.toast("🏆 Nouveau succès : " + C.achText(g, n) + (fresh.length > 1 ? " (et " + (fresh.length - 1) + " autre" + (fresh.length > 2 ? "s" : "") + ")" : ""), { label: "Partager", fn: () => share(k) });
  }
  let tries = 0;
  const wait = setInterval(() => { if (A.ready || ++tries > 40) { clearInterval(wait); if (A.ready) setTimeout(check, 1500); } }, 250);
})();
