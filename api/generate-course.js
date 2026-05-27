export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { topic } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }
const prompt = `
Gere a estrutura inicial de um curso sobre: ${topic}.

<h1>Título do Curso</h1>

<h2>Descrição Geral</h2>
Escreva 2 a 3 parágrafos explicando o curso.

<h2>Módulos do Curso</h2>
Liste 6 módulos com títulos, assim:

<h3>Módulo 1: Nome</h3>
<h3>Módulo 2: Nome</h3>
...
<h3>Módulo 6: Nome</h3>
NÃO coloque ```html no topo.
NÃO coloque blocos de código.

NÃO gere aulas aqui.
Apenas a estrutura geral.
HTML puro.
`;


    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      })
    });

    const data = await response.json();

    // Debug: caso a OpenAI retorne erro
    if (!data.choices || !data.choices[0]) {
      console.error("OpenAI error:", data);
      return res.status(500).json({
        error: "OpenAI returned an invalid response",
        details: data
      });
    }

    return res.status(200).json({
      html: data.choices[0].message.content
    });

  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
