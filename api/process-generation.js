import {
  callOpenAI, parseAIJson, planningSchema, moduleSchema,
  buildPlanningPrompt, buildModulePrompt, validatePlan,
  validateGeneratedModule, renderCourseHtml,
  clampModuleCount, normalizeLevel, normalizeStyle
} from '../lib/course-engine.js';

// Instalar como api/process-generation.js. Nunca expor a service role no browser.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = 'id,course_id,topic,status,total_modules,completed_modules,current_step,error_message,request_data,course_plan,generated_modules';

function reply(res, code, job, extra = {}) {
  return res.status(code).json({
    success: code < 400,
    jobId: job?.id,
    status: job?.status,
    courseId: job?.course_id,
    completedModules: job?.completed_modules,
    totalModules: job?.total_modules,
    currentStep: job?.current_step,
    ...extra
  });
}

async function boundedAI(options) {
  // O motor atual não aceita AbortSignal. Após o prazo, não usamos o resultado.
  // O token no banco impede que um pedido abandonado grave numa retoma.
  let timer;
  try {
    return await Promise.race([
      callOpenAI(options),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Prazo de geração excedido')), 240000);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://e-learn-landing.webflow.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return reply(res, 405, null, { error: 'Use POST.' });
  }

  const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
  if (!bearer) return reply(res, 401, null, { error: 'Autenticação obrigatória.' });
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return reply(res, 400, null, { error: 'JSON inválido.' });
  }
  if (!body || !UUID.test(body.jobId || '') ||
      (body.retry !== undefined && typeof body.retry !== 'boolean')) {
    return reply(res, 400, null, { error: 'Envie jobId válido e retry booleano opcional.' });
  }

  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return reply(res, 500, null, { error: 'Supabase não configurado no servidor.' });
  let userId;
  let job;
  let claim;
  let phase = 'database';

  async function db(path, data) {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`Falha Supabase (${response.status})`);
    return response.json();
  }
  const args = () => ({ p_job_id: body.jobId, p_user_id: userId });
  const rpc = (name, params = args()) => db(`rpc/${name}`, params);
  async function load() {
    const rows = await db(`course_generation_jobs?id=eq.${body.jobId}&user_id=eq.${userId}&select=${FIELDS}`);
    if (!Array.isArray(rows) || rows.length !== 1) return null;
    return rows[0];
  }

  try {
    const auth = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${bearer[1]}` },
      signal: AbortSignal.timeout(15000)
    });
    if (!auth.ok) {
      return reply(res, auth.status >= 500 ? 503 : 401, null, { error: 'Não foi possível validar a sessão.' });
    }
    userId = (await auth.json()).id;
    if (!UUID.test(userId || '')) return reply(res, 401, null, { error: 'Sessão inválida.' });
    job = await load();
    if (!job) return reply(res, 404, null, { error: 'Trabalho não encontrado.' });

    if (job.status === 'completed') return reply(res, 200, job);
    if (job.status === 'failed') {
      if (body.retry !== true) return reply(res, 409, job, { error: 'Geração interrompida. Envie retry: true para retomar.' });
      await rpc('resume_course_generation_job');
      job = await load();
    }
    if (job.status === 'pending') {
      await rpc('claim_course_generation_job');
      job = await load();
    }
    if (!job) return reply(res, 404, null, { error: 'Trabalho não encontrado.' });
    if (job.status === 'completed') return reply(res, 200, job);
    if (job.status !== 'processing') return reply(res, 409, job, { error: 'Estado incompatível com este processador.' });

    // A finalização também pode ser repetida após uma falha de rede.
    if (job.course_plan && job.completed_modules === job.total_modules) {
      phase = 'finalize';
      validatePlan(job.course_plan, job.total_modules);
      if (!Array.isArray(job.generated_modules) || job.generated_modules.length !== job.total_modules) {
        throw new Error('Módulos persistidos inconsistentes');
      }
      const modules = job.generated_modules.map((module, index) =>
        validateGeneratedModule(module, job.course_plan.modules[index], index));
      const html = renderCourseHtml({ ...job.course_plan, modules });
      if (!html?.trim()) throw new Error('HTML vazio');
      const courseId = await rpc('finalize_course_generation_job', { ...args(), p_content: html });
      return reply(res, 200, await load(), { courseId, course: html, step: 'completed' });
    }

    if (!process.env.OPENAI_API_KEY) return reply(res, 500, job, { error: 'OPENAI_API_KEY não configurada no servidor.' });
    const input = job.request_data || {};
    const topic = String(job.topic || '').trim().slice(0, 300);
    if (!topic) return reply(res, 422, job, { error: 'Trabalho sem tema válido.' });
    const options = {
      topic,
      level: normalizeLevel(input.level),
      style: normalizeStyle(input.style),
      goal: String(input.goal || '').trim().slice(0, 1000),
      audience: String(input.audience || '').trim().slice(0, 700)
    };

    if (!job.course_plan) {
      const token = await rpc('claim_course_plan');
      if (!token) return reply(res, 202, await load(), { busy: true });
      claim = { token, step: 'planning' };
      phase = 'planning';
      const count = clampModuleCount(input.modules ?? input.moduleCount ?? (job.total_modules || 6));
      const plan = parseAIJson(await boundedAI({
        apiKey: process.env.OPENAI_API_KEY,
        prompt: buildPlanningPrompt({ ...options, moduleCount: count }),
        schema: planningSchema, schemaName: 'course_plan', maxOutputTokens: 7000
      }));
      validatePlan(plan, count);
      phase = 'database';
      const saved = await rpc('complete_course_plan', {
        ...args(), p_claim_token: token, p_plan: plan, p_total_modules: count
      });
      claim = null;
      return reply(res, 202, await load(), { step: 'planning', saved, busy: !saved });
    }

    validatePlan(job.course_plan, job.total_modules);
    const rows = await rpc('claim_next_course_module');
    const next = rows?.[0];
    if (!next) return reply(res, 202, await load(), { busy: true });
    claim = { token: next.claim_token, step: 'module' };
    phase = 'module';
    const index = next.module_number - 1;
    const modulePlan = job.course_plan.modules[index];
    const module = validateGeneratedModule(parseAIJson(await boundedAI({
      apiKey: process.env.OPENAI_API_KEY,
      prompt: buildModulePrompt({ ...options, plan: job.course_plan, modulePlan, moduleIndex: index }),
      schema: moduleSchema, schemaName: 'course_module', maxOutputTokens: 12000
    })), modulePlan, index);
    if (module.lessons.some(lesson => !Array.isArray(lesson.content) ||
      !lesson.content.length || lesson.content.some(p => typeof p !== 'string' || !p.trim()))) {
      throw new Error('Módulo com conteúdo vazio ou inválido');
    }
    phase = 'database';
    const saved = await rpc('complete_course_module', {
      ...args(), p_module_number: next.module_number,
      p_module_data: module, p_claim_token: next.claim_token
    });
    claim = null;
    return reply(res, 202, await load(), { step: 'module', saved, busy: !saved });
  } catch {
    // Não divulgar mensagens do fornecedor nem dados do curso nos logs/respostas.
    const message = phase === 'planning' ? 'Não foi possível gerar o plano.' :
      phase === 'module' ? 'Não foi possível gerar o módulo.' :
      phase === 'finalize' ? 'Não foi possível finalizar o curso. Pode repetir o pedido.' :
      'Falha de comunicação. Consulte o trabalho antes de repetir o pedido.';
    if (claim) {
      try {
        await rpc('fail_course_generation_step', {
          ...args(), p_claim_token: claim.token, p_step: claim.step, p_error_message: message
        });
      } catch { /* Uma interrupção será recuperada pela expiração da reivindicação. */ }
    }
    return reply(res, 503, job, { error: message, refreshJob: true });
  }
}
