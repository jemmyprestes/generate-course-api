function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanJsonText(text = "") {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

function createYouTubeSearchUrl(query = "") {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function renderVisualExample(visualExample) {
  if (!visualExample) return "";

  const items = Array.isArray(visualExample.items) ? visualExample.items : [];

  return `
    <div class="visual-example-card">
      <p class="visual-label"><strong>Exemplo visual prático</strong></p>
      <h6>${escapeHtml(visualExample.title || "Exemplo visual")}</h6>
      <p>${escapeHtml(visualExample.description || "")}</p>

      <div class="visual-box visual-${escapeHtml(visualExample.type || "estrutura")}">
        ${items
          .map(
            (item, index) => `
              <div class="visual-item">
                <span>${index + 1}</span>
                <p>${escapeHtml(item)}</p>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderCourseHtml(course) {
  const modulesHtml = course.modules
    .map((module, moduleIndex) => {
      const lessonsHtml = module.lessons
        .map((lesson, lessonIndex) => {
          const youtubeUrl = createYouTubeSearchUrl(
            lesson.videoSearchQuery ||
              `${course.title} ${module.title} ${lesson.title} aula prática português`
          );

          return `
            <div class="course-lesson">
              <h5>Aula ${lessonIndex + 1} — ${escapeHtml(lesson.title)}</h5>

              <p><strong>Objetivo da aula:</strong> ${escapeHtml(
                lesson.objective
              )}</p>

              <p><strong>Conteúdo da aula:</strong> ${escapeHtml(
                lesson.content
              )}</p>

              <p><strong>Exemplo prático:</strong> ${escapeHtml(
                lesson.example
              )}</p>

              ${renderVisualExample(lesson.visualExample)}

              <div class="video-suggestion-card">
                <p><strong>Vídeo prático sugerido</strong></p>
                <p>${escapeHtml(
                  lesson.videoSuggestion ||
                    "Assista a um vídeo prático relacionado a esta aula."
                )}</p>
                <a href="${escapeHtml(
                  youtubeUrl
                )}" target="_blank" rel="noopener noreferrer">
                  Buscar vídeo prático desta aula
                </a>
              </div>

              <p><strong>Atividade:</strong> ${escapeHtml(lesson.activity)}</p>
            </div>
          `;
        })
        .join("");

      return `
        <details class="course-module">
          <summary><strong>Módulo ${moduleIndex + 1} — ${escapeHtml(
        module.title
      )}</strong></summary>

          <p><strong>Resumo do módulo:</strong> ${escapeHtml(
            module.summary
          )}</p>

          <p><strong>Aulas do módulo:</strong></p>

          ${lessonsHtml}

          <p><strong>Exercício prático do módulo:</strong> ${escapeHtml(
            module.moduleExercise
          )}</p>
        </details>
      `;
    })
    .join("");

  return `
    <h2>${escapeHtml(course.title)}</h2>

    <p>${escapeHtml(course.description)}</p>

    <h3>Para quem é o curso</h3>
    <ul>
      ${course.audience.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>

    <h3>Objetivo principal</h3>
    <p>${escapeHtml(course.objective)}</p>

    <h3>Módulos do curso</h3>
    <p>${escapeHtml(course.modulesIntro)}</p>

    ${modulesHtml}

    <h3>Projeto final</h3>
    <p>${escapeHtml(course.finalProject)}</p>

    <h3>Critérios de conclusão</h3>
    <ul>
      ${course.completionCriteria
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("")}
    </ul>

    <h3>Próximos passos</h3>
    <p>${escapeHtml(course.nextSteps)}</p>
  `;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      message:
        "API com módulos, exemplos visuais e vídeos sugeridos ativa. Envie POST com { topic }."
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
Você é um especialista em criação de cursos online, educação prática e design instrucional.

Crie um curso completo em português sobre: "${topic}".

Retorne APENAS JSON válido.
Não use Markdown.
Não use HTML.
Não use crases.
Não escreva explicações fora do JSON.

O JSON precisa seguir exatamente esta estrutura:

{
  "title": "Título do curso",
  "description": "Descrição curta e atrativa do curso",
  "audience": [
    "Perfil de aluno 1",
    "Perfil de aluno 2",
    "Perfil de aluno 3",
    "Perfil de aluno 4"
  ],
  "objective": "Objetivo principal do curso",
  "modulesIntro": "Frase explicando como o curso está organizado",
  "modules": [
    {
      "title": "Nome do módulo",
      "summary": "Resumo do módulo",
      "moduleExercise": "Exercício prático do módulo",
      "lessons": [
        {
          "title": "Título da aula",
          "objective": "Objetivo da aula",
          "content": "Conteúdo da aula em texto corrido. Explique como uma mini aula para iniciante.",
          "example": "Exemplo prático aplicado ao tema",
          "visualExample": {
            "title": "Título do exemplo visual",
            "type": "wireframe, fluxo, checklist, comparação, mapa, estrutura, tabela ou sequência",
            "description": "Explique o que o exemplo visual representa",
            "items": [
              "Elemento visual 1",
              "Elemento visual 2",
              "Elemento visual 3",
              "Elemento visual 4",
              "Elemento visual 5"
            ]
          },
          "videoSuggestion": "Descreva qual tipo de vídeo prático ajudaria esta aula",
          "videoSearchQuery": "termo curto e específico para buscar vídeo prático no YouTube em português",
          "activity": "Atividade prática da aula"
        }
      ]
    }
  ],
  "finalProject": "Descrição do projeto final",
  "completionCriteria": [
    "Critério 1",
    "Critério 2",
    "Critério 3",
    "Critério 4"
  ],
  "nextSteps": "Próximos passos após concluir o curso"
}

Regras obrigatórias:
Crie exatamente 6 módulos.
Cada módulo deve ter exatamente 3 aulas.
Cada aula precisa ter objetivo, conteúdo, exemplo, exemplo visual, sugestão de vídeo, termo de busca de vídeo e atividade.
O conteúdo de cada aula deve ser útil, prático e explicado como uma mini aula.
O exemplo visual não deve ser uma imagem externa.
O exemplo visual deve ser uma representação prática em itens, como wireframe, fluxo, checklist, comparação, estrutura ou sequência.
O videoSearchQuery deve ser específico e útil para encontrar vídeos reais no YouTube.
Não gere links falsos.
Não invente URLs.
`;

  try {
    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: prompt,
        max_output_tokens: 12000
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

    const outputText =
      data.output_text ||
      data.output
        ?.flatMap((item) => item.content || [])
        ?.map((content) => content.text || "")
        ?.join("\n")
        ?.trim();

    if (!outputText) {
      return res.status(500).json({
        error: "A IA não retornou conteúdo."
      });
    }

    let course;

    try {
      course = JSON.parse(cleanJsonText(outputText));
    } catch (error) {
      console.error("Erro ao converter JSON:", outputText);

      return res.status(500).json({
        error: "A IA retornou um formato inválido. Tente gerar novamente."
      });
    }

    const html = renderCourseHtml(course);

    return res.status(200).json({
      course: html
    });
  } catch (error) {
    console.error("Erro interno:", error);

    return res.status(500).json({
      error: "Erro interno ao gerar curso"
    });
  }
}
