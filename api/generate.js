export default function handler(req, res) {
  const ALLOWED_ORIGIN = "https://e-learn-landing.webflow.io";

  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const { topic } = req.body || {};

  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  const html = `
    <h2>Curso de ${topic}</h2>
    <p>Conteúdo gerado com sucesso.</p>
  `;

  return res.status(200).json({ ok: true, html });
}
