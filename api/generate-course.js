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
Crie um curso COMPLETO e DETALHADO sobre o tema: ${topic}.

O curso deve conter:

1) TÍTULO DO CURSO  
2) DESCRIÇÃO GERAL DO CURSO (mínimo 2 parágrafos)  

3) 6 MÓDULOS  
Cada módulo deve conter:  
- Título do módulo  
- Pequena descrição do módulo  
- 4 aulas  

4) CADA AULA DEVE TER:  
- Título  
- Conteúdo detalhado em 2–4 parágrafos  
- Exemplos práticos  
- Explicações claras  

FORMATO DA RESPOSTA:  
- ENTREGAR TUDO EM HTML LIMPO  
- Usar <h1>, <h2>, <h3>, <p>, <ul>, <li>  
- NÃO usar markdown  
- NÃO colocar blocos de código  
- NÃO colocar “html” no topo  
- NÃO colocar comentários  
- Apenas HTML puro e organizado  
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
