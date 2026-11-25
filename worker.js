// Serveur IA de Séance Board — à coller dans un Cloudflare Worker.
// Variables à créer dans le Worker (Settings > Variables and Secrets) :
//   ANTHROPIC_API_KEY  (Secret)  : ta clé API Anthropic
//   ACCESS_CODE        (Secret)  : le code que tu donnes à tes éducateurs
//   ALLOWED_ORIGIN     (Text)    : https://yesi-concept.github.io
export default {
  async fetch(req, env) {
    const allowed = env.ALLOWED_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": allowed,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Code",
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return json({ error: "method" }, 405);
    if (!env.ACCESS_CODE || req.headers.get("X-Code") !== env.ACCESS_CODE) return json({ error: "code" }, 401);

    let body;
    try { body = await req.json(); } catch { return json({ error: "json" }, 400); }
    const prompt = String(body.prompt || "").slice(0, 20000);
    if (!prompt) return json({ error: "empty" }, 400);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: env.MODEL || "claude-sonnet-5-5",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: "api", detail: j.error && j.error.message }, 502);
    const text = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("");
    return json({ text });
  },
};
