// ─────────────────────────────────────────────────────────────────────────────
// SERVICE de RIFAS — camada de acesso ao Firestore (coleção "rifas_books").
// Toda a regra de negócio vive em ./rifas (puro/testado). Aqui só I/O.
// ─────────────────────────────────────────────────────────────────────────────
import {
  collection,
  getDocs,
  doc,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  RaffleBook,
  PaymentStatus,
  seedClassBooks,
  recomputeBook,
  sellTicket,
  releaseTicket,
  sellAllInBook,
  releaseAllInBook,
} from "./rifas";

const COL = "rifas_books";

export interface TurmaRef {
  classId: string; // ex "3B"
  yearId: string; // ex "3"
  turma: string; // ex "B"
}

// Lista todas as turmas existentes a partir da coleção "alunos"
// (cada doc = uma turma, id = sala, campos { ano, turma }).
export const fetchTurmas = async (): Promise<TurmaRef[]> => {
  const snap = await getDocs(collection(db, "alunos"));
  const turmas: TurmaRef[] = [];
  snap.forEach((d) => {
    const data: any = d.data() || {};
    const classId = d.id;
    const yearId = String(data.ano ?? classId.charAt(0) ?? "");
    const turma = String(data.turma ?? classId.slice(1) ?? "");
    if (classId) turmas.push({ classId, yearId, turma });
  });
  turmas.sort((a, b) => a.classId.localeCompare(b.classId));
  return turmas;
};

// Lê todos os bloquinhos (rifas_books). Recalcula estado a partir de tickets[].
export const fetchAllBooks = async (): Promise<RaffleBook[]> => {
  const snap = await getDocs(collection(db, COL));
  const books: RaffleBook[] = [];
  snap.forEach((d) => books.push(recomputeBook({ id: d.id, ...(d.data() as any) })));
  books.sort((a, b) => a.classId.localeCompare(b.classId) || a.bookNumber - b.bookNumber);
  return books;
};

// Garante que uma turma tenha seus 10 bloquinhos. Cria apenas os que faltam
// (idempotente — não sobrescreve books já existentes/vendidos).
export const ensureClassBooks = async (
  t: TurmaRef,
  existing: RaffleBook[]
): Promise<RaffleBook[]> => {
  const existentes = new Set(
    existing.filter((b) => b.classId === t.classId).map((b) => b.bookNumber)
  );
  const novos = seedClassBooks(t.classId, t.yearId, t.turma).filter(
    (b) => !existentes.has(b.bookNumber)
  );
  if (novos.length === 0) return [];
  const batch = writeBatch(db);
  for (const b of novos) batch.set(doc(db, COL, b.id), b);
  await batch.commit();
  return novos;
};

// Garante books de TODAS as turmas. Retorna quantos bloquinhos foram criados.
export const ensureAllClassBooks = async (
  turmas: TurmaRef[],
  existing: RaffleBook[]
): Promise<number> => {
  let criados = 0;
  for (const t of turmas) {
    const novos = await ensureClassBooks(t, existing);
    criados += novos.length;
  }
  return criados;
};

// Persiste um book já recalculado.
const saveBook = async (book: RaffleBook): Promise<void> => {
  await setDoc(doc(db, COL, book.id), recomputeBook(book));
};

// Vende uma rifa e persiste. Retorna o book atualizado.
export const sellTicketRemote = async (
  book: RaffleBook,
  ticketNumber: number,
  opts: { soldTo?: string | null; paymentStatus?: PaymentStatus } = {}
): Promise<RaffleBook> => {
  const updated = sellTicket(book, ticketNumber, opts);
  await saveBook(updated);
  return updated;
};

// Libera (cancela venda de) uma rifa e persiste.
export const releaseTicketRemote = async (
  book: RaffleBook,
  ticketNumber: number
): Promise<RaffleBook> => {
  const updated = releaseTicket(book, ticketNumber);
  await saveBook(updated);
  return updated;
};

// Vende o BLOQUINHO inteiro (todas as rifas disponíveis) e persiste.
export const sellBookRemote = async (
  book: RaffleBook,
  opts: { soldTo?: string | null; paymentStatus?: PaymentStatus } = {}
): Promise<RaffleBook> => {
  const updated = sellAllInBook(book, opts);
  await saveBook(updated);
  return updated;
};

// Vende TODOS os bloquinhos de uma turma de uma vez (batch). Retorna os atualizados.
export const sellAllBooksRemote = async (
  books: RaffleBook[],
  opts: { soldTo?: string | null; paymentStatus?: PaymentStatus } = {}
): Promise<RaffleBook[]> => {
  const batch = writeBatch(db);
  const updated = books.map((b) => sellAllInBook(b, opts));
  for (const b of updated) batch.set(doc(db, COL, b.id), b);
  await batch.commit();
  return updated;
};

// Reseta um BLOQUINHO inteiro (libera todas as rifas) e persiste.
export const resetBookRemote = async (book: RaffleBook): Promise<RaffleBook> => {
  const updated = releaseAllInBook(book);
  await saveBook(updated);
  return updated;
};

// Reseta TODOS os bloquinhos de uma turma (batch). Retorna os atualizados.
export const resetAllBooksRemote = async (books: RaffleBook[]): Promise<RaffleBook[]> => {
  const batch = writeBatch(db);
  const updated = books.map((b) => releaseAllInBook(b));
  for (const b of updated) batch.set(doc(db, COL, b.id), b);
  await batch.commit();
  return updated;
};
