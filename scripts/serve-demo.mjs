// Sert l'interface seule, en mode démo, sur http://localhost:8787 (aucun serveur ni compte requis).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
const root = new URL("../web/", import.meta.url).pathname;
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm", ".mp4": "video/mp4", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".json": "application/json" };
createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  try {
    const file = join(root, path.endsWith("/") ? path + "index.html" : path);
    if (!file.startsWith(root)) throw new Error();
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" }); res.end(body);
  } catch { res.writeHead(404); res.end("Introuvable"); }
}).listen(8787, () => console.log("Démo : http://localhost:8787/?demo"));
