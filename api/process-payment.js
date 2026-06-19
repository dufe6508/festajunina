// api/process-payment.js — versão corrigida
// Correções:
// 1. Injeta `notification_url` apontando para o webhook do MP (entrega server-side garantida)
// 2. Injeta `external_reference` (uid do usuário) para o webhook achar o dono mesmo se
//    o pagador no MP estiver com nome/CPF diferentes do titular do ingresso
// 3. Propaga status real do MP (200/201/400) em vez de mascarar tudo como 500
// 4. Log detalhado para debug de pagamentos órfãos
// 5. Lê origin para montar a notification_url dinamicamente (dev/preview/prod)

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
    const origin =
      req.headers.origin ||
      (req.headers.host ? `https://${req.headers.host}` : "");

    // Aceita external_reference vindo do cliente (uid do usuário logado).
    // Se não vier, gera um para rastreabilidade.
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
        origin,
      },
      // Webhook que vai garantir a entrega mesmo se o cliente fechar a aba
      notification_url:
        incoming.notification_url ||
        (origin ? `${origin}/api/mp-webhook` : undefined),
    };

    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        // Idempotência estável: se o cliente reenviar a mesma intenção com o
        // mesmo external_reference, o MP devolve o mesmo pagamento em vez de criar outro.
        "X-Idempotency-Key": `${externalRef}-${incoming.transaction_amount || 0}-${incoming.payment_method_id || incoming.token || "x"}`,
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
      // Repassa o status real do MP (não mascara como 500 — o front precisa saber)
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
