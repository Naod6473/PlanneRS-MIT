// Fournisseurs de connexion, interchangeables par réseau :
//  - « direct »   : les modules de adapters/ (appli Meta, appli développeur X…), comme avant ;
//  - « composio » : Composio garde les jetons ; PlanneRs passe par son relais ;
//  - « postiz »   : un Postiz existant publie ; PlanneRs garde la file et déclenche à l'heure.
// Chaque compte enregistré indique son fournisseur dans ses identifiants (cred.provider, « direct » si absent).
// Le robot, la file, la planification et l'historique ne voient qu'un module par réseau, quel que soit le fournisseur.
//
// Interface commune d'un fournisseur (par réseau) :
//   connect  : lien d'autorisation ou identifiants (routes /api/providers/…)
//   status   (env, network, cred)              → { status: ok | pending | expired | error, detail }
//   publish  (env, post, cred, job, saveCred)  → { status:"ok", id, url } | { status:"pending", job }
//   refresh  : à la charge du fournisseur (Composio renouvelle seul ; « expired » = se reconnecter)
//   disconnect (env, network, cred)
import * as composio from "./composio.js";
import * as postiz from "./postiz.js";
import { PublishError } from "../adapters/meta.js";

export { composio, postiz };
export const providerOf = (cred) => (cred && cred.provider) || "direct";

// Modules par réseau qui aiguillent vers le bon fournisseur selon les identifiants du compte.
// getCfg(id) : identifiants d'un service (sert à lire la connexion Postiz).
export function routed(ADAPTERS, getCfg) {
  const out = {};
  for (const [n, ad] of Object.entries(ADAPTERS)) {
    out[n] = {
      id: n, fields: ad.fields,
      async publish(env, post, cred, job, save) {
        const p = providerOf(cred);
        if (p === "composio") {
          if (n === "x") return composio.publishX(env, post, cred);
          if (n === "instagram" || n === "facebook") return ad.publish(env, post, composio.metaCred(env, cred), job);
          throw new PublishError(n + " ne passe pas par Composio dans PlanneRs.", { todo: "Connecte-le en direct, ou poste-le à la main.", retryable: false });
        }
        if (p === "postiz") return postiz.publish(env, n, post, cred, job, await getCfg("postiz"));
        return ad.publish(env, post, cred, job, save);
      },
      comment: ad.comment ? async (env, mediaId, text, cred) => {
        const p = providerOf(cred);
        if (p === "postiz") throw new PublishError("Premier commentaire non géré via Postiz.", { todo: "Ajoute-le à la main.", retryable: false });
        return ad.comment(env, mediaId, text, p === "composio" ? composio.metaCred(env, cred) : cred);
      } : undefined,
      async test(env, cred, save) {
        const p = providerOf(cred);
        if (p === "direct") return ad.test(env, cred, save);
        const st = await status(env, n, cred, getCfg);
        if (st.status !== "ok") throw new PublishError(st.detail || "Connexion à refaire.", { why: st.detail, retryable: false });
        return st.detail;
      },
    };
  }
  return out;
}

// État d'une connexion tenue par un fournisseur.
export async function status(env, network, cred, getCfg) {
  const p = providerOf(cred);
  if (p === "composio") {
    const s = await composio.status(env, cred);
    const name = cred.account ? cred.account + " " : "";
    return { status: s.status, detail: s.status === "ok" ? "Connecté à " + name + "(via Composio)" : s.status === "expired" ? "La connexion Composio a expiré : reconnecte-toi." : s.status === "pending" ? "Autorisation pas encore donnée dans Composio." : "Connexion Composio inutilisable (" + s.raw + ")." };
  }
  if (p === "postiz") {
    const s = await postiz.status(await getCfg("postiz"), cred);
    return { status: s.status, detail: s.status === "ok" ? "Connecté à « " + s.name + " » (via Postiz)" : s.why };
  }
  return { status: "ok", detail: "" };
}

export async function disconnect(env, network, cred) {
  if (providerOf(cred) === "composio" && cred.connectedAccountId) await composio.removeAccount(env, cred).catch(() => null);
}

// Ce que l'interface doit savoir : fournisseurs disponibles et réseaux couverts.
export function available(env) {
  return { composio: { on: !!env.COMPOSIO_API_KEY, networks: composio.NETWORKS }, postiz: { networks: [...new Set(Object.values(postiz.IDENTIFIERS))] } };
}

// Fiches « fournisseur » de Réglages › Comptes (connexion au service lui-même).
export const CARDS = {
  composio: {
    id: "composio", fields: [],
    async test(env) {
      if (!env.COMPOSIO_API_KEY) throw new PublishError("Composio n'est pas configuré.", { why: "Ajoute le secret Worker COMPOSIO_API_KEY (clé de projet « ak_… »), puis réessaie." });
      await composio.api(env, "GET", "auth_configs?limit=1");
      return "Clé Composio acceptée";
    },
  },
  postiz: { id: "postiz", fields: postiz.fields, test: (env, cfg) => postiz.test(env, cfg) },
};
