// Núcleo da contagem de ingressos por lote — função PURA (sem Firebase/React),
// extraída de DashboardAdmin.tsx para permitir testes automatizados.
//
// Regra: cada ingresso mapeia para NO MÁXIMO um lote, evitando dupla contagem.
// Prioridade: loteId válido > nome (type) > turma (apenas alunos sem tipoTitular)
//             > tipoTitular (responsavel / ex_aluno).
// Retorna null quando o ingresso é "órfão de lote" (nenhum lote corresponde) —
// nesse caso ele NÃO some das métricas gerais, apenas não entra em nenhum card
// de lote (a Visão Geral conta `allTickets` diretamente).

export interface TicketLike {
  loteId?: string | null;
  type?: string | null;
  ano?: string | number | null;
  turma?: string | null;
  tipoTitular?: "responsavel" | "ex_aluno" | string | null;
  pagamentoConfirmado?: boolean;
}

export interface BatchLike {
  id: string;
  nome?: string;
  publico?: string;
  turmasVisiveis?: string[];
  quantidade?: number | string;
}

export const findBestLoteId = (
  t: TicketLike,
  batchList: BatchLike[]
): string | null => {
  if (t.loteId && batchList.some((b) => b.id === t.loteId)) return t.loteId;
  if (t.type) {
    const byName = batchList.find((b) => b.nome === t.type);
    if (byName) return byName.id;
  }
  if (!t.tipoTitular) {
    const key = `${t.ano ?? ""}${t.turma ?? ""}`.trim().toUpperCase();
    if (key.length > 1) {
      const byTurma = batchList.find(
        (b) => b.turmasVisiveis && b.turmasVisiveis.includes(key)
      );
      if (byTurma) return byTurma.id;
    }
  }
  if (t.tipoTitular === "responsavel") {
    const lote = batchList.find((b) => b.publico === "Pais/Responsáveis");
    if (lote) return lote.id;
  }
  if (t.tipoTitular === "ex_aluno") {
    const lote =
      batchList.find((b) => b.publico === "Ex-alunos") ||
      batchList.find((b) => b.publico === "Ambos");
    if (lote) return lote.id;
  }
  return null;
};

// Escolhe um lote "geral" de fallback quando nenhum critério específico casa.
// Preferência: maior capacidade (quantidade) — normalmente o lote padrão/geral.
// Desempate: publico "Ambos" > "Alunos" > ordem alfabética do nome.
const publicoRank = (p?: string): number => {
  if (p === "Ambos") return 0;
  if (p === "Alunos") return 1;
  return 2;
};
export const pickFallbackLote = (batches: BatchLike[]): BatchLike | null => {
  if (!batches || batches.length === 0) return null;
  return [...batches].sort((a, b) => {
    const qa = Number(a.quantidade) || 0;
    const qb = Number(b.quantidade) || 0;
    if (qb !== qa) return qb - qa;
    const pr = publicoRank(a.publico) - publicoRank(b.publico);
    if (pr !== 0) return pr;
    return (a.nome || "").localeCompare(b.nome || "");
  })[0];
};

// Igual ao findBestLoteId, mas NUNCA retorna null quando existe ao menos um lote:
// se nada específico casar, cai no lote de fallback. Garante que nenhum ingresso
// fique "órfão" — todo ingresso é contabilizado em exatamente um lote.
export const resolveLoteId = (t: TicketLike, batches: BatchLike[]): string | null => {
  const best = findBestLoteId(t, batches);
  if (best) return best;
  const fb = pickFallbackLote(batches);
  return fb ? fb.id : null;
};

export interface Reconciliation {
  /** Total de ingressos no banco (qualquer status). */
  total: number;
  /** Ingressos com pagamentoConfirmado === true. */
  pagos: number;
  /** Contagem por lote: { [loteId]: quantidade } (todos os status). */
  porLote: Record<string, number>;
  /** Ingressos que não casaram com nenhum lote (findBestLoteId === null). */
  orfaos: number;
  /** Soma das contagens de todos os lotes (sem órfãos). */
  somaLotes: number;
  /** true se somaLotes + orfaos === total (invariante de consistência). */
  consistente: boolean;
}

// Reconcilia a contagem por lote contra o total do banco. Garante a invariante
// que o usuário exigiu: soma(lotes) + órfãos === total, e nenhum ingresso some.
export const reconcile = (
  tickets: TicketLike[],
  batches: BatchLike[]
): Reconciliation => {
  const porLote: Record<string, number> = {};
  for (const b of batches) porLote[b.id] = 0;
  let orfaos = 0;
  let pagos = 0;
  for (const t of tickets) {
    if (t.pagamentoConfirmado) pagos++;
    const id = findBestLoteId(t, batches);
    if (id == null) orfaos++;
    else porLote[id] = (porLote[id] || 0) + 1;
  }
  const somaLotes = Object.values(porLote).reduce((a, b) => a + b, 0);
  return {
    total: tickets.length,
    pagos,
    porLote,
    orfaos,
    somaLotes,
    consistente: somaLotes + orfaos === tickets.length,
  };
};
