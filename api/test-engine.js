import {
  clampModuleCount,
  normalizeLevel,
  planningSchema,
  moduleSchema,
  renderCourseHtml
} from "../lib/course-engine.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Método não permitido."
    });
  }

  try {
    const html = renderCourseHtml({
      title: "Curso de teste",
      description: "Teste do motor de geração.",
      audience: [],
      objective: "Verificar a renderização.",
      modulesIntro: "",
      modules: [],
      nextSteps: ""
    });

    return res.status(200).json({
      success: true,
      engineLoaded: true,
      moduleCount: clampModuleCount(4),
      level: normalizeLevel("iniciante"),
      planningSchemaLoaded: !!planningSchema,
      moduleSchemaLoaded: !!moduleSchema,
      htmlGenerated: html.includes("Curso de teste")
    });

  } catch (error) {
    console.error("ENGINE TEST:", error);

    return res.status(500).json({
      success: false,
      error: "Falha ao testar o motor.",
      details: error.message
    });
  }
}
