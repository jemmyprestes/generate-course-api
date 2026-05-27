export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { topic } = req.body;

    const prompt = `
      Gere um curso completo sobre o tema: ${topic}.
      Estrutura:
      - Título
      - Descrição
      - 6 módulos
      - Cada módulo com 4 aulas
      - Responda em HTML pronto para Webflow.
    `;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      })
    });

    const data = await response.json();

    return res.status(200).json({
      html: data.choices[0].message.content
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

