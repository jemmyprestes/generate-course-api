// File: api/generate.js
export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'ORIGIN',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'Content-Type must be application/json' }), {
        status: 415,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const topic = (body.topic || '').toString().trim();
    const level = (body.level || 'beginner').toString().trim();

    if (!topic) {
      return new Response(JSON.stringify({ error: 'topic is required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    // Geração simples de exemplo; substitua pela sua lógica (LLM, templates, DB)
    const course = {
      id: `course_${Date.now()}`,
      title: `Curso de ${topic}`,
      level,
      createdAt: new Date().toISOString(),
      modules: [
        { id: 1, title: 'Introdução', summary: `Visão geral do ${topic}` },
        { id: 2, title: 'Fundamentos', summary: 'Conceitos essenciais' }
      ]
    };

    return new Response(JSON.stringify(course), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_server_error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}
