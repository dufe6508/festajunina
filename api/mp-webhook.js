// api/mp-webhook.js — NOVO. Webhook do Mercado Pago.
// Esta é a peça que falta hoje e que causa a maior parte dos ingressos perdidos:
// quando o cliente paga e fecha a aba antes do polling capturar o "approved", o
// ingresso nunca é criado. O MP chama este endpoint sempre que o pagamento muda
// de status — aqui criamos o ingresso no Firestore e disparamos o e-mail
// independentemente do navegador do cliente estar aberto.
//
// REQUISITOS (variáveis de ambiente no Vercel):
//   MP_ACCESS_TOKEN              — access token do MP (já existe)
//   FIREBASE_SERVICE_ACCOUNT     — JSON da service account do Firebase (cole o JSON inteiro)
//   SEND_EMAIL_URL               — ex: https://festajunina-api.vercel.app/api/send-email
//
// CONFIGURAR NO MERCADO PAGO:
//   Painel do MP → "Suas integrações" → seu app → Webhooks → adicionar:
//     https://SEU-DOMINIO/api/mp-webhook
//   Eventos: "Pagamentos" (payment)

const admin = require("firebase-admin");

function getDb() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT ausente");
    const sa = typeof raw === "string" ? JSON.parse(raw) : raw;
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  return admin.firestore();
}

async function fetchPayment(id) {
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  });
  if (!r.ok) throw new Error(`MP ${r.status}`);
  return r.json();
}

async function gerarCodigoIngresso(db) {
  const ref = db.collection("config").doc("ticketCounter");
  const novo = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const atual = snap.exists ? snap.data().ultimo || 0 : 0;
    const proximo = atual + 1;
    tx.set(ref, { ultimo: proximo });
    return proximo;
  });
  return `FJ-${String(novo).padStart(4, "0")}`;
}

module.exports = async function handler(req, res) {
  // O MP envia POST. Também aceita GET (ping de teste).
  if (req.method === "GET") return res.status(200).json({ ok: true });
  if (req.method !== "POST") return res.status(405).end();

  // Responde 200 rapidamente — MP reentrega se demorar/erro.
  // Mesmo em erro lógico devolvemos 200 só DEPOIS de tratar, pra evitar loop infinito.
  try {
    const body = req.body || {};
    const paymentId =
      body?.data?.id ||
      req.query?.["data.id"] ||
      req.query?.id ||
      body?.id;

    if (!paymentId) {
      console.warn("mp-webhook: sem paymentId", { body, query: req.query });
      return res.status(200).json({ ignored: true });
    }

    const payment = await fetchPayment(paymentId);
    const status = payment.status;
    const externalRef = payment.external_reference || "";

    // Só emite ingresso quando aprovado
    if (status !== "approved") {
      console.log("mp-webhook: status não-aprovado", { paymentId, status });
      return res.status(200).json({ ok: true, status });
    }

    const db = getDb();

    // 🔒 Idempotência por mpPaymentId — não duplica ingresso se MP reentregar
    const dup = await db
      .collection("ingressos")
      .where("mpPaymentId", "==", String(paymentId))
      .limit(1)
      .get();
    if (!dup.empty) {
      console.log("mp-webhook: já existe ingresso", { paymentId });
      return res.status(200).json({ ok: true, dedup: true });
    }

    // Resolve o usuário: external_reference deve ser o uid; fallback procura por e-mail
    let userDoc = null;
    if (externalRef) {
      const snap = await db.collection("usuarios").doc(externalRef).get();
      if (snap.exists) userDoc = { id: snap.id, ...snap.data() };
    }
    if (!userDoc && payment.payer?.email) {
      const q = await db
        .collection("usuarios")
        .where("email", "==", payment.payer.email)
        .limit(1)
        .get();
      if (!q.empty) userDoc = { id: q.docs[0].id, ...q.docs[0].data() };
    }

    const nomeAluno =
      userDoc?.nomeAluno ||
      userDoc?.nomeResponsavel ||
      payment.payer?.first_name ||
      "Convidado";
    const emailDestino = userDoc?.email || payment.payer?.email || "";

    const code = await gerarCodigoIngresso(db);
    const ticket = {
      userId: userDoc?.id || externalRef || "",
      nomeAluno,
      type: "Acesso Geral",
      qty: 1,
      price: Number(payment.transaction_amount) || 0,
      code,
      criadoEm: new Date().toISOString(),
      paymentMethod: "mercadopago",
      mpPaymentId: String(paymentId),
      statusPagamento: "approved",
      turma: userDoc?.turma || "",
      ano: userDoc?.ano || "",
      isTest: false,
      pagamentoConfirmado: true,
      dataPagamento: new Date().toISOString(),
      origem: "webhook",
      payerEmailMp: payment.payer?.email || "",
      payerCpfMp: payment.payer?.identification?.number || "",
    };
    await db.collection("ingressos").doc(code).set(ticket);
    console.log("mp-webhook: ingresso criado", { code, paymentId, userId: ticket.userId });

    // Dispara o e-mail (não falha o webhook se o e-mail der erro — ingresso já está salvo)
    if (emailDestino && process.env.SEND_EMAIL_URL) {
      try {
        await fetch(process.env.SEND_EMAIL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: emailDestino,
            nomeAluno,
            code,
            lote: ticket.type,
            preco: `R$ ${ticket.price.toFixed(2).replace(".", ",")}`,
          }),
        });
      } catch (e) {
        console.error("mp-webhook: erro ao enviar email", e.message);
      }
    } else {
      console.warn("mp-webhook: email não enviado (sem destino ou SEND_EMAIL_URL)", {
        emailDestino,
      });
    }

    return res.status(200).json({ ok: true, code });
  } catch (err) {
    console.error("mp-webhook: exception", err);
    // 200 mesmo em erro pra evitar tempestade de reentrega; logs ficam no Vercel.
    return res.status(200).json({ ok: false, error: err.message });
  }
};
