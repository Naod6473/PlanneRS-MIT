/* Espace de démonstration : données fictives générées autour de la date du jour.
   Utilisé quand aucun serveur n'est branché (fichier ouvert seul, ou mode démo). */
(function () {
  "use strict";
  const C = window.Core;

  window.DEMO_SETTINGS = {
    workspace: { name: "Espace de démo", demo: true },
    slots: [
      { time: "09:05", label: "Story du matin" },
      { time: "12:30", label: "Vidéo du jour" },
      { time: "18:00", label: "Carrousel" },
      { time: "19:00", label: "Story interactive" },
      { time: "21:00", label: "Série" },
    ],
    networks: ["instagram", "facebook", "linkedin", "x"],
    rules: { requireValidation: true, maxHashtags: 5, noRetryRelay: true, relayAfter: "instagram" },
    customChecks: [],
    categories: ["Recette", "Coulisses", "Astuce", "Actu", "Série"],
    notify: { manualReminderMinutes: 15, onFailure: true },
  };

  window.makeDemo = function (today) {
    today = today || C.ymd(new Date());
    const mon = C.mondayOf(today);
    const posts = [];
    let n = 100;
    const topics = [
      ["Le pain au levain en 3 étapes", "Recette"], ["Pourquoi la croûte chante", "Astuce"],
      ["4 h du matin au fournil", "Coulisses"], ["La farine T65, c'est quoi ?", "Astuce"],
      ["Brioche du dimanche", "Recette"], ["Nos fournisseurs de blé", "Coulisses"],
      ["Garder son pain plus longtemps", "Astuce"], ["Le croissant raté (et pourquoi)", "Coulisses"],
      ["Galette : frangipane ou pomme ?", "Recette"], ["Le four à bois, mode d'emploi", "Coulisses"],
      ["Sans gluten : ce qui change", "Astuce"], ["La baguette tradition", "Recette"],
      ["Une journée de livraison", "Coulisses"], ["Fermentation lente", "Astuce"],
    ];
    const caption = (t) => t + " 🥖\n\nOn t'explique tout en moins d'une minute, avec les gestes du fournil.\n\nEt toi, tu veux qu'on te montre quoi la prochaine fois ? Dis-le en commentaire !\n\n#boulangerie #faitmaison #pain #levain #artisan";
    const now = C.nowStamp();
    for (let i = -7; i < 14; i++) {
      const day = C.addDays(mon, i);
      const t = topics[(i + 7) % topics.length];
      const ref = String(n++);
      const past = (d, time) => d + "T" + time < now;
      const reel = {
        id: "p" + ref + "r", ref, title: t[0], category: t[1], format: "reel",
        networks: ["instagram", "facebook"], date: day, time: "12:30",
        caption: caption(t[0]), captionValidated: i < 6, manual: false,
        media: [{ name: ref + "-reel.mp4", type: "video" }], stage: "scheduled",
        status: past(day, "12:30") ? "published" : "scheduled",
      };
      posts.push(reel);
      posts.push({
        id: "p" + ref + "t", ref, title: "Teaser : " + t[0], format: "story", parent: reel.id, role: "teaser",
        networks: ["instagram"], date: day, time: "12:35", caption: "", captionValidated: true, manual: false,
        media: [{ name: ref + "-teaser.jpg", type: "image" }], stage: "scheduled",
        status: past(day, "12:35") ? "published" : "scheduled",
      });
      if (i % 7 !== 6) posts.push({
        id: "p" + ref + "c", ref, title: t[0] + " (carrousel)", category: t[1], format: "carousel",
        networks: ["instagram", "facebook"], date: day, time: "18:00",
        caption: caption(t[0]), captionValidated: i < 3, manual: false,
        media: [1, 2, 3, 4, 5].map((k) => ({ name: ref + "-slide-" + k + ".jpg", type: "image" })), stage: "scheduled",
        status: past(day, "18:00") ? "published" : "scheduled",
      });
      posts.push({
        id: "p" + ref + "s", ref: "", title: ["Sondage : levain ou levure ?", "Quiz : quelle farine ?", "Boîte à questions", "Sondage : croustillant ou moelleux ?"][(i + 7) % 4],
        format: "story", networks: ["instagram"], date: day, time: "19:00", manual: true, captionValidated: true,
        caption: "Tu préfères quoi ?\nLevain · Levure", media: [{ name: day + "-1900-interactive.jpg", type: "image" }],
        stage: "scheduled", status: day < C.addDays(today, -1) ? "published" : "scheduled",
      });
      if (i % 2 === 0) posts.push({
        id: "p" + ref + "m", ref: "", title: "Bonjour du fournil", format: "story", networks: ["instagram"],
        date: day, time: "09:05", caption: "", captionValidated: true, manual: false,
        media: [{ name: day + "-matin.jpg", type: "image" }], stage: "scheduled",
        status: past(day, "09:05") ? "published" : "scheduled",
      });
    }
    // LinkedIn et X : quelques exemples.
    [1, 3].forEach((k) => posts.push({
      id: "li" + k, ref: "L" + k, title: "Ce que 20 ans de fournil nous ont appris (" + k + ")", format: "document",
      networks: ["linkedin"], date: C.addDays(mon, 7 + k), time: "08:30", manual: true, captionValidated: false,
      caption: "Ce que 20 ans de fournil nous ont appris sur la constance.\n\n1. Les mêmes gestes, tous les jours.\n2. Un carnet pour chaque fournée.\n3. Goûter avant de vendre.",
      media: [{ name: "linkedin-" + k + ".pdf", type: "document" }], stage: "caption", status: "scheduled",
    }));
    posts.push({ id: "x1", ref: "X1", title: "Fil : le levain expliqué en 5 messages", format: "text", networks: ["x"],
      date: C.addDays(today, 2), time: "17:00", manual: false, captionValidated: false,
      caption: "Le levain, c'est juste de la farine et de l'eau. Vraiment ? 🧵", media: [], stage: "caption", status: "scheduled" });

    // Un échec réaliste hier à 18:00 : Instagram refuse une image, Facebook n'est pas tenté.
    const y = C.addDays(today, -1);
    const f = posts.find((p) => p.date === y && p.time === "18:00");
    if (f) {
      f.status = "failed";
      f.results = {
        instagram: { status: "failed", code: "2207052", error: "Le média n'a pas pu être récupéré depuis son adresse publique." },
        facebook: { status: "skipped", error: "Non tenté : il part après Instagram." },
      };
      f.failure = {
        what: "Instagram n'a pas réussi à récupérer l'image 3 sur 5.",
        why: "L'adresse publique de " + f.ref + "-slide-3.jpg ne répond pas. Le fichier est bien dans ton stockage ; c'est l'hébergement public qui ne l'a pas encore.",
        todo: "Réessayer suffit en général après quelques minutes. Sinon, poste-le à la main.",
      };
    }

    // Prêts à programmer (sans date) et brouillons pour le tableau de production.
    [["Le pain perdu anti-gaspi", "Recette", null], ["Rupture de farine : ce qu'on fait", "Actu", C.addDays(today, 5)],
     ["La levure, ce champignon", "Astuce", null]].forEach((x, k) => posts.push({
      id: "r" + k, ref: String(200 + k), title: x[0], category: x[1], format: k === 1 ? "reel" : "carousel",
      networks: ["instagram", "facebook"], date: null, time: null, caption: caption(x[0]), captionValidated: false,
      manual: false, media: [{ name: "r" + k + ".jpg", type: "image" }], stage: "ready", status: "ready", expires: x[2] }));
    [["Le seigle", "idea"], ["Visite d'un moulin", "writing"], ["Pain et santé : 5 idées reçues", "media"], ["Le pétrin mécanique", "caption"]]
      .forEach((x, k) => posts.push({ id: "d" + k, ref: String(210 + k), title: x[0], format: "reel", networks: ["instagram"],
        date: null, time: null, caption: "", captionValidated: false, manual: false, media: [], stage: x[1], status: "draft" }));

    // La Fabrique : des Reels à venir à différentes étapes, avec un storyboard.
    const sb = (t) => [
      { dur: 3, screen: t + " ?", voice: "Tu t'es déjà demandé pourquoi ?", visual: "Gros plan sur la pâte", music: "Lofi, départ" },
      { dur: 8, screen: "Étape 1", voice: "Tout commence la veille, au fournil.", visual: "Mains qui pétrissent", music: "" },
      { dur: 9, screen: "Étape 2", voice: "Puis on laisse le temps faire son travail.", visual: "Pâton qui lève (accéléré)", music: "" },
      { dur: 6, screen: "Le résultat", voice: "Et voilà le travail, tout chaud.", visual: "Sortie du four", music: "Montée" },
      { dur: 4, screen: "Et toi ?", voice: "Dis-nous en commentaire ce que tu veux voir !", visual: "Logo + appel", music: "Fin" },
    ];
    const S5 = ["script", "voice", "edit", "subs", "check"];
    const plan = [[4, "Claude · Contrôle qualité", "Vérifie le rythme et les sous-titres"], [3, "Claude · Sous-titres", "Sous-titres mot à mot"], [2, "Claude · Monteur", "Coupe les blancs, recadre en vertical"], [1, "Voix IA", "Réplique 3 sur 5"], [1, "", ""]];
    posts.filter((p) => p.format === "reel" && !p.parent && p.date && p.date > today).slice(0, plan.length).forEach((p, k) => {
      const [at, by, note] = plan[k], steps = {};
      S5.forEach((s, i) => { steps[s] = i < at ? { state: "done", by: i === 0 ? "Claude · Scénariste" : i === 1 ? "Voix IA" : "Claude · Monteur" } : i === at && by ? { state: "doing", by, note } : { state: "todo" }; });
      p.prod = { steps, shots: sb(p.title) };
      if (at < 2) p.media = [];
    });
    posts.filter((p) => p.id === "d2" || p.id === "d3").forEach((p, k) => { p.prod = { steps: { script: { state: k ? "done" : "doing", by: "Claude · Scénariste" } }, shots: k ? sb(p.title).slice(0, 4) : [] }; });

    const log = [
      { at: y + "T18:00", level: "error", postId: f && f.id, text: "Instagram a refusé le carrousel " + (f && f.ref) + ".", why: "Erreur 2207052 : média introuvable à l'adresse publique." },
      { at: y + "T18:02", level: "error", postId: f && f.id, text: "Nouvel essai automatique : refusé.", why: "Facebook n'est pas tenté : il part après Instagram." },
      { at: y + "T18:02", level: "info", text: "Notification envoyée sur ton téléphone." },
      { at: y + "T12:30", level: "ok", text: "Reel publié sur Instagram et Facebook." },
      { at: y + "T09:05", level: "ok", text: "Story du matin publiée." },
      { at: C.addDays(today, -2) + "T21:14", level: "change", text: "3 posts déplacés dans le calendrier." },
      { at: C.addDays(today, -2) + "T20:40", level: "change", text: "5 légendes validées." },
    ];
    const accounts = {
      instagram: { status: "ok", account: "@boulangerie.demo", detail: "Jeton valable, 12 envois sur 100 aujourd'hui" },
      facebook: { status: "ok", account: "Page « Boulangerie démo »", detail: "Relais automatique après Instagram" },
      linkedin: { status: "manual", account: "Page entreprise", detail: "Pas d'accès API : publication à la main" },
      gdrive: { status: "ok", account: "Dossier « Réseaux sociaux »", detail: "Lecture seule" },
      r2: { status: "warn", account: "Hébergement public des médias", detail: "1 fichier pas encore copié" },
      ntfy: { status: "ok", account: "Téléphone", detail: "Rappels et échecs" },
    };
    return { posts, log, accounts, settings: JSON.parse(JSON.stringify(window.DEMO_SETTINGS)) };
  };
})();
