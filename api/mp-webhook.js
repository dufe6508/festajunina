// api/mp-webhook.js — VERSÃO CORRIGIDA
// Mudanças principais:
//  1. mpPaymentId SEMPRE como String — consistente com o front
//  2. Se ingresso já existe (criado pelo front em status pending), faz UPSERT
//     marcando como pago em vez de só ignorar como "dedup"
//  3. Retorna 500 em exceções não previstas → MP reentrega (não perde pagamento)
//  4. Se não achar o dono (uid/email) NÃO cria ingresso órfão — retorna 500 pra reentrega
//
// VARIÁVEIS DE AMBIENTE (Vercel):
//   MP_ACCESS_TOKEN
//   FIREBASE_SERVICE_ACCOUNT  (JSON inteiro da service account)
//   SEND_EMAIL_URL            (ex: https://festajunina-api.vercel.app/api/send-email)
//
// CONFIGURAR NO MERCADO PAGO:
//   Painel MP → Suas integrações → seu app → Webhooks
//   URL:    https://SEU-DOMINIO/api/mp-webhook
//   Evento: Pagamentos (payment)

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
  if (req.method === "GET") return res.status(200).json({ ok: true });
  if (req.method !== "POST") return res.status(405).end();

  let paymentId;
  try {
    const body = req.body || {};
    paymentId =
      body?.data?.id ||
      req.query?.["data.id"] ||
      req.query?.id ||
      body?.id;

    if (!paymentId) {
      console.warn("mp-webhook: sem paymentId", { body, query: req.query });
      return res.status(200).json({ ignored: true });
    }

    const paymentIdStr = String(paymentId);
    const payment = await fetchPayment(paymentId);
    const status = payment.status;
    const externalRef = payment.external_reference || "";

    if (status !== "approved") {
      console.log("mp-webhook: status não-aprovado", { paymentId: paymentIdStr, status });
      return res.status(200).json({ ok: true, status });
    }

    const db = getDb();

    // 🔒 Idempotência / UPSERT por mpPaymentId (busca aceita string OU number
    // por segurança, caso existam ingressos antigos com o tipo errado)
    const [dupStr, dupNum] = await Promise.all([
      db.collection("ingressos").where("mpPaymentId", "==", paymentIdStr).limit(1).get(),
      db.collection("ingressos").where("mpPaymentId", "==", Number(paymentIdStr)).limit(1).get(),
    ]);
    const existing = !dupStr.empty ? dupStr.docs[0] : (!dupNum.empty ? dupNum.docs[0] : null);

    if (existing) {
      const data = existing.data();
      if (data.pagamentoConfirmado === true && data.statusPagamento === "approved") {
        console.log("mp-webhook: já confirmado", { paymentId: paymentIdStr, code: existing.id });
        return res.status(200).json({ ok: true, dedup: true });
      }
      // Atualiza ingresso pendente criado pelo front → marca como pago
      await existing.ref.update({
        mpPaymentId: paymentIdStr,
        statusPagamento: "approved",
        pagamentoConfirmado: true,
        dataPagamento: new Date().toISOString(),
        atualizadoPorWebhook: new Date().toISOString(),
      });

      // Incrementa contador do lote se ainda não foi contado
      if (data.loteId && data.pagamentoConfirmado !== true) {
        try {
          await db.collection("lotes").doc(data.loteId).update({
            ingressosAssociados: admin.firestore.FieldValue.increment(data.qty || 1),
          });
        } catch (e) {
          console.warn("mp-webhook: falha increment lote", e.message);
        }
      }

      // Envia e-mail se ainda não foi
      if (data.emailEnviado !== true && (data.email || payment.payer?.email) && process.env.SEND_EMAIL_URL) {
        await sendEmail({
          to: data.email || payment.payer?.email,
          nomeAluno: data.nomeAluno,
          code: existing.id,
          lote: data.type,
          preco: `R$ ${Number(data.price || 0).toFixed(2).replace(".", ",")}`,
        }).then(() =>
          existing.ref.update({ emailEnviado: true, emailEnviadoEm: new Date().toISOString() }).catch(() => {})
        ).catch((e) => console.error("mp-webhook: email upsert falhou", e.message));
      }

      console.log("mp-webhook: ingresso atualizado", { paymentId: paymentIdStr, code: existing.id });
      return res.status(200).json({ ok: true, upserted: true });
    }

    // Não existe ingresso ainda — cria do zero.
    // Resolve o usuário: external_reference deve ser o uid; fallback por e-mail.
    let userDoc = null;
    if (externalRef && !externalRef.startsWith("anon-")) {
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

    if (!userDoc) {
      // NÃO cria órfão. Retorna 500 → MP reentrega; admin pode reconciliar manualmente.
      console.error("mp-webhook: dono não encontrado", {
        paymentId: paymentIdStr,
        externalRef,
        payerEmail: payment.payer?.email,
      });
      return res.status(500).json({ error: "user_not_found", paymentId: paymentIdStr });
    }

    const nomeAluno =
      userDoc.nomeAluno || userDoc.nomeResponsavel || payment.payer?.first_name || "Convidado";
    const emailDestino = userDoc.email || payment.payer?.email || "";

    const code = await gerarCodigoIngresso(db);
    const ticket = {
      userId: userDoc.id,
      nomeAluno,
      type: "Acesso Geral",
      qty: 1,
      price: Number(payment.transaction_amount) || 0,
      code,
      criadoEm: new Date().toISOString(),
      paymentMethod: "mercadopago",
      mpPaymentId: paymentIdStr, // ✅ sempre string
      statusPagamento: "approved",
      turma: userDoc.turma || "",
      ano: userDoc.ano || "",
      isTest: false,
      pagamentoConfirmado: true,
      dataPagamento: new Date().toISOString(),
      origem: "webhook",
      email: emailDestino,
      payerEmailMp: payment.payer?.email || "",
      payerCpfMp: payment.payer?.identification?.number || "",
    };
    await db.collection("ingressos").doc(code).set(ticket);
    console.log("mp-webhook: ingresso criado", { code, paymentId: paymentIdStr, userId: ticket.userId });

    if (emailDestino && process.env.SEND_EMAIL_URL) {
      try {
        await sendEmail({
          to: emailDestino,
          nomeAluno,
          code,
          lote: ticket.type,
          preco: `R$ ${ticket.price.toFixed(2).replace(".", ",")}`,
        });
        await db.collection("ingressos").doc(code).update({
          emailEnviado: true,
          emailEnviadoEm: new Date().toISOString(),
        }).catch(() => {});
      } catch (e) {
        console.error("mp-webhook: erro ao enviar email", e.message);
      }
    }

    return res.status(200).json({ ok: true, code });
  } catch (err) {
    console.error("mp-webhook: exception", { paymentId, msg: err.message, stack: err.stack });
    // 500 → MP reentrega. Não silencia mais.
    return res.status(500).json({ error: err.message });
  }
};

async function sendEmail(payload) {
  const r = await fetch(process.env.SEND_EMAIL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`send-email ${r.status}`);
  return r;
}
