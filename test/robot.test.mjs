import { test } from "node:test";
import assert from "node:assert/strict";
import { runRobot, localNow } from "../worker/src/robot.js";

function setup(posts, adapters, extra = {}) {
  const saved = [], logs = [], notes = [];
  const deps = {
    posts, now: "2026-11-12T12:31", dryRun: false,
    settings: { rules: { noRetryRelay: true }, notify: { manualReminderMinutes: 15 } },
    adapters, cred: async () => ({ token: "t" }),
    save: async (ps) => saved.push(...ps), log: async (e) => logs.push(e), notify: async (n) => notes.push(n), ...extra,
  };
  return { deps, saved, logs, notes };
}
const post = (o) => ({ id: "p", title: "Test", networks: ["instagram", "facebook"], format: "reel", date: "2026-11-12", time: "12:30", status: "scheduled", captionValidated: true, manual: false, media: [{ url: "https://x/a.mp4" }], ...o });
const ok = { publish: async () => ({ status: "ok", url: "https://ok" }) };
const ko = (retryable = true) => ({ publish: async () => { const e = new Error("refus"); e.why = "raison"; e.retryable = retryable; throw e; } });

test("publie le principal puis le relais", async () => {
  const p = post();
  const { deps } = setup([p], { instagram: ok, facebook: ok });
  const s = await runRobot(deps);
  assert.equal(s.sent, 1);
  assert.equal(p.status, "published");
  assert.equal(p.results.facebook.status, "ok");
});

test("ne publie pas une légende non validée ni un post à la main", async () => {
  const a = post({ id: "a", captionValidated: false }), b = post({ id: "b", manual: true, time: "12:40" });
  const { deps, notes } = setup([a, b], { instagram: ok, facebook: ok });
  await runRobot(deps);
  assert.equal(a.status, "scheduled");
  assert.equal(b.status, "scheduled");
  assert.equal(notes[0].event, "manual"); // rappel 15 min avant
});

test("échec du principal : un nouvel essai, puis échec expliqué, relais non tenté", async () => {
  const p = post();
  const { deps, notes } = setup([p], { instagram: ko(), facebook: ok });
  await runRobot(deps);
  assert.equal(p.status, "scheduled");
  assert.equal(p.attempts, 1);
  await runRobot(deps);
  assert.equal(p.status, "failed");
  assert.equal(p.results.facebook.status, "skipped");
  assert.ok(p.failure.why);
  assert.equal(notes.at(-1).event, "failed");
});

test("échec du relais : pas de relance, post marqué à traiter", async () => {
  const p = post();
  const { deps } = setup([p], { instagram: ok, facebook: ko() });
  await runRobot(deps);
  assert.equal(p.status, "published");
  assert.equal(p.needsAttention, true);
  assert.match(p.failure.todo, /doublon/);
});

test("trop tard : signalé, pas envoyé", async () => {
  const p = post({ time: "04:00" });
  let called = false;
  const { deps } = setup([p], { instagram: { publish: async () => { called = true; return { status: "ok" }; } } });
  await runRobot(deps);
  assert.equal(called, false);
  assert.equal(p.status, "failed");
});

test("média pas prêt : reprise au passage suivant", async () => {
  const p = post();
  let n = 0;
  const ig = { publish: async (env, post, cred, job) => (n++ === 0 ? { status: "pending", job: { container: "c1" } } : (assert.equal(job.container, "c1"), { status: "ok" })) };
  const { deps } = setup([p], { instagram: ig, facebook: ok });
  await runRobot(deps);
  assert.equal(p.status, "scheduled");
  await runRobot(deps);
  assert.equal(p.status, "published");
});

test("mode simulation", async () => {
  const p = post();
  const { deps, logs } = setup([p], { instagram: ko(), facebook: ko() }, { dryRun: true });
  await runRobot(deps);
  assert.equal(p.status, "published");
  assert.match(logs[0].text, /Simulation/);
});

test("heure locale du fuseau", () => {
  assert.equal(localNow("Europe/Paris", new Date("2026-11-12T11:30:00Z")), "2026-11-12T12:30");
});

test("robot à l'arrêt : rien n'est touché", async () => {
  const p = post();
  const { deps } = setup([p], { instagram: ok, facebook: ok });
  deps.settings.rules.robotEnabled = false;
  const s = await runRobot(deps);
  assert.equal(s.off, true);
  assert.equal(p.status, "scheduled");
});

test("robot à l'arrêt : les rappels « à la main » partent quand même", async () => {
  const p = post({ manual: true, time: "12:40" });
  const { deps, notes } = setup([p], { instagram: ok, facebook: ok });
  deps.settings.rules.robotEnabled = false;
  const s = await runRobot(deps);
  assert.equal(s.reminded, 1);
  assert.equal(notes[0].event, "manual");
});

test("réseau non connecté : rappel à la main, pas d'échec du principal", async () => {
  const p = post({ networks: ["instagram", "linkedin"] });
  const { deps } = setup([p], { instagram: ok, linkedin: ok }, { cred: async (n) => (n === "linkedin" ? null : { token: "t" }) });
  await runRobot(deps);
  assert.equal(p.results.instagram.status, "ok");
  assert.equal(p.results.linkedin.status, "skipped");
  assert.equal(p.needsAttention, true);
});

test("média sans adresse publique : copie avant envoi, sinon échec expliqué", async () => {
  const p = post({ media: [{ name: "a.mp4" }] });
  const { deps } = setup([p], { instagram: ok, facebook: ok }, { ensurePublic: async (x) => { x.media[0].url = "https://pub/a.mp4"; } });
  await runRobot(deps);
  assert.equal(p.status, "published");
  const q = post({ media: [{ name: "a.mp4" }] });
  const e = Object.assign(new Error("x"), { why: "pas de stockage", retryable: false });
  const t = setup([q], { instagram: ok, facebook: ok }, { ensurePublic: async () => { throw e; } });
  await runRobot(t.deps);
  assert.equal(q.status, "failed");
  assert.match(q.failure.why, /pas de stockage/);
});

test("premier commentaire : posté après la publication, un refus ne casse rien", async () => {
  const seen = [];
  const withC = (fail) => ({ publish: async () => ({ status: "ok", id: "m1", url: "https://ok" }), comment: async (env, id, text) => { if (fail) throw new Error("droit manquant"); seen.push([id, text]); } });
  const p = post({ firstComment: "#pain #levain" });
  const { deps, logs } = setup([p], { instagram: withC(false), facebook: withC(true) });
  await runRobot(deps);
  assert.equal(p.status, "published");
  assert.deepEqual(seen, [["m1", "#pain #levain"]]);
  assert.equal(p.results.instagram.comment, true);
  assert.equal(p.results.facebook.comment, false);
  assert.ok(logs.some((l) => /Premier commentaire impossible sur Facebook/.test(l.text)));
});
