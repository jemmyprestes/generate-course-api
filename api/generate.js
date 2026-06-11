export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      message: "API funcionando. Envie um POST com { topic } para gerar um curso."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido"
    });
  }

  const { topic } = req.body || {};

  if (!topic) {
    return res.status(400).json({
      error: "O campo topic é obrigatório"
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "OPENAI_API_KEY não configurada na Vercel"
    });
  }

  try {
    const prompt = `
Crie um curso completo em português sobre: "${topic}".

Estrutura obrigatória:
1. Título do curso
2. Descrição curta
3. Para quem é o curso
4. Objetivo principal
5. Lista de módulos
6. Para cada módulo:
   - título
   - resumo
   - aulas
   - exercício prático
7. Projeto final
8. Próximos passos para o aluno

Use uma linguagem clara, prática e organizada.
Não invente links.
Retorne apenas o conteúdo do curso.
`;

    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        input: prompt,
        max_output_tokens: 2500
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Erro da OpenAI:", errorText);

      return res.status(500).json({
        error: "Erro ao gerar curso com IA",
        details: errorText
      });
    }

    const data = await aiResponse.json();

    const course =
      data.output_text ||
      data.output?.flatMap(item => item.content || [])
        ?.map(content => content.text || "")
        ?.join("\n")
        ?.trim();

    return res.status(200).json({
      course: course || "Não foi possível gerar o curso."
    });
  } catch (error) {
    console.error("Erro interno:", error);

    return res.status(500).json({
      error: "Erro interno ao gerar curso"
    });
  }
}
