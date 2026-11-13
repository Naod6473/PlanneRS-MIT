/* PlanneRs : animation d'ouverture (une fois par session), environ 3,5 secondes.
   Un paquet de cartes aux vraies couleurs des réseaux se pose dans un coin, sur fond noir. À chaque temps, la carte
   du dessus passe derrière le paquet et grandit jusqu'à remplir l'écran de sa couleur, pendant qu'un mot monte
   en bas à gauche : « Planifie. Valide. Publie. ». La dernière carte est celle de PlanneRs : elle grandit à son tour,
   devient le fond de l'appli, et son logo va se poser sur celui de la barre latérale.
   Tout passe par transform et opacity. Un clic ou une touche l'écourte. */
(function () {
  "use strict";
  const box = document.getElementById("intro");
  if (!box) return;
  let gone = false, skip = null, resize = null;
  const done = () => {
    if (gone) return;
    gone = true;
    removeEventListener("keydown", skip, true);
    removeEventListener("resize", resize);
    box.remove();
  };
  if (document.documentElement.classList.contains("no-intro") || !box.animate) return done();
  try { sessionStorage.setItem("planners-intro", "1"); } catch (e) {}

  // Le déroulé, en millisecondes.
  const DEAL = 45;                 // écart entre deux cartes quand le paquet se pose
  const BEATS = [440, 1180, 1920]; // les trois temps : une carte remplit l'écran, un mot arrive
  const END = 2640, TUCK = 120;    // la carte de PlanneRs se ramasse un instant, puis devient l'appli
  const GROW = 480, FADE = 220;    // durée d'un remplissage d'écran, puis du fondu final vers l'appli
  const TOTAL = END + TUCK + GROW + FADE;
  const OUT = "cubic-bezier(.16,1,.3,1)", INOUT = "cubic-bezier(.7,0,.2,1)";

  try {
    const en = (window.I18N || {}).lang === "en";
    const B = window.BRANDS || {};
    const deck = box.querySelector(".in-deck"), hero = box.querySelector(".hero");
    const plate = hero.firstElementChild, logo = hero.lastElementChild;

    // Les cartes : la couleur officielle de chaque réseau, à plat, et son logo en blanc. Celle de PlanneRs est dessous.
    const NETS = [
      ["youtube", "#FF0000"],
      ["facebook", "#0866FF"],
      ["instagram", "radial-gradient(circle at 0 100%,#FEDA75 8%,#FA7E1E 28%,#D62976 52%,#962FBF 76%,#4F5BD5)"],
    ];
    const cards = NETS.map(([id, color]) => {
      const c = document.createElement("div");
      c.className = "in-card";
      c.innerHTML = '<i class="in-plate"></i>' + (B[id] ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + B[id].path + '"/></svg>' : "");
      c.firstChild.style.background = color;
      deck.insertBefore(c, hero);
      return c;
    });
    cards.push(hero);
    cards.forEach((c, i) => { c.style.zIndex = String(30 - i); });

    // Les mots, empilés en bas à gauche : chaque nouveau monte du bord et pousse les précédents d'une ligne.
    const WORDS = en ? ["Plan.", "Approve.", "Post."] : ["Planifie.", "Valide.", "Publie."];
    const LEAD = en ? 1 : 0.92; // interligne, plus large en anglais pour les jambages de « Approve. »
    const words = document.createElement("div"), col = document.createElement("div"), base = document.createElement("i");
    words.className = "in-words";
    col.className = "in-col";
    const lines = WORDS.map((w) => { const s = document.createElement("span"); s.textContent = w; col.appendChild(s); return s; });
    lines[2].appendChild(base); // repère sans épaisseur, posé sur la ligne de base du dernier mot
    words.appendChild(col);
    box.appendChild(words);

    // Mesures, en une seule passe de mise en page, avant toute animation.
    const W = box.clientWidth, H = box.clientHeight;
    const slot = deck.getBoundingClientRect(), from = logo.getBoundingClientRect();
    const mark = document.querySelector(".side .logo-mark"), to = mark ? mark.getBoundingClientRect() : null;
    const rad = parseFloat(getComputedStyle(plate).borderTopLeftRadius) || 0;
    const cs = getComputedStyle(words), left = parseFloat(cs.left) || 24, bottom = parseFloat(cs.bottom) || 24;
    const step = Math.round(slot.width * 0.07); // décalage entre deux cartes du paquet
    words.style.fontSize = "100px";
    const em = words.getBoundingClientRect().width / 100; // largeur du mot le plus long, en em
    // Le texte le plus grand possible : sous le paquet (écran haut) ou à côté (écran large).
    const gap = left * 0.6, deckLeft = slot.left - 3 * step, deckBottom = slot.bottom + 3 * step;
    const under = Math.min((W - 2 * left) / em, (H - bottom - deckBottom - gap) / (3 * LEAD));
    const beside = Math.min((deckLeft - gap - left) / em, (H - bottom - slot.top) / (3 * LEAD));
    const size = Math.floor(Math.max(24, Math.min(Math.max(under, beside), H * 0.2, 200)));
    const line = Math.round(size * LEAD); // un nombre entier de pixels par ligne : le texte reste net à l'arrêt
    words.style.fontSize = size + "px";
    words.style.lineHeight = line + "px";
    // La ligne de base du dernier mot se pose exactement sur la marge du bas, quelle que soit la police du système.
    const sink = Math.round(words.getBoundingClientRect().bottom - base.getBoundingClientRect().bottom);
    words.style.marginBottom = -sink + "px";

    const anims = [];
    const run = (el, frames, opts) => { const a = el.animate(frames, Object.assign({ fill: "forwards", easing: OUT }, opts)); anims.push(a); return a; };
    const at = (d) => "translate(" + -d * step + "px," + d * step + "px)"; // place d'une carte dans le paquet (0 : dessus)
    const up = (px) => "translateY(" + px + "px)";
    // Une carte qui remplit l'écran : son centre gagne celui de l'écran, ses bords droits dépassent ceux de l'écran
    // (les coins arrondis, étirés, sortent du cadre : c'est ce qui donne la souplesse du mouvement).
    const REST = "translate(0px,0px) scale(1,1)", SMALL = "translate(0px,0px) scale(.94,.94)";
    const FULL = "translate(" + (W / 2 - slot.left - slot.width / 2).toFixed(1) + "px," + (H / 2 - slot.top - slot.height / 2).toFixed(1) + "px) scale(" +
      (W * 1.08 / (slot.width - 2 * rad)).toFixed(3) + "," + (H * 1.08 / (slot.height - 2 * rad)).toFixed(3) + ")";
    col.style.transform = up(3 * line + sink);

    let leaving = false;
    const play = () => {
      // Jamais démarré dans les 4 s (onglet en arrière-plan) : le garde-fou de la feuille de style a déjà masqué l'écran.
      if (leaving) return;
      if (getComputedStyle(box).visibility === "hidden") return done();
      // Ce garde-fou vaut tant que rien n'a démarré ; à partir d'ici, c'est le script qui veille.
      box.style.animation = "none";
      setTimeout(done, TOTAL + 600);

      // 1. Le paquet se pose, carte par carte, celle de PlanneRs d'abord.
      cards.forEach((c, i) => run(c, [
        { opacity: 1, transform: "translate(" + -i * step + "px," + (i * step - deckBottom) + "px)" },
        { opacity: 1, transform: at(i) },
      ], { duration: 340, delay: (cards.length - 1 - i) * DEAL, fill: "both" }));

      // 2. Trois temps : la carte du dessus passe derrière et remplit l'écran, le paquet avance d'un cran, un mot monte.
      BEATS.forEach((t, i) => {
        const c = cards[i];
        run(c, [{ zIndex: i + 1 }, { zIndex: i + 1 }], { duration: 1, delay: t });
        run(c.firstElementChild, [{ transform: REST }, { transform: FULL }], { duration: GROW, delay: t, easing: INOUT });
        cards.slice(i + 1).forEach((n, k) => run(n, [{ transform: at(k + 1) }, { transform: at(k) }], { duration: 320, delay: t }));
        run(lines[i], [{ opacity: 1 }, { opacity: 1 }], { duration: 1, delay: t + 90 });
        run(col, [{ transform: up((3 - i) * line + (i ? 0 : sink)) }, { transform: up((2 - i) * line) }], { duration: 560, delay: t + 90 });
      });

      // 3. La carte de PlanneRs se ramasse un instant, puis grandit jusqu'au plein écran : c'est le fond de l'appli.
      const tuck = TUCK / (TUCK + GROW), last = { duration: TUCK + GROW, delay: END, easing: "linear" };
      run(plate, [{ transform: REST, easing: "ease-out" }, { transform: SMALL, offset: tuck, easing: INOUT }, { transform: FULL }], last);
      // Son logo file se poser sur celui de la barre latérale ; sans barre latérale (téléphone), il gagne le centre de l'écran.
      const side = to && to.width && to.left >= 0 && to.top >= 0 && to.right <= W && to.bottom <= H;
      const cx = side ? to.left + to.width / 2 : W / 2, cy = side ? to.top + to.height / 2 : H / 2, k = side ? to.height / from.height : 1.2;
      run(logo, [
        { transform: "translate(0px,0px) scale(1)", easing: "ease-out" },
        { transform: "translate(0px,0px) scale(.94)", offset: tuck, easing: INOUT },
        { transform: "translate(" + (cx - from.left - from.width / 2).toFixed(1) + "px," + (cy - from.top - from.height / 2).toFixed(1) + "px) scale(" + k.toFixed(4) + ")" },
      ], last);

      // 4. L'écran, maintenant de la couleur du fond de l'appli, s'efface.
      run(box, [{ opacity: 1 }, { opacity: 0 }], { duration: FADE, delay: END + TUCK + GROW, easing: "linear" }).onfinish = done;
    };

    // Un clic ou une touche : on fige l'image et on passe à l'appli. Pareil si la fenêtre change nettement de taille.
    skip = () => {
      if (leaving) return;
      leaving = true;
      anims.forEach((a) => a.pause());
      box.style.pointerEvents = "none";
      box.animate([{ opacity: getComputedStyle(box).opacity }, { opacity: 0 }], { duration: 180, fill: "forwards" }).onfinish = done;
    };
    resize = () => { if (Math.abs(box.clientWidth - W) > W / 10 || Math.abs(box.clientHeight - H) > H / 10) skip(); };
    box.addEventListener("click", skip);
    addEventListener("keydown", skip, true);
    addEventListener("resize", resize);

    // Départ après la première image affichée : l'appli a fini de se dessiner derrière, rien ne saute au début.
    requestAnimationFrame(() => requestAnimationFrame(play));
  } catch (e) { done(); }
})();
