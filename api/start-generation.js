// api/start-generation.js
const allowedOrigin = 'https://e-learn-landing.webflow.io';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({error:'Método não permitido.'});

  try {
    const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Configuração incompleta');
    const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
    if (!bearer) return res.status(401).json({error:'É necessário iniciar sessão.'});
    const auth = await fetch(`${url}/auth/v1/user`, {
      headers:{apikey:key,Authorization:`Bearer ${bearer[1]}`},
      signal:AbortSignal.timeout(15000)
    });
    if (!auth.ok) return res.status(auth.status >= 500 ? 503 : 401).json({error:'Não foi possível validar a sessão.'});
    const user = await auth.json();
    if (!user.id) return res.status(401).json({error:'Utilizador não identificado.'});

    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
    catch { return res.status(400).json({error:'JSON inválido.'}); }
    const {topic,level='iniciante',modules=6,goal='',audience='',style='profissional'} = body || {};
    if (typeof topic !== 'string' || !topic.trim()) return res.status(400).json({error:'O tema do curso é obrigatório.'});
    const count = Number(modules);
    const request = {
      topic:topic.trim().slice(0,300),
      level:['iniciante','intermediario','avancado'].includes(level)?level:'iniciante',
      modules:[4,6,8,10,12].includes(count)?count:6,
      goal:String(goal ?? '').trim().slice(0,1000),
      audience:String(audience ?? '').trim().slice(0,700),
      style:['profissional','academico','intensivo','workshop'].includes(style)?style:'profissional'
    };
    const response = await fetch(`${url}/rest/v1/rpc/start_or_resume_course_generation`, {
      method:'POST',
      headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({p_user_id:user.id,p_request_data:request}),
      signal:AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error('Falha ao registar trabalho');
    const result = await response.json();
    if (!result?.jobId) throw new Error('Resposta sem identificador');
    return res.status(result.created ? 201 : 200).json(result);
  } catch {
    return res.status(503).json({error:'Não foi possível iniciar ou recuperar a geração. Pode repetir as mesmas opções.'});
  }
}
