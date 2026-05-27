import OpenAI from "openai";

export default async function handler(req, res) {
  try {
    const { topic, moduleNumber } = req.body;

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
Você vai gerar APENAS O MÓDULO ${moduleNumber} de um curso sobre: ${topic}.

ESTRUTURA OBRIGATÓRIA:

<h2>Módulo ${moduleNumber}: Título do Módulo</h2>
Escreva 1 parágrafo explicando o módulo.

Agora gere 4 aulas:

<h3>Aula X: Título da Aula</h3>

<p>
Escreva OBRIGATORIAMENTE:
- 4 a 7 parágrafos explicando a aula em profundidade
- exemplos reais
- analogias
- explicações passo a passo
- aplicações práticas
- erros comuns
- boas práticas
</p>

REGRAS:
- NÃO resuma
- NÃO pule conteúdo
- NÃO escreva apenas títulos
- NÃO escreva apenas 1 parágrafo
- Cada aula DEVE ter explicação completa
- Apenas HTML puro
`;

    const completion = await client.responses.create({
      model: "gpt-4o",
      input: prompt,
    });

    const html = completion.output_text;

    res.status(200).json({ html });

  } catch (error) {
    console.error("OpenAI error:", error);
    res.status(500).json({ error: "Erro ao gerar módulo" });
  }
}
