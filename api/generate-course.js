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
Você vai gerar um CURSO COMPLETO e EXTREMAMENTE DETALHADO sobre o tema: ${topic}.

O curso deve seguir EXATAMENTE esta estrutura:

<h1>Título do Curso</h1>

<h2>Descrição Geral</h2>
Escreva 2 a 3 parágrafos explicando o curso de forma clara, profunda e envolvente.

<h2>Módulo X: Nome do Módulo</h2>
Escreva 1 parágrafo explicando o módulo.

<h3>Aula X: Título da Aula</h3>
Escreva OBRIGATORIAMENTE:
- 3 a 6 parágrafos explicando o conteúdo da aula
- exemplos reais
- analogias
- explicações passo a passo
- aplicações práticas
- erros comuns
- boas práticas

NÃO RESUMA.  
NÃO pule conteúdo.  
NÃO escreva apenas títulos.  
NÃO escreva apenas 1 parágrafo.  
Cada aula DEVE ter explicação completa e profunda.

FORMATO DA RESPOSTA:
- Apenas HTML puro (<h1>, <h2>, <h3>, <p>, <ul>, <li>)
- NÃO use markdown
- NÃO coloque “html” no topo
- NÃO coloque comentários
- NÃO coloque blocos de código
- NÃO coloque texto fora da estrutura acima
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
