// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO DE RIFAS — UI (aba "Rifas" do painel admin).
// Hierarquia Ano → Turma → Bloquinho → Rifa. Lógica em ./rifas, I/O em ./rifasService.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Ticket,
  ChevronDown,
  ChevronRight,
  Trophy,
  Banknote,
  BarChart3,
  RefreshCw,
  CheckCircle2,
  Plus,
} from "lucide-react";
import {
  TICKET_PRICE,
  overview as buildOverview,
  financialByClass,
  financialByYear,
  groupByClass,
  rankingBySold,
  rankingByRevenue,
  recomputeBook,
} from "./rifas";
import {
  fetchTurmas,
  fetchAllBooks,
  ensureAllClassBooks,
  sellTicketRemote,
  releaseTicketRemote,
} from "./rifasService";

const brl = (n) => `R$ ${Number(n || 0).toFixed(2).replace(".", ",")}`;

const Card = ({ title, value, sub, icon: Icon }) => (
  <div className="flex flex-col rounded-2xl border border-zinc-800 bg-[#0a0a0a] p-5">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
        {title}
      </span>
      {Icon && <Icon className="h-4 w-4 text-zinc-600" />}
    </div>
    <span className="mt-3 text-2xl font-black tabular-nums text-white">{value}</span>
    {sub && <span className="mt-1 text-xs text-zinc-500">{sub}</span>}
  </div>
);

const Progress = ({ pct, esgotado }) => (
  <div className="h-2 w-full overflow-hidden rounded-full border border-zinc-800 bg-zinc-900">
    <div
      className={`h-full transition-all duration-500 ${
        esgotado ? "bg-green-500" : pct >= 80 ? "bg-amber-400" : "bg-white/70"
      }`}
      style={{ width: `${Math.min(100, pct)}%` }}
    />
  </div>
);

