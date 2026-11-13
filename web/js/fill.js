/* PlanneRs : remplir la semaine en un clic.
   Les posts « Prêts à programmer » vont dans les créneaux vides de la semaine affichée, à partir de maintenant,
   les meilleurs horaires d'abord (d'après les stats). Rien n'est enregistré avant « Programmer ». */
(function () {
  "use strict";
  const C = window.Core, U = window.UI, S = window.Store, A = window.App;
  const { esc, icon } = U;
  const layer = () => document.getElementById("layer");

  // Créneaux libres de la semaine (jours × créneaux sans post), triés : meilleure heure d'abord, puis chronologique.
  A.freeSlots = function (week) {
    const slots = (S.state.settings.slots || []).map((s) => s.time).sort();
    const now = C.nowStamp();
    const taken = new Set(S.state.posts.filter((p) => p.date && p.time && !p.parent && p.status !== "draft").map((p) => p.date + " " + p.time.slice(0, 5)));
    const gain = {};
    const b = A.bestTimes && A.bestTimes();
    (b ? b.hours : []).forEach((h) => { gain[h.k] = h.gain; });
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = C.addDays(week, i);
      slots.forEach((t) => { if ((d + "T" + t) > now && !taken.has(d + " " + t)) out.push({ date: d, time: t, gain: gain[+t.slice(0, 2)] || 0 }); });
    }
    // Un post par jour au plus d'abord, pour étaler ; on complète ensuite si besoin.
    const byGain = (x, y) => y.gain - x.gain || (x.date + x.time).localeCompare(y.date + y.time);
    const first = [], rest = [], seen = new Set();
    out.slice().sort(byGain).forEach((s) => { if (seen.has(s.date)) rest.push(s); else { seen.add(s.date); first.push(s); } });
    return first.sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time)).concat(rest);
  };

  A.fillWeek = function () {
    if (!A.week) A.week = C.mondayOf(C.ymd(new Date()));
    const ready = S.state.posts.filter((p) => !p.date && p.status === "ready" && !p.parent);
    const green = C.evergreen(S.state.posts, C.ymd(new Date()));
    if (!ready.length && !green.length) { U.toast("Aucun post dans « Prêts à programmer »"); return; }
    const free = A.freeSlots(A.week);
    if (!free.length) { U.toast("Plus de créneau libre cette semaine : passe à la semaine suivante"); return; }
    // D'abord les posts prêts ; les créneaux qui restent reçoivent une reprise d'un contenu intemporel (2 au plus par semaine).
    const extra = green.slice(0, Math.min(2, Math.max(0, free.length - ready.length))).map((p) => Object.assign({ green: true }, p));
    const plan = ready.concat(extra).slice(0, free.length).map((p, i) => ({ p, s: free[i] })).sort((x, y) => (x.s.date + x.s.time).localeCompare(y.s.date + y.s.time));
    A.openLayer('<div class="sh-top"><b>Remplir la semaine</b><span style="flex:1"></span><button class="iconbtn" data-close aria-label="Fermer">' + icon("x") + "</button></div>" +
      '<div class="sh-body"><p style="margin:0">' + plan.length + " post" + (plan.length > 1 ? "s" : "") + " dans les créneaux libres" + (A.bestTimes && A.bestTimes() ? ", les meilleurs horaires d'abord" : "") + ". Décoche ceux à garder de côté.</p>" +
      '<div class="fill-list">' + plan.map((x, i) => '<label class="fill-row"><input type="checkbox" data-fill-i="' + i + '" checked><span class="mono">' + esc(C.shortDay(x.s.date)) + " · " + x.s.time + "</span><b data-noi18n>" + esc(x.p.title) + "</b>" +
        (x.p.green ? '<span class="st st-scheduled">' + icon("undo") + "Reprise intemporelle</span>" : x.p.captionValidated ? "" : '<span class="st st-manual">Texte à valider</span>') + "</label>").join("") + "</div>" +
      (extra.length ? '<p class="muted" style="margin:0;font-size:13px">Les reprises intemporelles sont des copies de posts déjà publiés il y a plus de 2 mois : leur texte sera à relire et valider.</p>' : "") +
      (ready.length > plan.length ? '<p class="muted" style="margin:0;font-size:13px">' + (ready.length - plan.length) + " post(s) restent en attente : plus de créneau libre cette semaine.</p>" : "") +
      '<p class="muted" style="margin:0;font-size:13px">Un post dont le texte n\'est pas validé est daté, mais ne partira qu\'après validation.</p></div>' +
      '<div class="sh-foot"><button class="btn primary" id="fill-ok">' + icon("check") + "Programmer</button><button class=\"btn\" data-close>Annuler</button></div>", "Remplir la semaine");
    const L = layer();
    L.querySelector("#fill-ok").addEventListener("click", async () => {
      const pick = plan.filter((x, i) => L.querySelector('[data-fill-i="' + i + '"]').checked);
      if (!pick.length) { A.closeLayer(); return; }
      const copies = [];
      pick.forEach((x, i) => {
        const { p, s } = x;
        if (p.green) { const c = C.repostOf(S.post(p.id), s.date, s.time, "k" + Date.now().toString(36) + i); copies.push(c); x.p = c; return; }
        p.date = s.date; p.time = s.time; p.status = "scheduled"; if (p.captionValidated) p.stage = "scheduled";
      });
      await S.savePosts(pick.map((x) => x.p));
      await S.log({ level: "change", text: "Semaine remplie : " + pick.length + " post(s) programmé(s) (" + pick.map((x) => x.p.title).join(", ") + ")" });
      A.closeLayer(); A.render();
      if (A.celebrate && pick.length >= 3) A.celebrate({ word: (window.I18N || {}).lang === "en" ? "Week filled." : "Semaine remplie.", sub: pick.length + ((window.I18N || {}).lang === "en" ? " posts scheduled" : " posts programmés"), fx: "party", bg: "#0866FF" });
      U.toast(pick.length + " post(s) programmé(s)", { label: "Annuler", fn: async () => { for (const c of copies) await S.deletePost(c.id); const back = pick.filter((x) => !copies.includes(x.p)); back.forEach(({ p }) => { p.date = null; p.time = null; p.status = "ready"; p.stage = "ready"; }); await S.savePosts(back.map((x) => x.p)); A.render(); U.toast("Annulé"); } });
    });
  };
})();
