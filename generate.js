export default function handler(req, res) {
  res.status(200).json({
    message: "API funcionando"
  });
  }
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { topic } = req.body;

  res.status(200).json({
    course: `Curso gerado com sucesso para o tópico: ${topic}`
  });
}
