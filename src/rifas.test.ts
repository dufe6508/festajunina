import {
  TICKET_PRICE,
  TICKETS_PER_BOOK,
  BOOKS_PER_CLASS,
  MAX_REVENUE_PER_CLASS,
  computeBookStatus,
  makeBook,
  seedClassBooks,
  recomputeBook,
  sellTicket,
  releaseTicket,
  sellAllInBook,
  booksToCSV,
  classFinancial,
  financialByClass,
  financialByYear,
  overview,
  rankingBySold,
  rankingByRevenue,
  rifaRevenue,
  RaffleBook,
} from "./rifas";

describe("constantes de negócio", () => {
  test("10 blocos × 10 rifas × R$2 = R$200/turma", () => {
    expect(BOOKS_PER_CLASS).toBe(10);
    expect(TICKETS_PER_BOOK).toBe(10);
    expect(TICKET_PRICE).toBe(2);
    expect(MAX_REVENUE_PER_CLASS).toBe(200);
  });
});

describe("computeBookStatus — estados automáticos", () => {
  test("0 vendidas → available", () => expect(computeBookStatus(0)).toBe("available"));
  test("1..9 vendidas → partial", () => {
    expect(computeBookStatus(1)).toBe("partial");
    expect(computeBookStatus(9)).toBe("partial");
  });
  test("10 vendidas → sold_out", () => expect(computeBookStatus(10)).toBe("sold_out"));
});

