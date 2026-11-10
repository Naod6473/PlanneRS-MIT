import test from "node:test";
import assert from "node:assert/strict";
import { sign } from "../worker/src/storage/s3.js";
import * as s3 from "../worker/src/storage/s3.js";
import * as ghpages from "../worker/src/storage/ghpages.js";
import * as dropbox from "../worker/src/storage/dropbox.js";
import * as onedrive from "../worker/src/storage/onedrive.js";
import { parseMultistatus } from "../worker/src/storage/webdav.js";
import * as webdav from "../worker/src/storage/webdav.js";

const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
function route(table) {
  const calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url); calls.push({ url: u, opts });
    for (const [re, fn] of table) if (re.test(u) && (!fn.method || fn.method === (opts.method || "GET"))) return fn(u, opts);
    throw new Error("appel inattendu : " + (opts.method || "GET") + " " + u);
  };
  return calls;
}
const m = (method, fn) => Object.assign(fn, { method });

test("S3 : signature v4 conforme à la suite de tests AWS (get-vanilla)", async () => {
  const h = await sign({ method: "GET", url: "https://example.amazonaws.com/", payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    accessKeyId: "AKIDEXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY", region: "us-east-1", service: "service", amzDate: "20150830T123600Z" });
  assert.equal(h.authorization, "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31");
});

test("R2 : envoi d'un fichier et adresse publique", async () => {
  const calls = route([[/r2\.cloudflarestorage/, m("PUT", () => new Response("", { status: 200 }))]]);
  const url = await s3.put({ endpoint: "https://acc.r2.cloudflarestorage.com", bucket: "media", accessKeyId: "k", secretAccessKey: "s", publicBaseUrl: "https://media.ex.fr" }, "02_Sujets/004 SOC/reel.mp4", new Uint8Array([1]), "video/mp4");
  assert.equal(url, "https://media.ex.fr/media/02_Sujets/004%20SOC/reel.mp4");
  assert.match(calls[0].opts.headers.authorization, /^AWS4-HMAC-SHA256 Credential=k\/\d{8}\/auto\/s3\/aws4_request/);
});

test("GitHub Pages : adresse publique et mise à jour d'un fichier existant (sha)", async () => {
  assert.equal(ghpages.publicBase({ repo: "MonCompte/mes-medias" }), "https://moncompte.github.io/mes-medias/");
  assert.equal(ghpages.publicBase({ repo: "moi/moi.github.io" }), "https://moi.github.io/");
  const calls = route([[/contents\/media\/a\/b\.jpg\?ref=main/, () => J({ sha: "abc" })], [/contents\/media\/a\/b\.jpg$/, m("PUT", () => J({ content: {} }, 200))]]);
  const url = await ghpages.put({ token: "t", repo: "moi/site" }, "a/b.jpg", new Uint8Array([1, 2]), "image/jpeg");
  assert.equal(url, "https://moi.github.io/site/media/a/b.jpg");
  assert.equal(JSON.parse(calls[1].opts.body).sha, "abc");
});

test("Dropbox : jeton rafraîchi puis contenu du dossier", async () => {
  route([[/oauth2\/token/, () => J({ access_token: "A", expires_in: 14400 })],
    [/list_folder$/, () => J({ entries: [{ ".tag": "file", name: "reel.mp4", path_lower: "/mesmedias/02/reel.mp4", path_display: "/MesMedias/02/reel.mp4", size: 9 }, { ".tag": "folder", name: "x" }], has_more: false })]]);
  const d = await dropbox.folder({ appKey: "k", appSecret: "s", refreshToken: "r", root: "/MesMedias" }, "02");
  assert.equal(d.id, "/MesMedias/02");
  assert.deepEqual(d.files.map((f) => f.id), ["/mesmedias/02/reel.mp4"]);
});

test("OneDrive : le nouveau jeton de rafraîchissement est enregistré", async () => {
  route([[/oauth2\/v2\.0\/token/, () => J({ access_token: "A", refresh_token: "R2", expires_in: 3600 })],
    [/children/, () => J({ value: [{ id: "1", name: "a.jpg", size: 3, webUrl: "https://1drv/a", file: {} }, { id: "2", name: "dossier", folder: {} }] })],
    [/root:\/MesMedias\/02:$/, () => J({ id: "D", webUrl: "https://1drv/d", name: "02" })]]);
  let saved = null;
  const cred = { clientId: "c", refreshToken: "R1", root: "MesMedias" };
  const d = await onedrive.folder(cred, "02", async (c) => { saved = c.refreshToken; });
  assert.equal(saved, "R2");
  assert.deepEqual(d.files.map((f) => f.name), ["a.jpg"]);
});

test("WebDAV : lecture d'une réponse PROPFIND (Nextcloud)", async () => {
  const xml = '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>/remote.php/dav/files/moi/MesMedias/02/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>' +
    '<d:response><d:href>/remote.php/dav/files/moi/MesMedias/02/reel%20soc.mp4</d:href><d:propstat><d:prop><d:resourcetype/><d:getcontentlength>42</d:getcontentlength></d:prop></d:propstat></d:response></d:multistatus>';
  assert.deepEqual(parseMultistatus(xml).map((x) => [x.name, x.isDir, x.size]), [["02", true, 0], ["reel soc.mp4", false, 42]]);
  route([[/remote\.php/, m("PROPFIND", () => new Response(xml, { status: 207 }))]]);
  const d = await webdav.folder({ url: "https://cloud.ex/remote.php/dav/files/moi/", username: "moi", password: "p", root: "MesMedias" }, "02");
  assert.equal(d.files[0].id, "/remote.php/dav/files/moi/MesMedias/02/reel%20soc.mp4");
});

import * as gdw from "../worker/src/storage/gdrivewrite.js";
test("Drive (envoi) : crée le sous-dossier manquant puis envoie en reprise", async () => {
  const calls = [];
  globalThis.fetch = async (url, o = {}) => {
    const u = String(url); calls.push([o.method || "GET", u]);
    const J = (x, h) => new Response(JSON.stringify(x), { status: 200, headers: Object.assign({ "content-type": "application/json" }, h || {}) });
    if (u.includes("oauth2.googleapis.com/token")) return J({ access_token: "AT", expires_in: 3600 });
    if (u.includes("/drive/v3/files?q=") && decodeURIComponent(u).includes("name = '02_Sujets'")) return J({ files: [{ id: "S" }] });
    if (u.includes("/drive/v3/files?q=")) return J({ files: [] });
    if (u.includes("/drive/v3/files?supportsAllDrives=true&fields=id") && o.method === "POST") return J({ id: "NEW" });
    if (u.includes("uploadType=resumable")) { assert.equal(o.headers["x-upload-content-length"], "3"); assert.deepEqual(JSON.parse(o.body).parents, ["NEW"]); return new Response("", { status: 200, headers: { location: "https://up.example/session" } }); }
    if (u === "https://up.example/session") return J({ id: "F1", name: "a.mp4", webViewLink: "https://drive/F1" });
    throw new Error("inattendu " + u);
  };
  const r = await gdw.upload({ clientId: "c", clientSecret: "s", refreshToken: "r", rootFolderId: "ROOT" }, "02_Sujets/099_test", "a.mp4", new Uint8Array([1, 2, 3]).buffer, "video/mp4");
  assert.equal(r.id, "F1"); assert.equal(r.folderId, "NEW");
  assert.match(gdw.authUrl({ clientId: "c" }, "https://app.ex", "st"), /redirect_uri=https%3A%2F%2Fapp.ex%2Fapi%2Foauth%2Fgoogle%2Fcallback.*access_type=offline/);
});
