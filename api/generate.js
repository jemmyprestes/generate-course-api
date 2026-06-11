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

function normalizePosition(position = "center") {
  const allowedPositions = [
    "top",
    "upper-left",
    "upper-right",
    "center",
    "middle-left",
    "middle-right",
    "bottom",
    "bottom-left",
    "bottom-right"
  ];

  return allowedPositions.includes(position) ? position : "center";
}

function renderParagraphs(content) {
  if (Array.isArray(content)) {
    return content
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join("");
  }

  return `<p>${escapeHtml(content)}</p>`;
}

function renderLayoutVisual(visualExample) {
  const annotations = Array.isArray(visualExample.annotations)
    ? visualExample.annotations
    : [];

  return `
    <div class="visual-canvas">
      <div class="layout-board">
        <div class="layout-board-label">
          ${escapeHtml(visualExample.canvasLabel || "Modelo visual")}
        </div>

        ${annotations
          .map((annotation, index) => {
            const position = normalizePosition(annotation.position);

            return `
              <div class="layout-point layout-${position}">
                <span>${index + 1}</span>
                <strong>${escapeHtml(annotation.label || `Ponto ${index + 1}`)}</strong>
                <small>${escapeHtml(annotation.description || "")}</small>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderFlowVisual(visualExample) {
  const steps = Array.isArray(visualExample.steps) ? visualExample.steps : [];

  return `
    <div class="flow-visual">
      ${steps
        .map(
          (step, index) => `
            <div class="flow-step">
              <span>${index + 1}</span>
              <div>
                <strong>${escapeHtml(step.label || `Etapa ${index + 1}`)}</strong>
                <p>${escapeHtml(step.description || "")}</p>
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderComparisonVisual(visualExample) {
  const columns = Array.isArray(visualExample.columns)
    ? visualExample.columns
    : [];

  return `
    <div class="comparison-visual">
      ${columns
        .map(
          (column) => `
            <div class="comparison-column">
              <h6>${escapeHtml(column.title || "Comparação")}</h6>
              <ul>
                ${(Array.isArray(column.items) ? column.items : [])
                  .map((item) => `<li>${escapeHtml(item)}</li>`)
                  .join("")}
              </ul>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderDialogueVisual(visualExample) {
  const dialogue = Array.isArray(visualExample.dialogue)
    ? visualExample.dialogue
    : [];

  return `
    <div class="dialogue-visual">
      ${dialogue
        .map(
          (line, index) => `
            <div class="dialogue-bubble ${index % 2 === 0 ? "left" : "right"}">
              <strong>${escapeHtml(line.speaker || "Pessoa")}</strong>
              <p>${escapeHtml(line.text || "")}</p>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderCardsVisual(visualExample) {
  const cards = Array.isArray(visualExample.cards) ? visualExample.cards : [];

  return `
    <div class="cards-visual">
      ${cards
        .map(
          (card, index) => `
            <div class="visual-card-item">
              <span>${index + 1}</span>
              <strong>${escapeHtml(card.label || `Item ${index + 1}`)}</strong>
              <p>${escapeHtml(card.description || "")}</p>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderVisualExample(visualExample) {
  if (!visualExample) return "";

  const visualType = visualExample.visualType || "cards";

  let visualHtml = "";

  if (visualType === "layout") {
    visualHtml = renderLayoutVisual(visualExample);
  } else if (visualType === "flow") {
    visualHtml = renderFlowVisual(visualExample);
  } else if (visualType === "comparison") {
    visualHtml = renderComparisonVisual(visualExample);
  } else if (visualType === "dialogue") {
    visualHtml = renderDialogueVisual(visualExample);
  } else {
    visualHtml = renderCardsVisual(visualExample);
  }

  return `
    <div class="visual-example-card">
      <p class="visual-label"><strong>Exemplo visual prático</strong></p>
      <h6>${escapeHtml(visualExample.title || "Exemplo visual")}</h6>
      <p>${escapeHtml(visualExample.description || "")}</p>
      ${visualHtml}
    </div>
  `;
}

function renderCourseHtml(course) {
  const modules = Array.isArray(course.modules) ? course.modules : [];

  const modulesHtml = modules
    .map((module, moduleIndex) => {
      const lessons = Array.isArray(module.lessons) ? module.lessons : [];

      const lessonsHtml = lessons
        .map((lesson, lessonIndex) => {
          const youtubeQuery =
            lesson.videoSearchQuery ||
            `${course.title} ${module.title} ${lesson.title} aula prática português`;

          const youtubeUrl = createYouTubeSearchUrl(youtubeQuery);

          return `
            <div class="course-lesson">
              <h5>Aula ${lessonIndex + 1} — ${escapeHtml(lesson.title)}</h5>

              <p><strong>Objetivo da aula:</strong> ${escapeHtml(
                lesson.objective
              )}</p>

              <div class="lesson-content">
                <p><strong>Conteúdo da aula:</strong></p>
                ${renderParagraphs(lesson.content)}
              </div>

              <div class="guided-practice">
                <p><strong>Prática guiada:</strong></p>
                ${renderParagraphs(lesson.guidedPractice)}
              </div>

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
          <summary>
            <strong>Módulo ${moduleIndex + 1} — ${escapeHtml(module.title)}</strong>
          </summary>

          <p><strong>Resumo do módulo:</strong> ${escapeHtml(module.summary)}</p>

          <p><strong>Aulas do módulo:</strong></p>

          ${lessonsHtml}

          <p><strong>Exercício prático do módulo:</strong> ${escapeHtml(
            module.moduleExercise
          )}</p>
        </details>
      `;
    })
    .join("");

  const audience = Array.isArray(course.audience) ? course.audience : [];
  const completionCriteria = Array.isArray(course.completionCriteria)
    ? course.completionCriteria
    : [];

  return `
    <h2>${escapeHtml(course.title)}</h2>

    <p>${escapeHtml(course.description)}</p>

    <h3>Para quem é o curso</h3>
    <ul>
      ${audience.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
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
      ${completionCriteria
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
        "API com conteúdo detalhado, visuais adaptativos e vídeos sugeridos ativa. Envie POST com { topic }."
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
Você é um especialista em criação de cursos online, design instrucional e aulas práticas.

Crie um curso completo em português sobre: "${topic}".

Retorne APENAS JSON válido.
Não use Markdown.
Não use HTML.
Não use crases.
Não escreva explicações fora do JSON.
Não invente URLs.
Não gere links falsos.

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
          "content": [
            "Parágrafo 1 da aula, explicando o conceito principal com profundidade.",
            "Parágrafo 2 da aula, mostrando como esse conceito funciona na prática.",
            "Parágrafo 3 da aula, explicando cuidados, erros comuns ou detalhes importantes."
          ],
          "guidedPractice": [
            "Passo 1 da prática guiada.",
            "Passo 2 da prática guiada.",
            "Passo 3 da prática guiada."
          ],
          "example": "Exemplo prático aplicado ao tema",
          "visualExample": {
            "title": "Título do exemplo visual",
            "description": "Explique o que o visual representa",
            "visualType": "layout, flow, comparison, dialogue ou cards",
            "canvasLabel": "Use somente quando visualType for layout",
            "annotations": [
              {
                "label": "Ponto visual",
                "position": "top",
                "description": "Explicação do ponto visual"
              }
            ],
            "steps": [
              {
                "label": "Etapa do fluxo",
                "description": "Descrição da etapa"
              }
            ],
            "columns": [
              {
                "title": "Coluna 1",
                "items": ["Item 1", "Item 2", "Item 3"]
              },
              {
                "title": "Coluna 2",
                "items": ["Item 1", "Item 2", "Item 3"]
              }
            ],
            "cards": [
              {
                "label": "Conceito",
                "description": "Descrição do conceito"
              }
            ],
            "dialogue": [
              {
                "speaker": "Pessoa A",
                "text": "Frase do diálogo"
              },
              {
                "speaker": "Pessoa B",
                "text": "Resposta do diálogo"
              }
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
Cada aula precisa ter objetivo, conteúdo, prática guiada, exemplo prático, exemplo visual, sugestão de vídeo, termo de busca de vídeo e atividade.

O conteúdo de cada aula precisa ser desenvolvido.
Não escreva apenas um resumo.
Cada aula deve ter exatamente 3 parágrafos no campo content.
Cada parágrafo do campo content deve ter entre 45 e 90 palavras.
A prática guiada deve ter exatamente 3 passos.

Escolha o visualType conforme o assunto da aula:
- Use "layout" apenas para páginas, telas, interfaces, design, organização visual ou estruturas espaciais.
- Use "flow" para processos, passo a passo, jornadas, métodos, receitas, programação, atendimento, funis ou sequências.
- Use "comparison" para comparar conceitos, opções, antes/depois, certo/errado, vantagens/desvantagens.
- Use "dialogue" para idiomas, comunicação, vendas, atendimento, entrevistas, conversação ou situações com fala.
- Use "cards" para conceitos, vocabulário, regras, componentes, ferramentas, pilares ou listas explicativas.

Para visualType "layout":
- Use annotations.
- Use posições: top, upper-left, upper-right, center, middle-left, middle-right, bottom, bottom-left, bottom-right.
- Use entre 4 e 6 annotations.

Para visualType "flow":
- Use steps.
- Use entre 4 e 6 steps.

Para visualType "comparison":
- Use columns.
- Use exatamente 2 columns.
- Cada column deve ter entre 3 e 5 items.

Para visualType "dialogue":
- Use dialogue.
- Use entre 4 e 6 falas.

Para visualType "cards":
- Use cards.
- Use entre 4 e 6 cards.

Não deixe campos importantes vazios.
Não gere links.
Não invente URLs.
O videoSearchQuery deve ser específico e útil para encontrar vídeos reais no YouTube.
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
        max_output_tokens: 14000
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