const statusPill = (status) => {
  const map = {
    available: ["Disponível", "text-zinc-400 border-zinc-700 bg-zinc-900"],
    partial: ["Parcial", "text-amber-300 border-amber-500/30 bg-amber-500/10"],
    sold_out: ["Completo", "text-green-300 border-green-500/30 bg-green-500/10"],
    sold: ["Vendida", "text-green-300 border-green-500/30 bg-green-500/10"],
  };
  const [label, cls] = map[status] || ["—", "text-zinc-400 border-zinc-700"];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${cls}`}>
      {label}
    </span>
  );
};

export default function RifasModule({ showToast = () => {} }) {
  const [books, setBooks] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sub, setSub] = useState("overview"); // overview | turmas | relatorios
  const [openClass, setOpenClass] = useState(null);
  const [openBook, setOpenBook] = useState(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [ts, bs] = await Promise.all([fetchTurmas(), fetchAllBooks()]);
      setTurmas(ts);
      setBooks(bs);
    } catch (e) {
      showToast("Erro ao carregar rifas.");
    }
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  const ov = useMemo(() => buildOverview(books), [books]);
  const porTurma = useMemo(() => financialByClass(books), [books]);
  const porAno = useMemo(() => financialByYear(books), [books]);
  const grouped = useMemo(() => groupByClass(books), [books]);
  const rankSold = useMemo(() => rankingBySold(porTurma), [porTurma]);
  const rankRev = useMemo(() => rankingByRevenue(porTurma), [porTurma]);

  // turmas que ainda não têm os 10 bloquinhos
  const turmasFaltando = useMemo(() => {
    return turmas.filter((t) => {
      const have = (grouped[t.classId] || []).length;
      return have < 10;
    });
  }, [turmas, grouped]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const criados = await ensureAllClassBooks(turmas, books);
      await reload();
      showToast(
        criados > 0
          ? `${criados} bloquinho(s) criado(s).`
          : "Todas as turmas já têm seus bloquinhos.",
        "success"
      );
    } catch (e) {
      showToast("Erro ao gerar bloquinhos.");
    }
    setGenerating(false);
  };

  const applyBook = (updated) =>
    setBooks((prev) => prev.map((b) => (b.id === updated.id ? recomputeBook(updated) : b)));

  const handleSell = async (book, n) => {
    try {
      const upd = await sellTicketRemote(book, n, { paymentStatus: "paid" });
      applyBook(upd);
    } catch (e) {
      showToast("Erro ao vender rifa.");
    }
  };
  const handleRelease = async (book, n) => {
    try {
      const upd = await releaseTicketRemote(book, n);
      applyBook(upd);
    } catch (e) {
      showToast("Erro ao liberar rifa.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Ticket className="h-6 w-6" /> Rifas
          </h1>
          <p className="text-sm text-zinc-500">
            10 bloquinhos × 10 rifas por turma · {brl(TICKET_PRICE)} cada
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reload}
            className="flex h-10 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-xs font-semibold text-zinc-300 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
          {turmasFaltando.length > 0 && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-black hover:bg-zinc-200 disabled:opacity-50"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Gerar bloquinhos ({turmasFaltando.length} turma{turmasFaltando.length !== 1 ? "s" : ""})
            </button>
          )}
        </div>
      </div>

      {books.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-[#0a0a0a] p-10 text-center">
          <Ticket className="mx-auto mb-3 h-10 w-10 text-zinc-700" />
          <p className="text-white font-semibold">Nenhum bloquinho gerado ainda</p>
          <p className="mt-1 text-sm text-zinc-500">
            {turmas.length > 0
              ? `Clique em "Gerar bloquinhos" para criar 10 blocos para cada uma das ${turmas.length} turmas.`
              : "Cadastre/importe alunos primeiro para que as turmas existam."}
          </p>
        </div>
      ) : (
        <>
          {/* Sub-tabs */}
          <div className="flex gap-1 rounded-2xl border border-zinc-800 bg-[#0a0a0a] p-1">
            {[
              { k: "overview", l: "Visão Geral", i: BarChart3 },
              { k: "turmas", l: "Por Turma", i: Ticket },
              { k: "relatorios", l: "Relatórios", i: Trophy },
            ].map(({ k, l, i: I }) => (
              <button
                key={k}
                onClick={() => setSub(k)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all ${
                  sub === k ? "bg-white text-black" : "text-zinc-500 hover:text-white"
                }`}
              >
                <I className="h-4 w-4" /> {l}
              </button>
            ))}
          </div>

          {/* VISÃO GERAL */}
          {sub === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <Card title="Disponíveis" value={ov.availableTickets} icon={Ticket} />
                <Card title="Vendidas" value={ov.soldTickets} icon={CheckCircle2} />
                <Card title="Pendentes" value={ov.pendingTickets} sub="pgto pendente" />
                <Card title="Arrecadado" value={brl(ov.totalRevenue)} icon={Banknote} />
                <Card title="Previsto" value={brl(ov.expectedRevenue)} sub="potencial máximo" />
                <Card
                  title="% Vendido"
                  value={`${ov.completionPercentage}%`}
                  sub={`${ov.classesCount} turma(s)`}
                />
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-[#0a0a0a] p-5">
                <div className="mb-2 flex justify-between text-xs text-zinc-400">
                  <span>Progresso global</span>
                  <span className="tabular-nums">
                    {ov.soldTickets}/{ov.totalTickets} · falta {brl(ov.remainingRevenue)}
                  </span>
                </div>
                <Progress pct={ov.completionPercentage} esgotado={ov.completionPercentage >= 100} />
              </div>

              {/* Consolidado por ano */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  Consolidado por ano
                </p>
                {porAno.map((f) => (
                  <div
                    key={f.yearId}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-[#0a0a0a] px-4 py-3"
                  >
                    <span className="font-semibold text-white">{f.yearId}º Ano</span>
                    <span className="text-sm tabular-nums text-zinc-400">
                      {f.soldTickets}/{f.totalTickets} vendidas · {brl(f.totalRevenue)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* POR TURMA */}
          {sub === "turmas" && (
            <div className="space-y-3">
              {porTurma.map((f) => {
                const classBooks = grouped[f.classId] || [];
                const isOpen = openClass === f.classId;
                return (
                  <div key={f.classId} className="rounded-2xl border border-zinc-800 bg-[#0a0a0a]">
                    <button
                      onClick={() => {
                        setOpenClass(isOpen ? null : f.classId);
                        setOpenBook(null);
                      }}
                      className="flex w-full items-center gap-3 p-4 text-left"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-zinc-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-zinc-500" />
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-white">Turma {f.classId}</p>
                        <p className="text-xs text-zinc-500">
                          {f.booksComplete} bloco(s) completo(s) · {f.booksIncomplete} parcial(is)
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums text-white">
                          {f.soldTickets}/{f.totalTickets}
                        </p>
                        <p className="text-xs tabular-nums text-zinc-500">{brl(f.totalRevenue)}</p>
                      </div>
                    </button>
                    <div className="px-4 pb-3">
                      <Progress pct={f.completionPercentage} esgotado={f.completionPercentage >= 100} />
                    </div>

                    {isOpen && (
                      <div className="space-y-2 border-t border-zinc-800 p-4">
                        {classBooks.map((b) => {
                          const bookOpen = openBook === b.id;
                          return (
                            <div key={b.id} className="rounded-xl border border-zinc-800 bg-zinc-950">
                              <button
                                onClick={() => setOpenBook(bookOpen ? null : b.id)}
                                className="flex w-full items-center gap-2 p-3 text-left"
                              >
                                {bookOpen ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                                )}
                                <span className="flex-1 text-sm font-semibold text-white">
                                  Bloco {b.bookNumber}
                                </span>
                                <span className="text-xs tabular-nums text-zinc-500">
                                  {b.soldTickets}/10
                                </span>
                                {statusPill(b.status)}
                              </button>
                              {bookOpen && (
                                <div className="grid grid-cols-2 gap-2 border-t border-zinc-800 p-3 sm:grid-cols-5">
                                  {b.tickets.map((t) => (
                                    <div
                                      key={t.number}
                                      className="flex flex-col items-center gap-1 rounded-lg border border-zinc-800 bg-[#0a0a0a] p-2"
                                    >
                                      <span className="text-xs font-bold text-white">
                                        Rifa {t.number}
                                      </span>
                                      {statusPill(t.status)}
                                      {t.status === "available" ? (
                                        <button
                                          onClick={() => handleSell(b, t.number)}
                                          className="mt-1 w-full rounded-md bg-white py-1 text-[10px] font-bold text-black hover:bg-zinc-200"
                                        >
                                          Vender
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleRelease(b, t.number)}
                                          className="mt-1 w-full rounded-md border border-zinc-700 py-1 text-[10px] font-bold text-zinc-400 hover:text-white"
                                        >
                                          Liberar
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* RELATÓRIOS */}
          {sub === "relatorios" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-[#0a0a0a] p-5">
                <p className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                  <Trophy className="h-4 w-4 text-amber-400" /> Ranking — mais venderam
                </p>
                <ol className="space-y-2">
                  {rankSold.map((f, i) => (
                    <li key={f.classId} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-300">
                        <span className="mr-2 text-zinc-600">{i + 1}.</span> {f.classId}
                      </span>
                      <span className="tabular-nums text-zinc-400">{f.soldTickets} rifas</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-[#0a0a0a] p-5">
                <p className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                  <Banknote className="h-4 w-4 text-green-400" /> Ranking — arrecadação
                </p>
                <ol className="space-y-2">
                  {rankRev.map((f, i) => (
                    <li key={f.classId} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-300">
                        <span className="mr-2 text-zinc-600">{i + 1}.</span> {f.classId}
                      </span>
                      <span className="tabular-nums text-zinc-400">{brl(f.totalRevenue)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
