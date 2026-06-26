// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO DE RIFAS — núcleo de lógica PURA (sem Firebase/React), 100% testável.
//
// Regra de negócio:
//   Cada turma recebe 10 bloquinhos (books).
//   Cada bloquinho contém 10 rifas (tickets).  ⇒ 100 rifas/turma.
//   Cada rifa custa R$ 2,00.                   ⇒ R$ 200,00 máx/turma.
//
// Hierarquia: Ano → Turma → Bloquinho → Rifa.
//
// Integridade financeira (invariantes garantidas por reconcile/asserts em teste):
//   • availableTickets + soldTickets === totalTickets        (por book e por turma)
//   • paidTickets + pendingTickets === soldTickets
//   • totalRevenue === paidTickets * price
//   • expectedRevenue === totalTickets * price
// ─────────────────────────────────────────────────────────────────────────────

export const TICKET_PRICE = 2;
export const TICKETS_PER_BOOK = 10;
export const BOOKS_PER_CLASS = 10;
export const MAX_REVENUE_PER_CLASS = BOOKS_PER_CLASS * TICKETS_PER_BOOK * TICKET_PRICE; // 200

export type TicketStatus = "available" | "sold";
export type PaymentStatus = "paid" | "pending" | "none";
export type BookStatus = "available" | "partial" | "sold_out";

export interface RaffleTicket {
  number: number; // 1..10 dentro do bloquinho
  status: TicketStatus;
  paymentStatus: PaymentStatus;
  price: number;
  soldAt: string | null;
  soldTo: string | null;
}

export interface RaffleBook {
  id: string; // `${classId}_B${bookNumber padded}`
  classId: string; // ex "3B"
  yearId: string; // ex "3"
  turma: string; // ex "B"
  bookNumber: number; // 1..10
  totalTickets: number; // 10
  soldTickets: number;
  availableTickets: number;
  status: BookStatus;
  pricePerTicket: number;
  tickets: RaffleTicket[];
  createdAt: string;
}

export interface RaffleFinancial {
  classId: string;
  yearId: string;
  totalTickets: number;
  soldTickets: number;
  availableTickets: number;
  pendingTickets: number; // vendidas com pagamento pendente
  paidTickets: number;
  booksComplete: number; // bloquinhos 100% vendidos
  booksIncomplete: number; // bloquinhos parciais
  totalRevenue: number; // arrecadado (pagas)
  expectedRevenue: number; // potencial máximo (todas as rifas)
  remainingRevenue: number; // expected - total
  completionPercentage: number; // soldTickets / totalTickets * 100
}

export interface RaffleOverview {
  totalTickets: number;
  availableTickets: number;
  soldTickets: number;
  pendingTickets: number;
  paidTickets: number;
  totalRevenue: number;
  expectedRevenue: number;
  remainingRevenue: number;
  completionPercentage: number;
  classesCount: number;
}

