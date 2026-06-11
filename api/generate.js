export default function handler(req, res) {
  // CORS precisa vir antes de qualquer resposta
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Responde à requisição de pré-verificação do navegador
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Teste simples no navegador
  if (req.method === "GET") {
    return res.status(200).json({
      message: "API funcionando"
    });
  }

  // Só aceita POST para gerar curso
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido"
    });
  }

  const { topic } = req.body || {};

  if (!topic) {
    return res.status(400).json({
      error: "O campo topic é obrigatório"
    });
  }

  return res.status(200).json({
    course: `Curso gerado com sucesso para o tópico: ${topic}`
  });
}
