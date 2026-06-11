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

Retorne o conteúdo em HTML limpo, pronto para ser inserido em uma página Webflow.

Use apenas estas tags:
<h2>, <h3>, <h4>, <h5>, <p>, <ul>, <li>, <strong>, <br>

Não use Markdown.
Não use #, ##, ### ou **.
Não use crases.
Não coloque texto fora do HTML.

Estrutura obrigatória:

<h2>Título do curso</h2>
<p>Descrição curta do curso.</p>

<h3>Para quem é o curso</h3>
<ul>
  <li>Perfil de aluno 1</li>
  <li>Perfil de aluno 2</li>
  <li>Perfil de aluno 3</li>
</ul>

<h3>Objetivo principal</h3>
<p>Explique o objetivo principal do curso.</p>

<h3>Módulos do curso</h3>
<p>Liste brevemente os módulos do curso.</p>

Agora desenvolva o curso completo.

Crie entre 6 e 8 módulos.

Para cada módulo, use exatamente esta estrutura:

<h4>Módulo 1 — Nome do módulo</h4>

<p><strong>Resumo do módulo:</strong> Explique o que será aprendido neste módulo em um parágrafo claro.</p>

<p><strong>Aulas do módulo:</strong></p>

Para cada módulo, crie de 3 a 5 aulas completas.

Para cada aula, use esta estrutura:

<h5>Aula 1 — Título da aula</h5>
<p><strong>Objetivo da aula:</strong> Explique o que o aluno vai aprender nesta aula.</p>
<p><strong>Conteúdo da aula:</strong> Desenvolva o conteúdo da aula em 2 a 4 parágrafos. Não faça apenas uma lista. Explique o assunto como se fosse uma mini aula escrita.</p>
<p><strong>Exemplo prático:</strong> Dê um exemplo aplicado ao tema do curso.</p>
<p><strong>Atividade:</strong> Proponha uma tarefa simples para o aluno praticar.</p>

Depois das aulas de cada módulo, inclua:

<p><strong>Exercício prático do módulo:</strong> Crie um exercício maior para consolidar o aprendizado do módulo.</p>

No final do curso, inclua:

<h3>Projeto final</h3>
<p>Explique um projeto final completo que o aluno deve construir usando tudo o que aprendeu.</p>

<h3>Critérios de conclusão</h3>
<ul>
  <li>Critério 1</li>
  <li>Critério 2</li>
  <li>Critério 3</li>
</ul>

<h3>Próximos passos</h3>
<p>Explique o que o aluno pode estudar ou construir depois de terminar o curso.</p>

Importante:
Não entregue apenas títulos de aulas.
Cada aula precisa ter conteúdo explicado.
Cada módulo precisa ter aulas desenvolvidas.
O curso deve parecer um material real de estudo, não apenas uma ementa.
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
