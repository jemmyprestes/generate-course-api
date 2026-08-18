const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

module.exports = async function handler(req, res) {
  // Permitir apenas POST
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido. Use POST."
    });
  }

  try {
    // Verificar API Key
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY não configurada na Vercel."
      });
    }

    const { course, numberOfQuestions = 10 } = req.body || {};

    // Verificar conteúdo do curso
    if (!course || typeof course !== "string" || !course.trim()) {
      return res.status(400).json({
        error: "O conteúdo do curso é obrigatório."
      });
    }

    // Limitar quantidade de perguntas
    const questionCount = Math.min(
      Math.max(parseInt(numberOfQuestions, 10) || 10, 5),
      20
    );

    /*
     * Limitar o tamanho enviado para a IA.
     * Isso evita enviar conteúdo excessivamente grande.
     */
    const courseContent = course.trim().slice(0, 50000);

    const systemPrompt = `
Você é um especialista em avaliação educacional.

Sua tarefa é criar um TESTE FINAL baseado EXCLUSIVAMENTE no conteúdo do curso fornecido pelo usuário.

REGRAS OBRIGATÓRIAS:

1. Crie exatamente ${questionCount} perguntas.
2. Todas as perguntas devem ser baseadas no conteúdo real do curso.
3. NÃO invente informações que não estejam presentes no curso.
4. Cada pergunta deve ter exatamente 4 alternativas.
5. Deve existir apenas UMA resposta correta.
6. Misture perguntas fáceis, médias e difíceis.
7. Evite perguntas ambíguas.
8. Não faça perguntas cuja resposta possa ser interpretada de duas maneiras.
9. Não repita a mesma pergunta.
10. As alternativas incorretas devem parecer plausíveis.
11. Não revele a resposta correta no texto da pergunta.
12. Não inclua explicações da resposta correta.
13. Não inclua a resposta correta em texto fora do campo "correctAnswer".
14. Retorne SOMENTE JSON válido.
15. O campo "correctAnswer" deve ser um número de 0 a 3 indicando a posição da alternativa correta.
16. A posição da resposta correta deve variar entre as perguntas.
17. Não coloque sempre a resposta correta na mesma posição.

ESTRUTURA OBRIGATÓRIA:

{
  "questions": [
    {
      "question": "Pergunta",
      "options": [
        "Alternativa 1",
        "Alternativa 2",
        "Alternativa 3",
        "Alternativa 4"
      ],
      "correctAnswer": 0
    }
  ]
}
`;

    const userPrompt = `
CONTEÚDO COMPLETO DO CURSO:

${courseContent}

Crie agora o teste final seguindo rigorosamente todas as regras.
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 4000,
      response_format: {
        type: "json_object"
      },
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ]
    });

    const rawContent = completion.choices?.[0]?.message?.content;

    if (!rawContent) {
      return res.status(500).json({
        error: "A OpenAI não retornou o teste."
      });
    }

    let test;

    try {
      test = JSON.parse(rawContent);
    } catch (parseError) {
      console.error("Erro ao interpretar JSON da OpenAI:", parseError);

      return res.status(500).json({
        error: "A IA retornou um formato inválido."
      });
    }

    // Validação adicional de segurança
    if (
      !test ||
      !Array.isArray(test.questions) ||
      test.questions.length !== questionCount
    ) {
      return res.status(500).json({
        error: "O teste gerado possui uma estrutura inválida."
      });
    }

    for (const question of test.questions) {
      if (
        !question.question ||
        !Array.isArray(question.options) ||
        question.options.length !== 4 ||
        !Number.isInteger(question.correctAnswer) ||
        question.correctAnswer < 0 ||
        question.correctAnswer > 3
      ) {
        return res.status(500).json({
          error: "Uma ou mais perguntas foram geradas em formato inválido."
        });
      }
    }

    /*
     * IMPORTANTE:
     *
     * Neste momento não enviamos o correctAnswer para o navegador.
     *
     * O navegador receberá apenas:
     * question
     * options
     *
     * A resposta correta fica armazenada temporariamente
     * no servidor através de um ID de teste.
     *
     * Para uma implementação realmente segura e persistente,
     * o próximo passo será guardar essas respostas em banco de dados.
     */

    const testId =
      "TEST-" +
      Date.now() +
      "-" +
      Math.random().toString(36).substring(2, 10);

    // Versão pública das perguntas
    const publicQuestions = test.questions.map((question, index) => ({
      id: index + 1,
      question: question.question,
      options: question.options
    }));

    /*
     * Por enquanto devolvemos o testId e as perguntas.
     *
     * A correção segura será feita posteriormente através
     * de uma rota /api/submit-test ligada ao banco de dados.
     */

    return res.status(200).json({
      success: true,
      testId,
      questions: publicQuestions,
      totalQuestions: questionCount,
      passingScore: 70
    });

  } catch (error) {
    console.error("Erro em /api/generate-test:", error);

    return res.status(500).json({
      error: "Erro interno ao gerar o teste.",
      details:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined
    });
  }
};