describe("seed e estrutura", () => {
  test("turma recebe 10 blocos, cada um com 10 rifas", () => {
    const books = seedClassBooks("3B", "3", "B");
    expect(books).toHaveLength(10);
    for (const b of books) {
      expect(b.tickets).toHaveLength(10);
      expect(b.status).toBe("available");
      expect(b.tickets.every((t) => t.status === "available")).toBe(true);
    }
    // ids únicos e sequenciais
    expect(books.map((b) => b.bookNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(books.map((b) => b.id)).size).toBe(10);
  });
});

describe("venda e estados automáticos do bloco", () => {
  let book: RaffleBook;
  beforeEach(() => {
    book = makeBook("3B", "3", "B", 1, TICKET_PRICE, "2026-01-01T00:00:00Z");
  });

  test("vender 1 → partial", () => {
    const b = sellTicket(book, 1, { paymentStatus: "paid" });
    expect(b.soldTickets).toBe(1);
    expect(b.availableTickets).toBe(9);
    expect(b.status).toBe("partial");
  });

  test("vender as 10 → sold_out", () => {
    let b = book;
    for (let n = 1; n <= 10; n++) b = sellTicket(b, n, { paymentStatus: "paid" });
    expect(b.soldTickets).toBe(10);
    expect(b.status).toBe("sold_out");
    expect(b.availableTickets).toBe(0);
  });

  test("liberar volta para available", () => {
    let b = sellTicket(book, 5, { paymentStatus: "paid" });
    b = releaseTicket(b, 5);
    expect(b.soldTickets).toBe(0);
    expect(b.status).toBe("available");
  });

  test("não revende rifa já vendida (idempotente)", () => {
    const b1 = sellTicket(book, 1, { paymentStatus: "paid" });
    const b2 = sellTicket(b1, 1, { paymentStatus: "paid" });
    expect(b2.soldTickets).toBe(1);
  });

  test("vender bloco inteiro de uma vez → sold_out", () => {
    const b = sellAllInBook(book, { paymentStatus: "paid" });
    expect(b.soldTickets).toBe(10);
    expect(b.status).toBe("sold_out");
    expect(b.tickets.every((t) => t.status === "sold")).toBe(true);
  });

  test("vender bloco com algumas já vendidas mantém as existentes", () => {
    let b = sellTicket(book, 1, { paymentStatus: "paid", soldTo: "Ana" });
    b = sellAllInBook(b, { paymentStatus: "paid" });
    expect(b.soldTickets).toBe(10);
    expect(b.tickets.find((t) => t.number === 1)?.soldTo).toBe("Ana"); // não sobrescreve
  });

  test("recomputeBook é a fonte da verdade", () => {
    const corrompido = { ...book, soldTickets: 999, status: "sold_out" as const };
    expect(recomputeBook(corrompido).soldTickets).toBe(0);
    expect(recomputeBook(corrompido).status).toBe("available");
  });
});

describe("financeiro por turma — invariantes", () => {
  test("turma com 25 vendidas (20 pagas, 5 pendentes)", () => {
    let books = seedClassBooks("3B", "3", "B", "2026-01-01T00:00:00Z");
    // vende 25: 20 pagas, 5 pendentes
    let vendidas = 0;
    books = books.map((b) => {
      let nb = b;
      for (let n = 1; n <= 10 && vendidas < 25; n++) {
        nb = sellTicket(nb, n, { paymentStatus: vendidas < 20 ? "paid" : "pending" });
        vendidas++;
      }
      return nb;
    });
    const f = classFinancial(books);

    expect(f.totalTickets).toBe(100);
    expect(f.soldTickets).toBe(25);
    expect(f.paidTickets).toBe(20);
    expect(f.pendingTickets).toBe(5);
    expect(f.availableTickets).toBe(75);
    expect(f.totalRevenue).toBe(50); // 25 vendidas × 2 (toda vendida arrecada)
    expect(f.expectedRevenue).toBe(200); // 100 × 2
    expect(f.completionPercentage).toBe(25);

    // INVARIANTES de integridade financeira
    expect(f.availableTickets + f.soldTickets).toBe(f.totalTickets);
    expect(f.paidTickets + f.pendingTickets).toBe(f.soldTickets);
    expect(f.totalRevenue).toBe(f.soldTickets * TICKET_PRICE);
    expect(f.expectedRevenue).toBe(f.totalTickets * TICKET_PRICE);
    // 2 blocos cheios (20) + 1 parcial (5)
    expect(f.booksComplete).toBe(2);
    expect(f.booksIncomplete).toBe(1);
  });
});

describe("agregações multi-turma / multi-ano", () => {
  const build = () => {
    const turmas = [
      { c: "3A", y: "3" },
      { c: "3B", y: "3" },
      { c: "2A", y: "2" },
    ];
    let all: RaffleBook[] = [];
    turmas.forEach((t, idx) => {
      let books = seedClassBooks(t.c, t.y, t.c.slice(-1), "2026-01-01T00:00:00Z");
      // vende (idx+1)*10 rifas pagas
      const meta = (idx + 1) * 10;
      let vendidas = 0;
      books = books.map((b) => {
        let nb = b;
        for (let n = 1; n <= 10 && vendidas < meta; n++) {
          nb = sellTicket(nb, n, { paymentStatus: "paid" });
          vendidas++;
        }
        return nb;
      });
      all = all.concat(books);
    });
    return all;
  };

  test("overview consolida tudo e mantém invariante", () => {
    const all = build();
    const o = overview(all);
    expect(o.classesCount).toBe(3);
    expect(o.totalTickets).toBe(300);
    expect(o.soldTickets).toBe(60); // 10+20+30
    expect(o.totalRevenue).toBe(120); // 60 × 2
    expect(o.expectedRevenue).toBe(600);
    expect(o.availableTickets + o.soldTickets).toBe(o.totalTickets);
  });

  test("financialByClass soma === overview (consolidação sem perda)", () => {
    const all = build();
    const porTurma = financialByClass(all);
    const o = overview(all);
    const somaSold = porTurma.reduce((s, f) => s + f.soldTickets, 0);
    const somaRev = porTurma.reduce((s, f) => s + f.totalRevenue, 0);
    expect(somaSold).toBe(o.soldTickets);
    expect(somaRev).toBe(o.totalRevenue);
  });

  test("financialByYear consolida por ano", () => {
    const all = build();
    const porAno = financialByYear(all);
    const ano3 = porAno.find((f) => f.yearId === "3")!;
    const ano2 = porAno.find((f) => f.yearId === "2")!;
    expect(ano3.soldTickets).toBe(30); // 3A(10)+3B(20)
    expect(ano2.soldTickets).toBe(30); // 2A(30)
  });

  test("rankings ordenam corretamente", () => {
    const all = build();
    const fc = financialByClass(all);
    expect(rankingBySold(fc)[0].classId).toBe("2A"); // 30 vendidas
    expect(rankingByRevenue(fc)[0].classId).toBe("2A");
  });

  test("rifaRevenue expõe arrecadado/previsto/pendentes p/ financeiro geral", () => {
    const all = build();
    const r = rifaRevenue(all);
    expect(r.arrecadado).toBe(120);
    expect(r.previsto).toBe(600);
    expect(r.pendentes).toBe(0);
  });

  test("booksToCSV gera cabeçalho + 1 linha por rifa", () => {
    const all = build(); // 3 turmas × 10 blocos × 10 = 300 rifas
    const csv = booksToCSV(all);
    const linhas = csv.split("\n");
    expect(linhas[0]).toContain("Ano,Turma,Bloco,Rifa,Status");
    expect(linhas).toHaveLength(301); // 1 cabeçalho + 300 rifas
    expect(linhas.filter((l) => l.includes(",Vendida,")).length).toBe(60); // 10+20+30
  });
});
