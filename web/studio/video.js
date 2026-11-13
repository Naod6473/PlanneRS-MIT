// Vidéo : lecture des MP4 et MOV et export de la version sans les blancs, dans le navigateur (WebCodecs).
// Repris du moteur d'Autocut (web/static/video.js), sans les sous-titres incrustés, GIF ni fichiers de montage.

import { createFile, MP4BoxBuffer, DataStream, Log } from "./vendor/mp4box.esm.js";
import { Muxer, ArrayBufferTarget, FileSystemWritableFileStreamTarget } from "./vendor/mp4-muxer.esm.js";
import { drawCaption } from "./captions.js";

export const isVideoFile = (f) => /\.(mp4|m4v|mov|webm|mkv)$/i.test(f.name) || /^video\//.test(f.type || "");
const isMp4 = (f) => /\.(mp4|m4v|mov)$/i.test(f.name) || /^video\/(mp4|quicktime)/.test(f.type || "");

Log.setLogLevel(Log.error); // pas d'avertissements dans la console pour les boîtes inconnues

export const AUDIO_RATE = 48000; // le son des vidéos exportées : 48 kHz stéréo, la norme en montage

// --- Lecture du conteneur ----------------------------------------------------------

// Images par seconde courantes, pour reconnaître le NTSC (29,97 = 30 000 / 1 001)
const NTSC = [23.976, 29.97, 59.94, 119.88];

function frameRate(samples, timescale) {
  const durs = samples.slice(0, 600).map((s) => s.duration).filter((d) => d > 0).sort((a, b) => a - b);
  if (!durs.length) return { fps: 30, ntsc: false };
  const raw = timescale / durs[Math.floor(durs.length / 2)];
  const ntsc = NTSC.find((f) => Math.abs(raw - f) < 0.01);
  if (ntsc) return { fps: Math.round(ntsc) * 1000 / 1001, base: Math.round(ntsc), ntsc: true };
  const round = Math.round(raw);
  return Math.abs(raw - round) < 0.01 ? { fps: round, base: round, ntsc: false } : { fps: raw, base: round, ntsc: false };
}

// Rotation (téléphones) lue dans la matrice de la piste : 0, 90, 180 ou 270 degrés
function rotationOf(matrix) {
  if (!matrix || matrix.length < 4) return 0;
  const deg = Math.round((Math.atan2(matrix[1], matrix[0]) * 180) / Math.PI);
  return [0, 90, 180, 270].find((r) => r === ((deg % 360) + 360) % 360) || 0;
}

// Description du flux (avcC, hvcC, av1C) attendue par VideoDecoder
function descriptionOf(trak) {
  for (const entry of trak.mdia.minf.stbl.stsd.entries) {
    const box = entry.avcC || entry.hvcC || entry.av1C;
    if (box) {
      const stream = new DataStream();
      box.write(stream);
      return new Uint8Array(stream.buffer, 8); // sans l'en-tête de la boîte
    }
  }
  return undefined;
}

// Décalage de la liste de montage (edts) : le temps de présentation 0 de la vidéo, comme le lit le navigateur
function editOffset(trak, movieTimescale, timescale) {
  let delay = 0;
  for (const e of (trak.edts && trak.edts.elst && trak.edts.elst.entries) || []) {
    if (e.media_time === -1) delay += e.segment_duration / movieTimescale;
    else return { mediaTime: e.media_time / timescale, delay };
  }
  return null;
}

