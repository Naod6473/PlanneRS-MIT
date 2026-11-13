// Moteur de découpe (version privée, web/studio/cut.js) : blancs et « euh » sur une voix synthétique.
import test from "node:test";
import assert from "node:assert/strict";
import { analyse, plan, carve } from "../web/studio/cut.js";

const SR = 16000;
const VOWELS = [[300, 2300], [400, 2000], [550, 1800], [700, 1200], [500, 900], [320, 800], [450, 1600]];
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

// Voyelle : harmoniques pondérées par deux formants, hauteur qui glisse de f0a à f0b
function voiced(dur, f0a, f0b, f1, f2) {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  const mean = (f0a + f0b) / 2;
  let phase = 0, max = 1e-9;
  for (let i = 0; i < n; i++) {
    phase += (2 * Math.PI * (f0a + ((f0b - f0a) * i) / n)) / SR;
    let v = 0;
    for (let k = 1; k < 40 && k * mean < SR / 2 - 200; k++) {
      const fk = k * mean;
      const amp = [[f1, 90, 1], [f2, 130, 0.5], [2600, 200, 0.2]].reduce((a, [fc, bw, g]) => a + g / (1 + ((fk - fc) / bw) ** 2), 0);
      v += amp * Math.sin(k * phase);
    }
    const t = i / SR;
    out[i] = v * Math.min(1, t / 0.015) * Math.min(1, (dur - t) / 0.015);
    max = Math.max(max, Math.abs(out[i]));
  }
  return out.map((x) => (x / max) * 0.3);
}
function speech(seconds) {
  const parts = [];
  let total = 0;
  while (total < seconds) {
    const [f1, f2] = VOWELS[Math.floor(rnd() * VOWELS.length)];
    const a = 100 + rnd() * 80, dur = 0.08 + rnd() * 0.1;
    parts.push(voiced(dur, a, a * (0.8 + rnd() * 0.45), f1, f2));
    const burst = Math.round((0.02 + rnd() * 0.04) * SR);
    parts.push(Float32Array.from({ length: burst }, () => (rnd() - 0.5) * 0.1));
    total += dur + burst / SR;
  }
  return parts;
}
const quiet = (s) => [Float32Array.from({ length: Math.round(s * SR) }, () => (rnd() - 0.5) * 0.002)];
const join = (nested) => { const parts = nested.flat(); const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };

test("repère les blancs et l'« euh » tenu au milieu de la parole", () => {
  const before = join(speech(3));
  const x = join([quiet(0.8), [before], [voiced(0.5, 120, 114, 520, 1450)], speech(3), quiet(1.2), speech(2), quiet(0.6)]);
  const a = analyse([x], SR);
  assert.equal(a.segments.length, 2);
  assert.equal(a.hesitations.length, 1);
  const t0 = 0.8 + before.length / SR;
  assert.ok(Math.abs(a.hesitations[0][0] / SR - t0) < 0.12);
  const kept = plan(a);
  const dur = kept.reduce((n, p) => n + p.end - p.start, 0);
  assert.ok(dur < x.length / SR - 2, "au moins 2 s coupées");
  assert.equal(plan(a, { blanks: false, ums: false }).length, 1);
});

test("une parole continue n'a pas d'hésitation", () => {
  const a = analyse([join(speech(6))], SR);
  assert.deepEqual(a.hesitations, []);
});

test("carve coupe un passage en deux", () => {
  assert.deepEqual(carve([{ start: 0, end: 16000 }], [[4000, 8000]], SR), [{ start: 0, end: 4000 }, { start: 8000, end: 16000 }]);
});
