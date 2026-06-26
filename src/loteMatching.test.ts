import { findBestLoteId, reconcile, BatchLike, TicketLike } from "./loteMatching";

const batches: BatchLike[] = [
  { id: "L_TURMA", nome: "Lote Turmas", publico: "Alunos", turmasVisiveis: ["9A", "9B"] },
  { id: "L_PAIS", nome: "Lote Pais", publico: "Pais/Responsáveis" },
  { id: "L_EX", nome: "Lote Ex", publico: "Ex-alunos" },
  { id: "L_GERAL", nome: "Acesso Geral", publico: "Ambos" },
];

describe("findBestLoteId — mapeamento ingresso → lote", () => {
  test("loteId válido tem prioridade máxima (compra direta no lote / órfão de lote)", () => {
    // 'órfão de lote' = comprado direto no lote, SEM vínculo de aluno.
    // Tem loteId, então DEVE contar no lote.
    const t: TicketLike = { loteId: "L_GERAL", nomeAluno: null } as any;
    expect(findBestLoteId(t, batches)).toBe("L_GERAL");
  });

  test("loteId apontando para lote inexistente cai para próximos critérios", () => {
    const t: TicketLike = { loteId: "DELETADO", type: "Acesso Geral" };
    expect(findBestLoteId(t, batches)).toBe("L_GERAL"); // casa por nome
  });

  test("casa por nome do lote (type) quando não há loteId", () => {
    expect(findBestLoteId({ type: "Lote Turmas" }, batches)).toBe("L_TURMA");
  });

  test("aluno sem tipoTitular casa por ano+turma", () => {
    expect(findBestLoteId({ ano: "9", turma: "A" }, batches)).toBe("L_TURMA");
  });

  test("responsavel casa com lote Pais/Responsáveis", () => {
    expect(findBestLoteId({ tipoTitular: "responsavel" }, batches)).toBe("L_PAIS");
  });

  test("ex_aluno casa com lote Ex-alunos (fallback Ambos)", () => {
    expect(findBestLoteId({ tipoTitular: "ex_aluno" }, batches)).toBe("L_EX");
  });

  test("órfão real (sem nada que case) retorna null", () => {
    expect(findBestLoteId({ loteId: "DELETADO" }, batches)).toBeNull();
    expect(findBestLoteId({}, batches)).toBeNull();
  });

  test("não há dupla contagem: cada ticket mapeia para exatamente um lote", () => {
    // ticket que poderia casar por loteId E por turma → só conta o loteId
    const t: TicketLike = { loteId: "L_PAIS", ano: "9", turma: "A" };
    expect(findBestLoteId(t, batches)).toBe("L_PAIS");
  });
});

describe("reconcile — invariante de consistência (soma lotes + órfãos === total)", () => {
  test("cenário misto: aluno, órfão-de-lote, responsavel, ex_aluno, órfão real", () => {
    const tickets: TicketLike[] = [
      { loteId: "L_TURMA", pagamentoConfirmado: true },        // aluno
      { loteId: "L_GERAL", pagamentoConfirmado: true },        // órfão de lote (sem aluno) — DEVE contar
      { ano: "9", turma: "B", pagamentoConfirmado: true },     // aluno por turma
      { tipoTitular: "responsavel", pagamentoConfirmado: true },
      { tipoTitular: "ex_aluno", pagamentoConfirmado: false }, // não pago, mas existe
      { loteId: "DELETADO", pagamentoConfirmado: true },       // órfão real
      {},                                                      // órfão real
    ];
    const r = reconcile(tickets, batches);

    expect(r.total).toBe(7);
    expect(r.pagos).toBe(5);
    expect(r.orfaos).toBe(2);
    expect(r.somaLotes).toBe(5);
    // INVARIANTE: nenhum ingresso some.
    expect(r.somaLotes + r.orfaos).toBe(r.total);
    expect(r.consistente).toBe(true);

    expect(r.porLote.L_TURMA).toBe(2); // loteId + turma
    expect(r.porLote.L_GERAL).toBe(1);
    expect(r.porLote.L_PAIS).toBe(1);
    expect(r.porLote.L_EX).toBe(1);
  });

  test("sem órfãos: soma dos lotes bate exatamente com o total", () => {
    const tickets: TicketLike[] = [
      { loteId: "L_TURMA" },
      { loteId: "L_TURMA" },
      { loteId: "L_PAIS" },
    ];
    const r = reconcile(tickets, batches);
    expect(r.orfaos).toBe(0);
    expect(r.somaLotes).toBe(r.total);
    expect(r.consistente).toBe(true);
  });

  test("banco vazio é consistente", () => {
    const r = reconcile([], batches);
    expect(r.total).toBe(0);
    expect(r.consistente).toBe(true);
  });

  test("100 ingressos aleatórios: invariante sempre vale", () => {
    const tipos: TicketLike[] = [
      { loteId: "L_TURMA" },
      { loteId: "L_GERAL" },
      { ano: "9", turma: "A" },
      { tipoTitular: "responsavel" },
      { tipoTitular: "ex_aluno" },
      { loteId: "DELETADO" },
      {},
    ];
    const tickets: TicketLike[] = Array.from({ length: 100 }, (_, i) => ({
      ...tipos[i % tipos.length],
      pagamentoConfirmado: i % 2 === 0,
    }));
    const r = reconcile(tickets, batches);
    expect(r.somaLotes + r.orfaos).toBe(100);
    expect(r.consistente).toBe(true);
  });
});
