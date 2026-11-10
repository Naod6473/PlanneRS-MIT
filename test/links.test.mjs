// Vérification des liens des légendes.
import test from "node:test";
import assert from "node:assert/strict";
import { extract, checkPost } from "../worker/src/links.js";

test("liens : extraction, pannes réelles seulement", async () => {
  assert.deepEqual(extract("Lis https://a.test/x. Et (https://b.test/y) puis https://a.test/x"), ["https://a.test/x", "https://b.test/y"]);
  const codes = { "https://ok.test/": 200, "https://mort.test/": 404, "https://robot.test/": 403, "https://head.test/": 405 };
  const f = async (u, o) => { if (u === "https://down.test/") throw new Error("dns"); if (u === "https://head.test/" && o.method === "GET") return { status: 200 }; return { status: codes[u] }; };
  const bad = await checkPost({ caption: "https://ok.test/ https://mort.test/ https://robot.test/ https://head.test/", firstComment: "https://down.test/" }, f);
  assert.deepEqual(bad.map((b) => b.url), ["https://mort.test/", "https://down.test/"]);
});
