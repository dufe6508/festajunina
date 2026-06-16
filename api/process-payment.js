export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ⚠️ MODO DE TESTE — usando credenciais de teste do Mercado Pago.
  // Defina MP_ACCESS_TOKEN nas variáveis de ambiente do Vercel para produção.
  const ACCESS_TOKEN =
    process.env.MP_ACCESS_TOKEN ||
    "APP_USR-2977832363876431-061523-c77c1319ce55e8de2c46f5b62f08542d-1967932184";

  // DEBUG TEMPORÁRIO — remover depois
  console.log("DEBUG token usado (primeiros 20 chars):", ACCESS_TOKEN.slice(0, 20));
  console.log("DEBUG body recebido:", JSON.stringify(req.body, null, 2));

  try {
    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "X-Idempotency-Key": `${Date.now()}-${Math.random()}`,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro MP payment:", data);
      return res.status(500).json({ error: "Erro ao processar pagamento", details: data });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Erro interno:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}
