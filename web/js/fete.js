/* PlanneRs : petites célébrations, dans la direction artistique de l'ouverture
   (aplat aux vraies couleurs d'un réseau, gros mot en noir épais, icône Fluent 3D).
   - A.celebrate({ word, sub, fx, bg, fg }) : une carte monte du bas, reste 1,6 s, repart. Un clic la ferme.
   - Au chargement : « N posts partis » si des posts ont été publiés depuis la dernière visite,
     et un trophée aux caps de 10, 50, 100, 250, 500 et 1 000 posts publiés. */
(function () {
  "use strict";
  const A = window.App, S = window.Store, U = window.UI;
  const en = () => (window.I18N || {}).lang === "en";
  const reduce = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  const fxSrc = (k) => (window.PLANNERS_MENU_ICONS || {})["fx/" + k] || "img/fx/" + k + ".png";
  const COLORS = ["#FF0000", "#0866FF", "#FE2C55", "#25F4EE", "#E60023", "#FEDA75", "#962FBF", "#0A66C2"];

  let busy = null;
  A.celebrate = function (o) {
    o = o || {};
    if (reduce() || navigator.webdriver) { U.toast(o.word + (o.sub ? " " + o.sub : "")); return; }
    if (busy) busy.remove();
    const el = document.createElement("div");
    el.className = "fete";
    el.setAttribute("role", "status");
    el.setAttribute("data-noi18n", "");
    el.style.setProperty("--fbg", o.bg || "#0866FF");
    el.style.setProperty("--ffg", o.fg || "#fff");
    el.innerHTML = '<div class="fete-card">' + (o.fx ? '<img src="' + fxSrc(o.fx) + '" alt="" width="72" height="72">' : "") +
      '<div><b>' + U.esc(o.word || "") + "</b>" + (o.sub ? "<span>" + U.esc(o.sub) + "</span>" : "") + "</div></div>";
    // Confettis plats, aux couleurs des réseaux.
    for (let i = 0; i < 18; i++) {
      const c = document.createElement("i");
      c.style.background = COLORS[i % COLORS.length];
      c.style.left = 50 + (Math.random() * 2 - 1) * 26 + "%";
      c.style.setProperty("--dx", Math.round((Math.random() * 2 - 1) * 220) + "px");
      c.style.setProperty("--dy", Math.round(-140 - Math.random() * 220) + "px");
      c.style.setProperty("--r", Math.round(Math.random() * 540 - 270) + "deg");
      c.style.animationDelay = Math.round(120 + Math.random() * 160) + "ms";
      el.appendChild(c);
    }
    document.body.appendChild(el);
    busy = el;
    const bye = () => { if (!el.isConnected) return; el.classList.add("out"); setTimeout(() => el.remove(), 320); if (busy === el) busy = null; };
    el.addEventListener("click", bye);
    setTimeout(bye, 2200);
  };

  // Au chargement : ce qui est parti depuis la dernière visite, et les caps.
  const CAPS = [10, 50, 100, 250, 500, 1000];
  const KEY = "planners-fete-pub";
  function check() {
    const posts = (S && S.state && S.state.posts) || [];
    if (!posts.length) return;
    const n = posts.filter((p) => !p.parent && p.status === "published").length;
    let seen = null;
    try { seen = localStorage.getItem(KEY); localStorage.setItem(KEY, String(n)); } catch (e) { return; }
    if (seen === null) return;
    const before = +seen || 0;
    if (n <= before) return;
    const cap = CAPS.filter((c) => before < c && n >= c).pop();
    if (cap) A.celebrate({ word: en() ? cap + " posts!" : cap + " posts !", sub: en() ? "published with PlanneRs" : "publiés avec PlanneRs", fx: "trophy", bg: "#FF0000" });
    else {
      const d = n - before;
      A.celebrate({ word: en() ? d + (d > 1 ? " posts went out." : " post went out.") : d + (d > 1 ? " posts partis." : " post parti."), sub: en() ? "since your last visit" : "depuis ta dernière visite", fx: "rocket", bg: "#0866FF" });
    }
  }
  function later() {
    // Après l'animation d'ouverture, et seulement quand les posts sont chargés.
    let tries = 0;
    const go = () => {
      if (document.getElementById("intro")) return setTimeout(go, 400);
      if (!((S && S.state && S.state.posts) || []).length && ++tries < 20) return setTimeout(go, 500);
      setTimeout(check, 600);
    };
    go();
  }
  if (document.readyState === "complete") later(); else window.addEventListener("load", later);
})();
