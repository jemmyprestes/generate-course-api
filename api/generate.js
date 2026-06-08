export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { topic } = req.body;

  // Aqui você coloca sua lógica real depois
  res.status(200).json({
    course: `Curso gerado com sucesso para o tópico: ${topic}`
  });
}
