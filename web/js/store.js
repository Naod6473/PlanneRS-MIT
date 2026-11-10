/* PlanneRs : accès aux données. Mode « api » (serveur Cloudflare) ou « demo » (navigateur seul). */
(function () {
  "use strict";
  const KEY = "planners-demo-v1" + (window.PLANNERS_DEMO_VERSION || "");
  const fresh = () => (window.PLANNERS_DEMO_DATA ? JSON.parse(JSON.stringify(window.PLANNERS_DEMO_DATA)) : window.makeDemo());
  const S = {
    mode: "demo",
    state: { posts: [], log: [], accounts: {}, settings: {} },

    async init() {
      const forceDemo = window.PLANNERS_FORCE_DEMO || /[?&]demo\b/.test(location.search);
      if (!forceDemo && /^https?:$/.test(location.protocol)) {
        try {
          const r = await fetch("api/state", { headers: { accept: "application/json" } });
          if (r.ok && (r.headers.get("content-type") || "").includes("json")) {
            this.state = await r.json();
            this.mode = "api";
            return;
          }
        } catch (e) { /* pas de serveur : démo */ }
      }
      this.mode = "demo";
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { saved = null; }
      this.state = saved && saved.posts ? saved : fresh();
    },

    persist() {
      if (this.mode !== "demo") return;
      try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { /* stockage indisponible */ }
    },

    resetDemo() {
      try { localStorage.removeItem(KEY); } catch (e) { /* rien */ }
      this.state = fresh();
    },

    post(id) { return this.state.posts.find((p) => p.id === id); },

    async call(method, path, body) {
      const r = await fetch("api/" + path, {
        method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
      });
      if (!r.ok) throw new Error((await r.text()) || r.statusText);
      return r.headers.get("content-type")?.includes("json") ? r.json() : null;
    },

    // Enregistre un ou plusieurs posts modifiés.
    async savePosts(list) {
      list.forEach((p) => {
        const i = this.state.posts.findIndex((x) => x.id === p.id);
        if (i >= 0) this.state.posts[i] = p; else this.state.posts.push(p);
      });
      if (this.mode === "api") await this.call("PUT", "posts", { posts: list });
      this.persist();
    },

    async deletePost(id) {
      this.state.posts = this.state.posts.filter((p) => p.id !== id && p.parent !== id);
      if (this.mode === "api") await this.call("DELETE", "posts/" + encodeURIComponent(id));
      this.persist();
    },

    async log(entry) {
      entry.at = entry.at || window.Core.nowStamp();
      (this.state.log = this.state.log || []).unshift(entry);
      if (this.mode === "api") { try { await this.call("POST", "log", entry); } catch (e) { /* journal local seulement */ } }
      this.persist();
    },

    // Réessayer un envoi. En démo, on simule une réussite.
    async retry(id) {
      if (this.mode === "api") { const r = await this.call("POST", "posts/" + encodeURIComponent(id) + "/retry"); if (r && r.post) await this.savePosts([r.post]); return r; }
      const p = this.post(id);
      p.status = "published"; delete p.failure;
      p.results = { instagram: { status: "ok" }, facebook: { status: "ok" } };
      await this.savePosts([p]);
      return { ok: true };
    },

    async saveSettings(settings) {
      this.state.settings = settings;
      if (this.mode === "api") await this.call("PUT", "settings", settings);
      this.persist();
    },
  };
  window.Store = S;
})();