// Analyse un MP4 ou un MOV : taille, cadence, et table des images (position dans le fichier, temps).
// Renvoie null pour les autres formats ou un fichier sans image.
export async function probe(file) {
  if (!isMp4(file)) return null;
  const mp4 = createFile();
  let info = null;
  let failed = false;
  mp4.onReady = (i) => { info = i; };
  mp4.onError = () => { failed = true; };
  const CHUNK = 4 << 20;
  let offset = 0;
  // appendBuffer donne la position du prochain octet utile : on saute ainsi les données (mdat) avant le sommaire (moov)
  for (let guard = 0; offset < file.size && guard < 100000; guard++) {
    const ab = await file.slice(offset, offset + CHUNK).arrayBuffer();
    const next = mp4.appendBuffer(MP4BoxBuffer.fromArrayBuffer(ab, offset), offset + ab.byteLength >= file.size);
    if (failed) return null;
    if (info && !info.isFragmented) break;
    offset = next > offset ? next : offset + ab.byteLength;
  }
  mp4.flush();
  if (!info || !info.videoTracks.length) return null;
  const track = info.videoTracks[0];
  const trak = mp4.getTrackById(track.id);
  const timescale = track.timescale;
  const raw = trak.samples || [];
  if (!raw.length) return null;
  const edit = editOffset(trak, info.timescale, timescale);
  const zero = edit ? edit.mediaTime : Math.min(...raw.slice(0, 64).map((s) => s.cts)) / timescale;
  const delay = edit ? edit.delay : 0;
  // Temps de présentation de chaque image, en secondes, dans l'ordre de décodage
  const samples = raw.map((s) => ({
    offset: s.offset, size: s.size, sync: !!s.is_sync,
    time: s.cts / timescale - zero + delay, duration: s.duration / timescale,
  }));
  const rate = frameRate(raw, timescale);
  const width = (track.video && track.video.width) || track.track_width;
  const height = (track.video && track.video.height) || track.track_height;
  const bytes = samples.reduce((n, s) => n + s.size, 0);
  const duration = Math.max(...samples.map((s) => s.time + s.duration));
  return {
    codec: track.codec, width, height, rotation: rotationOf(track.matrix), ...rate,
    duration, bitrate: Math.round((bytes * 8) / Math.max(0.1, duration)),
    description: descriptionOf(trak), samples, hasAudio: info.audioTracks.length > 0,
  };
}

// Durée d'une vidéo d'après son sommaire, sinon d'après le lecteur du navigateur (WebM, MKV)
export async function durationOf(file, info) {
  if (info) return info.duration;
  const el = document.createElement("video");
  el.preload = "metadata";
  el.muted = true;
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve) => {
      const done = () => resolve(Number.isFinite(el.duration) ? el.duration : 0);
      el.onerror = () => resolve(0);
      el.onloadedmetadata = () => {
        if (Number.isFinite(el.duration)) return done();
        // Les enregistrements WebM n'annoncent pas leur durée : on la trouve en allant tout au bout
        el.ondurationchange = done;
        el.currentTime = 1e9;
      };
      el.src = url;
      setTimeout(done, 10000);
    });
  } finally {
    el.removeAttribute("src");
    URL.revokeObjectURL(url);
  }
}

// --- Encodage ------------------------------------------------------------------------

export function webCodecs() {
  return typeof VideoDecoder !== "undefined" && typeof VideoEncoder !== "undefined" && typeof AudioEncoder !== "undefined";
}

const even = (n) => Math.max(2, Math.round(n / 2) * 2);

// H.264 et AAC d'abord (lus partout, y compris par les logiciels de montage), sinon VP9 ou AV1 et Opus
async function pickVideo(width, height, fps, bitrate) {
  const tries = [
    { codec: "avc1.640033", mux: "avc", avc: { format: "avc" } },
    { codec: "avc1.4d0033", mux: "avc", avc: { format: "avc" } },
    { codec: "avc1.42003e", mux: "avc", avc: { format: "avc" } },
    { codec: "vp09.00.50.08", mux: "vp9" },
    { codec: "av01.0.08M.08", mux: "av1" },
  ];
  for (const t of tries) {
    const config = { codec: t.codec, width, height, bitrate, framerate: fps, ...(t.avc ? { avc: t.avc } : {}) };
    try {
      if ((await VideoEncoder.isConfigSupported(config)).supported) return { config, mux: t.mux };
    } catch { /* codec inconnu de ce navigateur */ }
  }
  return null;
}

