export default async function handler(req, res) {
  // Permite apenas POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // CORS para seu domínio do Vercel
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  const { totalCart, userEmail, userName, userCpf } = req.body;

  if (!totalCart || totalCart <= 0) {
    return res.status(400).json({ error: "Valor inválido" });
  }

  try {
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // ⚠️ Em produção, mova esta chave para uma variável de ambiente no Vercel:
        // Settings → Environment Variables → ACCESS_TOKEN
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN || "TEST-5215685526075469-061412-561d8834ac8728abeb405ed6e51195a3-380786826"}`,
      },
      body: JSON.stringify({
        items: [
          {
            id: "ingresso-festa-junina",
            title: "Ingresso - Festa Junina Brandão",
            description: "Acesso Geral",
            quantity: 1,
            currency_id: "BRL",
            unit_price: Number(totalCart),
          },
        ],
        payer: {
          email: userEmail || "comprador@email.com",
          name: userName || "Comprador",
          identification: {
            type: "CPF",
            number: (userCpf || "").replace(/\D/g, ""),
          },
        },
        payment_methods: {
          excluded_payment_types: [],
          installments: 1,
        },
        // URL de retorno após pagamento (ajuste para seu domínio)
        back_urls: {
          success: `${req.headers.origin || "https://seusite.vercel.app"}/?payment=success`,
          failure: `${req.headers.origin || "https://seusite.vercel.app"}/?payment=failure`,
          pending: `${req.headers.origin || "https://seusite.vercel.app"}/?payment=pending`,
        },
        auto_return: "approved",
        statement_descriptor: "FESTA JUNINA BRANDAO",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro MP:", data);
      return res.status(500).json({ error: "Erro ao criar preferência", details: data });
    }

    return res.status(200).json({
      preferenceId: data.id,
      initPoint: data.init_point,        // link de redirecionamento (fallback)
      sandboxInitPoint: data.sandbox_init_point, // link de teste
    });
  } catch (err) {
    console.error("Erro interno:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}
