/* Posts sans vidéo : phrase en image et carrousel PDF (LinkedIn), dessinés dans le navigateur, dans la DA de l'ouverture. */
(function () {
  "use strict";
  const A = window.App, C = window.Core;
  const W = 1080, H = 1350;
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const IG = ["#FA7E1E", "#D62976", "#962FBF", "#4F5BD5"];
  const colorOf = (net) => ((window.BRANDS || {})[net] || {}).color || "#15181C";

  // Fond : aplat de la vraie couleur du réseau (dégradé pour Instagram), sinon la scène noire.
  function flood(ctx, net, w, h) {
    if (net === "instagram") {
      const g = ctx.createLinearGradient(0, h, w, 0);
      IG.forEach((c, i) => g.addColorStop(i / (IG.length - 1), c));
      ctx.fillStyle = g;
    } else ctx.fillStyle = net ? colorOf(net) : "#0B0B0C";
    ctx.fillRect(0, 0, w, h);
  }

  // Coupe le texte en lignes qui tiennent dans maxW (les retours à la ligne sont gardés).
  function wrap(ctx, text, maxW) {
    const out = [];
    String(text).split("\n").forEach((para) => {
      let line = "";
      para.split(/\s+/).filter(Boolean).forEach((w) => {
        const t = line ? line + " " + w : w;
        if (ctx.measureText(t).width <= maxW || !line) line = t; else { out.push(line); line = w; }
      });
      out.push(line);
    });
    return out;
  }
  // Plus grande taille de police (entre max et min) qui fait tenir le texte dans la boîte.
  function fit(ctx, text, weight, boxW, boxH, max, min) {
    for (let s = max; s >= min; s -= 4) {
      ctx.font = weight + " " + s + "px " + FONT;
      const lines = wrap(ctx, text, boxW);
      if (lines.length * s * 1.12 <= boxH) return { size: s, lines };
    }
    ctx.font = weight + " " + min + "px " + FONT;
    return { size: min, lines: wrap(ctx, text, boxW) };
  }
  function draw(ctx, f, x, y) { f.lines.forEach((l, i) => ctx.fillText(l, x, y + i * f.size * 1.12)); }

  const clean = (t) => String(t || "").replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "").replace(/https?:\/\/\S+/g, "").replace(/[ \t]+/g, " ").trim();
  // Première phrase utile du texte (sans hashtags ni liens).
  A.firstSentence = function (t) {
    const s = clean(C.unthread(t)).split(/\n+/).map((x) => x.trim()).filter(Boolean).join(" ");
    const m = /^.{12,}?[.!?…](?=\s|$)/.exec(s);
    return (m ? m[0] : s).slice(0, 220).trim();
  };

  // Phrase en image : 1080 × 1350, la phrase en très gros sur l'aplat du réseau.
  A.quoteImage = function (phrase, net, sign) {
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    flood(ctx, net, W, H);
    ctx.fillStyle = "#fff"; ctx.textBaseline = "top";
    const f = fit(ctx, phrase, 800, W - 160, H - 420, 132, 52);
    const top = Math.max(150, (H - f.lines.length * f.size * 1.12) / 2 - 40);
    draw(ctx, f, 80, top);
    ctx.fillRect(80, H - 170, 120, 10);
    if (sign) { ctx.font = "700 40px " + FONT; ctx.fillText(String(sign).slice(0, 40), 80, H - 130); }
    return cv;
  };

  // Pages du carrousel : un paragraphe par page (ou un message du fil) ; un texte d'un bloc est coupé toutes les 2 phrases.
  A.carouselPages = function (t) {
    let parts = C.isThread(t) ? C.threadParts(t) : String(t || "").split(/\n\s*\n/);
    parts = parts.map(clean).filter((x) => x.length > 1);
    if (parts.length < 3) {
      const ss = parts.join(" ").match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [];
      const out = []; for (let i = 0; i < ss.length; i += 2) out.push(ss.slice(i, i + 2).join(" ").trim());
      parts = out.filter(Boolean);
    }
    return parts.slice(0, 20);
  };

  A.carouselCanvases = function (pages, net, sign) {
    return pages.map((txt, i) => {
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      const ctx = cv.getContext("2d"), first = i === 0, last = i === pages.length - 1 && pages.length > 1;
      flood(ctx, first || last ? net : null, W, H);
      ctx.fillStyle = "#fff"; ctx.textBaseline = "top";
      ctx.font = "700 34px " + FONT; ctx.globalAlpha = 0.7; ctx.fillText((i + 1) + " / " + pages.length, 80, 80); ctx.globalAlpha = 1;
      const f = first ? fit(ctx, txt, 800, W - 160, H - 420, 128, 56) : fit(ctx, txt, 700, W - 160, H - 380, 84, 40);
      draw(ctx, f, 80, first ? Math.max(200, (H - f.lines.length * f.size * 1.12) / 2 - 40) : 220);
      if (!first && !last) { ctx.fillStyle = net === "instagram" ? IG[1] : colorOf(net); ctx.fillRect(80, H - 150, 120, 10); }
      else ctx.fillRect(80, H - 150, 120, 10);
      ctx.fillStyle = "#fff";
      if (sign) { ctx.font = "700 34px " + FONT; ctx.fillText(String(sign).slice(0, 40), 80, H - 115); }
      if (!last) { ctx.font = "800 40px " + FONT; ctx.textAlign = "right"; ctx.fillText("→", W - 80, H - 125); ctx.textAlign = "left"; }
      return cv;
    });
  };

  // PDF minimal : une image JPEG pleine page par page (format 4:5, comme les carrousels LinkedIn).
  A.pdfFromJpegs = function (jpegs) {
    const enc = new TextEncoder(), chunks = [], offs = [];
    let len = 0;
    const put = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; chunks.push(b); len += b.length; };
    const obj = (n, body, stream) => {
      offs[n] = len; put(n + " 0 obj\n" + body);
      if (stream) { put("\nstream\n"); put(stream); put("\nendstream"); }
      put("\nendobj\n");
    };
    const n = jpegs.length, pw = 540, ph = 675;
    put("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    const kids = jpegs.map((_, i) => (3 + i * 3) + " 0 R").join(" ");
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, "<< /Type /Pages /Kids [" + kids + "] /Count " + n + " >>");
    jpegs.forEach((j, i) => {
      const p = 3 + i * 3, c = p + 1, im = p + 2;
      obj(p, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pw + " " + ph + "] /Resources << /XObject << /I " + im + " 0 R >> >> /Contents " + c + " 0 R >>");
      const draw = "q " + pw + " 0 0 " + ph + " 0 0 cm /I Do Q";
      obj(c, "<< /Length " + draw.length + " >>", draw);
      obj(im, "<< /Type /XObject /Subtype /Image /Width " + j.w + " /Height " + j.h + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + j.bytes.length + " >>", j.bytes);
    });
    const xref = len, total = 3 + n * 3;
    let x = "xref\n0 " + total + "\n0000000000 65535 f \n";
    for (let i = 1; i < total; i++) x += String(offs[i]).padStart(10, "0") + " 00000 n \n";
    put(x + "trailer\n<< /Size " + total + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
    return new Blob(chunks, { type: "application/pdf" });
  };

  const jpeg = (cv) => new Promise((res) => cv.toBlob((b) => b.arrayBuffer().then((a) => res({ bytes: new Uint8Array(a), w: cv.width, h: cv.height })), "image/jpeg", 0.9));
  A.canvasFile = (cv, name) => new Promise((res) => cv.toBlob((b) => res(new File([b], name, { type: "image/jpeg" })), "image/jpeg", 0.92));
  A.carouselPdf = async function (t, net, sign, name) {
    const cvs = A.carouselCanvases(A.carouselPages(t), net, sign);
    const js = []; for (const cv of cvs) js.push(await jpeg(cv));
    return { file: new File([A.pdfFromJpegs(js)], name || "carrousel.pdf", { type: "application/pdf" }), cover: cvs[0].toDataURL("image/jpeg", 0.7), pages: cvs.length };
  };
})();

