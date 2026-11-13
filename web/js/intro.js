/* PlanneRs : animation d'ouverture (une fois par session), environ 4,2 secondes.
   Sur fond noir, les cartes aux vraies couleurs des réseaux se posent côte à côte, puis se rejoignent en un seul paquet.
   À chaque temps, la carte du dessus passe derrière le paquet et grandit jusqu'à remplir l'écran de sa couleur, pendant
   qu'un mot monte : « Planifie. Valide. Publie. ». La dernière carte est celle de PlanneRs : elle grandit à son tour,
   devient le fond de l'appli, et son logo va se poser sur celui de la barre latérale.
   Écran large : le paquet en haut à droite, les mots en bas à gauche. Écran en hauteur (téléphone) : tout est centré.
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
  const LAY = 80;                    // écart entre deux cartes quand elles se posent côte à côte
  const JOIN = 560, PACK = 460;      // elles se rejoignent en un seul paquet : départ, durée du trajet
  const BEATS = [1200, 1940, 2680];  // les trois temps : une carte remplit l'écran, un mot arrive
  const END = 3400, TUCK = 120;      // la carte de PlanneRs se ramasse un instant, puis devient l'appli
  const GROW = 480, FADE = 220;      // durée d'un remplissage d'écran, puis du fondu final vers l'appli
  const TOTAL = END + TUCK + GROW + FADE;
  const OUT = "cubic-bezier(.16,1,.3,1)", INOUT = "cubic-bezier(.7,0,.2,1)";

  try {
    const en = (window.I18N || {}).lang === "en";
    const B = window.BRANDS || {};
    const deck = box.querySelector(".in-deck"), hero = box.querySelector(".hero");
    const plate = hero.firstElementChild, logo = hero.lastElementChild;

    // Les cartes : la couleur officielle de chaque réseau, à plat, et son logo en blanc. Celle de PlanneRs vient en dernier.
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

    // Les mots, empilés : chaque nouveau monte du bas du bloc et pousse les précédents d'une ligne.
    const WORDS = en ? ["Plan.", "Approve.", "Post."] : ["Planifie.", "Valide.", "Publie."];
    const LEAD = en ? 1 : 0.92; // interligne, plus large en anglais pour les jambages de « Approve. »
    const AIR = 0.3;            // écran en hauteur : l'espace entre la carte et les mots, en lignes
    const words = document.createElement("div"), col = document.createElement("div"), base = document.createElement("i");
    words.className = "in-words";
    col.className = "in-col";
    const lines = WORDS.map((w) => { const s = document.createElement("span"); s.textContent = w; col.appendChild(s); return s; });
    lines[2].appendChild(base); // repère sans épaisseur, posé sur la ligne de base du dernier mot
    words.appendChild(col);
    box.appendChild(words);

    // Mesures et mise en place, avant toute animation.
    const W = box.clientWidth, H = box.clientHeight;
    const isMid = () => getComputedStyle(box).getPropertyValue("--mid").trim() === "1";
    const mid = isMid(); // écran en hauteur : composition centrée (c'est la feuille de style qui le dit)
    let slot = deck.getBoundingClientRect();
    const mark = document.querySelector(".side .logo-mark"), to = mark ? mark.getBoundingClientRect() : null;
    const name = box.querySelector(".in-name");
    const rad = parseFloat(getComputedStyle(plate).borderTopLeftRadius) || 0;
    const cs = getComputedStyle(words), left = parseFloat(cs.left) || 24, bottom = parseFloat(cs.bottom) || 24;
    const step = Math.round(slot.width * 0.07); // décalage entre deux cartes du paquet
    const gap = left * 0.6, deckH = slot.height + 3 * step;
    const head = (name ? name.getBoundingClientRect().bottom : 0) + gap; // la place que prend le nom, en haut
    words.style.fontSize = "100px";
    const em = words.getBoundingClientRect().width / 100; // largeur du mot le plus long, en em
    // Le texte le plus grand possible : sous le paquet (écran haut, ou en hauteur : centré avec lui) ou à côté (écran large).
    const under = Math.min((W - 2 * left) / em, mid ? (H - 2 * head - slot.height) / ((3 + AIR) * LEAD) : (H - bottom - slot.top - deckH - gap) / (3 * LEAD));
    const beside = mid ? 0 : Math.min((slot.left - 3 * step - gap - left) / em, (H - bottom - slot.top) / (3 * LEAD));
    const size = Math.floor(Math.max(24, Math.min(Math.max(under, beside), H * 0.2, 200)));
    const line = Math.round(size * LEAD); // un nombre entier de pixels par ligne : le texte reste net à l'arrêt
    words.style.fontSize = size + "px";
    words.style.lineHeight = line + "px";
    // La ligne de base du dernier mot se pose exactement sur la marge du bas (ou sur le bas du bloc centré), quelle que soit la police du système.
    const wr = words.getBoundingClientRect(), sink = Math.round(wr.bottom - base.getBoundingClientRect().bottom);
    if (mid) {
      // Écran en hauteur : la carte et les trois lignes forment un seul bloc, centré dans l'écran et accroché par le haut.
      const block = slot.height + Math.round(line * AIR) + 3 * line, top = Math.round((H - block) / 2);
      deck.style.right = "auto";
      deck.style.left = Math.round((W - slot.width) / 2) + "px";
      deck.style.top = top + "px";
      words.style.left = Math.round((W - wr.width) / 2) + "px";
      words.style.bottom = "auto";
      words.style.top = Math.round(top + block + sink - wr.height) + "px";
      slot = deck.getBoundingClientRect();
    } else words.style.marginBottom = -sink + "px";
    const from = logo.getBoundingClientRect();
    // Au départ, les cartes sont posées côte à côte au milieu de l'écran : sur un rang s'il tient, sinon en carré
    // (et un peu réduites si même le carré ne tient pas).
    const g = Math.round(slot.width * 0.12);
    const room = (n) => Math.max(0.4, Math.min(1, (W - 2 * left) / (n * slot.width + (n - 1) * g), (H - 2 * head) / (4 / n * slot.height + (4 / n - 1) * g)));
    const cols = room(4) >= room(2) ? 4 : 2, sc = room(cols), px = sc * (slot.width + g), py = sc * (slot.height + g);
    const x0 = Math.round((W - cols * px + sc * g) / 2) - slot.left - (1 - sc) * slot.width / 2;
    const y0 = Math.round((H - 4 / cols * py + sc * g) / 2) - slot.top - (1 - sc) * slot.height / 2;
    const spot = (i, s) => "translate(" + (x0 + (i % cols) * px).toFixed(1) + "px," + (y0 + Math.floor(i / cols) * py).toFixed(1) + "px) scale(" + (sc * s).toFixed(3) + ")";

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

      // 1. Les cartes se posent côte à côte, une par une, puis se rejoignent en un seul paquet, celle de PlanneRs dessous.
      cards.forEach((c, i) => {
        run(c, [{ opacity: 1, transform: spot(i, 1.12) }, { opacity: 1, transform: spot(i, 1) }], { duration: 280, delay: i * LAY });
        run(c, [{ transform: spot(i, 1) }, { transform: at(i) + " scale(1)" }], { duration: PACK, delay: JOIN + (cards.length - 1 - i) * 35, easing: INOUT });
      });

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

    // Un clic ou une touche : on fige l'image et on passe à l'appli. Pareil si la fenêtre change nettement de taille ou de sens.
    skip = () => {
      if (leaving) return;
      leaving = true;
      anims.forEach((a) => a.pause());
      box.style.pointerEvents = "none";
      box.animate([{ opacity: getComputedStyle(box).opacity }, { opacity: 0 }], { duration: 180, fill: "forwards" }).onfinish = done;
    };
    resize = () => { if (Math.abs(box.clientWidth - W) > W / 10 || Math.abs(box.clientHeight - H) > H / 10 || isMid() !== mid) skip(); };
    box.addEventListener("click", skip);
    addEventListener("keydown", skip, true);
    addEventListener("resize", resize);

    // Départ après la première image affichée : l'appli a fini de se dessiner derrière, rien ne saute au début.
    requestAnimationFrame(() => requestAnimationFrame(play));
  } catch (e) { done(); }
})();
