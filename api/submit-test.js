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
      error: "Método não permitido."
    });
  }

  try {

    // ============================
    // VARIÁVEIS DE AMBIENTE
    // ============================

    const SUPABASE_URL =
      process.env.SUPABASE_URL;

    const SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      return res.status(500).json({
        error: "Configuração do Supabase incompleta."
      });
    }


    // ============================
    // RECEBER TESTE + RESPOSTAS
    // ============================

    const {
      testId,
      answers
    } = req.body || {};


    if (!testId) {
      return res.status(400).json({
        error: "testId é obrigatório."
      });
    }


    if (!Array.isArray(answers)) {
      return res.status(400).json({
        error: "As respostas são obrigatórias."
      });
    }


    // ============================
    // BUSCAR GABARITO PRIVADO
    // ============================

    const keyResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/course_test_keys?test_id=eq.${encodeURIComponent(testId)}&select=answers`,
      {
        method: "GET",

        headers: {
          "apikey":
            SUPABASE_SERVICE_ROLE_KEY,

          "Authorization":
            `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

          "Accept":
            "application/json"
        }
      }
    );


    if (!keyResponse.ok) {

      const errorText =
        await keyResponse.text();

      console.error(
        "ERRO AO BUSCAR GABARITO:",
        errorText
      );

      return res.status(500).json({
        error:
          "Não foi possível consultar o gabarito."
      });
    }


    const keyData =
      await keyResponse.json();


    if (
      !Array.isArray(keyData) ||
      keyData.length === 0
    ) {
      return res.status(404).json({
        error:
          "Teste não encontrado ou expirado."
      });
    }


    const answerKey =
      keyData[0].answers;


    if (!Array.isArray(answerKey)) {
      return res.status(500).json({
        error:
          "Gabarito armazenado em formato inválido."
      });
    }


    // ============================
    // CORRIGIR TESTE
    // ============================

    let correctAnswers = 0;


    answerKey.forEach((correct) => {

      const studentAnswer =
        answers.find(
          answer =>
            Number(answer.id) ===
            Number(correct.id)
        );


      if (
        studentAnswer &&
        Number(studentAnswer.answer) ===
        Number(correct.correctAnswer)
      ) {
        correctAnswers++;
      }

    });


    // ============================
    // CALCULAR RESULTADO
    // ============================

    const totalQuestions =
      answerKey.length;


    const score =
      Math.round(
        (correctAnswers /
          totalQuestions) * 100
      );


    const passingScore = 70;

    const passed =
      score >= passingScore;


    console.log(
      "TESTE CORRIGIDO:",
      {
        testId,
        correctAnswers,
        totalQuestions,
        score,
        passed
      }
    );


    // ============================
    // RESPOSTA PARA O WEBFLOW
    // ============================

    return res.status(200).json({

      success: true,

      testId,

      correctAnswers,

      totalQuestions,

      score,

      passingScore,

      passed

    });


  } catch (error) {

    console.error(
      "ERRO EM SUBMIT-TEST:",
      error
    );


    return res.status(500).json({
      error:
        "Erro interno ao corrigir o teste."
    });

  }
}
