// api/start-generation.js

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const allowedOrigin = "https://e-learn-landing.webflow.io";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido."
    });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      throw new Error("Configuração Supabase incompleta.");
    }

    // 1. Validar autenticação
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";

    if (!token) {
      return res.status(401).json({
        error: "É necessário iniciar sessão."
      });
    }

    const userResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!userResponse.ok) {
      return res.status(401).json({
        error: "Sessão inválida ou expirada."
      });
    }

    const user = await userResponse.json();

    if (!user.id) {
      return res.status(401).json({
        error: "Utilizador não identificado."
      });
    }

    // 2. Validar opções do curso
    const {
      topic,
      level = "iniciante",
      modules = 6,
      goal = "",
      audience = "",
      style = "profissional"
    } = req.body || {};

    if (typeof topic !== "string" || !topic.trim()) {
      return res.status(400).json({
        error: "O tema do curso é obrigatório."
      });
    }

    const allowedLevels = [
      "iniciante", "intermediario", "avancado"
    ];

    const allowedStyles = [
      "profissional", "academico",
      "intensivo", "workshop"
    ];

    const moduleCount = Number(modules);

    const requestData = {
      topic: topic.trim().slice(0, 300),
      level: allowedLevels.includes(level)
        ? level
        : "iniciante",
      modules: [4, 6, 8, 10, 12].includes(moduleCount)
        ? moduleCount
        : 6,
      goal: String(goal).trim().slice(0, 1000),
      audience: String(audience).trim().slice(0, 700),
      style: allowedStyles.includes(style)
        ? style
        : "profissional"
    };

    // 3. Criar trabalho no Supabase
    const insertResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/course_generation_jobs`,
      {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          user_id: user.id,
          topic: requestData.topic,
          status: "pending",
          total_modules: requestData.modules,
          completed_modules: 0,
          current_step: "A aguardar planejamento",
          request_data: requestData
        })
      }
    );

    if (!insertResponse.ok) {
      const details = await insertResponse.text();
      console.error("SUPABASE INSERT ERROR:", details);

      throw new Error("Não foi possível registar a geração.");
    }

    const jobs = await insertResponse.json();
    const job = jobs[0];

    if (!job?.id) {
      throw new Error("A geração não recebeu um identificador.");
    }

    // 4. Responder sem iniciar a geração ainda
    return res.status(201).json({
      success: true,
      jobId: job.id,
      status: job.status,
      totalModules: job.total_modules,
      completedModules: job.completed_modules
    });

  } catch (error) {
    console.error("START GENERATION ERROR:", error);

    return res.status(500).json({
      error: "Não foi possível iniciar a geração."
    });
  }
}
