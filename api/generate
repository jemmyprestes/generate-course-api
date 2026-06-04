// File: api/generate-module.js
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
    const moduleTitle = (body.moduleTitle || '').toString().trim();
    const courseId = (body.courseId || '').toString().trim();

    if (!moduleTitle || !courseId) {
      return new Response(JSON.stringify({ error: 'moduleTitle and courseId are required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const module = {
      id: `module_${Date.now()}`,
      courseId,
      title: moduleTitle,
      summary: `Resumo do módulo ${moduleTitle}`,
      lessons: [
        { id: 1, title: 'Objetivos' },
        { id: 2, title: 'Conteúdo principal' }
      ],
      createdAt: new Date().toISOString()
    };

    return new Response(JSON.stringify(module), {
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
