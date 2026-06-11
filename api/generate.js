function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanJsonText(text) {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

async function searchPexelsImage(query) {
  if (!process.env.PEXELS_API_KEY || !query) {
    return {
      fallback: true,
      searchUrl: `https://www.pexels.com/search/${encodeURIComponent(query || "")}/`
    };
  }

  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(
      query
    )}&per_page=1&orientation=landscape`;

    const response = await fetch(url, {
      headers: {
        Authorization: process.env.PEXELS_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro Pexels API:", response.status, errorText);

      return {
        fallback: true,
        searchUrl: `https://www.pexels.com/search/${encodeURIComponent(query)}/`
      };
    }

    const data = await response.json();
    const photo = data.photos?.[0];

    if (!photo) {
      console.log("Nenhuma imagem encontrada para:", query);

      return {
        fallback: true,
        searchUrl: `https://www.pexels.com/search/${encodeURIComponent(query)}/`
      };
    }

    return {
      fallback: false,
      src: photo.src?.large || photo.src?.medium || photo.src?.original,
      alt: photo.alt || query,
      photographer: photo.photographer || "",
      pageUrl: photo.url || ""
    };
  } catch (error) {
    console.error("Erro ao buscar imagem no Pexels:", error);

    return {
      fallback: true,
      searchUrl: `https://www.pexels.com/search/${encodeURIComponent(query)}/`
    };
  }
}

async function searchYouTubeVideo(query) {
  if (!process.env.YOUTUBE_API_KEY || !query) return null;

  try {
    const searchQuery = `${query} aula tutorial português`;

    const url =
      `https://www.googleapis.com/youtube/v3/search` +
      `?part=snippet` +
      `&type=video` +
      `&maxResults=1` +
      `&safeSearch=moderate` +
      `&videoEmbeddable=true` +
      `&relevanceLanguage=pt` +
      `&regionCode=BR` +
      `&q=${encodeURIComponent(searchQuery)}` +
      `&key=${process.env.YOUTUBE_API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) return null;

    const data = await response.json();
    const item = data.items?.[0];

    if (!item?.id?.videoId) return null;

    return {
      videoId: item.id.videoId,
      title: item.snippet?.title || "Vídeo sugerido"
    };
  } catch (error) {
    console.error("Erro ao buscar vídeo no YouTube:", error);
    return null;
  }
}

function renderCourseHtml(course) {
  const modulesHtml = course.modules
    .map((module, moduleIndex) => {
      const lessonsHtml = module.lessons
        .map((lesson, lessonIndex) => {
          const imageHtml = lesson.image?.src
  ? `
    <div class="media-card">
      <p><strong>Imagem de apoio</strong></p>
      <img src="${escapeHtml(lesson.image.src)}" alt="${escapeHtml(
        lesson.image.alt
      )}" loading="lazy" />
      ${
        lesson.image.photographer
          ? `<p class="media-credit">Foto: ${escapeHtml(
              lesson.image.photographer
            )}</p>`
          : ""
      }
    </div>
  `
  : lesson.image?.searchUrl
    ? `
      <div class="media-card">
        <p><strong>Imagem de apoio</strong></p>
        <p>Não consegui carregar uma imagem automaticamente, mas você pode abrir uma busca pronta:</p>
        <a href="${escapeHtml(lesson.image.searchUrl)}" target="_blank" rel="noopener noreferrer">
          Buscar imagem para esta aula
        </a>
      </div>
    `
    : `
      <div class="media-card">
        <p><strong>Imagem de apoio:</strong> nenhuma imagem encontrada para esta aula.</p>
      </div>
    `;

          const videoHtml = lesson.video
            ? `
              <div class="media-card">
                <p><strong>Vídeo prático</strong></p>
                <div class="video-wrapper">
                  <iframe
                    src="https://www.youtube.com/embed/${escapeHtml(
                      lesson.video.videoId
                    )}"
                    title="${escapeHtml(lesson.video.title)}"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen>
                  </iframe>
                </div>
                <p class="media-credit">${escapeHtml(lesson.video.title)}</p>
              </div>
            `
            : "";

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

              <div class="lesson-media">
                ${imageHtml}
                ${videoHtml}
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
    message: "API com imagens e vídeos ativa - versão 2"
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

  const missingKeys = [];

  if (!process.env.OPENAI_API_KEY) missingKeys.push("OPENAI_API_KEY");
  if (!process.env.PEXELS_API_KEY) missingKeys.push("PEXELS_API_KEY");
  if (!process.env.YOUTUBE_API_KEY) missingKeys.push("YOUTUBE_API_KEY");

  if (missingKeys.length > 0) {
    return res.status(500).json({
      error: `Variáveis não configuradas na Vercel: ${missingKeys.join(", ")}`
    });
  }

  const prompt = `
Você é um especialista em criação de cursos online.

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
          "activity": "Atividade prática da aula",
          "imageQuery": "termo curto para buscar uma imagem prática no Pexels",
          "videoQuery": "termo curto para buscar um vídeo prático no YouTube"
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

Regras:
Crie exatamente 6 módulos.
Cada módulo deve ter exatamente 3 aulas.
Cada aula precisa ter objetivo, conteúdo, exemplo, atividade, imageQuery e videoQuery.
O conteúdo de cada aula precisa ser útil e prático, não apenas uma frase curta.
Os termos imageQuery e videoQuery devem ser específicos e fáceis de buscar.
Para videoQuery, prefira termos em português quando fizer sentido.
`;

  try {
    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
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

    const mediaTasks = [];

    course.modules.forEach((module) => {
      module.lessons.forEach((lesson) => {
        mediaTasks.push(
          Promise.all([
            searchPexelsImage(lesson.imageQuery),
            searchYouTubeVideo(lesson.videoQuery)
          ]).then(([image, video]) => {
            lesson.image = image;
            lesson.video = video;
          })
        );
      });
    });

    await Promise.all(mediaTasks);

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
