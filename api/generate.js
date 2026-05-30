module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "https://e-learn-landing.webflow.io");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { topic } = req.body || {};

    if (!topic || typeof topic !== "string") {
      console.error("Missing or invalid topic:", req.body);
      return res.status(400).json({ error: "Missing or invalid topic" });
    }

    // Chamada à OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Gere APENAS HTML limpo, organizado e bem estruturado. " +
              "Use <h2>, <h3>, <p>, <ul>, <li>. " +
              "Não inclua explicações, comentários, markdown ou texto fora do HTML. " +
              "Não inclua ```html. " +
              "O HTML deve ser bonito, claro e pronto para ser exibido."
          },
          {
            role: "user",
            content:
              `Crie a estrutura completa de um curso sobre: ${topic}. ` +
              "Inclua: Introdução, Objetivos, Público-alvo, Conteúdo do Curso (com 5 módulos), FAQ e Conclusão."
          }
        ],
        max_tokens: 2000
      })
    });

    const openaiJson = await response.json();

    if (!response.ok) {
      console.error("OpenAI returned error:", response.status, openaiJson);
      return res.status(502).json({ error: "OpenAI error", details: openaiJson });
    }

    const html = openaiJson.choices?.[0]?.message?.content || "<p>Erro ao gerar conteúdo.</p>";

    return res.status(200).json({ html });
  } catch (err) {
    console.error("Handler error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ error: "Erro interno no servidor.", details: String(err) });
  }
};
