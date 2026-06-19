// api/payment-status.js — versão corrigida
// Correções:
// 1. Retorna também external_reference e payer (pra debug e pra eventual rematch por uid)
// 2. Propaga status real do MP corretamente
// 3. Não vaza access_token em logs

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "ID do pagamento é obrigatório" });

  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!ACCESS_TOKEN) return res.status(500).json({ error: "MP_ACCESS_TOKEN ausente" });

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("payment-status: erro MP", { id, status: response.status, msg: data?.message });
      return res.status(response.status).json({ error: "Erro ao consultar pagamento", details: data });
    }
    return res.status(200).json({
      id: data.id,
      status: data.status,
      status_detail: data.status_detail,
      external_reference: data.external_reference || null,
      payer_email: data.payer?.email || null,
      transaction_amount: data.transaction_amount,
    });
  } catch (err) {
    console.error("payment-status: exception", err.message);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}
