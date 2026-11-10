import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import * as gdrive from "../worker/src/storage/gdrive.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const sa = { client_email: "planners@test.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) };
const cred = { serviceAccount: JSON.stringify(sa), rootFolderId: "ROOT" };
const FOLDER = "application/vnd.google-apps.folder";
const tree = {
  ROOT: [{ id: "S", name: "02_Sujets", mimeType: FOLDER }],
  S: [{ id: "T", name: "004_SOC", mimeType: FOLDER }],
  T: [{ id: "R", name: "reel", mimeType: FOLDER }],
  R: [{ id: "f1", name: "reel-soc.mp4", mimeType: "video/mp4", size: "123", webViewLink: "https://drive.google.com/file/d/f1/view" }],
};

test("Drive : jeton signé RS256 puis dossier trouvé par son chemin", async () => {
  let assertion = null;
  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(url);
    if (u.host === "oauth2.googleapis.com") {
      assertion = new URLSearchParams(opts.body).get("assertion");
      return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
    }
    assert.equal(opts.headers.authorization, "Bearer tok");
    const parent = /'([^']+)' in parents/.exec(u.searchParams.get("q"))[1];
    return new Response(JSON.stringify({ files: tree[parent] || [] }), { status: 200 });
  };
  const d = await gdrive.folder(cred, "02_Sujets/004_SOC/reel");
  assert.equal(d.id, "R");
  assert.equal(d.files[0].name, "reel-soc.mp4");
  const [h, b, sig] = assertion.split(".");
  const claims = JSON.parse(Buffer.from(b, "base64url").toString());
  assert.equal(claims.iss, sa.client_email);
  assert.equal(claims.scope, "https://www.googleapis.com/auth/drive.readonly");
  const v = createVerify("RSA-SHA256"); v.update(h + "." + b);
  assert.ok(v.verify(publicKey, Buffer.from(sig, "base64url")));
  await assert.rejects(gdrive.folder(cred, "02_Sujets/inconnu"), /introuvable/);
});

test("Drive : clé illisible expliquée", async () => {
  await assert.rejects(gdrive.test({}, { serviceAccount: "pas du json", rootFolderId: "x" }), /illisible/);
});
