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
    // CONFIGURAÇÃO
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
        error:
          "Configuração do Supabase incompleta."
      });

    }


    // ============================
    // TOKEN DO UTILIZADOR
    // ============================

    const authHeader =
      req.headers.authorization || "";


    const accessToken =
      authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;


    if (!accessToken) {

      return res.status(401).json({
        error:
          "Utilizador não autenticado."
      });

    }


    // ============================
    // IDENTIFICAR UTILIZADOR
    // ============================

    const userResponse =
      await fetch(
        `${SUPABASE_URL}/auth/v1/user`,
        {
          headers: {

            apikey:
              SUPABASE_SERVICE_ROLE_KEY,

            Authorization:
              `Bearer ${accessToken}`

          }
        }
      );


    if (!userResponse.ok) {

      return res.status(401).json({
        error:
          "Sessão inválida ou expirada."
      });

    }


    const user =
      await userResponse.json();


    if (!user?.id) {

      return res.status(401).json({
        error:
          "Não foi possível identificar o utilizador."
      });

    }


    // ============================
    // RECEBER DADOS
    // ============================

    const {
      testId,
      courseId,
      answers
    } = req.body || {};


    if (!testId) {

      return res.status(400).json({
        error:
          "testId é obrigatório."
      });

    }


    if (!courseId) {

      return res.status(400).json({
        error:
          "courseId é obrigatório."
      });

    }


    if (!Array.isArray(answers)) {

      return res.status(400).json({
        error:
          "As respostas são obrigatórias."
      });

    }


    // ============================
    // CONFIRMAR CURSO DO UTILIZADOR
    // ============================

    const courseResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/courses?id=eq.${encodeURIComponent(courseId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,title`,
        {
          headers: {

            apikey:
              SUPABASE_SERVICE_ROLE_KEY,

            Authorization:
              `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`

          }
        }
      );


    const courses =
      await courseResponse.json();


    if (
      !courseResponse.ok ||
      !Array.isArray(courses) ||
      courses.length === 0
    ) {

      return res.status(403).json({
        error:
          "Este curso não pertence ao utilizador."
      });

    }


    const course =
      courses[0];


    // ============================
    // BUSCAR GABARITO
    // ============================

    const keyResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/course_test_keys?test_id=eq.${encodeURIComponent(testId)}&select=answers`,
        {
          headers: {

            apikey:
              SUPABASE_SERVICE_ROLE_KEY,

            Authorization:
              `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`

          }
        }
      );


    const keyData =
      await keyResponse.json();


    if (
      !keyResponse.ok ||
      !Array.isArray(keyData) ||
      keyData.length === 0
    ) {

      return res.status(404).json({
        error:
          "Teste não encontrado."
      });

    }


    const answerKey =
      keyData[0].answers;


    if (!Array.isArray(answerKey)) {

      return res.status(500).json({
        error:
          "Gabarito inválido."
      });

    }


    // ============================
    // CORRIGIR
    // ============================

    let correctAnswers = 0;


    answerKey.forEach(
      (correct) => {

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

      }
    );


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


    // ============================
    // CONTAR TENTATIVAS ANTERIORES
    // ============================

    const attemptsResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/course_tests?user_id=eq.${encodeURIComponent(user.id)}&course_id=eq.${encodeURIComponent(courseId)}&select=attempts&order=attempts.desc&limit=1`,
        {
          headers: {

            apikey:
              SUPABASE_SERVICE_ROLE_KEY,

            Authorization:
              `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`

          }
        }
      );


    let attempts = 1;


    if (attemptsResponse.ok) {

      const previousAttempts =
        await attemptsResponse.json();


      if (
        Array.isArray(previousAttempts) &&
        previousAttempts.length > 0
      ) {

        attempts =
          Number(
            previousAttempts[0].attempts || 0
          ) + 1;

      }

    }


    // ============================
    // SALVAR RESULTADO
    // ============================

    const saveResultResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/course_tests`,
        {
          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            apikey:
              SUPABASE_SERVICE_ROLE_KEY,

            Authorization:
              `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

            Prefer:
              "return=representation"

          },

          body: JSON.stringify({

            test_id:
              testId,

            course_id:
              courseId,

            user_id:
              user.id,

            course_topic:
              course.title,

            answers:
              answers,

            total_questions:
              totalQuestions,

            passing_score:
              passingScore,

            score:
              score,

            passed:
              passed,

            attempts:
              attempts,

            passed_at:
              passed
                ? new Date().toISOString()
                : null

          })

        }
      );


    const savedResult =
      await saveResultResponse.json();


    if (!saveResultResponse.ok) {

      console.error(
        "ERRO AO SALVAR RESULTADO:",
        savedResult
      );


      return res.status(500).json({
        error:
          "O teste foi corrigido, mas não foi possível salvar o resultado."
      });

    }


    console.log(
      "RESULTADO SALVO:",
      {
        userId: user.id,
        courseId,
        score,
        passed,
        attempts
      }
    );


    // ============================
    // RESULTADO
    // ============================

    return res.status(200).json({

      success: true,

      testId,

      correctAnswers,

      totalQuestions,

      score,

      passingScore,

      passed,

      attempts

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