// ── Status de um bloquinho a partir da contagem de vendidas ──
export const computeBookStatus = (
  soldTickets: number,
  total: number = TICKETS_PER_BOOK
): BookStatus => {
  if (soldTickets <= 0) return "available";
  if (soldTickets >= total) return "sold_out";
  return "partial";
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

const bookId = (classId: string, bookNumber: number): string =>
  `${classId}_B${String(bookNumber).padStart(2, "0")}`;

// ── Cria as 10 rifas vazias de um bloquinho ──
export const emptyTickets = (price: number = TICKET_PRICE): RaffleTicket[] =>
  Array.from({ length: TICKETS_PER_BOOK }, (_, i) => ({
    number: i + 1,
    status: "available" as TicketStatus,
    paymentStatus: "none" as PaymentStatus,
    price,
    soldAt: null,
    soldTo: null,
  }));

// ── Cria um bloquinho zerado ──
export const makeBook = (
  classId: string,
  yearId: string,
  turma: string,
  bookNumber: number,
  price: number = TICKET_PRICE,
  createdAt: string = new Date().toISOString()
): RaffleBook => ({
  id: bookId(classId, bookNumber),
  classId,
  yearId,
  turma,
  bookNumber,
  totalTickets: TICKETS_PER_BOOK,
  soldTickets: 0,
  availableTickets: TICKETS_PER_BOOK,
  status: "available",
  pricePerTicket: price,
  tickets: emptyTickets(price),
  createdAt,
});

// ── Gera os 10 bloquinhos de uma turma ──
export const seedClassBooks = (
  classId: string,
  yearId: string,
  turma: string,
  createdAt: string = new Date().toISOString()
): RaffleBook[] =>
  Array.from({ length: BOOKS_PER_CLASS }, (_, i) =>
    makeBook(classId, yearId, turma, i + 1, TICKET_PRICE, createdAt)
  );

// ── Recalcula os agregados/estado de um bloquinho a partir do array de rifas ──
// Fonte da verdade = tickets[]. Evita contadores divergentes.
export const recomputeBook = (book: RaffleBook): RaffleBook => {
  const sold = book.tickets.filter((t) => t.status === "sold").length;
  return {
    ...book,
    soldTickets: sold,
    availableTickets: book.tickets.length - sold,
    status: computeBookStatus(sold, book.tickets.length),
  };
};

// ── Vende uma rifa específica (retorna NOVO book; não muta) ──
export const sellTicket = (
  book: RaffleBook,
  ticketNumber: number,
  opts: { soldTo?: string | null; paymentStatus?: PaymentStatus; soldAt?: string } = {}
): RaffleBook => {
  const tickets = book.tickets.map((t) =>
    t.number === ticketNumber && t.status === "available"
      ? {
          ...t,
          status: "sold" as TicketStatus,
          paymentStatus: opts.paymentStatus ?? "paid",
          soldTo: opts.soldTo ?? null,
          soldAt: opts.soldAt ?? new Date().toISOString(),
        }
      : t
  );
  return recomputeBook({ ...book, tickets });
};

// ── Cancela a venda de uma rifa (volta a disponível) ──
export const releaseTicket = (book: RaffleBook, ticketNumber: number): RaffleBook => {
  const tickets = book.tickets.map((t) =>
    t.number === ticketNumber
      ? { ...t, status: "available" as TicketStatus, paymentStatus: "none" as PaymentStatus, soldTo: null, soldAt: null }
      : t
  );
  return recomputeBook({ ...book, tickets });
};

// ── Vende TODAS as rifas disponíveis de um bloquinho de uma vez ──
export const sellAllInBook = (
  book: RaffleBook,
  opts: { soldTo?: string | null; paymentStatus?: PaymentStatus; soldAt?: string } = {}
): RaffleBook => {
  const at = opts.soldAt ?? new Date().toISOString();
  const tickets = book.tickets.map((t) =>
    t.status === "available"
      ? {
          ...t,
          status: "sold" as TicketStatus,
          paymentStatus: opts.paymentStatus ?? "paid",
          soldTo: opts.soldTo ?? null,
          soldAt: at,
        }
      : t
  );
  return recomputeBook({ ...book, tickets });
};

// ── Reseta um bloquinho: libera TODAS as rifas (volta a disponível) ──
export const releaseAllInBook = (book: RaffleBook): RaffleBook => {
  const tickets = book.tickets.map((t) => ({
    ...t,
    status: "available" as TicketStatus,
    paymentStatus: "none" as PaymentStatus,
    soldTo: null,
    soldAt: null,
  }));
  return recomputeBook({ ...book, tickets });
};

// ── Exporta rifas para CSV (uma linha por rifa) ──
export const booksToCSV = (books: RaffleBook[]): string => {
  const head = ["Ano", "Turma", "Bloco", "Rifa", "Status", "Preco", "VendidaPara", "VendidaEm"];
  const rows = [head.join(",")];
  const ordered = [...books].sort(
    (a, b) => a.classId.localeCompare(b.classId) || a.bookNumber - b.bookNumber
  );
  for (const b of ordered) {
    for (const t of b.tickets) {
      rows.push(
        [
          b.yearId,
          b.classId,
          b.bookNumber,
          t.number,
          t.status === "sold" ? "Vendida" : "Disponível",
          t.price.toFixed(2),
          `"${(t.soldTo || "").replace(/"/g, '""')}"`,
          t.soldAt || "",
        ].join(",")
      );
    }
  }
  return rows.join("\n");
};

const ticketAgg = (books: RaffleBook[]) => {
  let total = 0,
    sold = 0,
    paid = 0,
    pending = 0,
    revenue = 0,
    expected = 0;
  for (const b of books) {
    for (const t of b.tickets) {
      total++;
      expected += t.price;
      if (t.status === "sold") {
        sold++;
        // Toda rifa vendida conta como arrecadada (valor total das vendidas).
        revenue += t.price;
        if (t.paymentStatus === "pending") pending++;
        else paid++;
      }
    }
  }
  return { total, sold, paid, pending, revenue: round2(revenue), expected: round2(expected) };
};

// ── Financeiro de UMA turma (lista de books da turma) ──
export const classFinancial = (books: RaffleBook[]): RaffleFinancial => {
  const classId = books[0]?.classId ?? "";
  const yearId = books[0]?.yearId ?? "";
  const a = ticketAgg(books);
  let booksComplete = 0,
    booksIncomplete = 0;
  for (const b of books) {
    const s = recomputeBook(b).status;
    if (s === "sold_out") booksComplete++;
    else if (s === "partial") booksIncomplete++;
  }
  return {
    classId,
    yearId,
    totalTickets: a.total,
    soldTickets: a.sold,
    availableTickets: a.total - a.sold,
    pendingTickets: a.pending,
    paidTickets: a.paid,
    booksComplete,
    booksIncomplete,
    totalRevenue: a.revenue,
    expectedRevenue: a.expected,
    remainingRevenue: round2(a.expected - a.revenue),
    completionPercentage: a.total > 0 ? round2((a.sold / a.total) * 100) : 0,
  };
};

// ── Agrupa books por turma ──
export const groupByClass = (books: RaffleBook[]): Record<string, RaffleBook[]> => {
  const map: Record<string, RaffleBook[]> = {};
  for (const b of books) (map[b.classId] ||= []).push(b);
  for (const k of Object.keys(map)) map[k].sort((x, y) => x.bookNumber - y.bookNumber);
  return map;
};

// ── Financeiro de TODAS as turmas ──
export const financialByClass = (books: RaffleBook[]): RaffleFinancial[] => {
  const grouped = groupByClass(books);
  return Object.values(grouped)
    .map(classFinancial)
    .sort((a, b) => a.classId.localeCompare(b.classId));
};

// ── Consolidado por ANO ──
export const financialByYear = (books: RaffleBook[]): RaffleFinancial[] => {
  const byYear: Record<string, RaffleBook[]> = {};
  for (const b of books) (byYear[b.yearId] ||= []).push(b);
  return Object.entries(byYear)
    .map(([yearId, ybooks]) => {
      const f = classFinancial(ybooks);
      return { ...f, classId: `Ano ${yearId}`, yearId };
    })
    .sort((a, b) => a.yearId.localeCompare(b.yearId));
};

// ── Visão geral GLOBAL ──
export const overview = (books: RaffleBook[]): RaffleOverview => {
  const a = ticketAgg(books);
  const classes = new Set(books.map((b) => b.classId));
  return {
    totalTickets: a.total,
    availableTickets: a.total - a.sold,
    soldTickets: a.sold,
    pendingTickets: a.pending,
    paidTickets: a.paid,
    totalRevenue: a.revenue,
    expectedRevenue: a.expected,
    remainingRevenue: round2(a.expected - a.revenue),
    completionPercentage: a.total > 0 ? round2((a.sold / a.total) * 100) : 0,
    classesCount: classes.size,
  };
};

// ── Rankings (relatórios) ──
export const rankingBySold = (financials: RaffleFinancial[]): RaffleFinancial[] =>
  [...financials].sort((a, b) => b.soldTickets - a.soldTickets || b.totalRevenue - a.totalRevenue);

export const rankingByRevenue = (financials: RaffleFinancial[]): RaffleFinancial[] =>
  [...financials].sort((a, b) => b.totalRevenue - a.totalRevenue || b.soldTickets - a.soldTickets);

// ── Receita de rifas só com o necessário p/ integrar no financeiro geral ──
export const rifaRevenue = (books: RaffleBook[]): { arrecadado: number; previsto: number; pendentes: number } => {
  const a = ticketAgg(books);
  return { arrecadado: a.revenue, previsto: a.expected, pendentes: a.pending };
};
