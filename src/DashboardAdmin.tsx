import React, { useState, useEffect, useRef } from "react";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  QrCode,
  ArrowLeft,
  LogOut,
  Camera,
  BarChart3,
  ClipboardList,
  ChevronRight,
  Search,
  CheckSquare,
  Banknote,
  ShoppingCart,
  Clock,
  Menu,
  X,
  GraduationCap,
  Shield,
  Home,
  User,
  Download,
  UserPlus,
  Mail,
  IdCard,
  Hash,
  Trash2,
  AlertTriangle,
  SlidersHorizontal,
} from "lucide-react";
import { FaRegAddressCard } from "react-icons/fa";
import { IoMdInformationCircleOutline } from "react-icons/io";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBGV0JAs7kI4JiKVvZDphaZ2h8hOXZAmps",
  authDomain: "festajunina-brandao.firebaseapp.com",
  projectId: "festajunina-brandao",
  storageBucket: "festajunina-brandao.firebasestorage.app",
  messagingSenderId: "609151203088",
  appId: "1:609151203088:web:231ac7eaeaf666d9511795",
  measurementId: "G-0Y2T5K1L6E",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helpers
const maskCpf = (cpf) =>
  cpf
    ? `***.${cpf.replace(/\D/g, "").slice(3, 6)}.${cpf
        .replace(/\D/g, "")
        .slice(6, 9)}-**`
    : "***.***.***-**";

const applyCpfMask = (v) => {
  let c = v.replace(/\D/g, "").slice(0, 11);
  if (c.length > 9)
    return c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (c.length > 6) return c.replace(/^(\d{3})(\d{3})(\d{0,3})/, "$1.$2.$3");
  if (c.length > 3) return c.replace(/^(\d{3})(\d{0,3})/, "$1.$2");
  return c;
};

// Gera um código único de ingresso no padrão #FJ-XXXX
const generateTicketCode = () =>
  `#FJ-${Math.floor(1000 + Math.random() * 9000)}`;

