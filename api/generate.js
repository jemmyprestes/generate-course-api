export default async function handler(req, res) {
  try {
    // Ler raw body
    const raw = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });

    console.log('Raw request body:', raw);

    const contentType = (req.headers['content-type'] || '').toLowerCase();

    // Parse flexível: JSON ou form-urlencoded
    let body = {};
    if (contentType.includes('application/json')) {
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch (parseErr) {
        console.error('JSON parse error:', parseErr.message);
        return res.status(400).json({ error: 'Invalid JSON', details: parseErr.message, raw });
      }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(raw);
      body = Object.fromEntries(params.entries());
    } else {
      // tentativa segura de parse JSON como fallback
      try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
    }

    // Validação simples
    if (!body.topic || typeof body.topic !== 'string') {
      return res.status(400).json({ error: 'Invalid payload', details: 'topic is required and must be a string', received: body });
    }

    // --- A partir daqui, coloque seu código existente que usa body.topic ---
    // Exemplo de resposta de teste:
    return res.status(200).json({ ok: true, received: body });
  } catch (err) {
    console.error('Handler unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
