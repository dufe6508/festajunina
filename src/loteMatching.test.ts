import {
  findBestLoteId,
  resolveLoteId,
  pickFallbackLote,
  idealCategoryLote,
  enrichTicket,
  reconcile,
  BatchLike,
  TicketLike,
} from "./loteMatching";

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

describe("pickFallbackLote — lote geral de fallback", () => {
  test("escolhe o lote de maior capacidade (quantidade)", () => {
    const bs: BatchLike[] = [
      { id: "A", nome: "A", publico: "Alunos", quantidade: 100 },
      { id: "B", nome: "B", publico: "Alunos", quantidade: 700 },
      { id: "C", nome: "C", publico: "Alunos", quantidade: 30 },
    ];
    expect(pickFallbackLote(bs)?.id).toBe("B");
  });
  test("empate de capacidade → prioriza publico Ambos > Alunos", () => {
    const bs: BatchLike[] = [
      { id: "A", nome: "A", publico: "Alunos", quantidade: 100 },
      { id: "B", nome: "B", publico: "Ambos", quantidade: 100 },
    ];
    expect(pickFallbackLote(bs)?.id).toBe("B");
  });
  test("lista vazia → null", () => {
    expect(pickFallbackLote([])).toBeNull();
  });
});

describe("resolveLoteId — NUNCA deixa órfão quando há lote", () => {
  test("órfão real cai no lote de fallback (maior capacidade)", () => {
    const t: TicketLike = { loteId: "DELETADO" };
    // batches tem L_TURMA(sem quantidade) ... adiciona um geral grande:
    const bs: BatchLike[] = [...batches, { id: "L_GERAL700", nome: "Padrão", publico: "Alunos", quantidade: 700 }];
    expect(findBestLoteId(t, bs)).toBeNull();
    expect(resolveLoteId(t, bs)).toBe("L_GERAL700");
  });
  test("best-fit ainda tem prioridade sobre fallback", () => {
    const bs: BatchLike[] = [...batches, { id: "BIG", nome: "Big", publico: "Alunos", quantidade: 999 }];
    expect(resolveLoteId({ tipoTitular: "responsavel" }, bs)).toBe("L_PAIS");
  });
  test("sem nenhum lote → null (não há onde alocar)", () => {
    expect(resolveLoteId({ loteId: "X" }, [])).toBeNull();
  });
  test("ZERO órfãos: todo ingresso resolve para um lote", () => {
    const tickets: TicketLike[] = [
      { loteId: "DELETADO" },
      {},
      { type: "inexistente" },
      { ano: "1", turma: "Z" }, // turma sem lote
    ];
    for (const t of tickets) {
      expect(resolveLoteId(t, batches)).not.toBeNull();
    }
  });
});

describe("regressão pais/ex — não cair no lote de alunos", () => {
  const bs: BatchLike[] = [
    { id: "PADRAO", nome: "1º Lote - Padrão", publico: "Alunos", quantidade: 700 },
    { id: "PAIS", nome: "Lote Pais", publico: "Pais/Responsáveis", quantidade: 100 },
    { id: "EX", nome: "Lote Ex", publico: "Ex-alunos", quantidade: 30 },
  ];

  test("fallback NUNCA usa lote de Pais/Ex (mesmo sendo grande)", () => {
    const big: BatchLike[] = [
      { id: "PAIS", nome: "Pais", publico: "Pais/Responsáveis", quantidade: 9999 },
      { id: "GERAL", nome: "Geral", publico: "Alunos", quantidade: 100 },
    ];
    expect(pickFallbackLote(big)?.id).toBe("GERAL");
  });

  test("enrichTicket deriva tipoTitular do tipo do usuário (pai → responsavel)", () => {
    const t = enrichTicket({ loteId: "PADRAO" }, { tipo: "pai", ano: "3", turma: "B" });
    expect(t.tipoTitular).toBe("responsavel");
  });

  test("pai salvo (por engano) no Padrão é corrigido para o lote de Pais", () => {
    const t = enrichTicket({ loteId: "PADRAO" }, { tipo: "pai" });
    // loteId aponta p/ Padrão (válido), mas categoria é responsavel:
    expect(idealCategoryLote(t, bs)).toBe("PAIS");
  });

  test("ex-aluno é roteado para o lote Ex (ou Ambos)", () => {
    const t = enrichTicket({}, { tipo: "ex_aluno" });
    expect(idealCategoryLote(t, bs)).toBe("EX");
  });

  test("aluno NÃO tem categoria definitiva (não deve ser movido)", () => {
    expect(idealCategoryLote({ ano: "3", turma: "B" }, bs)).toBeNull();
    expect(idealCategoryLote(enrichTicket({}, { tipo: "aluno" }), bs)).toBeNull();
  });

  test("aluno órfão cai no lote geral (Padrão), nunca em Pais/Ex", () => {
    expect(resolveLoteId(enrichTicket({ loteId: "DELETADO" }, { tipo: "aluno" }), bs)).toBe("PADRAO");
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
