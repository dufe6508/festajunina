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
  Download,
  Zap,
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
  booksToCSV,
} from "./rifas";
import {
  fetchTurmas,
  fetchAllBooks,
  ensureAllClassBooks,
  sellTicketRemote,
  releaseTicketRemote,
  sellBookRemote,
  sellAllBooksRemote,
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
  const [busy, setBusy] = useState(null); // id de operação em andamento
  const [sub, setSub] = useState("overview"); // overview | turmas | relatorios
  const [openYear, setOpenYear] = useState(null);
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

  // Turmas agrupadas por ANO (1, 2, 3...) para a aba "Por Turma".
  const turmasByYear = useMemo(() => {
    const m = {};
    porTurma.forEach((f) => {
      (m[f.yearId] ||= []).push(f);
    });
    return m;
  }, [porTurma]);
  const anos = useMemo(() => Object.keys(turmasByYear).sort(), [turmasByYear]);

  const turmasFaltando = useMemo(
    () => turmas.filter((t) => (grouped[t.classId] || []).length < 10),
    [turmas, grouped]
  );

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const criados = await ensureAllClassBooks(turmas, books);
      await reload();
      showToast(
        criados > 0 ? `${criados} bloquinho(s) criado(s).` : "Todas as turmas já têm seus bloquinhos.",
        "success"
      );
    } catch (e) {
      showToast("Erro ao gerar bloquinhos.");
    }
    setGenerating(false);
  };

  const applyBook = (updated) =>
    setBooks((prev) => prev.map((b) => (b.id === updated.id ? recomputeBook(updated) : b)));
  const applyBooks = (updatedList) =>
    setBooks((prev) =>
      prev.map((b) => {
        const u = updatedList.find((x) => x.id === b.id);
        return u ? recomputeBook(u) : b;
      })
    );

  const handleSell = async (book, n) => {
    try {
      applyBook(await sellTicketRemote(book, n, { paymentStatus: "paid" }));
    } catch {
      showToast("Erro ao vender rifa.");
    }
  };
  const handleRelease = async (book, n) => {
    try {
      applyBook(await releaseTicketRemote(book, n));
    } catch {
      showToast("Erro ao liberar rifa.");
    }
  };
  const handleSellBook = async (book) => {
    setBusy(book.id);
    try {
      applyBook(await sellBookRemote(book, { paymentStatus: "paid" }));
      showToast(`Bloco ${book.bookNumber} vendido por completo.`, "success");
    } catch {
      showToast("Erro ao vender bloco.");
    }
    setBusy(null);
  };
  const handleSellTurma = async (classId) => {
    const cb = grouped[classId] || [];
    const restantes = cb.reduce((s, b) => s + b.availableTickets, 0);
    if (restantes === 0) return showToast("Turma já está com todas as rifas vendidas.");
    if (!window.confirm(`Vender TODAS as ${restantes} rifas restantes da turma ${classId}?`)) return;
    setBusy(classId);
    try {
      applyBooks(await sellAllBooksRemote(cb, { paymentStatus: "paid" }));
      showToast(`Turma ${classId}: ${restantes} rifa(s) vendida(s).`, "success");
    } catch {
      showToast("Erro ao vender turma.");
    }
    setBusy(null);
  };

  const handleExportCSV = () => {
    try {
      const csv = booksToCSV(books);
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rifas_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast("Erro ao exportar CSV.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
      </div>
    );
  }

  const renderBook = (b) => {
    const bookOpen = openBook === b.id;
    return (
      <div key={b.id} className="rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-2 p-3">
          <button onClick={() => setOpenBook(bookOpen ? null : b.id)} className="flex flex-1 items-center gap-2 text-left">
            {bookOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
            )}
            <span className="flex-1 text-sm font-semibold text-white">Bloco {b.bookNumber}</span>
            <span className="text-xs tabular-nums text-zinc-500">{b.soldTickets}/10</span>
            {statusPill(b.status)}
          </button>
          {b.availableTickets > 0 && (
            <button
              onClick={() => handleSellBook(b)}
              disabled={busy === b.id}
              className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[10px] font-bold text-black hover:bg-zinc-200 disabled:opacity-50"
              title="Vender o bloco inteiro"
            >
              {busy === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              Vender bloco
            </button>
          )}
        </div>
        {bookOpen && (
          <div className="grid grid-cols-2 gap-2 border-t border-zinc-800 p-3 sm:grid-cols-5">
            {b.tickets.map((t) => (
              <div key={t.number} className="flex flex-col items-center gap-1 rounded-lg border border-zinc-800 bg-[#0a0a0a] p-2">
                <span className="text-xs font-bold text-white">Rifa {t.number}</span>
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
  };

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
        <div className="flex flex-wrap gap-2">
          <button
            onClick={reload}
            className="flex h-10 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-xs font-semibold text-zinc-300 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
          {books.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="flex h-10 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-xs font-semibold text-zinc-300 hover:text-white"
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </button>
          )}
          {turmasFaltando.length > 0 && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-black hover:bg-zinc-200 disabled:opacity-50"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Gerar bloquinhos ({turmasFaltando.length})
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
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Card title="Disponíveis" value={ov.availableTickets} icon={Ticket} />
                <Card title="Vendidas" value={ov.soldTickets} icon={CheckCircle2} />
                <Card title="Arrecadado" value={brl(ov.totalRevenue)} icon={Banknote} sub="rifas vendidas" />
                <Card title="% Vendido" value={`${ov.completionPercentage}%`} sub={`${ov.classesCount} turma(s)`} />
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-[#0a0a0a] p-5">
                <div className="mb-2 flex justify-between text-xs text-zinc-400">
                  <span>Progresso global</span>
                  <span className="tabular-nums">
                    {ov.soldTickets}/{ov.totalTickets}
                  </span>
                </div>
                <Progress pct={ov.completionPercentage} esgotado={ov.completionPercentage >= 100} />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Consolidado por ano</p>
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

          {/* POR TURMA — agrupado por ANO */}
          {sub === "turmas" && (
            <div className="space-y-3">
              {anos.map((ano) => {
                const fins = turmasByYear[ano] || [];
                const yearOpen = openYear === ano;
                const sold = fins.reduce((s, f) => s + f.soldTickets, 0);
                const total = fins.reduce((s, f) => s + f.totalTickets, 0);
                const rev = fins.reduce((s, f) => s + f.totalRevenue, 0);
                return (
                  <div key={ano} className="rounded-2xl border border-zinc-800 bg-[#0a0a0a]">
                    <button
                      onClick={() => {
                        setOpenYear(yearOpen ? null : ano);
                        setOpenClass(null);
                        setOpenBook(null);
                      }}
                      className="flex w-full items-center gap-3 p-4 text-left"
                    >
                      {yearOpen ? (
                        <ChevronDown className="h-5 w-5 text-zinc-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-zinc-400" />
                      )}
                      <span className="flex-1 text-lg font-bold text-white">{ano}º Ano</span>
                      <span className="text-sm tabular-nums text-zinc-400">
                        {sold}/{total} · {brl(rev)}
                      </span>
                      <span className="ml-2 rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-500">
                        {fins.length} turma(s)
                      </span>
                    </button>

                    {yearOpen && (
                      <div className="space-y-2 border-t border-zinc-800 p-3">
                        {fins.map((f) => {
                          const classBooks = grouped[f.classId] || [];
                          const classOpen = openClass === f.classId;
                          return (
                            <div key={f.classId} className="rounded-xl border border-zinc-800 bg-zinc-950">
                              <div className="flex items-center gap-2 p-3">
                                <button
                                  onClick={() => {
                                    setOpenClass(classOpen ? null : f.classId);
                                    setOpenBook(null);
                                  }}
                                  className="flex flex-1 items-center gap-2 text-left"
                                >
                                  {classOpen ? (
                                    <ChevronDown className="h-4 w-4 text-zinc-500" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-zinc-500" />
                                  )}
                                  <div className="flex-1">
                                    <p className="font-bold text-white">Turma {f.classId}</p>
                                    <p className="text-[11px] text-zinc-500">
                                      {f.booksComplete} completo(s) · {f.booksIncomplete} parcial(is)
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold tabular-nums text-white">
                                      {f.soldTickets}/{f.totalTickets}
                                    </p>
                                    <p className="text-[11px] tabular-nums text-zinc-500">{brl(f.totalRevenue)}</p>
                                  </div>
                                </button>
                                {f.availableTickets > 0 && (
                                  <button
                                    onClick={() => handleSellTurma(f.classId)}
                                    disabled={busy === f.classId}
                                    className="flex items-center gap-1 rounded-lg border border-white/20 bg-white/[0.06] px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-white/10 disabled:opacity-50"
                                    title="Vender todas as rifas da turma"
                                  >
                                    {busy === f.classId ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Zap className="h-3 w-3" />
                                    )}
                                    Vender tudo
                                  </button>
                                )}
                              </div>
                              <div className="px-3 pb-2">
                                <Progress pct={f.completionPercentage} esgotado={f.completionPercentage >= 100} />
                              </div>
                              {classOpen && (
                                <div className="space-y-2 border-t border-zinc-800 p-3">
                                  {classBooks.map(renderBook)}
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
