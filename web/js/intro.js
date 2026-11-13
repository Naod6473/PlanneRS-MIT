/* PlanneRs : animation d'ouverture (une fois par session), environ 2 secondes.
   Un paquet de cartes aux couleurs des réseaux tombe, se mélange au rythme de trois mots
   (« Planifie. Valide. Publie. »), explose en flou, puis la carte du logo s'agrandit et devient l'appli.
   Un clic l'écourte. */
(function () {
  "use strict";
  const box = document.getElementById("intro");
  if (!box) return;
  const done = () => { box.remove(); };
  if (document.documentElement.classList.contains("no-intro") || !box.animate) return done();
  try { sessionStorage.setItem("planners-intro", "1"); } catch (e) {}

  const en = (window.I18N || {}).lang === "en";
  const deck = box.querySelector(".in-deck"), hero = box.querySelector(".hero"), logo = box.querySelector(".hero img");
  box.querySelectorAll(".in-card:not(.hero)").forEach((c) => c.remove());

  // Les cartes : un réseau par carte, avec son logo.
  const B = window.BRANDS || {};
  const CARDS = [
    ["youtube", "linear-gradient(160deg,#ff5a4f,#FF0000 55%,#b80000)", -14],
    ["tiktok", "linear-gradient(160deg,#25F4EE,#111 45%,#111 60%,#FE2C55)", 11],
    ["linkedin", "linear-gradient(160deg,#3b8de0,#0A66C2 60%,#074a8d)", -6],
    ["facebook", "linear-gradient(160deg,#4d93ff,#0866FF 60%,#0047c2)", 8],
    ["instagram", "radial-gradient(circle at 30% 107%,#fdf497 0%,#fd5949 45%,#d6249f 60%,#285AEB 90%)", -3],
  ];
  const cards = CARDS.map(([id, bg, rot], i) => {
    const c = document.createElement("div");
    c.className = "in-card";
    c.style.background = bg;
    c.style.zIndex = String(i + 1);
    c.dataset.rot = rot;
    if (B[id]) c.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + B[id].path + '"/></svg>';
    deck.insertBefore(c, hero);
    return c;
  });
  hero.style.zIndex = "20";

  // Les mots qui pop.
  const WORDS = en ? ["Plan.", "Approve.", "Post."] : ["Planifie.", "Valide.", "Publie."];
  const TINTS = [["#FFD60A", "#111"], ["#FF2E93", "#fff"], ["#22D3EE", "#06222a"]];
  const words = WORDS.map((w, i) => {
    const s = document.createElement("span");
    s.className = "in-word";
    s.textContent = w;
    s.style.background = TINTS[i][0];
    s.style.color = TINTS[i][1];
    box.appendChild(s);
    return s;
  });

  const anims = [];
  const run = (el, frames, opts) => { const a = el.animate(frames, Object.assign({ fill: "forwards", easing: "cubic-bezier(.2,.8,.2,1)" }, opts)); anims.push(a); return a; };
  const rot = (c) => +c.dataset.rot;

  // 1. Le paquet tombe, carte par carte.
  cards.forEach((c, i) => run(c, [
    { transform: "translateY(-70vh) rotate(" + (rot(c) * 3) + "deg)", opacity: 0 },
    { transform: "translateY(0) rotate(" + rot(c) + "deg)", opacity: 1 },
  ], { duration: 380, delay: i * 45, easing: "cubic-bezier(.3,1.5,.5,1)", fill: "both" }));

  // 2. Trois temps : un mot pop, la carte du dessus file sur le côté, le fond change de teinte.
  const BEAT = 300, T0 = 380;
  const BG = ["#4a3700", "#5a0a3c", "#00434f"];
  WORDS.forEach((_, i) => {
    const t = T0 + i * BEAT, w = words[i], c = cards[cards.length - 1 - i], side = i % 2 ? -1 : 1;
    run(w, [
      { opacity: 0, transform: "translate(-50%,-50%) scale(.4) rotate(" + -8 * side + "deg)" },
      { opacity: 1, transform: "translate(-50%,-50%) scale(1.12) rotate(" + 3 * side + "deg)", offset: 0.35 },
      { opacity: 1, transform: "translate(-50%,-50%) scale(1) rotate(" + -2 * side + "deg)", offset: 0.6 },
      { opacity: 0, transform: "translate(-50%,-50%) scale(1.25) rotate(" + -2 * side + "deg)" },
    ], { duration: BEAT + 60, delay: t, easing: "cubic-bezier(.2,.9,.3,1.2)", fill: "both" });
    run(c, [
      { transform: "translateY(0) rotate(" + rot(c) + "deg)" },
      { transform: "translate(" + 46 * side + "vw,-6vh) rotate(" + 28 * side + "deg)", opacity: 0, filter: "blur(6px)" },
    ], { duration: 340, delay: t + 40, easing: "cubic-bezier(.5,0,.8,.4)" });
    run(box, [{ backgroundColor: BG[i] }], { duration: 160, delay: t, fill: "forwards" });
  });

  // 3. Les cartes restantes explosent en flou, la carte du logo arrive.
  const T1 = T0 + WORDS.length * BEAT;
  cards.slice(0, cards.length - WORDS.length).forEach((c, i) => run(c, [
    { transform: "translateY(0) rotate(" + rot(c) + "deg)" },
    { transform: "translate(" + (i ? 50 : -50) + "vw," + (i ? 30 : -30) + "vh) rotate(" + (i ? 40 : -40) + "deg) scale(.8)", opacity: 0, filter: "blur(8px)" },
  ], { duration: 360, delay: T1 - 120, easing: "cubic-bezier(.5,0,.8,.4)" }));
  run(box, [{ backgroundColor: "#0d0f12" }], { duration: 200, delay: T1, fill: "forwards" });
  run(hero, [
    { opacity: 0, transform: "scale(.6) rotate(-6deg)" },
    { opacity: 1, transform: "scale(1.08) rotate(2deg)", offset: 0.6 },
    { opacity: 1, transform: "scale(1) rotate(0deg)" },
  ], { duration: 300, delay: T1 - 80, easing: "cubic-bezier(.3,1.4,.5,1)", fill: "both" });

  // 4. La carte du logo grandit jusqu'au plein écran, avec un léger effet de souplesse.
  const W = innerWidth + 4, H = innerHeight + 4;
  run(hero, [
    { width: "132px", height: "176px", margin: "-88px 0 0 -66px", borderRadius: "16px", transform: "perspective(900px) rotateX(0deg)" },
    { offset: 0.55, transform: "perspective(900px) rotateX(8deg) skewX(-2deg)", borderRadius: "32px" },
    { width: W + "px", height: H + "px", margin: -H / 2 + "px 0 0 " + -W / 2 + "px", borderRadius: "0px", transform: "perspective(900px) rotateX(0deg)" },
  ], { duration: 520, delay: T1 + 260, easing: "cubic-bezier(.75,0,.2,1)" });
  run(logo, [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.4)" }], { duration: 320, delay: T1 + 420 });

  // 5. L'écran se fond dans l'appli.
  const out = run(box, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, delay: T1 + 760, easing: "linear", fill: "forwards" });
  out.onfinish = done;

  box.addEventListener("click", () => {
    anims.forEach((a) => a.cancel());
    box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" }).onfinish = done;
  }, { once: true });
})();
