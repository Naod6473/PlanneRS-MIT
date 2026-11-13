/* PlanneRs : langue de l'interface.
   Le français est la langue source. En anglais, chaque texte affiché est remplacé à la volée
   à partir du dictionnaire web/js/i18n-en.js (texte exact, ou modèle où « # » remplace un nombre).
   Un texte absent du dictionnaire reste en français : rien ne casse. */
(function () {
  "use strict";
  const KEY = "planners-lang";
  let lang = null;
  try { lang = localStorage.getItem(KEY); } catch (e) { /* rien */ }
  if (lang !== "fr" && lang !== "en") lang = /^fr\b/i.test(navigator.language || "fr") ? "fr" : "en";
  const I = (window.I18N = {
    lang,
    set(l) { try { localStorage.setItem(KEY, l); } catch (e) { /* rien */ } location.reload(); },
    t: (s) => s,
  });
  if (window.Core && window.Core.setLang) window.Core.setLang(lang);
  document.documentElement.lang = lang;
  if (lang === "fr") return;

  // Le dictionnaire anglais (≈ 95 Ko) n'est chargé que pour l'interface en anglais.
  // En attendant, la page reste masquée (au plus 3 s) pour éviter un éclair de français.
  let D = window.I18N_EN || {};
  // Dates déjà écrites en anglais par Core (« Tuesday 10 November », « Tue 10 ») : remplacées par « @ » dans les clés.
  const DATE = /\b(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday) \d{1,2}(?: (?:January|February|March|April|May|June|July|August|September|October|November|December))?\b|\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat) \d{1,2}\b/g;
  function fill(m, dates, nums) { let i = 0, j = 0; return m.replace(/@/g, () => (dates[j++] || "")).replace(/#/g, () => (i < nums.length ? nums[i++] : "")); }
  const PREFIX = [["Configurer ", "Set up "], ["Se connecter à ", "Connect to "], ["Version pour ", "Version for "], ["Aller à ", "Go to "], ["En retard de ", "Late by "], ["Échec : ", "Failed: "]];
  function one(t) {
    if (D[t] != null) return D[t];
    if (t.startsWith("· ")) { const r = one(t.slice(2)); return r == null ? null : "· " + r; }
    const dates = t.match(DATE) || [], rest = t.replace(DATE, "@"), nums = rest.match(/\d+/g) || [];
    const k = rest.replace(/\d+/g, "#");
    if (k !== t && D[k] != null) return fill(D[k], dates, nums);
    return null;
  }
  function tr(s) {
    if (s == null) return null;
    const t = String(s).replace(/\s+/g, " ").trim();
    if (!t) return null;
    let v = one(t);
    // Texte composé « A · B · C » : chaque morceau à part.
    if (v == null && t.includes(" · ")) { const parts = t.split(" · "), out = parts.map((x) => one(x)); if (out.some((x) => x != null)) v = parts.map((x, i) => (out[i] != null ? out[i] : x)).join(" · "); }
    if (v == null) { const p = PREFIX.find(([a]) => t.startsWith(a)); if (p) v = p[1] + t.slice(p[0].length); }
    if (v == null || v === t) return null;
    const lead = String(s).match(/^\s*/)[0], trail = String(s).match(/\s*$/)[0];
    return lead + v + trail;
  }
  I.t = (s) => tr(s) || s;

  // Contenu saisi par l'utilisateur : jamais traduit.
  const SKIP = "textarea, script, style, pre, .caption, .quote, .ph-cap, .igcap, [data-noi18n]";
  const ATTRS = ["placeholder", "aria-label", "title"];
  function textNode(n) { const el = n.parentElement; if (!el || el.closest(SKIP)) return; const v = tr(n.nodeValue); if (v != null) n.nodeValue = v; }
  function element(el) {
    if (el.parentElement && el.parentElement.closest(SKIP)) return;
    ATTRS.forEach((a) => { if (el.hasAttribute(a)) { const v = tr(el.getAttribute(a)); if (v != null) el.setAttribute(a, v); } });
    if (el.tagName === "INPUT" && (el.type === "button" || el.type === "submit")) { const v = tr(el.value); if (v != null) el.value = v; }
  }
  function walk(root) {
    if (root.nodeType === 3) return textNode(root);
    if (root.nodeType !== 1) return;
    element(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n; while ((n = w.nextNode())) { if (n.nodeType === 3) textNode(n); else element(n); }
  }
  let busy = false;
  const mo = new MutationObserver((list) => {
    if (busy) return; busy = true;
    try {
      list.forEach((m) => {
        if (m.type === "childList") m.addedNodes.forEach(walk);
        else if (m.type === "characterData") textNode(m.target);
        else if (m.type === "attributes") element(m.target);
      });
      const tt = tr(document.title); if (tt != null) document.title = tt;
    } finally { mo.takeRecords(); busy = false; }
  });
  function start() {
    walk(document.body);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  const root = document.documentElement;
  function ready() { root.classList.remove("i18n-wait"); if (document.body) start(); else document.addEventListener("DOMContentLoaded", start); }
  if (window.I18N_EN) ready();
  else {
    root.classList.add("i18n-wait");
    const tag = document.createElement("script"), base = (document.currentScript && document.currentScript.src) || "js/i18n.js";
    tag.src = base.replace(/i18n\.js(\?.*)?$/, "i18n-en.js");
    let done = false;
    const go = () => { if (done) return; done = true; D = window.I18N_EN || {}; ready(); };
    tag.onload = go; tag.onerror = go; setTimeout(go, 3000);
    document.head.appendChild(tag);
  }
  const conf = window.confirm.bind(window);
  window.confirm = (m) => conf(I.t(m));
})();
