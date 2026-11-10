// Construit docs/index.json (titre, description, catégorie, tags, chemin, intertitres de chaque page)
// et vérifie l'en-tête de chaque page ainsi que tous les liens internes.
// Usage : npm run docs:index        (écrit docs/index.json)
//         npm run docs:index -- --check   (vérifie seulement, sans écrire)
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "docs");
export const CATEGORIES = ["Sommaire", "Démarrage", "Utilisation", "Réseaux sociaux", "Stockage", "Notifications", "Référence"];
const REQUIRED = ["title", "description", "category", "tags", "order", "updated"];

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : n.endsWith(".md") ? [p] : [];
  });
}

// En-tête YAML simple : « clé: valeur », valeurs entre crochets pour les listes.
export function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (!kv) continue;
    let v = kv[2].trim();
    if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
    else if (/^".*"$/.test(v)) v = v.slice(1, -1);
    else if (/^\d+$/.test(v)) v = Number(v);
    out[kv[1]] = v;
  }
  return { data: out, body: text.slice(m[0].length) };
}

// Ancre façon GitHub : minuscules, accents gardés, ponctuation retirée, espaces en tirets.
export function slug(h) {
  return h.trim().toLowerCase().replace(/[`*_]/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s/g, "-");
}

function headings(body) {
  const out = [];
  let fence = false;
  for (const line of body.split("\n")) {
    if (/^```/.test(line)) fence = !fence;
    if (fence) continue;
    const m = line.match(/^(#{1,4})\s+(.+?)\s*#*$/);
    if (m) out.push({ level: m[1].length, text: m[2].replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"), anchor: slug(m[2].replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")) });
  }
  return out;
}

export function build() {
  const files = walk(ROOT).sort();
  const pages = [], errors = [];
  const anchors = new Map();
  for (const f of files) {
    const rel = relative(ROOT, f).split(sep).join("/");
    const fm = frontmatter(readFileSync(f, "utf8"));
    if (!fm) { errors.push(rel + " : en-tête YAML manquant"); continue; }
    for (const k of REQUIRED) if (fm.data[k] === undefined || fm.data[k] === "") errors.push(rel + " : champ « " + k + " » manquant");
    if (fm.data.category && !CATEGORIES.includes(fm.data.category)) errors.push(rel + " : catégorie inconnue « " + fm.data.category + " »");
    if (fm.data.tags && !Array.isArray(fm.data.tags)) errors.push(rel + " : « tags » doit être une liste [a, b]");
    if (fm.data.updated && !/^\d{4}-\d{2}-\d{2}$/.test(fm.data.updated)) errors.push(rel + " : « updated » au format AAAA-MM-JJ");
    const hs = headings(fm.body);
    anchors.set(rel, new Set(hs.map((h) => h.anchor)));
    pages.push({ path: rel, title: fm.data.title, description: fm.data.description, category: fm.data.category, tags: fm.data.tags || [], order: fm.data.order, updated: fm.data.updated, headings: hs.filter((h) => h.level > 1).map(({ level, text, anchor }) => ({ level, text, anchor })), body: fm.body });
  }
  // Liens internes : le fichier doit exister, et l'ancre aussi pour une page Markdown.
  for (const p of pages) {
    let fence = false;
    for (const line of p.body.split("\n")) {
      if (/^```/.test(line)) fence = !fence;
      if (fence) continue;
      for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) {
        const href = m[1];
        if (/^(https?:|mailto:)/.test(href)) continue;
        const [file, hash] = href.split("#");
        const target = file ? relative(ROOT, resolve(ROOT, dirname(p.path), file)).split(sep).join("/") : p.path;
        if (file && target !== "index.json" && !existsSync(join(ROOT, target))) { errors.push(p.path + " : lien cassé vers " + href); continue; }
        if (hash && target.endsWith(".md") && anchors.has(target) && !anchors.get(target).has(decodeURIComponent(hash))) errors.push(p.path + " : ancre introuvable " + href);
      }
    }
  }
  const order = (c) => { const i = CATEGORIES.indexOf(c); return i < 0 ? 99 : i; };
  pages.sort((a, b) => order(a.category) - order(b.category) || (a.order || 0) - (b.order || 0) || a.path.localeCompare(b.path));
  const index = {
    generated: "npm run docs:index",
    categories: [...new Set(pages.map((p) => p.category))],
    pages: pages.map(({ body, ...rest }) => rest),
  };
  return { index, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { index, errors } = build();
  if (errors.length) { console.error("Documentation : " + errors.length + " problème(s)\n- " + errors.join("\n- ")); process.exit(1); }
  if (!process.argv.includes("--check")) writeFileSync(join(ROOT, "index.json"), JSON.stringify(index, null, 2) + "\n");
  console.log(index.pages.length + " pages, " + index.categories.length + " catégories, liens OK.");
}
