export default async function handler(req, res) {
  // ============================
  // CORS
  // ============================

  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://e-learn-landing.webflow.io"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido. Use POST."
    });
  }

  try {
    // ============================
    // VARIÁVEIS DE AMBIENTE
    // ============================

    const OPENAI_API_KEY =
      process.env.OPENAI_API_KEY;

    const SUPABASE_URL =
      process.env.SUPABASE_URL;

    const SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY;


    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY não configurada."
      });
    }


    if (
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      return res.status(500).json({
        error:
          "Configuração do Supabase incompleta na Vercel."
      });
    }


    // ============================
    // DADOS RECEBIDOS
    // ============================

    const {
      course,
      content,
      topic,
      courseTopic,
      title,
      numberOfQuestions = 10
    } = req.body || {};


    let rawCourseContent =
      course || content;


    if (
      rawCourseContent &&
      typeof rawCourseContent !== "string"
    ) {
      rawCourseContent =
        JSON.stringify(
          rawCourseContent,
          null,
          2
        );
    }


    if (
      !rawCourseContent ||
      typeof rawCourseContent !== "string" ||
      !rawCourseContent.trim()
    ) {
      return res.status(400).json({
        error:
          "O conteúdo do curso é obrigatório."
      });
    }


    // ============================
    // QUANTIDADE DE PERGUNTAS
    // ============================

    const questionCount =
      Math.min(
        Math.max(
          parseInt(
            numberOfQuestions,
            10
          ) || 10,
          5
        ),
        20
      );


    const courseContent =
      rawCourseContent
        .trim()
        .slice(0, 50000);


    const courseTitle =
      topic ||
      courseTopic ||
      title ||
      "Curso";


    // ============================
    // PROMPT
    // ============================

    const systemPrompt = `
Você é um especialista em avaliação educacional.

Sua tarefa é criar um TESTE FINAL baseado EXCLUSIVAMENTE no conteúdo do curso fornecido.

REGRAS OBRIGATÓRIAS:

1. Crie exatamente ${questionCount} perguntas.
2. Todas as perguntas devem ser baseadas no conteúdo real do curso.
3. NÃO invente informações que não estejam presentes no curso.
4. Cada pergunta deve ter exatamente 4 alternativas.
5. Deve existir apenas UMA resposta correta.
6. Misture perguntas fáceis, médias e difíceis.
7. Evite perguntas ambíguas.
8. Não repita perguntas.
9. As alternativas incorretas devem ser plausíveis.
10. Não revele a resposta correta no texto da pergunta.
11. O campo "correctAnswer" deve ser um número de 0 a 3.
12. A posição da resposta correta deve variar.
13. Retorne SOMENTE JSON válido.

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
TÍTULO DO CURSO:

${courseTitle}

CONTEÚDO DO CURSO:

${courseContent}

Crie agora o teste final seguindo rigorosamente as regras.
`;


    // ============================
    // GERAR TESTE COM OPENAI
    // ============================

    const openAIResponse =
      await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${OPENAI_API_KEY}`
          },

          body: JSON.stringify({
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
          })
        }
      );


    const openAIData =
      await openAIResponse.json();


    if (!openAIResponse.ok) {
      console.error(
        "ERRO OPENAI:",
        openAIData
      );

      return res.status(500).json({
        error:
          "Erro ao gerar o teste com a IA."
      });
    }


    const rawContent =
      openAIData
        .choices?.[0]
        ?.message?.content;


    if (!rawContent) {
      return res.status(500).json({
        error:
          "A OpenAI não retornou o teste."
      });
    }


    // ============================
    // INTERPRETAR JSON
    // ============================

    let test;

    try {
      test =
        JSON.parse(rawContent);
    } catch (error) {

      console.error(
        "ERRO JSON:",
        error
      );

      return res.status(500).json({
        error:
          "A IA retornou um formato inválido."
      });
    }


    // ============================
    // VALIDAR TESTE
    // ============================

    if (
      !test ||
      !Array.isArray(test.questions) ||
      test.questions.length !==
        questionCount
    ) {
      return res.status(500).json({
        error:
          "Estrutura inválida do teste."
      });
    }


    for (
      const question
      of test.questions
    ) {

      if (
        !question.question ||
        !Array.isArray(
          question.options
        ) ||
        question.options.length !== 4 ||
        !Number.isInteger(
          question.correctAnswer
        ) ||
        question.correctAnswer < 0 ||
        question.correctAnswer > 3
      ) {

        return res.status(500).json({
          error:
            "Uma ou mais perguntas possuem formato inválido."
        });

      }
    }


    // ============================
    // CRIAR ID DO TESTE
    // ============================

    const testId =
      "TEST-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .substring(2, 10);


    // ============================
    // GABARITO PRIVADO
    // ============================

    const answerKey =
      test.questions.map(
        (question, index) => ({
          id: index + 1,
          correctAnswer:
            question.correctAnswer
        })
      );


    // ============================
    // SALVAR GABARITO NO SUPABASE
    // ============================

    const saveKeyResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/course_test_keys`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "apikey":
              SUPABASE_SERVICE_ROLE_KEY,

            "Authorization":
              `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

            "Prefer":
              "return=minimal"
          },

          body: JSON.stringify({
            test_id: testId,
            answers: answerKey
          })
        }
      );


    if (!saveKeyResponse.ok) {

      const saveError =
        await saveKeyResponse.text();


      console.error(
        "ERRO AO SALVAR GABARITO:",
        saveError
      );


      return res.status(500).json({
        error:
          "Não foi possível salvar o gabarito do teste."
      });
    }


    console.log(
      "GABARITO SALVO:",
      testId
    );


    // ============================
    // VERSÃO PÚBLICA
    // ============================

    const publicQuestions =
      test.questions.map(
        (question, index) => ({
          id: index + 1,

          question:
            question.question,

          options:
            question.options
        })
      );


    // ============================
    // RESPOSTA PARA O WEBFLOW
    // ============================

    return res.status(200).json({
      success: true,

      testId,

      questions:
        publicQuestions,

      totalQuestions:
        questionCount,

      passingScore: 70
    });


  } catch (error) {

    console.error(
      "ERRO EM GENERATE-TEST:",
      error
    );


    return res.status(500).json({
      error:
        "Erro interno ao gerar o teste."
    });

  }
}
