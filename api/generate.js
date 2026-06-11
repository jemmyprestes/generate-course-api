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

  const prompt = `
Você é um especialista em criação de cursos online.

Crie um curso completo em português sobre: "${topic}".

O conteúdo deve ser retornado em HTML limpo, pronto para ser inserido dentro de uma página Webflow usando innerHTML.

Use SOMENTE estas tags HTML:
<h2>, <h3>, <h4>, <h5>, <p>, <ul>, <li>, <strong>, <br>

Não use Markdown.
Não use #, ##, ###.
Não use **.
Não use crases.
Não use bloco de código.
Não escreva \`\`\`html.
Não explique o que você está fazendo.
Retorne somente o HTML do curso.

Estrutura obrigatória:

<h2>Título do curso</h2>

<p>Crie uma descrição curta e atrativa do curso.</p>

<h3>Para quem é o curso</h3>
<ul>
  <li>Perfil de aluno 1</li>
  <li>Perfil de aluno 2</li>
  <li>Perfil de aluno 3</li>
  <li>Perfil de aluno 4</li>
</ul>

<h3>Objetivo principal</h3>
<p>Explique claramente o que o aluno será capaz de fazer ao terminar o curso.</p>

<h3>Módulos do curso</h3>
<p>Explique em uma frase como o curso está organizado.</p>

Crie exatamente 6 módulos.

Para cada módulo, use esta estrutura:

<h4>Módulo 1 — Nome do módulo</h4>

<p><strong>Resumo do módulo:</strong> Escreva um resumo claro explicando o que o aluno vai aprender neste módulo.</p>

<p><strong>Aulas do módulo:</strong></p>

Crie exatamente 4 aulas para cada módulo.

Para cada aula, use esta estrutura:

<h5>Aula 1 — Título da aula</h5>

<p><strong>Objetivo da aula:</strong> Explique o objetivo específico da aula.</p>

<p><strong>Conteúdo da aula:</strong> Desenvolva a aula em texto corrido, com explicação real. Não escreva apenas uma frase curta. Explique o conceito como se fosse uma mini aula para um iniciante.</p>

<p><strong>Exemplo prático:</strong> Dê um exemplo aplicado ao tema do curso.</p>

<p><strong>Atividade:</strong> Crie uma tarefa simples e prática para o aluno executar.</p>

Depois das 4 aulas de cada módulo, inclua:

<p><strong>Exercício prático do módulo:</strong> Crie um exercício maior que una os aprendizados das aulas do módulo.</p>

Depois de todos os módulos, inclua:

<h3>Projeto final</h3>
<p>Descreva um projeto final completo que o aluno deve construir usando tudo o que aprendeu no curso.</p>

<h3>Critérios de conclusão</h3>
<ul>
  <li>Critério 1</li>
  <li>Critério 2</li>
  <li>Critério 3</li>
  <li>Critério 4</li>
</ul>

<h3>Próximos passos</h3>
<p>Explique o que o aluno pode estudar, criar ou vender depois de concluir o curso.</p>

Regras importantes:
Cada módulo precisa ter resumo.
Cada módulo precisa ter exatamente 4 aulas.
Cada aula precisa ter objetivo, conteúdo, exemplo prático e atividade.
Não entregue só uma ementa.
O resultado deve parecer um material real de estudo.
`;

  try {
    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-5.4",
        input: prompt,
        max_output_tokens: 10000
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

    let course =
      data.output_text ||
      data.output
        ?.flatMap((item) => item.content || [])
        ?.map((content) => content.text || "")
        ?.join("\n")
        ?.trim();

    if (!course) {
      return res.status(500).json({
        error: "A IA não retornou conteúdo."
      });
    }

    // Limpeza básica caso a IA coloque crases ou bloco html por engano
    course = course
      .replace(/```html/g, "")
      .replace(/```/g, "")
      .trim();

    return res.status(200).json({
      course
    });
  } catch (error) {
    console.error("Erro interno:", error);

    return res.status(500).json({
      error: "Erro interno ao gerar curso"
    });
  }
}
