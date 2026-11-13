/* PlanneRs : « Une semaine en 10 minutes ». Un parcours guidé en 4 étapes, toujours dans le même panneau :
   1. Idées (au moins 5 pour la semaine, une par ligne) ; 2. Textes (une légende pour chaque idée, puis « Prêt ») ;
   3. Créneaux (« Remplir la semaine » place les posts prêts) ; 4. Validation (la revue en pile).
   Les étapes se cochent d'elles-mêmes d'après l'état réel des posts ; on revient au panneau après chaque outil. */
(function () {
  "use strict";
  const C = window.Core, U = window.UI, S = window.Store, A = window.App;
  const { esc, icon } = U;
  const layer = () => document.getElementById("layer");
  const GOAL = 5;
  let back = false; // revenir au panneau quand l'outil ouvert depuis lui se ferme

  // La semaine visée : la semaine en cours du lundi au jeudi, la suivante à partir du vendredi.
  const target = () => { const t = C.ymd(new Date()), m = C.mondayOf(t); return C.parseYmd(t).getDay() === 5 || C.parseYmd(t).getDay() === 6 || C.parseYmd(t).getDay() === 0 ? C.addDays(m, 7) : m; };
  const top = () => (S.state.posts || []).filter((p) => !p.parent && p.status !== "published" && !p.ignored);

  A.weekFlowState = function () {
    const w = target(), end = C.addDays(w, 6);
    const inWeek = top().filter((p) => p.date && p.date >= w && p.date <= end && p.format !== "story");
    const undated = top().filter((p) => !p.date);
    const toWrite = undated.filter((p) => p.status !== "ready" && !String(p.caption || "").trim());
    const ready = undated.filter((p) => p.status === "ready");
    const toValidate = inWeek.filter((p) => !p.captionValidated && !p.manual && p.status !== "failed");
    const have = inWeek.length + undated.length;
    const need = Math.max(0, GOAL - inWeek.length - ready.length); // textes à écrire pour avoir de quoi remplir la semaine
    return {
      week: w, inWeek, undated, toWrite, ready, toValidate,
      steps: [
        { k: "ideas", done: have >= GOAL, n: have },
        { k: "texts", done: have >= GOAL && (need === 0 || !toWrite.length), n: Math.min(need, toWrite.length) },
        { k: "slots", done: inWeek.length >= GOAL || (have >= GOAL && !ready.length && !undated.some((p) => p.status !== "ready")), n: ready.length },
        { k: "valid", done: inWeek.length > 0 && !toValidate.length, n: toValidate.length },
      ],
    };
  };

  const started = () => { try { const v = +sessionStorage.getItem("planners-wf-t0"); if (v) return v; const n = Date.now(); sessionStorage.setItem("planners-wf-t0", String(n)); return n; } catch (e) { return Date.now(); } };

  A.openWeekFlow = function () {
    back = false;
    const st = A.weekFlowState(), t0 = started();
    const cur = st.steps.findIndex((s) => !s.done);
    const min = Math.max(0, Math.round((Date.now() - t0) / 60000));
    const wk = C.shortDay(st.week) + " → " + C.shortDay(C.addDays(st.week, 6));
    const head = (i, title, sub) => {
      const s = st.steps[i], on = i === cur;
      return '<li class="wf-step' + (s.done ? " done" : "") + (on ? " on" : "") + '"><span class="wf-n">' + (s.done ? icon("check") : i + 1) + '</span><div class="wf-b"><b>' + title + "</b><small>" + sub + "</small>";
    };
    const s = st.steps;
    let h = '<div class="sh-top"><b>Une semaine en 10 minutes</b><span style="flex:1"></span><button class="iconbtn" data-close aria-label="Fermer">' + icon("x") + "</button></div>" +
      '<div class="sh-body wf"><p class="wf-sub"><span data-noi18n>' + esc(wk) + '</span><span class="wf-t">' + (cur < 0 ? "" : min ? min + " min" : "C'est parti") + "</span></p>" +
      '<div class="wf-bar" aria-hidden="true">' + s.map((x) => '<i class="' + (x.done ? "ok" : "") + '"></i>').join("") + "</div><ol class=\"wf-list\">";

    // 1. Idées
    h += head(0, "Des idées", s[0].done ? s[0].n + " sujets pour la semaine" : "Au moins " + GOAL + " sujets. Tu en as " + s[0].n + ".");
    if (cur === 0) h += '<form class="wf-form" id="wf-ideas"><textarea name="t" rows="4" placeholder="Une idée par ligne&#10;Ex. : le croissant raté (et pourquoi)"></textarea><button class="btn primary">' + icon("plus") + "Ajouter</button></form>";
    h += "</div></li>";

    // 2. Textes
    h += head(1, "Les textes", s[1].done ? "Chaque idée a sa légende" : (s[1].n > 1 ? "Encore " + s[1].n + " textes à écrire" : "Encore un texte à écrire"));
    if (cur === 1) {
      const p = st.toWrite[0];
      h += '<form class="wf-form" id="wf-text" data-id="' + esc(p.id) + '"><span class="wf-title" data-noi18n>' + esc(p.title || "") + '</span><textarea name="c" rows="5" required placeholder="La légende : une accroche, deux ou trois phrases, une question pour finir."></textarea>' +
        '<span class="row"><button class="btn primary">' + icon("check") + 'Prêt</button><button type="button" class="btn" data-wf-open="' + esc(p.id) + '">' + icon("pen") + "Ouvrir le post</button></span></form>";
    }
    h += "</div></li>";

    // 3. Créneaux
    h += head(2, "Les créneaux", s[2].done ? st.inWeek.length + " posts dans la semaine" : st.ready.length + " post" + (st.ready.length > 1 ? "s" : "") + " prêt" + (st.ready.length > 1 ? "s" : "") + " à placer");
    if (cur === 2) h += '<button class="btn primary" data-wf-fill>' + icon("spark") + "Remplir la semaine</button>";
    h += "</div></li>";

    // 4. Validation
    h += head(3, "La validation", s[3].done ? "Tout est validé" : st.toValidate.length ? st.toValidate.length + " post" + (st.toValidate.length > 1 ? "s" : "") + " à relire" : "Rien à relire pour l'instant");
    if (cur === 3 && st.toValidate.length) h += '<button class="btn primary" data-wf-review>' + icon("check") + "Relire en pile</button>";
    h += "</div></li></ol>";

    if (cur < 0) h += '<div class="wf-done">Semaine prête. Tout part à l\'heure prévue.</div>';
    h += "</div>";
    A.openLayer(h, "Une semaine en 10 minutes");

    const L = layer();
    const fi = L.querySelector("#wf-ideas");
    if (fi) {
      fi.t.focus();
      fi.addEventListener("submit", async (e) => {
        e.preventDefault();
        const lines = fi.t.value.split("\n").map((x) => x.trim()).filter(Boolean);
        if (!lines.length) return;
        for (const title of lines) await A.addIdea({ title });
        U.toast(lines.length + (lines.length > 1 ? " idées ajoutées" : " idée ajoutée"));
        A.render(); A.openWeekFlow();
      });
    }
    const ft = L.querySelector("#wf-text");
    if (ft) {
      ft.c.focus();
      ft.addEventListener("submit", async (e) => {
        e.preventDefault();
        const p = S.post(ft.dataset.id); if (!p) return;
        p.caption = ft.c.value.trim(); p.stage = "ready"; p.status = "ready";
        await S.savePosts([p]); await S.log({ level: "change", text: "Texte écrit : " + p.title, postId: p.id });
        A.render(); A.openWeekFlow();
      });
    }
    L.querySelectorAll("[data-wf-open]").forEach((b) => b.addEventListener("click", () => { back = true; A.closeLayer(); A.openPost(b.dataset.wfOpen); }));
    const fl = L.querySelector("[data-wf-fill]");
    if (fl) fl.addEventListener("click", () => { back = true; A.week = st.week; A.fillWeek(); });
    const rv = L.querySelector("[data-wf-review]");
    if (rv) rv.addEventListener("click", () => { back = true; A.closeLayer(); A.openReview(st.toValidate.map((p) => p.id)); });
    if (cur < 0 && A.celebrate && !A._wfCheered) { A._wfCheered = true; try { sessionStorage.removeItem("planners-wf-t0"); } catch (e) { /* rien */ } A.celebrate({ word: "Semaine prête.", sub: min ? "en " + min + " min" : "", fx: "party", bg: "#0866FF" }); }
  };

  // Retour au panneau quand l'outil ouvert depuis lui se referme (fiche du post, remplissage, revue).
  const again = () => setTimeout(() => {
    const pile = document.getElementById("pile");
    if (back && !layer().firstElementChild && !(pile && !pile.hidden)) A.openWeekFlow();
  }, 60);
  const shut = A.closeLayer;
  A.closeLayer = function () { const r = shut.apply(this, arguments); if (back) again(); return r; };
  const render = A.render;
  A.render = function () {
    const r = render.apply(this, arguments);
    if (back) again();
    return r;
  };
})();