// Nova formatação de data para seguir o padrão visual: "14/06/2026 às 01:44"
const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })} às ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const Button = ({
  children,
  className = "",
  isLoading,
  variant = "primary",
  ...props
}) => {
  const v = {
    primary: "bg-white text-black hover:bg-zinc-200",
    secondary:
      "bg-zinc-900 text-white border border-zinc-800 hover:bg-zinc-800",
    outline:
      "bg-transparent text-zinc-300 border border-zinc-800 hover:bg-zinc-900",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all h-12 px-6 py-2 disabled:opacity-50 ${v[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />} {children}
    </button>
  );
};

const Input = ({ className = "", error, ...props }) => (
  <input
    className={`flex h-12 w-full rounded-xl border ${
      error
        ? "border-red-500 bg-red-500/10 text-red-100"
        : "border-zinc-800 bg-black text-white"
    } px-4 py-2 text-sm placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white transition-all ${className}`}
    {...props}
  />
);

const Label = ({ children, className = "" }) => (
  <label
    className={`text-[10px] font-bold uppercase tracking-widest text-zinc-500 ${className}`}
  >
    {children}
  </label>
);
const StatCard = ({
  title,
  val,
  icon: Icon,
  tot,
  pct,
  sub,
  onClick,
  bgBar = "bg-white",
}) => {
  const C = onClick ? "button" : "div";
  return (
    <C
      onClick={onClick}
      className={`bg-[#0a0a0a] border border-zinc-800 p-6 rounded-3xl flex flex-col relative overflow-hidden w-full ${
        onClick
          ? "group text-left hover:border-zinc-500 transition-colors cursor-pointer"
          : ""
      }`}
    >
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
          <Icon
            className={`h-6 w-6 text-white ${
              onClick ? "group-hover:scale-110 transition-transform" : ""
            }`}
          />
        </div>
        <p className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
          {title}
        </p>
      </div>
      <p
        className={`${
          sub ? "text-3xl" : "text-4xl"
        } font-black text-white mt-auto`}
      >
        {val}{" "}
        {tot != null && (
          <span className="text-xl text-zinc-600 font-medium">/ {tot}</span>
        )}
      </p>
      {pct != null && (
        <div className="w-full bg-zinc-900 h-1.5 mt-4 rounded-full overflow-hidden">
          <div
            className={`${bgBar} h-full rounded-full transition-all duration-1000`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {sub && (
        <div className="mt-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          {sub}
        </div>
      )}
    </C>
  );
};

export default function DashboardAdmin({ currentUser, onLogout, onBack }) {
  const [activeTab, setActiveTab] = useState("admin_scanner");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [allTickets, setAllTickets] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [adminLoading, setAdminLoading] = useState(false);
  const [scanCode, setScanCode] = useState("");
  const [scanResultModal, setScanResultModal] = useState(null);
  const [infoModalTicket, setInfoModalTicket] = useState(null);
  const [confirmDeleteTicket, setConfirmDeleteTicket] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [adminListYear, setAdminListYear] = useState(null);
  const [adminListClass, setAdminListClass] = useState(null);
  const [dashboardDetailModal, setDashboardDetailModal] = useState(null);
  const [filterYear, setFilterYear] = useState(null);
  const [filterClass, setFilterClass] = useState(null);

  // ─── Estados: Pesquisar Ingressos ───
  const [searchQuery, setSearchQuery] = useState("");
  const [searchYear, setSearchYear] = useState(null);
  const [searchClass, setSearchClass] = useState(null);
  const [searchStatus, setSearchStatus] = useState(null); // null | "validado" | "pendente"
  const [showSearchFilters, setShowSearchFilters] = useState(false);

  // ─── Estados: Adicionar Ingresso ───
  const [addTicketForm, setAddTicketForm] = useState({
    nomeAluno: "",
    ano: "",
    turma: "",
    cpf: "",
    email: "",
  });
  const [addTicketErrors, setAddTicketErrors] = useState({});
  const [addTicketStatus, setAddTicketStatus] = useState("pendente"); // "pendente" | "validado"
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [generatedTicket, setGeneratedTicket] = useState(null);

  const allTicketsRef = useRef(allTickets);
  useEffect(() => {
    allTicketsRef.current = allTickets;
  }, [allTickets]);
  useEffect(() => {
    if (!dashboardDetailModal) {
      setFilterYear(null);
      setFilterClass(null);
    }
  }, [dashboardDetailModal]);
  useEffect(() => {
    fetchAllTicketsForAdmin();
  }, [activeTab]);

  const showToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAllTicketsForAdmin = async () => {
    setAdminLoading(true);
    try {
      const qSnap = await getDocs(collection(db, "ingressos"));
      const uSnap = await getDocs(collection(db, "usuarios"));
      const tickets = [],
        uMap = {};
      qSnap.forEach((d) => tickets.push({ id: d.id, ...d.data() }));
      uSnap.forEach((d) => (uMap[d.id] = d.data().cpf));
      setUsersMap(uMap);
      setAllTickets(
        tickets.sort((a, b) =>
          (a.nomeAluno || "").localeCompare(b.nomeAluno || "")
        )
      );
    } catch (err) {
      showToast("Erro ao buscar dados.");
    }
    setAdminLoading(false);
  };

  const processScan = (code) => {
    const t = allTicketsRef.current.find(
      (x) => x.code.toUpperCase() === code.toUpperCase()
    );
    if (!t)
      setScanResultModal({
        type: "error",
        msg: "Ingresso Inválido/Não Encontrado!",
      });
    else if (t.usado)
      setScanResultModal({
        type: "warning",
        msg: "Ingresso JÁ UTILIZADO!",
        ticket: t,
      });
    else
      setScanResultModal({
        type: "success",
        msg: "Ingresso Válido! Liberar.",
        ticket: t,
      });
    setScanCode("");
  };

  const handleScanSubmit = (e) => {
    e.preventDefault();
    if (!scanCode) return;
    processScan(scanCode);
  };

  useEffect(() => {
    let html5QrcodeScanner = null;
    if (activeTab === "admin_scanner" && isScanning) {
      const init = () => {
        if (!window.Html5Qrcode) return setTimeout(init, 100);
        html5QrcodeScanner = new window.Html5Qrcode("qr-reader");
        html5QrcodeScanner
          .start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 250 },
            (txt) => {
              html5QrcodeScanner.stop();
              setIsScanning(false);
              processScan(txt);
            },
            () => {}
          )
          .catch(() => {
            showToast("Permissão negada ou câmera indisponível.", "error");
            setIsScanning(false);
          });
      };
      if (!window.Html5Qrcode) {
        const s = document.createElement("script");
        s.src = "https://unpkg.com/html5-qrcode";
        s.onload = init;
        document.body.appendChild(s);
      } else init();
    }
    return () => {
      if (html5QrcodeScanner?.isScanning) html5QrcodeScanner.stop();
    };
  }, [activeTab, isScanning]);

  const confirmarEntrada = async (ticketId) => {
    setAdminLoading(true);
    try {
      const horaAtual = new Date().toISOString();
      await updateDoc(doc(db, "ingressos", ticketId), {
        usado: true,
        horaEntrada: horaAtual,
      });
      setAllTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId ? { ...t, usado: true, horaEntrada: horaAtual } : t
        )
      );
      showToast("Entrada confirmada!", "success");
      setScanResultModal(null);
    } catch (err) {
      showToast("Erro ao confirmar entrada.");
    }
    setAdminLoading(false);
  };

  // ─── FUNÇÃO: Excluir Ingresso ───
  const excluirIngresso = async (ticketId) => {
    setAdminLoading(true);
    try {
      await deleteDoc(doc(db, "ingressos", ticketId));
      setAllTickets((prev) => prev.filter((t) => t.id !== ticketId));
      showToast("Ingresso excluído com sucesso!", "success");
      setConfirmDeleteTicket(null);
      setInfoModalTicket(null);
    } catch (err) {
      showToast("Erro ao excluir o ingresso.");
    }
    setAdminLoading(false);
  };

  // ─── FUNÇÃO: Adicionar Ingresso Manualmente ───
  const handleAddTicketChange = (e) => {
    const { name, value } = e.target;
    let v = value;
    if (name === "cpf") v = applyCpfMask(value);
    setAddTicketForm((prev) => ({ ...prev, [name]: v }));
    if (addTicketErrors[name])
      setAddTicketErrors((prev) => ({ ...prev, [name]: null }));
  };

  const validateAddTicket = () => {
    const e = {};
    if (addTicketForm.nomeAluno.trim().length < 3)
      e.nomeAluno = "Mínimo 3 caracteres";
    if (!addTicketForm.ano) e.ano = "Selecione o ano";
    if (!addTicketForm.turma) e.turma = "Selecione a turma";
    if (addTicketForm.cpf.replace(/\D/g, "").length !== 11)
      e.cpf = "CPF inválido";
    if (!/^\S+@\S+\.\S+$/.test(addTicketForm.email))
      e.email = "E-mail inválido";
    setAddTicketErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleGenerateTicket = async () => {
    if (!validateAddTicket())
      return showToast("Corrija os erros para continuar.");

    setIsCreatingTicket(true);
    try {
      const uniqueCode = generateTicketCode();
      const usado = addTicketStatus === "validado";
      const agora = new Date().toISOString();

      const ticketData = {
        userId: `manual_${uniqueCode}`,
        nomeAluno: addTicketForm.nomeAluno.trim(),
        ano: addTicketForm.ano,
        turma: addTicketForm.turma,
        type: "Acesso Geral",
        qty: 1,
        price: 15,
        code: uniqueCode,
        criadoEm: agora,
        usado,
        horaEntrada: usado ? agora : null,
        cpf: addTicketForm.cpf,
        email: addTicketForm.email,
        origem: "manual_admin",
      };

      await setDoc(doc(db, "ingressos", uniqueCode), ticketData);

      setAllTickets((prev) =>
        [...prev, { id: uniqueCode, ...ticketData }].sort((a, b) =>
          (a.nomeAluno || "").localeCompare(b.nomeAluno || "")
        )
      );
      setUsersMap((prev) => ({
        ...prev,
        [`manual_${uniqueCode}`]: addTicketForm.cpf,
      }));

      setGeneratedTicket({ id: uniqueCode, ...ticketData });
      showToast("Ingresso gerado com sucesso!", "success");

      setAddTicketForm({
        nomeAluno: "",
        ano: "",
        turma: "",
        cpf: "",
        email: "",
      });
      setAddTicketStatus("pendente");
    } catch (err) {
      showToast("Erro ao gerar o ingresso.");
    }
    setIsCreatingTicket(false);
  };

  // ─── FUNÇÃO DE EXPORTAR PARA XLS ───
  const exportToXLS = () => {
    const filtered = allTickets
      .filter((t) => t.ano === adminListYear && t.turma === adminListClass)
      .sort((a, b) => (a.nomeAluno || "").localeCompare(b.nomeAluno || ""));

    if (filtered.length === 0) {
      showToast("Não há dados para exportar.", "error");
      return;
    }

    let tableHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"></head>
      <body>
        <table border="1">
          <thead>
            <tr style="background-color: #333; color: #fff;">
              <th>Nome do Aluno</th>
              <th>Turma</th>
              <th>CPF do Responsável/Aluno</th>
              <th>Código do Convite</th>
              <th>Status</th>
              <th>Data da Compra</th>
              <th>Data de Validação</th>
            </tr>
          </thead>
          <tbody>
    `;

    filtered.forEach((t) => {
      const turmaFmt = `${t.ano}º ${t.turma}`;
      const cpf = usersMap[t.userId] || "—";
      const status = t.usado ? "Presente" : "Pendente";
      const dtCompra = formatDate(t.criadoEm);
      const dtValida = t.usado ? formatDate(t.horaEntrada) : "—";

      tableHTML += `
        <tr>
          <td>${t.nomeAluno || "—"}</td>
          <td>${turmaFmt}</td>
          <td>${cpf}</td>
          <td>${t.code}</td>
          <td>${status}</td>
          <td>${dtCompra}</td>
          <td>${dtValida}</td>
        </tr>
      `;
    });

    tableHTML += `</tbody></table></body></html>`;

    const blob = new Blob([tableHTML], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Lista_Turma_${adminListYear}Ano_${adminListClass}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ─── COMPONENTES REUTILIZÁVEIS INTERNOS ───
  const getDetailedList = () => {
    let list =
      dashboardDetailModal === "vendidos"
        ? [...allTickets]
        : dashboardDetailModal === "entraram"
        ? allTickets.filter((t) => t.usado)
        : allTickets.filter((t) => !t.usado);
    if (filterYear) list = list.filter((t) => t.ano === filterYear);
    if (filterClass) list = list.filter((t) => t.turma === filterClass);
    return list.sort((a, b) =>
      (a.nomeAluno || "").localeCompare(b.nomeAluno || "")
    );
  };

  // ─── Resultados da pesquisa de ingressos ───
  const getSearchResults = () => {
    const query = searchQuery.trim().toLowerCase();
    let list = [...allTickets];

    if (searchYear) list = list.filter((t) => t.ano === searchYear);
    if (searchClass) list = list.filter((t) => t.turma === searchClass);
    if (searchStatus === "validado") list = list.filter((t) => t.usado);
    if (searchStatus === "pendente") list = list.filter((t) => !t.usado);

    if (query.length >= 3) {
      list = list.filter((t) => {
        const nome = (t.nomeAluno || "").toLowerCase();
        const code = (t.code || "").toLowerCase();
        const cpf = (usersMap[t.userId] || "").toLowerCase();
        return (
          nome.includes(query) || code.includes(query) || cpf.includes(query)
        );
      });
    } else if (!searchYear && !searchClass && !searchStatus) {
      return [];
    }

    return list.sort((a, b) =>
      (a.nomeAluno || "").localeCompare(b.nomeAluno || "")
    );
  };

  // TicketRow — layout em card com ícone, CPF, código e status
  const TicketRow = ({ t, i, isModal }) => {
    const cpf = maskCpf(usersMap[t.userId]);
    const turmaLabel = t.ano && t.turma ? `${t.ano}º ${t.turma}` : "—";

    return (
      <div
        key={t.id}
        className="bg-[#0a0a0a] border border-zinc-800 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4 hover:border-zinc-700 hover:bg-[#0c0c0c] transition-colors"
      >
        {/* Ícone + identidade */}
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center justify-center shrink-0">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-base truncate">
              {t.nomeAluno || "—"}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1.5 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" /> {turmaLabel}
              </span>
              <span className="h-3 w-px bg-zinc-800 hidden sm:inline-block" />
              <span className="flex items-center gap-1.5 font-mono">
                <Hash className="h-3.5 w-3.5" />
                {t.code?.replace("#", "")}
              </span>
              <span className="h-3 w-px bg-zinc-800 hidden sm:inline-block" />
              <span className="flex items-center gap-1.5 font-mono">
                <FaRegAddressCard className="h-3.5 w-3.5" /> {cpf}
              </span>
            </div>
          </div>
        </div>

        {/* Status + ação */}
        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-5 pl-[60px] sm:pl-0 shrink-0">
          <div className="flex flex-col items-start sm:items-end gap-1">
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                t.usado
                  ? "bg-green-500/10 text-green-400"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {t.usado ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              {t.usado ? "Validado" : "Pendente"}
            </span>
            <span className="text-zinc-500 text-[11px] font-medium">
              {t.usado
                ? formatDate(t.horaEntrada)
                : isModal
                ? formatDate(t.criadoEm)
                : "Aguardando entrada"}
            </span>
          </div>

          <button
            onClick={() => setInfoModalTicket(t)}
            className="h-9 w-9 flex items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors shrink-0"
            title="Ver detalhes"
          >
            <IoMdInformationCircleOutline className="h-5 w-5" />
          </button>

          {!t.usado && !isModal && (
            <Button
              onClick={() => confirmarEntrada(t.id)}
              variant="outline"
              className="h-9 text-xs shrink-0"
              isLoading={adminLoading}
            >
              Aprovar
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-black overflow-hidden selection:bg-white selection:text-black">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 bg-[#0a0a0a] border-r border-zinc-800 flex flex-col transition-all duration-300 ${
          sidebarOpen
            ? "w-64"
            : "w-0 lg:w-20 overflow-hidden lg:overflow-visible"
        }`}
      >
        <div className="h-20 flex items-center justify-between lg:justify-center px-6 lg:px-0 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5 text-black" />
            </div>
            <span
              className={`font-bold text-white tracking-tight transition-opacity ${
                sidebarOpen ? "opacity-100" : "lg:hidden opacity-0 w-0"
              }`}
            >
              Painel Admin
            </span>
          </div>
          <button
            className="p-2 text-zinc-500 hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
          {[
            { key: "admin_scanner", label: "Validar (Câmera)", icon: Camera },
            { key: "admin_dashboard", label: "Dashboard", icon: BarChart3 },
            {
              key: "admin_list",
              label: "Listas de Presença",
              icon: ClipboardList,
            },
            {
              key: "admin_search",
              label: "Pesquisar Ingressos",
              icon: Search,
            },
            {
              key: "admin_add_ticket",
              label: "Adicionar Ingresso",
              icon: UserPlus,
            },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key);
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-4 px-3 lg:px-0 lg:justify-center rounded-xl transition-all h-12 text-sm font-medium whitespace-nowrap ${
                activeTab === key
                  ? "bg-white text-black"
                  : "text-zinc-500 hover:bg-zinc-900 hover:text-white"
              } ${sidebarOpen ? "lg:px-3 lg:justify-start" : ""}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span
                className={
                  sidebarOpen ? "opacity-100 block" : "lg:hidden opacity-0 w-0"
                }
              >
                {label}
              </span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-zinc-800 shrink-0 space-y-2">
          <button
            onClick={onBack || onLogout}
            className={`w-full flex items-center gap-4 px-3 lg:px-0 lg:justify-center h-12 rounded-xl text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-white transition-all whitespace-nowrap ${
              sidebarOpen ? "lg:px-3 lg:justify-start" : ""
            }`}
          >
            <Home className="h-5 w-5 shrink-0" />
            <span
              className={
                sidebarOpen ? "opacity-100 block" : "lg:hidden opacity-0 w-0"
              }
            >
              Tela Inicial
            </span>
          </button>
          <button
            onClick={onLogout}
            className={`w-full flex items-center gap-4 px-3 lg:px-0 lg:justify-center h-12 rounded-xl text-sm font-medium text-zinc-500 hover:bg-zinc-900 hover:text-red-400 transition-all whitespace-nowrap ${
              sidebarOpen ? "lg:px-3 lg:justify-start" : ""
            }`}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span
              className={
                sidebarOpen ? "opacity-100 block" : "lg:hidden opacity-0 w-0"
              }
            >
              Sair
            </span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-20 bg-black/80 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between px-6 sm:px-8 shrink-0 z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <button
              className="p-2 -ml-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <button
              className="hidden lg:block p-2 -ml-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-base font-semibold text-white tracking-wide">
              {activeTab === "admin_scanner"
                ? "Validação de Entrada"
                : activeTab === "admin_dashboard"
                ? "Dashboard Financeiro"
                : activeTab === "admin_add_ticket"
                ? "Adicionar Ingresso"
                : activeTab === "admin_search"
                ? "Pesquisar Ingressos"
                : "Listas de Presença"}
            </h2>
          </div>
          <div className="flex items-center gap-3 bg-[#0a0a0a] rounded-full sm:rounded-xl px-2 py-1.5 sm:pr-4 border border-zinc-800">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-wider leading-none text-zinc-500">
                Admin
              </p>
              <p className="text-sm font-semibold text-white mt-1 leading-none">
                Diretoria
              </p>
            </div>
            <div className="h-10 w-10 rounded-full flex items-center justify-center border border-zinc-700 bg-zinc-900 shrink-0">
              <Shield className="h-5 w-5 text-white" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-black p-4 sm:p-6 lg:p-8">
          {/* ── SCANNER ── */}
          {activeTab === "admin_scanner" && (
            <div className="max-w-xl mx-auto flex flex-col items-center justify-center min-h-[70vh] animate-in fade-in zoom-in duration-300">
              <div className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl p-8 sm:p-10 flex flex-col items-center w-full shadow-2xl">
                <Camera className="h-12 w-12 text-white mb-5" />

                <h3 className="font-bold text-white text-xl sm:text-2xl mb-1.5 text-center tracking-tight">
                  Leitor de Ingresso
                </h3>
                <p className="text-zinc-500 text-center text-sm mb-8 max-w-sm">
                  Aponte a câmera para o QR Code ou digite o código manualmente
                </p>

                {isScanning ? (
                  <div className="w-full mb-2 bg-black border border-zinc-800 rounded-2xl overflow-hidden shadow-inner relative">
                    <div id="qr-reader" className="w-full"></div>
                    <button
                      onClick={() => setIsScanning(false)}
                      className="w-full py-3.5 bg-zinc-950 border-t border-zinc-800 text-zinc-400 hover:text-white text-sm font-semibold transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <Button
                    className="w-full mb-6"
                    onClick={() => setIsScanning(true)}
                  >
                    <Camera className="w-4 h-4" /> Ativar Câmera
                  </Button>
                )}

                {!isScanning && (
                  <>
                    <div className="flex items-center gap-3 w-full mb-6">
                      <div className="flex-1 h-px bg-zinc-800" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                        ou digite o código
                      </span>
                      <div className="flex-1 h-px bg-zinc-800" />
                    </div>

                    <form onSubmit={handleScanSubmit} className="w-full">
                      <div className="relative flex items-center bg-black border border-zinc-700 rounded-2xl h-14 pl-5 pr-2 focus-within:border-white focus-within:ring-1 focus-within:ring-white transition shadow-inner">
                        <span className="font-mono text-zinc-500 text-lg tracking-widest shrink-0">
                          #FJ-
                        </span>
                        <input
                          type="text"
                          placeholder="0000"
                          className="flex-1 bg-transparent text-white text-lg font-mono outline-none text-center tracking-[0.3em] placeholder:text-zinc-700 placeholder:tracking-[0.3em]"
                          value={scanCode.replace("#FJ-", "")}
                          onChange={(e) => {
                            const v = e.target.value
                              .replace(/\D/g, "")
                              .slice(0, 4);
                            setScanCode(v ? `#FJ-${v}` : "");
                          }}
                        />
                        <button
                          type="submit"
                          disabled={!scanCode}
                          className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-white text-black disabled:opacity-30 disabled:pointer-events-none hover:bg-zinc-200 transition-colors"
                        >
                          <Search className="h-4 w-4" />
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── DASHBOARD ── */}
          {activeTab === "admin_dashboard" && (
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <BarChart3 className="h-6 w-6 text-white" /> Visão Geral
                  </h1>
                  <p className="text-zinc-400 text-sm mt-1">
                    Clique nos cards para detalhes.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={fetchAllTicketsForAdmin}
                  isLoading={adminLoading}
                >
                  Atualizar
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                <StatCard
                  title="Vendidos"
                  val={allTickets.length}
                  icon={ShoppingCart}
                  pct={allTickets.length > 0 ? 100 : 0}
                  onClick={() => setDashboardDetailModal("vendidos")}
                />
                <StatCard
                  title="Entraram"
                  val={allTickets.filter((t) => t.usado).length}
                  tot={allTickets.length}
                  icon={CheckSquare}
                  pct={
                    allTickets.length > 0
                      ? (allTickets.filter((t) => t.usado).length /
                          allTickets.length) *
                        100
                      : 0
                  }
                  onClick={() => setDashboardDetailModal("entraram")}
                />
                <StatCard
                  title="Pendentes"
                  val={allTickets.filter((t) => !t.usado).length}
                  icon={Clock}
                  pct={
                    allTickets.length > 0
                      ? (allTickets.filter((t) => !t.usado).length /
                          allTickets.length) *
                        100
                      : 0
                  }
                  bgBar="bg-zinc-600"
                  onClick={() => setDashboardDetailModal("pendentes")}
                />
                <StatCard
                  title="Receita (R$)"
                  val={`R$ ${allTickets
                    .reduce((acc, t) => acc + (t.price || 15), 0)
                    .toFixed(2)
                    .replace(".", ",")}`}
                  icon={Banknote}
                  sub="Valor Bruto Arrecadado"
                />
              </div>
            </div>
          )}

          {/* ── LISTAS DE PRESENÇA ── */}
          {activeTab === "admin_list" && (
            <div className="max-w-6xl mx-auto">
              {!adminListYear ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        Listas de Presença
                      </h2>
                      <p className="text-zinc-400 text-sm">
                        Selecione o ano escolar
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={fetchAllTicketsForAdmin}
                      isLoading={adminLoading}
                      className="h-10 text-xs"
                    >
                      Atualizar
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {[1, 2, 3].map((a) => (
                      <button
                        key={a}
                        onClick={() => setAdminListYear(String(a))}
                        className="bg-[#0a0a0a] p-8 border border-zinc-800 rounded-3xl hover:border-zinc-500 transition flex flex-col items-center justify-center group"
                      >
                        <div className="w-16 h-16 bg-black border border-zinc-800 rounded-full flex items-center justify-center mb-4">
                          <GraduationCap className="h-8 w-8 text-white" />
                        </div>
                        <h2 className="text-3xl font-black text-white">
                          {a}º Ano
                        </h2>
                        <p className="text-zinc-500 uppercase tracking-widest text-xs mt-2 font-bold group-hover:text-white transition-colors">
                          Ver turmas <ChevronRight className="inline w-3 h-3" />
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : !adminListClass ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setAdminListYear(null)}
                      className="p-2 bg-zinc-900 text-zinc-400 hover:text-white rounded-full transition"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {adminListYear}º Ano
                      </h2>
                      <p className="text-zinc-400 text-sm">Selecione a turma</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {Array.from({ length: 12 }, (_, i) =>
                      String.fromCharCode(65 + i)
                    ).map((t) => {
                      const tot = allTickets.filter(
                        (x) => x.ano === adminListYear && x.turma === t
                      ).length;
                      return (
                        <button
                          key={t}
                          onClick={() => setAdminListClass(t)}
                          className="flex items-center justify-between p-4 bg-[#0a0a0a] border border-zinc-800 rounded-xl hover:bg-zinc-900 hover:border-zinc-600 transition-colors group"
                        >
                          <span className="font-bold text-white text-sm">
                            Turma {t}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              tot > 0
                                ? "bg-white text-black"
                                : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                            }`}
                          >
                            {tot} {tot === 1 ? "aluno" : "alunos"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setAdminListClass(null)}
                        className="p-2 bg-zinc-900 text-zinc-400 hover:text-white rounded-full transition"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <div>
                        <h2 className="text-xl font-bold text-white">
                          {adminListYear}º Ano — Turma {adminListClass}
                        </h2>
                        <p className="text-zinc-400 text-sm">
                          Presença:{" "}
                          {
                            allTickets.filter(
                              (t) =>
                                t.ano === adminListYear &&
                                t.turma === adminListClass &&
                                t.usado
                            ).length
                          }{" "}
                          /{" "}
                          {
                            allTickets.filter(
                              (t) =>
                                t.ano === adminListYear &&
                                t.turma === adminListClass
                            ).length
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <Button
                        variant="outline"
                        onClick={exportToXLS}
                        className="h-10 text-xs flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" /> Exportar Planilha
                      </Button>
                      <Button
                        variant="outline"
                        onClick={fetchAllTicketsForAdmin}
                        isLoading={adminLoading}
                        className="h-10 text-xs"
                      >
                        Atualizar
                      </Button>
                    </div>
                  </div>
                  <div>
                    {allTickets.filter(
                      (t) =>
                        t.ano === adminListYear && t.turma === adminListClass
                    ).length === 0 ? (
                      <div className="p-12 text-center text-zinc-500">
                        <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        Vazia.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {allTickets
                          .filter(
                            (t) =>
                              t.ano === adminListYear &&
                              t.turma === adminListClass
                          )
                          .sort((a, b) =>
                            a.usado && !b.usado
                              ? -1
                              : !a.usado && b.usado
                              ? 1
                              : a.usado && b.usado
                              ? new Date(b.horaEntrada).getTime() -
                                new Date(a.horaEntrada).getTime()
                              : (a.nomeAluno || "").localeCompare(
                                  b.nomeAluno || ""
                                )
                          )
                          .map((t, i) => (
                            <TicketRow key={t.id} t={t} i={i} isModal={false} />
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PESQUISAR INGRESSOS ── */}
          {activeTab === "admin_search" && (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Search className="h-6 w-6 text-white" /> Pesquisar Ingressos
                </h1>
                <p className="text-zinc-400 text-sm mt-1">
                  Digite ao menos 3 letras para buscar por nome, código ou CPF.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Buscar por nome, código (#FJ-0000) ou CPF..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-14 bg-[#0a0a0a] border border-zinc-800 rounded-2xl pl-14 pr-4 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition shadow-inner"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setShowSearchFilters((v) => !v)}
                  className={`relative h-14 w-14 shrink-0 flex items-center justify-center rounded-2xl border transition-colors ${
                    showSearchFilters
                      ? "bg-white text-black border-white"
                      : "bg-[#0a0a0a] border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600"
                  }`}
                  title="Filtros"
                >
                  <SlidersHorizontal className="h-5 w-5" />
                  {(searchYear || searchClass || searchStatus) && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white text-black text-[10px] font-bold flex items-center justify-center border-2 border-black">
                      {
                        [searchYear, searchClass, searchStatus].filter(Boolean)
                          .length
                      }
                    </span>
                  )}
                </button>
              </div>

              {/* Filtros */}
              {showSearchFilters && (
                <div className="bg-[#0a0a0a] border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-white uppercase tracking-widest">
                      Filtros
                    </p>
                    {(searchYear || searchClass || searchStatus) && (
                      <button
                        onClick={() => {
                          setSearchYear(null);
                          setSearchClass(null);
                          setSearchStatus(null);
                        }}
                        className="text-[11px] font-bold text-zinc-500 hover:text-white transition-colors"
                      >
                        Limpar filtros
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mr-1 shrink-0">
                      Ano:
                    </span>
                    <button
                      onClick={() => {
                        setSearchYear(null);
                        setSearchClass(null);
                      }}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                        !searchYear
                          ? "bg-white text-black"
                          : "bg-zinc-900 text-zinc-400 hover:text-white"
                      }`}
                    >
                      Todos
                    </button>
                    {[1, 2, 3].map((y) => (
                      <button
                        key={y}
                        onClick={() => {
                          setSearchYear(String(y));
                          setSearchClass(null);
                        }}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                          searchYear === String(y)
                            ? "bg-white text-black"
                            : "bg-zinc-900 text-zinc-400 hover:text-white"
                        }`}
                      >
                        {y}º Ano
                      </button>
                    ))}
                  </div>

                  {searchYear && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 animate-in fade-in slide-in-from-left-4">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mr-1 shrink-0">
                        Turma:
                      </span>
                      <button
                        onClick={() => setSearchClass(null)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                          !searchClass
                            ? "bg-white text-black"
                            : "bg-zinc-900 text-zinc-400 hover:text-white"
                        }`}
                      >
                        Todas
                      </button>
                      {Array.from({ length: 12 }, (_, i) =>
                        String.fromCharCode(65 + i)
                      ).map((c) => (
                        <button
                          key={c}
                          onClick={() => setSearchClass(c)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                            searchClass === c
                              ? "bg-white text-black"
                              : "bg-zinc-900 text-zinc-400 hover:text-white"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 overflow-x-auto pb-1 border-t border-zinc-800 pt-4">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mr-1 shrink-0">
                      Status:
                    </span>
                    <button
                      onClick={() => setSearchStatus(null)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                        !searchStatus
                          ? "bg-white text-black"
                          : "bg-zinc-900 text-zinc-400 hover:text-white"
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setSearchStatus("validado")}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                        searchStatus === "validado"
                          ? "bg-white text-black"
                          : "bg-zinc-900 text-zinc-400 hover:text-white"
                      }`}
                    >
                      Validados
                    </button>
                    <button
                      onClick={() => setSearchStatus("pendente")}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                        searchStatus === "pendente"
                          ? "bg-white text-black"
                          : "bg-zinc-900 text-zinc-400 hover:text-white"
                      }`}
                    >
                      Pendentes
                    </button>
                  </div>
                </div>
              )}

              {/* Resultados */}
              <div className="space-y-3">
                {searchQuery.trim().length > 0 &&
                searchQuery.trim().length < 3 ? (
                  <div className="py-12 text-center text-zinc-500 text-sm">
                    Digite pelo menos 3 letras para pesquisar.
                  </div>
                ) : getSearchResults().length === 0 ? (
                  <div className="py-12 text-center text-zinc-500 text-sm flex flex-col items-center gap-3">
                    <Search className="w-10 h-10 opacity-20" />
                    {searchQuery || searchYear || searchClass || searchStatus
                      ? "Nenhum ingresso encontrado."
                      : "Digite um nome, código ou CPF, ou use os filtros acima."}
                  </div>
                ) : (
                  <>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
                      {getSearchResults().length}{" "}
                      {getSearchResults().length === 1
                        ? "resultado"
                        : "resultados"}
                    </p>
                    {getSearchResults().map((t, i) => (
                      <TicketRow key={t.id} t={t} i={i} isModal={true} />
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── ADICIONAR INGRESSO ── */}
          {activeTab === "admin_add_ticket" && (
            <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <UserPlus className="h-6 w-6 text-white" /> Adicionar Ingresso
                </h1>
                <p className="text-zinc-400 text-sm mt-1">
                  Cadastre manualmente um novo ingresso e gere o QR Code.
                </p>
              </div>

              <div className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Nome do Aluno</Label>
                    <Input
                      name="nomeAluno"
                      placeholder="Nome completo"
                      value={addTicketForm.nomeAluno}
                      onChange={handleAddTicketChange}
                      error={addTicketErrors.nomeAluno}
                    />
                    {addTicketErrors.nomeAluno && (
                      <p className="text-red-400 text-xs">
                        {addTicketErrors.nomeAluno}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Ano</Label>
                    <div className="relative">
                      <select
                        name="ano"
                        value={addTicketForm.ano}
                        onChange={handleAddTicketChange}
                        className={`flex h-12 w-full appearance-none rounded-xl border ${
                          addTicketErrors.ano
                            ? "border-red-500 bg-red-500/10 text-red-100"
                            : "border-zinc-800 bg-black text-white"
                        } px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white transition-all`}
                      >
                        <option value="" disabled>
                          Selecione
                        </option>
                        {[1, 2, 3].map((a) => (
                          <option
                            key={a}
                            value={String(a)}
                            className="bg-zinc-900"
                          >
                            {a}º Ano
                          </option>
                        ))}
                      </select>
                    </div>
                    {addTicketErrors.ano && (
                      <p className="text-red-400 text-xs">
                        {addTicketErrors.ano}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Turma</Label>
                    <div className="relative">
                      <select
                        name="turma"
                        value={addTicketForm.turma}
                        onChange={handleAddTicketChange}
                        className={`flex h-12 w-full appearance-none rounded-xl border ${
                          addTicketErrors.turma
                            ? "border-red-500 bg-red-500/10 text-red-100"
                            : "border-zinc-800 bg-black text-white"
                        } px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white transition-all`}
                      >
                        <option value="" disabled>
                          Selecione
                        </option>
                        {Array.from({ length: 12 }, (_, i) =>
                          String.fromCharCode(65 + i)
                        ).map((t) => (
                          <option key={t} value={t} className="bg-zinc-900">
                            Turma {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    {addTicketErrors.turma && (
                      <p className="text-red-400 text-xs">
                        {addTicketErrors.turma}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>CPF</Label>
                    <Input
                      name="cpf"
                      placeholder="000.000.000-00"
                      value={addTicketForm.cpf}
                      onChange={handleAddTicketChange}
                      error={addTicketErrors.cpf}
                      className="font-mono"
                    />
                    {addTicketErrors.cpf && (
                      <p className="text-red-400 text-xs">
                        {addTicketErrors.cpf}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input
                      name="email"
                      type="email"
                      placeholder="email@exemplo.com"
                      value={addTicketForm.email}
                      onChange={handleAddTicketChange}
                      error={addTicketErrors.email}
                    />
                    {addTicketErrors.email && (
                      <p className="text-red-400 text-xs">
                        {addTicketErrors.email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-6 space-y-3">
                  <Label>Status do Ingresso</Label>
                  <div className="grid grid-cols-2 gap-2 bg-black p-1.5 rounded-xl border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setAddTicketStatus("pendente")}
                      className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition ${
                        addTicketStatus === "pendente"
                          ? "bg-zinc-900 text-white border border-zinc-700"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      <Clock className="h-4 w-4" /> Pendente
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddTicketStatus("validado")}
                      className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition ${
                        addTicketStatus === "validado"
                          ? "bg-white text-black"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      <CheckSquare className="h-4 w-4" /> Validado
                    </button>
                  </div>
                </div>

                <Button
                  className="w-full h-14"
                  onClick={handleGenerateTicket}
                  isLoading={isCreatingTicket}
                >
                  <QrCode className="h-5 w-5" /> Gerar Ingresso
                </Button>
              </div>

              {generatedTicket && (
                <div className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-6 w-6 text-black" />
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    Ingresso gerado!
                  </h3>
                  <p className="text-zinc-400 text-sm mt-1 mb-6">
                    {generatedTicket.nomeAluno} — {generatedTicket.ano}º{" "}
                    {generatedTicket.turma} —{" "}
                    {generatedTicket.usado ? "Validado" : "Pendente"}
                  </p>
                  <div className="bg-black p-6 rounded-2xl border border-zinc-800 flex flex-col items-center">
                    <div className="bg-white p-2 rounded-xl inline-block">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                          generatedTicket.code
                        )}`}
                        alt="QR Code"
                        className="w-32 h-32 object-contain"
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500 uppercase font-bold tracking-widest mt-5">
                      Código Verificador
                    </p>
                    <p className="font-mono text-2xl font-black text-white mt-1 tracking-wider">
                      {generatedTicket.code}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-6 h-12"
                    onClick={() => setGeneratedTicket(null)}
                  >
                    Adicionar Outro
                  </Button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── MODAIS ── */}
      {scanResultModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all"
          onClick={() => setScanResultModal(null)}
        >
          <div
            className="bg-[#0a0a0a] border border-zinc-800 p-8 rounded-3xl max-w-sm w-full flex flex-col items-center text-center relative shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white bg-zinc-900 rounded-full"
              onClick={() => setScanResultModal(null)}
            >
              <X className="w-5 h-5" />
            </button>
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 border-4 ${
                scanResultModal.type === "success"
                  ? "bg-white text-black border-white"
                  : scanResultModal.type === "warning"
                  ? "bg-zinc-800 text-white border-zinc-700"
                  : "bg-zinc-900 text-white border-zinc-800"
              }`}
            >
              {scanResultModal.type === "success" && (
                <CheckCircle2 className="h-10 w-10" />
              )}
              {scanResultModal.type === "warning" && (
                <AlertCircle className="h-10 w-10" />
              )}
              {scanResultModal.type === "error" && <X className="h-10 w-10" />}
            </div>
            <h4
              className={`text-2xl font-black mb-2 ${
                scanResultModal.type === "success"
                  ? "text-white"
                  : scanResultModal.type === "warning"
                  ? "text-zinc-400"
                  : "text-zinc-500"
              }`}
            >
              {scanResultModal.msg}
            </h4>
            {scanResultModal.ticket && (
              <div className="mt-6 w-full bg-black border border-zinc-800 p-5 rounded-2xl text-left space-y-4">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                    Titular
                  </p>
                  <p className="text-white font-bold text-xl">
                    {scanResultModal.ticket.nomeAluno}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-zinc-800 pt-4">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                      Turma
                    </p>
                    <p className="text-white font-mono text-sm">
                      {scanResultModal.ticket.ano}º{" "}
                      {scanResultModal.ticket.turma}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                      CPF
                    </p>
                    <p className="text-white font-mono text-sm">
                      {maskCpf(usersMap[scanResultModal.ticket.userId])}
                    </p>
                  </div>
                </div>
                {scanResultModal.type === "warning" && (
                  <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl mt-2">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                      Validado em
                    </p>
                    <p className="text-white font-mono text-xs">
                      {formatDate(scanResultModal.ticket.horaEntrada)}
                    </p>
                  </div>
                )}
              </div>
            )}
            {scanResultModal.type === "success" && (
              <Button
                className="w-full mt-6 h-14 bg-white hover:bg-zinc-200 text-black border-none text-base"
                onClick={() => confirmarEntrada(scanResultModal.ticket.id)}
                isLoading={adminLoading}
              >
                Liberar Entrada
              </Button>
            )}
          </div>
        </div>
      )}

      {infoModalTicket && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all"
          onClick={() => setInfoModalTicket(null)}
        >
          <div
            className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl max-w-md w-full relative shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base leading-tight">
                    {infoModalTicket.nomeAluno || "—"}
                  </h3>
                  <p className="text-zinc-500 text-xs font-mono mt-0.5">
                    {infoModalTicket.code}
                  </p>
                </div>
              </div>
              <button
                className="p-2 text-zinc-500 hover:text-white bg-zinc-900 rounded-full shrink-0"
                onClick={() => setInfoModalTicket(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <span
                className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                  infoModalTicket.usado
                    ? "bg-green-500/10 text-green-400"
                    : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {infoModalTicket.usado ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
                {infoModalTicket.usado ? "Validado" : "Pendente"}
              </span>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">
                    Turma
                  </p>
                  <p className="text-white font-mono text-sm flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-zinc-500" />
                    {infoModalTicket.ano && infoModalTicket.turma
                      ? `${infoModalTicket.ano}º ${infoModalTicket.turma}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">
                    CPF
                  </p>
                  <p className="text-white font-mono text-sm flex items-center gap-1.5">
                    <FaRegAddressCard className="h-3.5 w-3.5 text-zinc-500" />
                    {maskCpf(usersMap[infoModalTicket.userId])}
                  </p>
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                    Comprado em
                  </p>
                  <p className="text-white font-mono text-xs">
                    {formatDate(infoModalTicket.criadoEm)}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                    Validado em
                  </p>
                  <p className="text-white font-mono text-xs">
                    {infoModalTicket.usado
                      ? formatDate(infoModalTicket.horaEntrada)
                      : "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 pt-0 space-y-3">
              {!infoModalTicket.usado && (
                <button
                  onClick={async () => {
                    await confirmarEntrada(infoModalTicket.id);
                    setInfoModalTicket((prev) =>
                      prev
                        ? {
                            ...prev,
                            usado: true,
                            horaEntrada: new Date().toISOString(),
                          }
                        : prev
                    );
                  }}
                  disabled={adminLoading}
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-green-500/20 bg-green-500/5 text-green-400 hover:bg-green-500/10 hover:border-green-500/30 text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {adminLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Validar Ingresso
                </button>
              )}
              <button
                onClick={() => setConfirmDeleteTicket(infoModalTicket)}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 text-sm font-bold transition-colors"
              >
                <Trash2 className="h-4 w-4" /> Excluir Ingresso
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteTicket && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all"
          onClick={() => setConfirmDeleteTicket(null)}
        >
          <div
            className="bg-[#0a0a0a] border border-zinc-800 p-6 sm:p-8 rounded-3xl max-w-sm w-full flex flex-col items-center text-center relative shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mb-5">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h4 className="text-white font-bold text-lg mb-2">
              Excluir este ingresso?
            </h4>
            <p className="text-zinc-500 text-sm mb-1">
              <span className="text-white font-semibold">
                {confirmDeleteTicket.nomeAluno}
              </span>{" "}
              — {confirmDeleteTicket.code}
            </p>
            <p className="text-zinc-500 text-xs mb-6">
              Esta ação não pode ser desfeita. O aluno precisará comprar ou
              validar um novo ingresso.
            </p>
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={() => setConfirmDeleteTicket(null)}
              >
                Cancelar
              </Button>
              <button
                onClick={() => excluirIngresso(confirmDeleteTicket.id)}
                disabled={adminLoading}
                className="flex-1 h-11 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {adminLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {dashboardDetailModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all"
          onClick={() => setDashboardDetailModal(null)}
        >
          <div
            className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col relative shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 sm:p-8 border-b border-zinc-800 bg-black rounded-t-3xl shrink-0">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  {dashboardDetailModal === "vendidos" && (
                    <>
                      <ShoppingCart className="w-5 h-5" /> Vendidos
                    </>
                  )}
                  {dashboardDetailModal === "entraram" && (
                    <>
                      <CheckSquare className="w-5 h-5" /> Entraram
                    </>
                  )}
                  {dashboardDetailModal === "pendentes" && (
                    <>
                      <Clock className="w-5 h-5" /> Pendentes
                    </>
                  )}
                </h3>
                <p className="text-zinc-500 text-sm mt-1">
                  Ordem alfabética. Total: {getDetailedList().length}
                </p>
              </div>
              <button
                className="p-2 text-zinc-500 hover:text-white bg-zinc-900 rounded-full"
                onClick={() => setDashboardDetailModal(null)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 sm:px-8 py-4 border-b border-zinc-800 bg-[#0a0a0a] shrink-0 space-y-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mr-2">
                  Ano:
                </span>
                <button
                  onClick={() => {
                    setFilterYear(null);
                    setFilterClass(null);
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                    !filterYear
                      ? "bg-white text-black"
                      : "bg-zinc-900 text-zinc-400 hover:text-white"
                  }`}
                >
                  Todos
                </button>
                {[1, 2, 3].map((y) => (
                  <button
                    key={y}
                    onClick={() => {
                      setFilterYear(String(y));
                      setFilterClass(null);
                    }}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                      filterYear === String(y)
                        ? "bg-white text-black"
                        : "bg-zinc-900 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {y}º
                  </button>
                ))}
              </div>
              {filterYear && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 animate-in fade-in slide-in-from-left-4">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mr-2">
                    Turma:
                  </span>
                  <button
                    onClick={() => setFilterClass(null)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                      !filterClass
                        ? "bg-white text-black"
                        : "bg-zinc-900 text-zinc-400 hover:text-white"
                    }`}
                  >
                    Todas
                  </button>
                  {Array.from({ length: 12 }, (_, i) =>
                    String.fromCharCode(65 + i)
                  ).map((c) => (
                    <button
                      key={c}
                      onClick={() => setFilterClass(c)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                        filterClass === c
                          ? "bg-white text-black"
                          : "bg-zinc-900 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-8">
              {getDetailedList().length === 0 ? (
                <div className="py-12 text-center text-zinc-500">
                  Nenhum registro.
                </div>
              ) : (
                <div className="space-y-3">
                  {getDetailedList().map((t, i) => (
                    <TicketRow key={t.id} t={t} i={i} isModal={true} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 bg-zinc-900 text-white border border-zinc-800 shadow-2xl rounded-xl p-4 flex items-center gap-3 z-[60]">
          <AlertCircle className="h-5 w-5" />
          {toast.message}
        </div>
      )}
    </div>
  );
}