async function pickAudio() {
  for (const t of [{ codec: "mp4a.40.2", mux: "aac", bitrate: 192000 }, { codec: "opus", mux: "opus", bitrate: 160000 }]) {
    const config = { codec: t.codec, sampleRate: AUDIO_RATE, numberOfChannels: 2, bitrate: t.bitrate };
    try {
      if ((await AudioEncoder.isConfigSupported(config)).supported) return { config, mux: t.mux };
    } catch { /* codec inconnu de ce navigateur */ }
  }
  return null;
}

// Ce navigateur sait-il décoder cette vidéo et en écrire une ? Renvoie la raison sinon.
export async function canExport(v) {
  if (!webCodecs()) return "webcodecs";
  try {
    const ok = await VideoDecoder.isConfigSupported({ codec: v.codec, codedWidth: v.width, codedHeight: v.height, description: v.description });
    if (!ok.supported) return "decode";
  } catch {
    return "decode";
  }
  if (!(await pickVideo(even(v.width), even(v.height), v.fps, 2e6)) || !(await pickAudio())) return "encode";
  return "";
}

const tick = () => new Promise((r) => setTimeout(r, 0));

// Lit les données d'une suite d'images du fichier, par blocs de quelques Mo
async function* readSamples(file, list) {
  const MAX = 16 << 20;
  for (let i = 0; i < list.length;) {
    let j = i;
    let lo = list[i].offset;
    let hi = lo + list[i].size;
    while (j + 1 < list.length) {
      const s = list[j + 1];
      const nlo = Math.min(lo, s.offset);
      const nhi = Math.max(hi, s.offset + s.size);
      if (nhi - nlo > MAX) break;
      [lo, hi] = [nlo, nhi];
      j++;
    }
    const buf = new Uint8Array(await file.slice(lo, hi).arrayBuffer());
    for (let k = i; k <= j; k++) yield { s: list[k], data: buf.subarray(list[k].offset - lo, list[k].offset - lo + list[k].size) };
    i = j + 1;
  }
}

// Images d'un passage [start, end[ : celles à décoder (depuis l'image clé qui précède) et celles à garder
function planPiece(v, start, end) {
  let firstIdx = -1;
  let lastIdx = -1;
  let first = Infinity;
  let stop = 0;
  let count = 0;
  v.samples.forEach((s, i) => {
    if (s.time < start - 1e-6 || s.time >= end - 1e-6) return;
    if (firstIdx < 0) firstIdx = i;
    lastIdx = i;
    first = Math.min(first, s.time);
    stop = Math.max(stop, s.time + (s.duration || 1 / v.fps));
    count++;
  });
  if (!count) return null;
  // Depuis une image clé affichée avant le passage (les images B d'un GOP ouvert dépendent du précédent)
  let from = firstIdx;
  while (from > 0 && (!v.samples[from].sync || v.samples[from].time > first + 1e-6)) from--;
  // Jusqu'à la dernière image gardée dans l'ordre de décodage, plus quelques-unes pour les images B
  const to = Math.min(v.samples.length - 1, lastIdx + 4);
  return { first, duration: stop - first, decode: v.samples.slice(from, to + 1), count, start, end };
}

// Recadrage : rectangle à garder dans l'image codée (avant rotation), pour un rapport largeur / hauteur
// `aspect` à l'affichage (9 / 16 vertical, 1 carré). `pos` de 0 (gauche ou haut) à 1 (droite ou bas).
export function cropRect(v, aspect, pos = 0.5) {
  if (!aspect) return null;
  const turned = v.rotation % 180 !== 0;
  const [dw, dh] = turned ? [v.height, v.width] : [v.width, v.height];
  let [x, y, w, h] = [0, 0, dw, dh];
  if (dw / dh > aspect) {
    w = Math.round(dh * aspect);
    x = Math.round((dw - w) * pos);
  } else {
    h = Math.round(dw / aspect);
    y = Math.round((dh - h) * pos);
  }
  // Du repère affiché vers le repère codé
  let r;
  if (v.rotation === 90) r = { x: y, y: v.height - x - w, width: h, height: w };
  else if (v.rotation === 180) r = { x: v.width - x - w, y: v.height - y - h, width: w, height: h };
  else if (v.rotation === 270) r = { x: v.width - y - h, y: x, width: h, height: w };
  else r = { x, y, width: w, height: h };
  // Valeurs paires (sous-échantillonnage des couleurs 4:2:0), dans l'image
  const fix = (n) => Math.max(0, Math.floor(n / 2) * 2);
  r = { x: fix(r.x), y: fix(r.y), width: Math.max(2, fix(r.width)), height: Math.max(2, fix(r.height)) };
  r.width = Math.min(r.width, fix(v.width - r.x));
  r.height = Math.min(r.height, fix(v.height - r.y));
  return r;
}

