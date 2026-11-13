/* PlanneRs : animation d'ouverture (une fois par session).
   Trois cartes aux couleurs des réseaux se mélangent, s'écartent en flou, puis la carte du logo
   s'agrandit jusqu'à remplir l'écran et laisse place à l'appli. Un clic l'écourte. */
(function () {
  "use strict";
  const box = document.getElementById("intro");
  if (!box) return;
  const done = () => { box.remove(); };
  if (document.documentElement.classList.contains("no-intro") || !box.animate) return done();
  try { sessionStorage.setItem("planners-intro", "1"); } catch (e) {}

  const $ = (s) => box.querySelector(s);
  const c1 = $(".c1"), c2 = $(".c2"), c3 = $(".c3"), hero = $(".hero"), logo = $(".hero img");
  const ease = "cubic-bezier(.2,.8,.2,1)";
  // Le logo d'un réseau au centre de chaque carte.
  const B = window.BRANDS || {};
  [[c1, "instagram"], [c2, "facebook"], [c3, "linkedin"]].forEach(([el, id]) => { if (B[id]) el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + B[id].path + '"/></svg>'; });
  const anims = [];
  const run = (el, frames, opts) => { const a = el.animate(frames, Object.assign({ fill: "forwards", easing: ease }, opts)); anims.push(a); return a; };

  // 1. Mélange : chaque carte du dessus glisse sur le côté puis repasse dessous.
  const shuffle = (el, rot, delay, side) => run(el, [
    { transform: "rotate(" + rot + "deg) translateX(0)", zIndex: 3 },
    { transform: "rotate(" + (rot + 6 * side) + "deg) translateX(" + 150 * side + "px)", zIndex: 3, offset: 0.45 },
    { transform: "rotate(" + (rot + 6 * side) + "deg) translateX(" + 150 * side + "px)", zIndex: 0, offset: 0.5 },
    { transform: "rotate(" + rot + "deg) translateX(0)", zIndex: 0 },
  ], { duration: 420, delay });
  shuffle(c3, -2, 80, 1);
  shuffle(c2, 5, 300, -1);
  shuffle(c1, -7, 520, 1);

  // 2. La carte du logo arrive sur le dessus.
  run(hero, [{ opacity: 0, transform: "translateY(24px) scale(.92)" }, { opacity: 1, transform: "translateY(0) scale(1)" }], { duration: 260, delay: 760 });

  // 3. Les autres cartes s'envolent en flou.
  const fly = (el, x, r, delay) => run(el, [
    { opacity: 1, filter: "blur(0)" },
    { opacity: 0, filter: "blur(8px)", transform: "translateX(" + x + "vw) rotate(" + r + "deg) scale(.85)" },
  ], { duration: 420, delay, easing: "cubic-bezier(.5,0,.75,0)" });
  fly(c1, -45, -18, 1000);
  fly(c2, 45, 16, 1020);
  fly(c3, -38, 10, 1040);

  // 4. La carte du logo grandit jusqu'au plein écran, avec un léger effet de souplesse.
  const W = innerWidth, H = innerHeight;
  run(hero, [
    { width: "132px", height: "176px", margin: "-88px 0 0 -66px", borderRadius: "14px", transform: "perspective(900px) rotateX(0deg)" },
    { offset: 0.55, transform: "perspective(900px) rotateX(7deg) skewX(-2deg)", borderRadius: "28px" },
    { width: W + 4 + "px", height: H + 4 + "px", margin: -(H + 4) / 2 + "px 0 0 " + -(W + 4) / 2 + "px", borderRadius: "0px", transform: "perspective(900px) rotateX(0deg)" },
  ], { duration: 620, delay: 1120, easing: "cubic-bezier(.7,0,.2,1)" });
  run(logo, [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.25)" }], { duration: 380, delay: 1300 });

  // 5. L'écran se fond dans l'appli.
  const out = run(box, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, delay: 1720, easing: "linear" });
  out.onfinish = done;

  box.addEventListener("click", () => {
    anims.forEach((a) => a.cancel());
    box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" }).onfinish = done;
  }, { once: true });
})();
