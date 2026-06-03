export default async function handler(req, res) {
  // Ajuste: permita apenas o domínio do seu site (mais seguro que '*')
  const ALLOWED_ORIGIN = "https://e-learn-landing.webflow.io";

  // Função para setar headers CORS em todas as respostas
  function setCorsHeaders() {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    // se precisar enviar cookies/autenticação entre domínios, habilite e configure:
    // res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  // Responder preflight (OPTIONS) imediatamente
  if (req.method === "OPTIONS") {
    setCorsHeaders();
    // 204 No Content é apropriado para preflight
    return res.status(204).end();
  }

  setCorsHeaders();

  try {
    // Ler raw body
    const raw = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

    console.log("Raw request body:", raw);

    const contentType = (req.headers["content-type"] || "").toLowerCase();

    // Parse flexível: JSON ou form-urlencoded
    let body = {};
    if (contentType.includes("application/json")) {
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch (parseErr) {
        console.error("JSON parse error:", parseErr.message);
        return res.status(400).json({ error: "Invalid JSON", details: parseErr.message, raw });
      }
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(raw);
      body = Object.fromEntries(params.entries());
    } else {
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        body = {};
      }
    }

    // Validação simples
    if (!body.topic || typeof body.topic !== "string") {
      return res.status(400).json({ error: "Invalid payload", details: "topic is required and must be a string", received: body });
    }

    // --- Aqui entra seu código real que gera o HTML usando body.topic ---
    // Exemplo de resposta de teste:
    const generatedHtml = `<h2>Curso de ${body.topic}</h2><p>Conteúdo gerado com sucesso.</p>`;

    return res.status(200).json({ ok: true, html: generatedHtml });
  } catch (err) {
    console.error("Handler unexpected error:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}
