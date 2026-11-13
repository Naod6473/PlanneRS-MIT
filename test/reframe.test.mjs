// Vertical qui suit la personne (web/studio/reframe.js) : choix de la personne, trajet lissé, position du cadre.
import test from "node:test";
import assert from "node:assert/strict";
import { pickBox, smoothPath, xAt, posFor, sampleTimes } from "../web/studio/reframe.js";
import { cropRect } from "../web/studio/video.js";

const box = (x0, x1, score = 0.9) => ({ score, x0, y0: 0.1, x1, y1: 0.9 });

test("pickBox : la plus grande personne, sans sauter vers une autre", () => {
  assert.equal(pickBox([]), null);
  assert.equal(pickBox([box(0.1, 0.2), box(0.5, 0.8)]), 0.65);
  assert.equal(pickBox([box(0.1, 0.4), box(0.6, 0.92)], 0.25), 0.25); // reste sur la personne suivie
  assert.equal(pickBox([box(0.1, 0.4, 0.3)]), null); // trop incertain
});

test("smoothPath : trous comblés, erreur isolée ignorée, petits mouvements sans effet", () => {
  assert.equal(smoothPath([{ t: 0, x: null }]), null);
  const xs = [null, 0.3, 0.31, 0.29, 0.9, 0.3, 0.32, 0.3, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7];
  const p = smoothPath(xs.map((x, i) => ({ t: i / 2, x })));
  assert.equal(p.length, xs.length);
  assert.ok(p.slice(0, 8).every((q) => Math.abs(q.x - 0.3) < 1e-9), "immobile malgré l'erreur à 0,9 et les petits écarts");
  assert.ok(p[9].x > 0.3 && p[9].x < 0.7, "rejoint la personne en douceur");
  assert.ok(Math.abs(p[15].x - 0.7) < 0.05);
  for (let i = 1; i < p.length; i++) assert.ok(p[i].x >= p[i - 1].x - 1e-9);
});

test("xAt, posFor, sampleTimes", () => {
  const path = [{ t: 0, x: 0.2 }, { t: 1, x: 0.4 }];
  assert.equal(xAt(path, -1), 0.2); assert.ok(Math.abs(xAt(path, 0.5) - 0.3) < 1e-9); assert.equal(xAt(path, 9), 0.4); assert.equal(xAt(null, 1), 0.5);
  assert.equal(posFor(0.5, 0.3), 0.5); assert.equal(posFor(0.05, 0.3), 0); assert.equal(posFor(0.99, 0.3), 1); assert.equal(posFor(0.3, 1), 0.5);
  assert.deepEqual(sampleTimes([{ start: 0, end: 1.2 }, { start: 5, end: 6 }]), [0, 0.5, 1, 5, 5.5]);
  assert.ok(sampleTimes([{ start: 0, end: 3600 }]).length <= 241);
});

test("cadre qui suit : même taille partout, centré sur la personne, dans l'image", () => {
  const v = { width: 1920, height: 1080, rotation: 0 };
  const frac = (1080 * 9) / 16 / 1920;
  const at = (x) => cropRect(v, 9 / 16, posFor(x, frac));
  const a = at(0.2), b = at(0.8), c = at(0);
  assert.equal(a.width, b.width); assert.equal(a.height, 1080);
  assert.ok(Math.abs(a.x + a.width / 2 - 0.2 * 1920) < 4);
  assert.ok(Math.abs(b.x + b.width / 2 - 0.8 * 1920) < 4);
  assert.equal(c.x, 0); assert.ok(at(1).x + at(1).width <= 1920);
  assert.ok([a.x, b.x].every((n) => n % 2 === 0));
});
