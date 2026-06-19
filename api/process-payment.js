// api/process-payment.js — VERSÃO CORRIGIDA
// Mudanças:
//  1. notification_url usa PUBLIC_BASE_URL fixa (não muda em preview/prod)
//  2. X-Idempotency-Key NÃO inclui o token MP (que é único por clique) —
//     usa external_reference + valor → cliques duplicados reaproveitam o mesmo pagamento
//  3. Mantém propagação do status real do MP

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

  if (!process.env.MP_ACCESS_TOKEN) {
    console.error("process-payment: MP_ACCESS_TOKEN ausente");
    return res.status(500).json({ error: "Credencial MP não configurada" });
  }

  try {
    // URL pública FIXA do webhook — defina PUBLIC_BASE_URL no Vercel
    // (ex: https://festajunina-brandao.vercel.app). Fallback usa o host atual,
    // mas em preview deploys isso muda — sempre prefira a env var.
    const baseUrl =
      process.env.PUBLIC_BASE_URL ||
      (req.headers.host ? `https://${req.headers.host}` : "");

    const incoming = req.body || {};
    const externalRef =
      incoming.external_reference ||
      incoming.metadata?.user_id ||
      `anon-${Date.now()}`;

    const payload = {
      ...incoming,
      external_reference: String(externalRef),
      metadata: {
        ...(incoming.metadata || {}),
        user_id: incoming.metadata?.user_id || externalRef,
        origin: baseUrl,
      },
      notification_url: baseUrl ? `${baseUrl}/api/mp-webhook` : undefined,
    };

    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        // Idempotência ESTÁVEL: dois cliques rápidos do MESMO usuário pelo
        // MESMO valor devolvem o mesmo pagamento (não cobra duas vezes).
        // Antes a chave incluía o token, que é único por tentativa → falhava.
        "X-Idempotency-Key": `${externalRef}-${incoming.transaction_amount || 0}-${incoming.payment_method_id || "x"}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("process-payment: MP retornou erro", {
        status: response.status,
        external_reference: externalRef,
        mp: data,
      });
      return res.status(response.status).json({
        error: data.message || "Erro ao processar pagamento",
        details: data,
      });
    }

    console.log("process-payment: ok", {
      id: data.id,
      status: data.status,
      external_reference: data.external_reference,
    });
    return res.status(200).json(data);
  } catch (err) {
    console.error("process-payment: exception", err);
    return res.status(500).json({ error: "Erro interno do servidor", message: err.message });
  }
}
