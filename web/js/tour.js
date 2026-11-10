/* PlanneRs : visite guidée des menus, proposée à la première ouverture. */
(function () {
  "use strict";
  const U = window.UI, S = window.Store, A = window.App;
  const { esc, icon } = U;
  const KEY = "planners-tour-done";

  // Chaque étape : vue ouverte derrière, entrée de menu mise en avant, texte.
  const STEPS = [
    { title: "Bienvenue dans PlanneRs", text: "Tu prépares tes publications, tu valides les légendes, et PlanneRs les envoie à l'heure prévue. Voici les menus en une minute." },
    { view: "today", title: "Aujourd'hui", text: "Ce qui demande ton attention : légendes à valider, envois en échec, posts à publier à la main. Sur le côté, le programme du jour." },
    { view: "calendar", title: "Calendrier", text: "Tes posts semaine par semaine ou mois par mois. Glisse un post pour changer sa date, et clique sur un statut de la légende pour filtrer." },
    { view: "contents", title: "Contenus", text: "Tes idées et brouillons, de l'idée jusqu'à la publication. Le tableau suit chaque étape, la liste sert à chercher et à modifier plusieurs posts d'un coup, Médias retrouve tes images et vidéos." },
    { view: "stats", title: "Stats", text: "Abonnés, vues, meilleurs posts et hashtags qui marchent, une fois les comptes connectés. Le bilan du mois se copie ou s'imprime en PDF." },
    { view: "activity", title: "Activité", text: "Le journal de tout ce qui s'est passé : envois, échecs, modifications. Un point de couleur dans le menu dit si tout va bien." },
    { view: "settings", title: "Réglages", text: "Le point de départ : connecte tes comptes et ton stockage de médias, choisis tes créneaux et tes notifications. Chaque connexion a son guide pas à pas. Un assistant IA (Claude, ChatGPT…) peut aussi préparer tes posts : tu n'as plus qu'à valider." },
    { title: "Dernière astuce", text: "Ctrl+K (ou « Rechercher ») trouve un post ou lance une action, par exemple « Tout valider ». Tu peux revoir cette visite dans Réglages › Espace.", last: true },
  ];
  const MORE = ["stats", "activity", "settings"];

  const box = () => document.getElementById("tour");
  const done = () => {
    try { if (localStorage.getItem(KEY)) return true; } catch (e) { /* rien */ }
    return !!(S.state.settings && S.state.settings.tourDone);
  };
  async function markDone() {
    try { localStorage.setItem(KEY, "1"); } catch (e) { /* rien */ }
    if (S.state.settings && !S.state.settings.tourDone) { S.state.settings.tourDone = true; try { await S.saveSettings(S.state.settings); } catch (e) { /* rien */ } }
  }

  function target(step) {
    if (!step.view) return null;
    if (A.isMobile()) return document.querySelector('#tabbar a[href="#' + (MORE.includes(step.view) ? "more" : step.view) + '"]');
    return document.querySelector('#nav a[href="#' + step.view + '"]');
  }

  A.tour = function (start) {
    let i = start || 0;
    let el = box();
    if (!el) { el = document.createElement("div"); el.id = "tour"; document.body.appendChild(el); }
    const before = document.activeElement;
    const close = async () => {
      document.removeEventListener("keydown", key, true); window.removeEventListener("resize", place);
      el.innerHTML = ""; await markDone();
      try { (before && before.focus) ? before.focus() : null; } catch (e) { /* rien */ }
    };
    const go = (n) => { i = n; draw(); };
    function place() {
      const st = STEPS[i], t = target(st), card = el.querySelector(".tour-card"), hole = el.querySelector(".tour-hole");
      if (!card) return;
      card.removeAttribute("style"); card.className = "tour-card";
      if (!t || !t.getClientRects().length) { hole.hidden = true; card.classList.add("center"); return; }
      const r = t.getBoundingClientRect();
      hole.hidden = false;
      Object.assign(hole.style, { left: r.left - 4 + "px", top: r.top - 4 + "px", width: r.width + 8 + "px", height: r.height + 8 + "px" });
      if (A.isMobile()) { card.classList.add("dock"); card.style.bottom = window.innerHeight - r.top + 14 + "px"; return; }
      const h = card.offsetHeight;
      card.style.left = r.right + 18 + "px";
      card.style.top = Math.max(12, Math.min(r.top + r.height / 2 - h / 2, window.innerHeight - h - 12)) + "px";
    }
    function draw() {
      const st = STEPS[i];
      if (st.view && (location.hash.replace("#", "").split("/")[0] || "today") !== st.view) location.hash = "#" + st.view;
      const n = STEPS.length - 1;
      const more = st.view && MORE.includes(st.view) && A.isMobile() ? '<p class="muted" style="margin:0">Sur téléphone, ce menu est dans « Plus ».</p>' : "";
      el.innerHTML = '<div class="tour-scrim"></div><div class="tour-hole" hidden></div>' +
        '<div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-t">' +
        (i ? '<span class="tour-n">' + i + " / " + (n - 1 > 0 ? n - 1 : n) + "</span>" : "") +
        '<h2 id="tour-t">' + esc(st.title) + "</h2><p>" + esc(st.text) + "</p>" + more +
        '<div class="tour-dots" aria-hidden="true">' + STEPS.map((_, k) => "<i" + (k === i ? ' class="on"' : "") + "></i>").join("") + "</div>" +
        '<div class="tour-acts">' +
        (i === 0 ? '<button class="btn quiet" data-t="skip">Passer</button><button class="btn primary" data-t="next">Commencer la visite</button>'
          : st.last ? '<button class="btn" data-t="prev">' + icon("left") + 'Retour</button><button class="btn" data-t="end">Terminer</button><button class="btn primary" data-t="setup">Connecter mes comptes</button>'
            : '<button class="btn quiet" data-t="skip">Quitter</button><button class="btn" data-t="prev">' + icon("left") + 'Retour</button><button class="btn primary" data-t="next">Suivant' + icon("right") + "</button>") +
        "</div></div>";
      // Le dernier pas est hors menu : on n'affiche plus de numéro.
      if (st.last || i === 0) { const nEl = el.querySelector(".tour-n"); if (nEl) nEl.remove(); }
      requestAnimationFrame(() => { place(); const p = el.querySelector(".tour-acts .primary"); if (p) p.focus(); });
    }
    const act = (a) => {
      if (a === "next") return go(Math.min(i + 1, STEPS.length - 1));
      if (a === "prev") return go(Math.max(i - 1, 0));
      if (a === "setup") { A.setTab = "accounts"; close(); if (location.hash === "#settings") A.render(); else location.hash = "#settings"; return; }
      close();
    };
    const key = (e) => {
      if (!el.innerHTML) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === "ArrowRight" && !STEPS[i].last) { e.preventDefault(); e.stopPropagation(); go(i + 1); }
      else if (e.key === "ArrowLeft" && i) { e.preventDefault(); e.stopPropagation(); go(i - 1); }
      else if (e.key === "Tab") {
        const f = [...el.querySelectorAll("button")]; if (!f.length) return;
        const k = f.indexOf(document.activeElement);
        e.preventDefault(); f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    };
    el.onclick = (e) => { const b = e.target.closest("[data-t]"); if (b) act(b.dataset.t); };
    document.addEventListener("keydown", key, true);
    window.addEventListener("resize", place);
    draw();
  };

  // Première ouverture : la visite démarre toute seule (une fois par personne).
  A.maybeTour = function () { if (!done()) setTimeout(() => { if (!document.getElementById("layer").innerHTML) A.tour(); }, 400); };
})();
