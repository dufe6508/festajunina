export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: "ID do pagamento é obrigatório" });
  }

  // ⚠️ MODO DE TESTE — usando credenciais de teste do Mercado Pago.
  // Defina MP_ACCESS_TOKEN nas variáveis de ambiente do Vercel para produção.
  const ACCESS_TOKEN =
    process.env.MP_ACCESS_TOKEN ||
    "APP_USR-2977832363876431-061523-c77c1319ce55e8de2c46f5b62f08542d-1967932184";

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro MP status:", data);
      return res.status(response.status).json({ error: "Erro ao consultar pagamento", details: data });
    }

    return res.status(200).json({
      id: data.id,
      status: data.status, // approved, pending, rejected, in_process, cancelled
      status_detail: data.status_detail,
    });
  } catch (err) {
    console.error("Erro interno:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}