// Décode les images d'un passage et appelle `onFrame(frame, t)` pour chacune de celles qui y sont, dans l'ordre.
// L'image est fermée après l'appel. `busy()` dit s'il faut attendre avant de décoder la suite.
async function decodePlan(file, v, plan, onFrame, busy = () => false) {
  let error = null;
  const dec = new VideoDecoder({
    output: (frame) => {
      const t = frame.timestamp / 1e6;
      try {
        if (t >= plan.start - 1e-6 && t < plan.end - 1e-6) onFrame(frame, t);
      } catch (e) {
        error = error || e;
      }
      frame.close();
    },
    error: (e) => { error = error || e; },
  });
  dec.configure({ codec: v.codec, codedWidth: v.width, codedHeight: v.height, description: v.description });
  try {
    for await (const { s, data } of readSamples(file, plan.decode)) {
      if (error) throw error;
      while (dec.decodeQueueSize > 12 || busy()) await tick();
      dec.decode(new EncodedVideoChunk({ type: s.sync ? "key" : "delta", timestamp: Math.round(s.time * 1e6), duration: Math.round(s.duration * 1e6), data }));
    }
    await dec.flush();
    if (error) throw error;
  } finally {
    if (dec.state !== "closed") dec.close();
  }
}

// Image décodée (et recadrée) redressée sur une toile, avec les sous-titres par-dessus : pour incruster
// du texte, l'image doit être à l'endroit (la rotation des MOV de téléphone ne s'applique plus après).
function painter(v, src, groups, style = {}) {
  // `src` : rectangle de départ (il fixe la taille) ; frame() peut en recevoir un autre de même taille.
  const turned = v.rotation % 180 !== 0;
  const [w, h] = turned ? [even(src.height), even(src.width)] : [even(src.width), even(src.height)];
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  return {
    width: w, height: h,
    frame(frame, t, init, r = src) {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate((v.rotation * Math.PI) / 180);
      const [bw, bh] = turned ? [h, w] : [w, h];
      ctx.drawImage(frame, r.x, r.y, r.width, r.height, -bw / 2, -bh / 2, bw, bh);
      ctx.restore();
      drawCaption(ctx, w, h, groups, t, style);
      return new VideoFrame(canvas, init);
    },
  };
}

// Son à 48 kHz stéréo envoyé à l'encodeur par blocs d'une seconde, à partir de `startUs` dans la vidéo
async function encodeAudio(aenc, channels, frames, startUs) {
  const left = fitLength(channels[0], frames);
  const right = fitLength(channels[1] || channels[0], frames);
  for (let k = 0; k < frames; k += AUDIO_RATE) {
    const n = Math.min(AUDIO_RATE, frames - k);
    const planar = new Float32Array(n * 2);
    planar.set(left.subarray(k, k + n), 0);
    planar.set(right.subarray(k, k + n), n);
    const data = new AudioData({
      format: "f32-planar", sampleRate: AUDIO_RATE, numberOfFrames: n, numberOfChannels: 2,
      timestamp: Math.round(startUs + (k / AUDIO_RATE) * 1e6), data: planar,
    });
    aenc.encode(data);
    data.close();
    while (aenc.encodeQueueSize > 12) await tick();
  }
}

