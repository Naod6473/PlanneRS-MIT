// Construit dist/demo.html : l'interface en un seul fichier, en mode démo (pratique pour une présentation).
// Option : node scripts/build-demo.mjs données.json  → remplace les données fictives par un export.
import { readFile, writeFile, mkdir } from "node:fs/promises";
const web = new URL("../web/", import.meta.url);
let html = await readFile(new URL("index.html", web), "utf8");
const css = await readFile(new URL("css/app.css", web), "utf8");
html = html.replace(/<link rel="(icon|manifest)"[^>]*>\n?/g, "").replace('<link rel="stylesheet" href="css/app.css">', () => "<style>\n" + css + "\n</style>");
const logo = (await readFile(new URL("img/logo.png", web))).toString("base64");
html = html.replace('src="img/logo.png"', () => 'src="data:image/png;base64,' + logo + '"');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
let js = "window.PLANNERS_FORCE_DEMO = true;\n";
const data = process.argv[2];
for (const s of scripts) js += (await readFile(new URL(s, web), "utf8")) + "\n";
const dataTxt = data ? await readFile(data, "utf8") : "";
if (data) js = js.replace("window.PLANNERS_FORCE_DEMO = true;", () => "window.PLANNERS_FORCE_DEMO = true;\nwindow.PLANNERS_DEMO_DATA = " + dataTxt.replace(/<\//g, "<\\/") + ";");
html = html.replace(/(<script src="[^"]+"><\/script>\n?)+/, () => "<script>\n" + js.replace(/<\/script/gi, "<\\/script") + "\n</script>\n");
await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
await writeFile(new URL("../dist/demo.html", import.meta.url), html);
console.log("dist/demo.html écrit (" + Math.round(html.length / 1024) + " Ko)");
