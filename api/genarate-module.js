module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "https://e-learn-landing.webflow.io");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { topic } = req.body;

    // Chamada para a OpenAI
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
            content: "Gere a estrutura de um curso em HTML."
          },
          {
            role: "user",
            content: `Crie a estrutura de um curso sobre: ${topic}`
          }
        ]
      })
    });

    const data = await response.json();

    return res.status(200).json({
      html: data.choices?.[0]?.message?.content || "<p>Erro ao gerar conteúdo.</p>"
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
};
