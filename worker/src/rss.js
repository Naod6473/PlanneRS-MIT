// Reprise d'un flux RSS ou Atom : chaque nouvel article devient un post à relire.
// Rien ne part tout seul : le post arrive sans date et sans validation, dans « Prêts à programmer ».
// Le premier passage sur un flux ne crée rien (il retient seulement ce qui existe déjà).
export const MAX_NEW = 5;   // posts créés au plus par flux et par passage
const KEEP_SEEN = 300;

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function text(s) {
  return String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => (ENT[n.toLowerCase()] != null ? ENT[n.toLowerCase()] : m)).replace(/\s+/g, " ").trim();
}
const tag = (xml, name) => { const m = new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i").exec(xml); return m ? m[1] : ""; };
const attr = (xml, name, a) => { const m = new RegExp("<" + name + "\\s[^>]*?\\b" + a + '\\s*=\\s*["\']([^"\']+)["\']', "i").exec(xml); return m ? m[1].replace(/&amp;/g, "&") : ""; };

// Lit un flux RSS 2.0 ou Atom. Renvoie { title, items: [{ id, title, link, date, image }] }, du plus récent au plus ancien.
export function parse(xml) {
  xml = String(xml || "");
  const atom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const blocks = xml.match(atom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) || [];
  const head = blocks.length ? xml.slice(0, xml.indexOf(blocks[0])) : xml;
  const items = blocks.map((b) => {
    let link = atom ? (attr(b, 'link[^>]*?rel=["\']alternate["\']', "href") || attr(b, "link", "href")) : text(tag(b, "link"));
    const title = text(tag(b, "title"));
    const id = text(tag(b, atom ? "id" : "guid")) || link || title;
    let image = attr(b, "media:content", "url") || attr(b, "media:thumbnail", "url");
    if (!image && /image\//i.test(attr(b, "enclosure", "type"))) image = attr(b, "enclosure", "url");
    if (!image) { const m = /<img[^>]+src=["']([^"']+)["']/i.exec(text0(tag(b, "content:encoded") || tag(b, "description") || tag(b, "content"))); if (m) image = m[1]; }
    const date = text(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date"));
    if (link && !/^https?:\/\//i.test(link)) link = "";
    return { id, title, link, date, image: /^https:\/\//i.test(image) ? image : "" };
  }).filter((i) => i.id && i.title);
  return { title: text(tag(head, "title")), items };
}
// Contenu d'un article : on enlève seulement l'enveloppe CDATA et les entités, pour y chercher une image.
function text0(s) { return String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&"); }

// items : articles du flux ; seen : identifiants déjà vus (undefined au premier passage).
// Renvoie { posts, seen } : les posts à créer et la nouvelle liste des identifiants vus.
export function toPosts(items, feed, seen, settings, stamp) {
  const ids = items.map((i) => i.id);
  if (!Array.isArray(seen)) return { posts: [], seen: ids.slice(0, KEEP_SEEN), first: true };
  const known = new Set(seen);
  const fresh = items.filter((i) => !known.has(i.id)).slice(0, MAX_NEW).reverse(); // du plus ancien au plus récent
  const nets = feed.networks && feed.networks.length ? feed.networks : [((settings && settings.networks) || ["instagram"])[0]];
  const posts = fresh.map((it, k) => {
    const media = it.image ? [{ name: decodeURIComponent(it.image.split("?")[0].split("/").pop() || "image").slice(0, 200), type: "image", url: it.image }] : [];
    return {
      id: "r" + (stamp || Date.now()).toString(36) + k, ref: "", title: it.title.slice(0, 200), format: media.length ? "image" : "text", networks: nets.slice(),
      date: null, time: null, caption: it.title + (it.link ? "\n\n" + it.link : ""), captionValidated: false, manual: false, media,
      stage: "ready", status: "ready", source: { rss: feed.url, link: it.link || undefined },
    };
  });
  return { posts, seen: fresh.map((i) => i.id).concat(seen).slice(0, KEEP_SEEN) };
}

// Passe sur tous les flux des réglages. deps : { fetch(url) -> texte, save(posts), log(entry), now }
// memo : { [url]: [identifiants vus] } ; renvoie { created, memo, errors }.
export async function run(feeds, memo, settings, deps) {
  const out = { created: 0, errors: 0, memo: {} };
  let n = 0;
  for (const feed of (feeds || []).filter((f) => f && /^https?:\/\//i.test(f.url || "") && f.enabled !== false)) {
    try {
      const r = toPosts(parse(await deps.fetch(feed.url)).items, feed, (memo || {})[feed.url], settings, Date.now() + n++);
      out.memo[feed.url] = r.seen;
      if (r.posts.length) {
        await deps.save(r.posts);
        for (const p of r.posts) await deps.log({ at: deps.now, level: "change", text: "Nouvel article repris du flux : " + p.title + ". À relire et programmer.", postId: p.id });
        out.created += r.posts.length;
      }
    } catch (e) {
      out.errors++; if ((memo || {})[feed.url]) out.memo[feed.url] = memo[feed.url];
      await deps.log({ at: deps.now, level: "error", text: "Flux illisible : " + feed.url, why: e.message });
    }
  }
  return out;
}
