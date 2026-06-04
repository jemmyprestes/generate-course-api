export default async function handler(req, res) {
  const ALLOWED_ORIGIN = "https://e-learn-landing.webflow.io";

  function setCorsHeaders() {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  if (req.method === "OPTIONS") {
    setCorsHeaders();
    return res.status(204).end();
  }

  setCorsHeaders();

  try {
    const raw = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", chunk => data += chunk);
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

    const contentType = (req.headers["content-type"] || "").toLowerCase();
    let body = {};

    if (contentType.includes("application/json")) {
      try { body = raw ? JSON.parse(raw) : {}; }
      catch (e) { return res.status(400).json({ error: "Invalid JSON", details: e.message }); }
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      body = Object.fromEntries(new URLSearchParams(raw).entries());
    } else {
      try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
    }

    if (!body.topic || typeof body.topic !== "string") {
      return res.status(400).json({ error: "Invalid payload", details: "topic is required and must be a string" });
    }

    if (!body.moduleNumber) {
      return res.status(400).json({ error: "moduleNumber is required" });
    }

    const generatedHtml = `
      <h3>Módulo ${body.moduleNumber}: ${escapeHtml(body.topic)}</h3>
      <p>Conteúdo do módulo gerado com sucesso.</p>
    `;

    return res.status(200).json({ ok: true, html: generatedHtml });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[s]));
}