// Écrit un MP4 avec les passages `pieces` ([{ start, end }] en secondes) mis bout à bout.
// `audioFor(piece)` renvoie le son du passage : canaux Float32Array à 48 kHz, de la durée exacte du passage.
// `crop` : rectangle de cropRect, ou null pour l'image entière, ou une fonction (t en secondes dans la
// vidéo d'origine) qui renvoie un rectangle de même taille à chaque image (cadre qui suit la personne).
// `captions` : groupes de captionGroups (temps de la vidéo exportée) à incruster, ou null.
// `writable` : fichier ouvert en écriture (FileSystemWritableFileStream) où la vidéo s'écrit au fil de l'eau ;
// la fonction renvoie alors true au lieu d'un Blob, et rien ne reste en mémoire.
export async function renderVideo(file, v, pieces, audioFor, onProgress = () => {}, { crop = null, captions = null, captionStyle = {}, writable = null } = {}) {
  const cropAt = typeof crop === "function" ? crop : () => crop;
  crop = cropAt(pieces.length ? pieces[0].start : 0);
  const src = crop || { x: 0, y: 0, width: v.width, height: v.height };
  const paint = captions && captions.length ? painter(v, src, captions, captionStyle) : null;
  const width = paint ? paint.width : crop ? crop.width : even(v.width);
  const height = paint ? paint.height : crop ? crop.height : even(v.height);
  const area = (src.width * src.height) / (v.width * v.height);
  const bitrate = Math.max(1e6, Math.min(50e6, v.bitrate * 1.15 * Math.max(0.35, area)));
  const vc = await pickVideo(width, height, v.fps, bitrate);
  const ac = await pickAudio();
  if (!vc || !ac) throw new Error("encode");
  const plans = pieces.map((p) => planPiece(v, p.start, p.end)).filter(Boolean);
  const total = plans.reduce((n, p) => n + p.count, 0);
  if (!total) return null;
  const target = writable ? new FileSystemWritableFileStreamTarget(writable) : new ArrayBufferTarget();
  const muxer = new Muxer({
    target, fastStart: !writable && total < 3000 ? "in-memory" : false, firstTimestampBehavior: "offset",
    video: { codec: vc.mux, width, height, rotation: paint ? 0 : v.rotation, frameRate: v.fps },
    audio: { codec: ac.mux, numberOfChannels: 2, sampleRate: AUDIO_RATE },
  });
  let error = null;
  const fail = (e) => { error = error || e; };
  const venc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: fail });
  venc.configure(vc.config);
  const aenc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: fail });
  aenc.configure(ac.config);

  let outStart = 0; // début du passage dans la vidéo exportée (µs)
  let done = 0;
  let lastKey = -Infinity;
  const frameUs = Math.round(1e6 / v.fps);
  try {
    for (const plan of plans) {
      let first = true;
      await decodePlan(file, v, plan, (frame, t) => {
        if (done >= total) return;
        const ts = Math.round(outStart + (t - plan.first) * 1e6);
        const init = { timestamp: ts, duration: frameUs };
        const r = crop ? cropAt(t) : null;
        const out = paint ? paint.frame(frame, ts / 1e6, init, r || src) : new VideoFrame(frame, { ...init, ...(r ? { visibleRect: r } : {}) });
        // Une image clé au début de chaque passage et toutes les 2 secondes
        const key = first || ts - lastKey >= 2e6;
        if (key) lastKey = ts;
        first = false;
        venc.encode(out, { keyFrame: key });
        out.close();
        onProgress(++done / total);
      }, () => venc.encodeQueueSize > 12 || !!error);
      if (error) throw error;
      // Son du passage, de la même durée que ses images
      await encodeAudio(aenc, await audioFor(plan), Math.round(plan.duration * AUDIO_RATE), outStart);
      outStart += Math.round(plan.duration * 1e6);
    }
    await venc.flush();
    await aenc.flush();
  } finally {
    if (venc.state !== "closed") venc.close();
    if (aenc.state !== "closed") aenc.close();
  }
  if (error) throw error;
  muxer.finalize();
  return writable ? true : new Blob([target.buffer], { type: "video/mp4" });
}

function fitLength(data, frames) {
  if (data.length === frames) return data;
  const out = new Float32Array(frames);
  out.set(data.subarray(0, frames));
  return out;
}
