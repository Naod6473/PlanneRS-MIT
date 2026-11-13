/* PlanneRs : assistant de connexion pas à pas.
   Une étape à la fois : ce qu'il faut faire, le lien direct, les valeurs à copier en un clic.
   La dernière étape colle les identifiants et vérifie la connexion ; en cas d'échec, l'assistant
   indique l'étape à revoir. L'étape atteinte est retenue sur l'appareil. */
(function () {
  "use strict";
  const U = window.UI, S = window.Store, A = window.App;
  const { esc, icon, brand } = U;
  const layer = () => document.getElementById("layer");
  const origin = () => location.origin;

  // Chaque étape : t (titre), p (texte), a (actions, une par ligne), go ([libellé, lien]), copy ([libellé, valeur]).
  // {o} est remplacé par l'adresse de l'instance.
  const W = {
    instagram: { name: "Instagram et Page Facebook", meta: true, steps: [
      { t: "Compte professionnel", a: ["Dans l'appli Instagram : Profil › ☰ › « Type de compte et outils » › « Passer à un compte professionnel ».", "Choisis Créateur ou Entreprise."] },
      { t: "Relier la Page Facebook", a: ["Ouvre ta Page Facebook › « Paramètres » › « Comptes liés » › « Instagram ».", "Clique « Connecter le compte » et connecte-toi à Instagram."], go: ["Ouvrir mes Pages", "https://www.facebook.com/pages/?category=your_pages"] },
      { t: "Créer l'application Meta", a: ["Clique « Créer une application ».", "Cas d'usage : « Autre », puis type « Entreprise ».", "Laisse-la en mode Développement : aucune vérification n'est nécessaire pour tes propres comptes."], go: ["Ouvrir Mes applications", "https://developers.facebook.com/apps/"] },
      { t: "Générer un jeton", a: ["À droite, « Application Meta » : choisis ton application.", "« Autorisations » : ajoute les droits ci-dessous.", "Clique « Generate Access Token » et coche ta Page et ton compte Instagram.", "Copie le jeton (le long texte en haut) : PlanneRs fait le reste."], go: ["Ouvrir l'Explorateur", "https://developers.facebook.com/tools/explorer/"], copy: [["Droits", "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,instagram_manage_insights,instagram_manage_comments"]] },
    ], fix: [[/token|jeton|OAuth|190/i, 3, "Le jeton est refusé ou expiré : génère-en un nouveau dans l'Explorateur."], [/permission|autoris|#10|#200/i, 3, "Il manque un droit : refais la génération du jeton en ajoutant tous les droits."], [/client_secret|client_id|validating client/i, 4, "L'identifiant ou le code secret de l'application est refusé : recopie-les depuis Paramètres › Général de l'application."]] },
    youtube: { name: "YouTube (Shorts)", oauth: "api/oauth/google/start?for=youtube", steps: [
      { t: "Créer un projet Google Cloud", a: ["En haut, sélectionne un projet ou clique « Nouveau projet ».", "Si tu as déjà un client Google pour le Drive, garde ce projet."], go: ["Ouvrir Google Cloud", "https://console.cloud.google.com/projectcreate"] },
      { t: "Activer l'API YouTube", a: ["Vérifie que le bon projet est sélectionné en haut.", "Clique « Activer »."], go: ["Ouvrir YouTube Data API v3", "https://console.cloud.google.com/apis/library/youtube.googleapis.com"] },
      { t: "Écran de connexion", a: ["Si Google le demande, clique « Commencer ».", "Nom de l'application : PlanneRs. Adresse d'assistance : la tienne.", "Audience : « Externe ».", "Dans « Audience », ajoute ton adresse Google dans « Utilisateurs test »."], go: ["Ouvrir l'écran de connexion", "https://console.cloud.google.com/auth/overview"] },
      { t: "Créer le client OAuth", a: ["Clique « Créer un client ».", "Type : « Application Web ».", "« URI de redirection autorisés » › « Ajouter un URI » : colle l'adresse ci-dessous.", "Clique « Créer » et garde l'ID client et le code secret."], go: ["Ouvrir les clients", "https://console.cloud.google.com/auth/clients"], copy: [["URI de redirection", "{o}/api/oauth/google/callback"]] },
    ], fix: [[/redirect_uri|redirection/i, 3, "L'adresse de redirection ne correspond pas : vérifie l'URI dans le client OAuth."], [/access_denied|test|non vérifi/i, 2, "Ton compte n'est pas dans les utilisateurs test."], [/disabled|not been used|activ/i, 1, "L'API YouTube n'est pas activée dans ce projet."]] },
    gdrivewrite: { name: "Google Drive (envoi)", oauth: "api/oauth/google/start", steps: [
      { t: "Projet Google Cloud", a: ["Utilise le même projet que pour YouTube s'il existe, sinon crée-en un."], go: ["Ouvrir Google Cloud", "https://console.cloud.google.com/projectcreate"] },
      { t: "Activer l'API Drive", a: ["Vérifie le projet sélectionné en haut, puis clique « Activer »."], go: ["Ouvrir Google Drive API", "https://console.cloud.google.com/apis/library/drive.googleapis.com"] },
      { t: "Écran de connexion", a: ["Audience « Externe » ; ajoute ton adresse Google dans « Utilisateurs test »."], go: ["Ouvrir l'écran de connexion", "https://console.cloud.google.com/auth/overview"] },
      { t: "Créer le client OAuth", a: ["« Créer un client », type « Application Web ».", "Ajoute l'URI de redirection ci-dessous, puis « Créer »."], go: ["Ouvrir les clients", "https://console.cloud.google.com/auth/clients"], copy: [["URI de redirection", "{o}/api/oauth/google/callback"]] },
    ], fix: [[/redirect_uri|redirection/i, 3, "L'adresse de redirection ne correspond pas : vérifie l'URI dans le client OAuth."], [/scope|autoris/i, 2, "Accepte tous les droits demandés à l'écran Google (coche chaque case)."]] },
    tiktok: { name: "TikTok", oauth: "api/oauth/tiktok/start", steps: [
      { t: "Créer l'app TikTok", a: ["Connecte-toi avec le compte TikTok qui publiera.", "Clique « Create app », type « Individual »."], go: ["Ouvrir le portail TikTok", "https://developers.tiktok.com/apps"] },
      { t: "Remplir la fiche", a: ["Nom, catégorie, description courte.", "Icône : 1024 × 1024, sans logo de réseau social.", "Conditions et confidentialité : une page publique de ton site."] },
      { t: "Ajouter les produits", a: ["« Add products » › « Login Kit ».", "« Add products » › « Content Posting API », puis active « Direct Post »."] },
      { t: "Adresse de retour", a: ["Dans « Login Kit » › « Redirect URI », colle l'adresse ci-dessous.", "Vérifie les droits user.info.basic, video.upload et video.publish dans « Scopes »."], copy: [["Redirect URI", "{o}/api/oauth/tiktok/callback"]] },
      { t: "Sandbox", a: ["Menu « Sandbox » › « Target users » › ajoute ton compte TikTok, puis « Save ».", "Copie la Client key et le Client secret de la sandbox."] },
    ], fix: [[/redirect/i, 3, "L'adresse de retour ne correspond pas : recopie-la dans Login Kit."], [/scope|authoriz/i, 3, "Un droit manque : vérifie les Scopes de l'app."], [/target|sandbox|not.*allowed/i, 4, "Ton compte n'est pas dans les Target users de la sandbox."]] },
  };
  A.hasWizard = (id) => !!W[id];

  const key = (id) => "planners-wiz-" + id;
  const getStep = (id) => { try { return +localStorage.getItem(key(id)) || 0; } catch (e) { return 0; } };
  const setStep = (id, n) => { try { localStorage.setItem(key(id), String(n)); } catch (e) { /* pas de stockage : sans gravité */ } };

  A.wizard = function (id, at, msg) {
    const w = W[id]; if (!w) return A.openConn(id);
    const n = w.steps.length + 1; // + l'étape finale (identifiants)
    let i = Math.max(0, Math.min(at == null ? getStep(id) : at, n - 1));
    const fields = (S.state.adapters || {})[id] || [];
    const a = (S.state.accounts || {})[id];
    const M = { token: "", appId: "", appSecret: "", pages: null, pick: "" }; // assistant Meta : rien n'est gardé après fermeture
    function metaStep() {
      if (!M.pages) return '<h3 class="wz-t">Coller le jeton</h3><form class="form" id="wzm" onsubmit="return false">' +
        '<label>Jeton de l\'Explorateur<input name="userToken" type="password" autocomplete="off" required value="' + esc(M.token) + '"></label>' +
        '<details class="wz-more"' + (M.appId ? " open" : "") + '><summary>Pour un jeton qui n\'expire jamais (conseillé)</summary><p class="muted small">Dans ton application Meta › Paramètres de l\'app › Général : l\'identifiant et la clé secrète. La clé ne sert qu\'à allonger le jeton : elle n\'est pas enregistrée.</p>' +
        '<label>Identifiant de l\'application<input name="appId" inputmode="numeric" autocomplete="off" value="' + esc(M.appId) + '"></label><label>Clé secrète<input name="appSecret" type="password" autocomplete="off" value="' + esc(M.appSecret) + '"></label>' +
        '<a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener">' + icon("open") + "Ouvrir Mes applications</a></details></form>" +
        '<p class="muted" style="font-size:12px;margin:0">PlanneRs retrouve ta Page, son jeton et ton compte Instagram, et vérifie les autorisations. Plus besoin de chercher les identifiants.</p>';
      const r = M.pages;
      return '<h3 class="wz-t">Choisir le compte</h3>' +
        (r.missing.length ? '<div class="wz-note">Il manque des autorisations : ' + esc(r.missing.join(", ")) + '. Refais l\'étape 4 en les ajoutant. <button class="btn sm" data-wz-go="3">Revoir l\'étape 4</button></div>' : "") +
        (r.long ? '<p class="wz-ok">' + icon("check") + "Jeton sans expiration.</p>" : '<p class="wz-warn">' + icon("alert") + "Jeton court (environ 1 h) : ajoute l\'identifiant et la clé secrète de l\'application pour qu\'il n\'expire jamais.</p>") +
        (r.optionalMissing.length ? '<p class="muted small">Facultatif, non accordé : ' + esc(r.optionalMissing.join(", ")) + " (stats, premier commentaire).</p>" : "") +
        (r.pages.length ? '<div class="wz-pages" role="radiogroup" aria-label="Page Facebook">' + r.pages.map((p) => '<label class="wz-page"><input type="radio" name="wzpg" value="' + esc(p.id) + '"' + (M.pick === p.id ? " checked" : "") + '><span class="mv-col"><b data-noi18n>' + esc(p.name) + "</b>" +
          (p.igId ? '<span class="muted small">Instagram : <span data-noi18n>@' + esc(p.igUser || p.igId) + "</span></span>" : '<span class="wz-warn small">Pas de compte Instagram relié : seule la Page sera connectée (étape 2).</span>') + "</span></label>").join("") + "</div>"
          : '<div class="wz-note">Aucune Page trouvée : en générant le jeton, coche bien ta Page et ton compte Instagram dans la fenêtre Facebook. <button class="btn sm" data-wz-go="3">Revoir l\'étape 4</button></div>') +
        '<button class="btn quiet sm" data-wz="metaback">' + icon("left") + "Changer de jeton</button>";
    }
    function draw(note) {
      setStep(id, i);
      const last = i === n - 1, st = w.steps[i];
      const dots = Array.from({ length: n }, (_, k) => '<button class="wz-dot' + (k === i ? " on" : k < i ? " done" : "") + '" data-wz-go="' + k + '" aria-label="Étape ' + (k + 1) + '"></button>').join("");
      const body = last && w.meta ? metaStep()
        : last
        ? (a && a.status === "pending" && w.oauth
          ? '<h3 class="wz-t">Autoriser l\'accès</h3><ol class="wz-a"><li>Clique le bouton ci-dessous.</li><li>Choisis le bon compte et accepte tous les droits demandés.</li><li>Tu reviens ici, connecté.</li></ol>'
          : '<h3 class="wz-t">Coller les identifiants</h3><form class="form" id="wzf" onsubmit="return false">' + fields.map((f) => "<label>" + esc(f.label) + '<input name="' + esc(f.key) + '" type="' + (f.secret ? "password" : "text") + '" autocomplete="off"' + (f.optional ? "" : " required") + "></label>").join("") + '</form><p class="muted" style="font-size:12px;margin:0">Chiffrés avant d\'être enregistrés, jamais renvoyés à l\'interface.</p>')
        : '<h3 class="wz-t">' + esc(st.t) + '</h3><ol class="wz-a">' + st.a.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ol>" +
          (st.go ? '<a class="btn primary" href="' + esc(st.go[1]) + '" target="_blank" rel="noopener">' + icon("open") + esc(st.go[0]) + "</a>" : "") +
          (w.meta && i === 0 ? '<div class="wz-alt"><b>Pas envie de créer une app Meta ?</b><p>Tu peux tout planifier et valider dans PlanneRs, puis poster à la main en un geste : à l\'heure prévue, un rappel arrive et le texte est prêt à coller.</p><button class="btn" data-wz="manual">' + icon("hand") + "Poster Instagram et Facebook à la main</button></div>" : "") +
          (st.copy ? '<div class="form">' : "") + (st.copy || []).map(([l, v]) => { v = v.replace("{o}", origin()); return '<label class="wz-copy">' + esc(l) + '<span class="row"><input readonly value="' + esc(v) + '" data-noi18n style="flex:1"><button class="btn" data-copyval="' + esc(v) + '">' + icon("copy") + "Copier</button></span></label>"; }).join("") + (st.copy ? "</div>" : "");
      A.openLayer('<div class="sh-top">' + brand(id, "lg") + "<b>" + esc(w.name) + '</b><span class="muted">Étape ' + (i + 1) + " sur " + n + '</span><span style="flex:1"></span><button class="iconbtn" data-close aria-label="Fermer">' + icon("x") + "</button></div>" +
        '<div class="sh-body wz"><div class="wz-dots">' + dots + "</div>" + (note ? '<div class="wz-note">' + esc(note) + "</div>" : "") + body + "</div>" +
        '<div class="sh-foot">' + (i > 0 ? '<button class="btn" data-wz="prev">' + icon("left") + "Précédent</button>" : "") + '<span style="flex:1"></span>' +
        (last && w.meta ? (M.pages ? '<button class="btn primary big" data-wz="metaconnect">' + icon("check") + "Connecter ce compte</button>" : '<button class="btn primary big" data-wz="find">' + icon("search") + "Trouver mes comptes</button>") : last ? (a && a.status === "pending" && w.oauth ? '<a class="btn primary big" href="' + w.oauth + '">' + icon("open") + "Autoriser l'accès</a>" : '<button class="btn primary big" data-wz="connect">' + icon("check") + "Vérifier et connecter</button>") : '<button class="btn primary" data-wz="next">C\'est fait, suivant' + icon("right") + "</button>") + "</div>", w.name);
      layer().querySelector(".sheet").addEventListener("click", onClick);
    }
    function explain(m) {
      const f = (w.fix || []).find(([re]) => re.test(m));
      return f ? { step: f[1], note: f[2] + " (" + m.slice(0, 160) + ")" } : null;
    }
    draw(msg && (explain(msg) || {}).note);
    async function onClick(e) {
      const root = layer();
      const g = e.target.closest("[data-wz-go]"); if (g) { i = +g.dataset.wzGo; draw(); return; }
      const b = e.target.closest("[data-wz]"); if (!b) return;
      if (b.dataset.wz === "prev") { i--; draw(); return; }
      if (b.dataset.wz === "next") { i++; draw(); return; }
      if (b.dataset.wz === "manual") {
        const st = S.state.settings, r = Object.assign({}, st.rules || {}), m = new Set(r.manualNets || []);
        m.add("instagram"); m.add("facebook"); r.manualNets = [...m];
        await S.saveSettings(Object.assign({}, st, { rules: r }));
        U.toast("Instagram et Facebook : à poster à la main. Rappel à l'heure prévue, texte prêt à coller."); A.closeLayer(); A.render(); return;
      }
      if (b.dataset.wz === "metaback") { M.pages = null; draw(); return; }
      if (b.dataset.wz === "find") {
        const f = root.querySelector("#wzm"); if (!f || !f.reportValidity()) return;
        Object.assign(M, Object.fromEntries(new FormData(f).entries())); M.token = M.userToken || "";
        if (S.mode !== "api") { M.pages = { long: !!M.appSecret, missing: [], optionalMissing: [], pages: [{ id: "1", name: "Ma Page (démo)", igId: "2", igUser: "mon.compte" }] }; M.pick = "1"; draw(); return; }
        b.disabled = true;
        try { M.pages = await S.call("POST", "meta/setup", { userToken: M.token, appId: M.appId, appSecret: M.appSecret }); M.pick = (M.pages.pages.find((p) => p.igId) || M.pages.pages[0] || {}).id || ""; draw(); }
        catch (err) { b.disabled = false; const ex = explain(err.message); if (ex) { i = ex.step; draw(ex.note); } else draw("Échec : " + err.message); }
        return;
      }
      if (b.dataset.wz === "metaconnect") {
        const sel = root.querySelector('input[name="wzpg"]:checked'); if (!sel) { U.toast("Choisis la Page à connecter"); return; }
        M.pick = sel.value;
        if (S.mode !== "api") { S.state.accounts.instagram = { status: "ok", account: "@mon.compte (démo)", detail: "Connexion simulée (démo)" }; S.persist(); setStep(id, 0); U.toast("Démo : connexion simulée"); A.closeLayer(); A.render(); return; }
        b.disabled = true; U.toast("Vérification…");
        try {
          const r = await S.call("POST", "meta/setup", { userToken: M.token, appId: M.appId, appSecret: M.appSecret, pageId: M.pick });
          if (r.ig) S.state.accounts.instagram = r.info; else S.state.accounts.facebook = r.info;
          if (r.info.relay) S.state.accounts.facebook = r.info.relay;
          setStep(id, 0); U.toast("Connecté : " + (r.info.account || w.name) + (r.long ? "" : " (jeton court : refais l'assistant avec la clé de l'application)")); A.closeLayer(); A.render();
        } catch (err) { b.disabled = false; let m = err.message; try { m = JSON.parse(m).info.detail; } catch (x) { /* texte brut */ } const ex = explain(m); if (ex) { i = ex.step; draw(ex.note); } else draw("Échec : " + m); }
        return;
      }
      if (b.dataset.wz === "connect") {
        if (S.mode !== "api") { S.state.accounts[id] = { status: "ok", account: "Compte de démo", detail: "Connexion simulée (démo)" }; S.persist(); setStep(id, 0); U.toast("Démo : connexion simulée"); A.closeLayer(); A.render(); return; }
        const f = root.querySelector("#wzf"); if (!f || !f.reportValidity()) return;
        b.disabled = true; U.toast("Vérification…");
        try {
          const r = await S.call("POST", "connect/" + id, Object.fromEntries(new FormData(f).entries()));
          S.state.accounts[id] = r.info; if (r.info.relay) S.state.accounts.facebook = r.info.relay;
          if (r.info.status === "pending") { A.wizard(id, n - 1); return; }
          setStep(id, 0); U.toast("Connecté : " + (r.info.account || w.name)); A.closeLayer(); A.render();
        } catch (err) {
          b.disabled = false; let m = err.message; try { m = JSON.parse(m).info.detail; } catch (x) { /* texte brut */ }
          const ex = explain(m);
          if (ex) { i = ex.step; draw(ex.note); } else draw("Échec : " + m);
        }
      }
    }
  };
})();