/* Une vidéo, trois textes : à partir du script (voix du storyboard) ou de la légende d'une vidéo, un fil pour X et un post LinkedIn. */
(function () {
  "use strict";
  const A = window.App, C = window.Core;
  const VIDEO = { reel: 1, video: 1 };
  function source(p) {
    const voice = ((p.prod && p.prod.shots) || []).map((x) => String(x.voice || "").trim()).filter(Boolean).join(" ");
    const cap = String(p.caption || "").trim();
    const tags = (cap.match(/(^|\s)#[\p{L}\p{N}_]+/gu) || []).map((x) => x.trim()).join(" ");
    return voice ? voice + (tags ? "\n\n" + tags : "") : cap;
  }
  // check = true : dit seulement si l'action a du sens pour ce post.
  A.textsFromVideo = function (p, check) {
    const vid = VIDEO[p.format] || (p.media || []).some((m) => m.type === "video");
    const src = source(p), nets = A.nets();
    const short = ["x", "bluesky", "threads", "mastodon"].find((n) => nets.includes(n));
    const long = nets.includes("linkedin") ? "linkedin" : null;
    if (check) return !!(vid && [...src].length > 40 && (short || long));
    const base = { ref: "", format: "text", date: null, time: null, captionValidated: false, manual: false, media: [], stage: "caption", status: "ready", from: p.id };
    if (p.series) base.series = p.series;
    const stamp = Date.now().toString(36), out = [];
    if (short) {
      const max = C.TEXT_MAX[short];
      const tags = (src.match(/(^|\s)#[\p{L}\p{N}_]+/gu) || []).map((x) => x.trim());
      const s2 = (src.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "").trim() + (tags.length ? "\n\n" + tags.slice(0, 2).join(" ") : "")).trim();
      const t = [...s2].length > max ? C.splitThread(s2, max) : s2;
      out.push(Object.assign({}, base, { id: "t" + stamp + "a", title: (C.isThread(t) ? (window.I18N && window.I18N.lang === "en" ? "Thread" : "Fil") : "Post") + " " + ((window.BRANDS[short] || {}).title || short) + (window.I18N && window.I18N.lang === "en" ? ": " : " : ") + p.title, networks: [short], caption: t }));
    }
    if (long) out.push(Object.assign({}, base, { id: "t" + stamp + "b", title: "LinkedIn : " + p.title, networks: ["linkedin"], caption: C.versionFor(src, "linkedin") }));
    return out;
  };
})();
