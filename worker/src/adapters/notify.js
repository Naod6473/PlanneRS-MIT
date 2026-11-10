// Notifications : ntfy, Telegram, webhook signé.
export const channels = {
  ntfy: {
    fields: [{ key: "topic", label: "Sujet ntfy (ex. https://ntfy.sh/mon-sujet-secret)" }, { key: "token", label: "Jeton (facultatif)", secret: true }],
    async send(env, cred, n) {
      // Publication JSON : gère les accents et les emojis dans le titre.
      const m = String(cred.topic).match(/^(https?:\/\/[^/]+)\/(.+)$/);
      const base = m ? m[1] : "https://ntfy.sh", topic = m ? m[2] : cred.topic;
      const headers = { "content-type": "application/json" };
      if (cred.token) headers.authorization = "Bearer " + cred.token;
      const r = await fetch(base + "/", { method: "POST", headers, body: JSON.stringify({ topic, title: n.title, message: n.text, click: n.url || undefined }) });
      if (!r.ok) throw new Error("ntfy : " + r.status);
    },
  },
  telegram: {
    fields: [{ key: "botToken", label: "Jeton du bot (via @BotFather)", secret: true }, { key: "chatId", label: "Identifiant de la discussion" }],
    async send(env, cred, n) {
      const r = await fetch("https://api.telegram.org/bot" + cred.botToken + "/sendMessage", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: cred.chatId, text: n.title + "\n" + n.text + (n.url ? "\n" + n.url : "") }),
      });
      if (!r.ok) throw new Error("Telegram : " + r.status);
    },
  },
  webhook: {
    fields: [{ key: "url", label: "Adresse HTTPS" }, { key: "secret", label: "Secret de signature (HMAC SHA-256)", secret: true }],
    async send(env, cred, n) {
      const body = JSON.stringify({ event: n.event, title: n.title, text: n.text, post: n.post || null, at: new Date().toISOString() });
      const headers = { "content-type": "application/json" };
      if (cred.secret) {
        const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(cred.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
        headers["x-planners-signature"] = "sha256=" + [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
      }
      const r = await fetch(cred.url, { method: "POST", headers, body });
      if (!r.ok) throw new Error("Webhook : " + r.status);
    },
  },
};
