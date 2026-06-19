// @ts-nocheck
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
  ChevronDown,
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
  Ticket,
  FileUp,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Info,
  Pencil,
  Unlink,
  Lock,
  Unlock,
} from "lucide-react";
import { FaRegAddressCard } from "react-icons/fa";
import {
  IoMdInformationCircleOutline,
  IoMdAddCircleOutline,
} from "react-icons/io";
import { IoEyeOutline } from "react-icons/io5";
import { AiOutlineEyeInvisible } from "react-icons/ai";
import { MdGroups } from "react-icons/md";
import { LuTicketPlus, LuTicketCheck } from "react-icons/lu";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  runTransaction,
  increment,
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
// Exibe o CPF completo, formatado com pontuação (ex: 123.456.789-00)
const formatCpf = (cpf) => {
  const digits = (cpf || "").replace(/\D/g, "");
  if (digits.length !== 11) return cpf || "—";
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
};

// Resolve o CPF de um ingresso, priorizando o CPF salvo no próprio
// ingresso (ingressos manuais) e caindo para o cadastro do usuário
const getTicketCpf = (t, usersMap) => t?.cpf || usersMap[t?.userId] || "";

const applyCpfMask = (v) => {
  let c = v.replace(/\D/g, "").slice(0, 11);
  if (c.length > 9)
    return c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (c.length > 6) return c.replace(/^(\d{3})(\d{3})(\d{0,3})/, "$1.$2.$3");
  if (c.length > 3) return c.replace(/^(\d{3})(\d{0,3})/, "$1.$2");
  return c;
};

// Procura, na coleção "usuarios", uma conta já cadastrada (login) com o
// CPF informado. Se existir, retorna o UID real dessa conta — assim o
// ingresso criado pelo admin já nasce vinculado ao login do aluno/pai,
// sem precisar esperar ele se cadastrar depois.
const findUserIdByCpf = async (db, cpfDigits) => {
  if (!cpfDigits) return null;
  try {
    const usuariosSnap = await getDocs(collection(db, "usuarios"));
    let found = null;
    usuariosSnap.forEach((d) => {
      if ((d.data().cpf || "").replace(/\D/g, "") === cpfDigits) found = d.id;
    });
    return found;
  } catch {
    return null;
  }
};

// Gera um código único usando o MESMO contador transacional ("config/ticketCounter")
// que o fluxo de checkout público (cadastro1.tsx) usa. Antes, este admin gerava
// o código procurando o menor número "livre" varrendo a coleção "ingressos" — um
// sistema de numeração totalmente separado do contador usado pelo checkout.
// Isso permitia que o admin e um cliente pagando ao mesmo tempo gerassem o MESMO
// código (ex: ambos "FJ-0001"), e o segundo "setDoc" SOBRESCREVIA o primeiro
// ingresso no Firestore — fazendo um ingresso desaparecer silenciosamente da DB
// (por isso o admin via menos ingressos do que o real, tanto nos Lotes quanto
// nas Dashboards, e o contador não subia corretamente).
// Usar a transação garante que cada chamada — venha do admin ou do checkout —
// recebe um número sequencial exclusivo, sem nunca colidir.
const generateTicketCode = async (db) => {
  const counterRef = doc(db, "config", "ticketCounter");
  const novoNumero = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const atual = snap.exists() ? snap.data().ultimo : 0;
    const proximo = atual + 1;
    transaction.set(counterRef, { ultimo: proximo });
    return proximo;
  });
  return `FJ-${String(novoNumero).padStart(4, "0")}`;
};

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
    className={`text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5 block ${className}`}
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
      className={`bg-[#0a0a0a] border border-zinc-800/80 p-6 rounded-2xl flex flex-col w-full relative overflow-hidden ${
        onClick
          ? "group text-left hover:bg-zinc-900/40 hover:border-zinc-700 transition-all duration-200 cursor-pointer"
          : ""
      }`}
    >
      {/* Label + ícone */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
          {title}
        </p>
        <Icon className="h-4 w-4 text-zinc-600" />
      </div>

      {/* Valor principal */}
      <p
        className={`${
          sub ? "text-2xl" : "text-3xl"
        } font-black text-white leading-none`}
      >
        {val}
        {tot != null && (
          <span className="text-lg text-zinc-700 font-medium ml-1">
            / {tot}
          </span>
        )}
      </p>

      {/* Barra de progresso */}
      {pct != null && (
        <div className="w-full bg-zinc-900 h-px mt-5 rounded-full overflow-hidden">
          <div
            className={`${bgBar} h-full rounded-full transition-all duration-1000`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Sub-label */}
      {sub && (
        <p className="mt-3 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
          {sub}
        </p>
      )}

      {/* Seta discreta para cards clicáveis */}
      {onClick && (
        <ChevronRight className="absolute bottom-5 right-5 h-3.5 w-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
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

  // Modais GERAIS
  const [confirmLogoutModal, setConfirmLogoutModal] = useState(false);

  // Scanner e Ingressos
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

  // Estados: Pesquisar Ingressos
  const [searchQuery, setSearchQuery] = useState("");
  const [searchYear, setSearchYear] = useState(null);
  const [searchClass, setSearchClass] = useState(null);
  const [searchStatus, setSearchStatus] = useState(null);
  const [showSearchFilters, setShowSearchFilters] = useState(false);

  // Estados: Gestão de Lotes
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [batchModal, setBatchModal] = useState(null); // Criação/Edição de lote
  const [confirmVisibilityModal, setConfirmVisibilityModal] = useState(null); // Ocultar/Exibir lote
  const [confirmDeleteBatch, setConfirmDeleteBatch] = useState(null); // Excluir lote
  const [deletingBatch, setDeletingBatch] = useState(false);

  // Estados: Busca de aluno no formulário de adicionar ingresso
  const [addTicketStudentSearch, setAddTicketStudentSearch] = useState("");
  const [addTicketStudentResults, setAddTicketStudentResults] = useState<any[]>(
    []
  );
  const [addTicketStudentSearchOpen, setAddTicketStudentSearchOpen] =
    useState(false);
  const [addTicketStudentSearchLoading, setAddTicketStudentSearchLoading] =
    useState(false);
  const addTicketSearchRef = useRef<HTMLDivElement>(null);

  // Estados: Adicionar Ingresso
  const [addTicketForm, setAddTicketForm] = useState({
    nomeAluno: "",
    ano: "",
    turma: "",
    cpf: "",
    email: "",
    loteId: "",
  });
  const [addTicketErrors, setAddTicketErrors] = useState({});
  const [addTicketStatus, setAddTicketStatus] = useState("pendente"); // "pendente" | "validado"
  const [addTicketPago, setAddTicketPago] = useState(false); // pagamento confirmado
  const [addTicketMetodoPagamento, setAddTicketMetodoPagamento] = useState<
    "dinheiro" | null
  >(null); // método de pagamento manual
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [generatedTicket, setGeneratedTicket] = useState(null);
  const [revenueModalOpen, setRevenueModalOpen] = useState(false); // modal de receita detalhada
  const [presencaListModal, setPresencaListModal] = useState<null | "todos" | "entraram" | "pendentes">(null); // modal lista de ingressos na tela de presença

  // Estados: Importação de Alunos
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    duplicates: number;
  } | null>(null);
  const [importDragActive, setImportDragActive] = useState(false);
  const [importTypeErrors, setImportTypeErrors] = useState<string[]>([]);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Estados: Importação de Pais/Responsáveis
  const [importParentSubTab, setImportParentSubTab] = useState<
    "alunos" | "pais"
  >("alunos");
  const [importParentFiles, setImportParentFiles] = useState<File[]>([]);
  const [importParentPreview, setImportParentPreview] = useState<any[]>([]);
  const [importParentErrors, setImportParentErrors] = useState<string[]>([]);
  const [importParentLoading, setImportParentLoading] = useState(false);
  const [importParentResult, setImportParentResult] = useState<{
    success: number;
    failed: number;
    duplicates: number;
    semAluno: number;
  } | null>(null);
  const [importParentDragActive, setImportParentDragActive] = useState(false);
  const [importParentTypeErrors, setImportParentTypeErrors] = useState<
    string[]
  >([]);
  const importParentFileRef = useRef<HTMLInputElement>(null);

  // Sub-abas da seção de Alunos
  const [groupsSubTab, setGroupsSubTab] = useState<
    "import" | "manual" | "search" | "classes" | "responsaveis"
  >("import");
  const [importSubTab, setImportSubTab] = useState<"alunos" | "pais">("alunos");
  // Turmas: navegação
  const [classesYear, setClassesYear] = useState<string | null>(null); // "1","2","3"
  const [classesClass, setClassesClass] = useState<string | null>(null); // "A".."L"
  const [classesData, setClassesData] = useState<Record<string, any[]>>({}); // turmaId -> alunos
  const [classesLoading, setClassesLoading] = useState(false);
  const [classesWithStudents, setClassesWithStudents] = useState<string[]>([]); // turmaIds que têm alunos
  const [classesWithIncompleteStudents, setClassesWithIncompleteStudents] =
    useState<string[]>([]); // turmaIds com alunos sem CPF
  const [classesWithStudentsLoading, setClassesWithStudentsLoading] =
    useState(false);
  // Modal de aluno
  const [studentModal, setStudentModal] = useState<any | null>(null); // aluno selecionado
  const [studentModalTicket, setStudentModalTicket] = useState<any | null>(
    null
  ); // ingresso do aluno
  const [studentModalLoading, setStudentModalLoading] = useState(false);
  // Form de associar ingresso no modal
  const [associarForm, setAssociarForm] = useState({
    loteId: "",
    email: "",
    status: "pendente",
    pago: false,
    metodoPagamento: null as "dinheiro" | null,
  });
  const [associarLoading, setAssociarLoading] = useState(false);
  const [studentModalResponsaveis, setStudentModalResponsaveis] = useState<
    any[]
  >([]);
  // Edição de dados cadastrais do aluno no modal
  const [editStudentMode, setEditStudentMode] = useState(false);
  const [editStudentForm, setEditStudentForm] = useState({
    cpf: "",
    email: "",
    telefone: "",
  });
  const [editStudentSaving, setEditStudentSaving] = useState(false);
  const [editStudentError, setEditStudentError] = useState("");
  // Modal: lista de alunos sem CPF da turma
  const [missingCpfModal, setMissingCpfModal] = useState<{
    turmaId: string;
    alunos: any[];
  } | null>(null);

  // Estados: Responsáveis
  const [responsavelSearch, setResponsavelSearch] = useState("");
  const [responsavelResults, setResponsavelResults] = useState<any[]>([]);
  const [responsavelSearchLoading, setResponsavelSearchLoading] =
    useState(false);
  const [allResponsaveis, setAllResponsaveis] = useState<any[]>([]);
  const [allResponsaveisLoading, setAllResponsaveisLoading] = useState(false);
  const [confirmLimparResponsaveis, setConfirmLimparResponsaveis] =
    useState(false);
  const [limparResponsaveisLoading, setLimparResponsaveisLoading] =
    useState(false);
  const [responsavelModal, setResponsavelModal] = useState<any | null>(null);
  const [responsavelModalTicket, setResponsavelModalTicket] = useState<
    any | null
  >(null);
  const [responsavelModalLoading, setResponsavelModalLoading] = useState(false);
  const [confirmDeleteResponsavel, setConfirmDeleteResponsavel] =
    useState(false);
  const [deleteResponsavelLoading, setDeleteResponsavelLoading] =
    useState(false);
  const [associarResponsavelForm, setAssociarResponsavelForm] = useState({
    loteId: "",
    email: "",
    status: "pendente",
    pago: false,
    metodoPagamento: null as "dinheiro" | null,
  });
  const [associarResponsavelLoading, setAssociarResponsavelLoading] =
    useState(false);
  // Remover responsável a partir da tela do aluno (desassociar ou excluir)
  const [responsavelToRemove, setResponsavelToRemove] = useState<any | null>(
    null
  );
  const [removeResponsavelLoading, setRemoveResponsavelLoading] =
    useState(false);
  // Edição do aluno associado ao responsável
  const [editingAlunoAssociado, setEditingAlunoAssociado] = useState(false);
  const [editAlunoSearch, setEditAlunoSearch] = useState("");
  const [editAlunoResults, setEditAlunoResults] = useState<any[]>([]);
  const [editAlunoLoading, setEditAlunoLoading] = useState(false);
  const [savingAlunoAssociado, setSavingAlunoAssociado] = useState(false);

  // Edição inline dos dados do responsável (lápis no modal de pais)
  const [editingResponsavel, setEditingResponsavel] = useState(false);
  const [editResponsavelForm, setEditResponsavelForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    relacao: "responsavel",
  });
  const [editResponsavelErrors, setEditResponsavelErrors] = useState<
    Record<string, string>
  >({});
  const [savingResponsavelEdit, setSavingResponsavelEdit] = useState(false);
  const [confirmDeleteClass, setConfirmDeleteClass] = useState<string | null>(
    null
  ); // turmaId
  const [deleteClassLoading, setDeleteClassLoading] = useState(false);
  const [confirmDeleteStudent, setConfirmDeleteStudent] = useState(false);
  const [deleteStudentLoading, setDeleteStudentLoading] = useState(false);
  // Pesquisar alunos
  const [studentSearch, setStudentSearch] = useState("");
  const [studentResults, setStudentResults] = useState<any[]>([]);
  const [studentSearchLoading, setStudentSearchLoading] = useState(false);

  // Estados: Cadastro Manual de Aluno
  const emptyManualForm = {
    nomeAluno: "",
    ano: "",
    turma: "",
    cpf: "",
    email: "",
    telefone: "",
  };
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [manualErrors, setManualErrors] = useState<Record<string, string>>({});
  const [manualLoading, setManualLoading] = useState(false);
  const [manualSuccessSala, setManualSuccessSala] = useState<string | null>(
    null
  );

  // Estados: Tipo de cadastro manual (aluno ou pai)
  const [manualType, setManualType] = useState<"aluno" | "pai" | null>(null);

  // Estados: Cadastro Manual de Pai/Responsável
  const emptyParentForm = {
    nome: "",
    cpf: "",
    email: "",
    telefone: "",
    relacao: "pai", // "pai" | "mae" | "responsavel"
  };
  const [parentForm, setParentForm] = useState(emptyParentForm);
  const [parentErrors, setParentErrors] = useState<Record<string, string>>({});
  const [parentLoading, setParentLoading] = useState(false);
  const [parentSuccess, setParentSuccess] = useState<any | null>(null);

  // Estados: Busca de aluno para associar ao pai
  const [parentStudentSearch, setParentStudentSearch] = useState("");
  const [parentStudentResults, setParentStudentResults] = useState<any[]>([]);
  const [parentStudentSearchLoading, setParentStudentSearchLoading] =
    useState(false);
  const [parentAssociatedStudent, setParentAssociatedStudent] = useState<
    any | null
  >(null);
  const [parentStudentSearchOpen, setParentStudentSearchOpen] = useState(false);
  const parentStudentSearchRef = useRef<HTMLDivElement>(null);

  const allTicketsRef = useRef(allTickets);
  useEffect(() => {
    allTicketsRef.current = allTickets;
  }, [allTickets]);

  // ─── Garante que a coleção "ingressos" e o contador existam no Firebase ───
  useEffect(() => {
    const inicializarFirebase = async () => {
      try {
        // Garante que o contador existe
        const counterRef = doc(db, "config", "ticketCounter");
        const counterSnap = await getDocs(collection(db, "config"));
        let counterExiste = false;
        counterSnap.forEach((d) => {
          if (d.id === "ticketCounter") counterExiste = true;
        });
        if (!counterExiste) {
          await setDoc(counterRef, { ultimo: 0 });
        }
        // Garante que a coleção "ingressos" existe (Firestore não cria coleções vazias,
        // então apenas tentamos buscar — se retornar vazio, está ok e pronto para uso)
        await getDocs(collection(db, "ingressos"));
      } catch (err) {
        console.warn("Erro ao inicializar Firebase:", err);
      }
    };
    inicializarFirebase();
  }, []);

  useEffect(() => {
    if (!addTicketStudentSearchOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        addTicketSearchRef.current &&
        !addTicketSearchRef.current.contains(e.target as Node)
      ) {
        setAddTicketStudentSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [addTicketStudentSearchOpen]);

  useEffect(() => {
    if (!parentStudentSearchOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        parentStudentSearchRef.current &&
        !parentStudentSearchRef.current.contains(e.target as Node)
      ) {
        setParentStudentSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [parentStudentSearchOpen]);

  useEffect(() => {
    if (!dashboardDetailModal) {
      setFilterYear(null);
      setFilterClass(null);
    }
  }, [dashboardDetailModal]);

  useEffect(() => {
    // Sempre busca os ingressos para que a contagem dos lotes seja precisa
    fetchAllTicketsForAdmin();
    if (activeTab === "admin_batches" || activeTab === "admin_add_ticket") {
      fetchBatches();
    }
  }, [activeTab]);

  const showToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ─── FUNÇÃO: Buscar Todos os Ingressos ───
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

  // ─── FUNÇÃO: Buscar / Criar Lotes Iniciais ───
  const fetchBatches = async () => {
    setLoadingBatches(true);
    try {
      const snap = await getDocs(collection(db, "lotes"));
      if (snap.empty) {
        // Criação do lote padrão conforme requisito se a coleção não existir
        const defaultBatch = {
          nome: "Lote Padrão",
          preco: 15,
          quantidade: 15,
          dataLimite: "", // Ilimitado/Sem data
          publico: "Ambos",
          visivel: true,
        };
        const docRef = doc(collection(db, "lotes"));
        await setDoc(docRef, defaultBatch);
        setBatches([{ id: docRef.id, ...defaultBatch }]);
      } else {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        // Ordenação alfabética simples
        const sorted = list.sort((a, b) => a.nome.localeCompare(b.nome));

        // Sincroniza ingressosAssociados com a contagem real da DB para lotes
        // que ainda não têm o campo (backwards compat com ingressos existentes)
        const ticketsSnap = await getDocs(collection(db, "ingressos"));
        const allT: any[] = [];
        ticketsSnap.forEach((d) => allT.push({ id: d.id, ...d.data() }));

        const synced = sorted.map((b) => {
          const count = allT.filter(
            (t) => t.loteId === b.id || t.type === b.nome
          ).length;
          // Corrige sempre que o contador divergir da contagem real (inclusão OU exclusão)
          if (b.ingressosAssociados == null || b.ingressosAssociados !== count) {
            updateDoc(doc(db, "lotes", b.id), { ingressosAssociados: count }).catch(() => {});
            return { ...b, ingressosAssociados: count };
          }
          return b;
        });

        setBatches(synced);
      }
    } catch (error) {
      showToast("Erro ao buscar lotes.");
    }
    setLoadingBatches(false);
  };

  // ─── FUNÇÕES: Importação de Alunos ───

  // Carrega o SheetJS dinamicamente (evita bundle extra no projeto)
  const loadXLSX = (): Promise<any> =>
    new Promise((resolve) => {
      if ((window as any).XLSX) return resolve((window as any).XLSX);
      const s = document.createElement("script");
      s.src =
        "https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js";
      s.onload = () => resolve((window as any).XLSX);
      document.head.appendChild(s);
    });

  // Lê um File (.xlsx ou .csv) e retorna array de objetos linha
  const parseFile = async (file: File): Promise<any[]> => {
    const XLSX = await loadXLSX();
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", raw: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    // header: 1 → array de arrays; depois convertemos para objetos
    const raw: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
    });
    if (raw.length < 2) return [];
    const headers = (raw[0] as string[]).map((h) =>
      String(h)
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
    );
    return raw
      .slice(1)
      .map((row, idx) => {
        const obj: any = { _row: idx + 2 };
        headers.forEach((h, i) => {
          obj[h] = String(row[i] ?? "").trim();
        });
        return obj;
      })
      .filter((obj) =>
        Object.entries(obj)
          .filter(([k]) => k !== "_row")
          .some(([, v]) => String(v).trim() !== "")
      );
  };

  // Normaliza os dados para o formato esperado: nome, turma, ano, cpf
  const normalizeRow = (row: any) => {
    const nome =
      row.nome ||
      row.nomecompleto ||
      row.nomealuno ||
      row.name ||
      row.aluno ||
      row.nomecompletodoaluno ||
      "";
    const turma = (row.turma || row.class || row.sala || "")
      .toUpperCase()
      .replace(/\s/g, "");
    const ano = String(
      row.ano || row.year || row.serie || row.serie || ""
    ).replace(/[^0-9]/g, "");
    const cpf = (row.cpf || row.documento || row.doc || "").replace(/\D/g, "");
    return { nome: nome.trim(), turma: turma.trim(), ano: ano.trim(), cpf };
  };

  // Valida uma linha normalizada
  const validateRow = (
    r: { nome: string; turma: string; ano: string; cpf: string },
    rowNum: number
  ): string | null => {
    if (!r.nome || r.nome.length < 3)
      return `Linha ${rowNum}: Nome inválido ("${r.nome}")`;
    if (!["1", "2", "3"].includes(r.ano))
      return `Linha ${rowNum}: Ano deve ser 1, 2 ou 3 — encontrado "${r.ano}"`;
    if (!/^[A-L]$/.test(r.turma))
      return `Linha ${rowNum}: Turma deve ser letra A-L — encontrado "${r.turma}"`;
    if (r.cpf.length !== 11)
      return `Linha ${rowNum}: CPF inválido — ${r.cpf.length} dígitos encontrados`;
    return null;
  };

  // Tipos de arquivo permitidos
  const ALLOWED_EXTENSIONS = [".csv", ".xlsx"];
  const isAllowedFile = (file: File): boolean => {
    const name = file.name.toLowerCase();
    return ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
  };

  const handleImportFilesChange = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setImportResult(null);
    setImportErrors([]);
    setImportPreview([]);
    setImportTypeErrors([]);

    // Separar válidos e inválidos por tipo
    const invalid = fileArray.filter((f) => !isAllowedFile(f));
    const valid = fileArray.filter((f) => isAllowedFile(f));

    if (invalid.length > 0) {
      setImportTypeErrors(
        invalid.map(
          (f) =>
            `"${f.name}" não é permitido. Apenas arquivos .csv ou .xlsx são aceitos.`
        )
      );
    }

    if (valid.length === 0) {
      setImportFiles([]);
      return;
    }

    setImportFiles(valid);

    try {
      const allRows: any[] = [];
      for (const file of valid) {
        const rows = await parseFile(file);
        allRows.push(...rows);
      }

      if (allRows.length === 0) {
        setImportErrors([
          "Arquivo(s) vazio(s) ou sem dados. Verifique se a primeira linha é o cabeçalho.",
        ]);
        return;
      }
      const normalized = allRows.map((r) => ({
        ...normalizeRow(r),
        _row: r._row,
      }));
      const errors: string[] = [];
      normalized.forEach((r) => {
        const err = validateRow(r, r._row);
        if (err) errors.push(err);
      });
      setImportErrors(errors);
      setImportPreview(normalized);
    } catch (err) {
      setImportErrors([
        "Erro ao processar arquivo(s). Certifique-se que são .csv ou .xlsm válidos.",
      ]);
    }
  };

  const handleImportSubmit = async () => {
    if (importPreview.length === 0 || importErrors.length > 0) return;
    setImportLoading(true);
    setImportResult(null);

    try {
      // Usa o preview já normalizado e validado — não faz novo parse
      const normalized = importPreview;

      let success = 0,
        failed = 0,
        duplicates = 0;

      // Busca CPFs já cadastrados em todas as subcoleções
      const cpfsExistentes = new Set<string>();
      try {
        const anosSnap = await getDocs(collection(db, "alunos"));
        for (const turmaDoc of anosSnap.docs) {
          const alunosSnap = await getDocs(
            collection(db, "alunos", turmaDoc.id, "lista")
          );
          alunosSnap.forEach((d) => {
            const cpfRaw = d.data().cpf || "";
            // Normaliza ao comparar: aceita CPF salvo com ou sem formatação
            const cpfDigits = cpfRaw.replace(/\D/g, "");
            if (cpfDigits) cpfsExistentes.add(cpfDigits);
          });
        }
      } catch (e) {
        console.warn("Erro ao buscar CPFs existentes:", e);
      }

      for (const row of normalized) {
        const err = validateRow(row, row._row);
        if (err) {
          failed++;
          continue;
        }
        if (cpfsExistentes.has(row.cpf)) {
          duplicates++;
          continue;
        }
        try {
          // 1. Garante que o documento pai da turma existe (ex: alunos/3B)
          const turmaId = `${row.ano}${row.turma}`;
          await setDoc(
            doc(db, "alunos", turmaId),
            {
              ano: row.ano,
              turma: row.turma,
              sala: turmaId,
            },
            { merge: true }
          );

          // 2. Salva o aluno com o nome como ID do documento (ex: Maria_Jose)
          const nomeId = row.nome.trim().replace(/\s+/g, "_");
          await setDoc(doc(db, "alunos", turmaId, "lista", nomeId), {
            nome: row.nome,
            turma: row.turma,
            ano: row.ano,
            cpf: row.cpf,
            sala: turmaId,
            cadastradoEm: new Date().toISOString(),
          });
          cpfsExistentes.add(row.cpf);
          success++;
        } catch (e) {
          console.error("Erro ao salvar aluno:", row, e);
          failed++;
        }
      }

      setImportResult({ success, failed, duplicates });
      if (success > 0) {
        showToast(`${success} aluno(s) importado(s) com sucesso!`, "success");
      } else {
        showToast(
          "Nenhum aluno foi importado. Verifique os dados e as permissões do Firebase.",
          "error"
        );
      }
    } catch (e) {
      console.error("Erro geral na importação:", e);
      showToast("Erro durante a importação.", "error");
    }
    setImportLoading(false);
  };

  // ─── PARSE/VALIDAÇÃO/IMPORTAÇÃO DE PAIS ───

  const normalizeParentRow = (row: any) => {
    const nome =
      row.responsavel ||
      row.nome ||
      row.nomeresponsavel ||
      row.responsável ||
      row.nomepai ||
      row.nomemae ||
      "";
    const cpf = (row.cpf || row.documento || row.doc || "").replace(/\D/g, "");
    const nomeAluno =
      row.nomealuno ||
      row.aluno ||
      row.nomедоaluno ||
      row.nomedo_aluno ||
      row.nomedaluno ||
      "";
    const ano = String(row.ano || row.year || row.serie || "").replace(
      /[^0-9]/g,
      ""
    );
    const turma = (row.turma || row.class || row.sala || "")
      .toUpperCase()
      .replace(/\s/g, "");
    return {
      nome: String(nome).trim(),
      cpf,
      nomeAluno: String(nomeAluno).trim(),
      ano: ano.trim(),
      turma: turma.trim(),
    };
  };

  const validateParentRow = (
    r: {
      nome: string;
      cpf: string;
      nomeAluno: string;
      ano: string;
      turma: string;
    },
    rowNum: number
  ): string | null => {
    if (!r.nome || r.nome.length < 2)
      return `Linha ${rowNum}: Nome do responsável inválido ("${r.nome}")`;
    if (r.cpf.length !== 11)
      return `Linha ${rowNum}: CPF inválido — ${r.cpf.length} dígitos encontrados`;
    if (!r.nomeAluno || r.nomeAluno.length < 2)
      return `Linha ${rowNum}: Nome do aluno inválido ("${r.nomeAluno}")`;
    if (!["1", "2", "3"].includes(r.ano))
      return `Linha ${rowNum}: Ano deve ser 1, 2 ou 3 — encontrado "${r.ano}"`;
    if (!/^[A-L]$/.test(r.turma))
      return `Linha ${rowNum}: Turma deve ser letra A-L — encontrado "${r.turma}"`;
    return null;
  };

  const handleImportParentFilesChange = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setImportParentResult(null);
    setImportParentErrors([]);
    setImportParentPreview([]);
    setImportParentTypeErrors([]);

    const invalid = fileArray.filter((f) => !isAllowedFile(f));
    const valid = fileArray.filter((f) => isAllowedFile(f));

    if (invalid.length > 0) {
      setImportParentTypeErrors(
        invalid.map((f) => `"${f.name}" não é permitido. Apenas .csv ou .xlsx.`)
      );
    }
    if (valid.length === 0) {
      setImportParentFiles([]);
      return;
    }
    setImportParentFiles(valid);

    try {
      const allRows: any[] = [];
      for (const file of valid) {
        const rows = await parseFile(file);
        allRows.push(...rows);
      }
      if (allRows.length === 0) {
        setImportParentErrors(["Arquivo(s) vazio(s) ou sem dados."]);
        return;
      }
      const normalized = allRows.map((r) => ({
        ...normalizeParentRow(r),
        _row: r._row,
      }));
      const errors: string[] = [];
      normalized.forEach((r) => {
        const err = validateParentRow(r, r._row);
        if (err) errors.push(err);
      });
      setImportParentErrors(errors);
      setImportParentPreview(normalized);
    } catch {
      setImportParentErrors(["Erro ao processar arquivo(s)."]);
    }
  };

  const handleImportParentSubmit = async () => {
    if (importParentPreview.length === 0 || importParentErrors.length > 0)
      return;
    setImportParentLoading(true);
    setImportParentResult(null);

    try {
      // Pré-carrega CPFs já cadastrados em responsaveis
      const cpfsExistentes = new Set<string>();
      const snapResp = await getDocs(collection(db, "responsaveis"));
      snapResp.forEach((d) => {
        const cpf = (d.data().cpf || "").replace(/\D/g, "");
        if (cpf) cpfsExistentes.add(cpf);
      });

      // Pré-carrega alunos de todas as turmas para vincular
      const alunosMap: Record<string, any> = {}; // "nomeNormalizado_turmaId" -> alunoData
      const turmasSnap = await getDocs(collection(db, "alunos"));
      for (const turmaDoc of turmasSnap.docs) {
        const alunosSnap = await getDocs(
          collection(db, "alunos", turmaDoc.id, "lista")
        );
        alunosSnap.forEach((d) => {
          const data = d.data();
          const nomeNorm = (data.nome || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ")
            .trim();
          const key = `${nomeNorm}_${turmaDoc.id}`;
          alunosMap[key] = { id: d.id, turmaId: turmaDoc.id, ...data };
        });
      }

      let success = 0,
        failed = 0,
        duplicates = 0,
        semAluno = 0;

      for (const row of importParentPreview) {
        const err = validateParentRow(row, row._row);
        if (err) {
          failed++;
          continue;
        }

        if (cpfsExistentes.has(row.cpf)) {
          duplicates++;
          continue;
        }

        // Tenta localizar o aluno pela combinação nome + turma
        const turmaId = `${row.ano}${row.turma}`;
        const nomeAlunoNorm = (row.nomeAluno || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        const key = `${nomeAlunoNorm}_${turmaId}`;
        const alunoEncontrado = alunosMap[key];

        try {
          const agora = new Date().toISOString();
          const respData: any = {
            nome: row.nome,
            cpf: row.cpf,
            relacao: "responsavel",
            criadoEm: agora,
          };

          if (alunoEncontrado) {
            respData.alunoId = alunoEncontrado.id;
            respData.alunoNome = alunoEncontrado.nome;
            respData.alunoTurma = turmaId;
            respData.alunoAno = row.ano;
            respData.alunoCpf = (alunoEncontrado.cpf || "").replace(/\D/g, "");
          } else {
            semAluno++;
          }

          const nomeId =
            row.nome.trim().replace(/\s+/g, "_") + "_" + row.cpf.slice(-4);
          await setDoc(doc(db, "responsaveis", nomeId), respData);
          cpfsExistentes.add(row.cpf);
          success++;
        } catch (e) {
          console.error("Erro ao salvar responsável:", row, e);
          failed++;
        }
      }

      setImportParentResult({ success, failed, duplicates, semAluno });
      if (success > 0) {
        showToast(
          `${success} responsável(is) importado(s) com sucesso!`,
          "success"
        );
      } else {
        showToast("Nenhum responsável importado. Verifique os dados.", "error");
      }
    } catch (e) {
      console.error("Erro geral na importação de pais:", e);
      showToast("Erro durante a importação.", "error");
    }
    setImportParentLoading(false);
  };

  // ── Limpar turma completa do Firebase ──
  const handleDeleteClass = async (turmaId: string) => {
    setDeleteClassLoading(true);
    try {
      const alunosSnap = await getDocs(
        collection(db, "alunos", turmaId, "lista")
      );
      await Promise.all(alunosSnap.docs.map((d) => deleteDoc(d.ref)));
      // Remove do cache local
      setClassesData((prev) => {
        const n = { ...prev };
        delete n[turmaId];
        return n;
      });
      setClassesWithStudents((prev) => prev.filter((id) => id !== turmaId));
      // Volta para a listagem de turmas
      setClassesClass(null);
      setConfirmDeleteClass(null);
      showToast("Turma apagada com sucesso!", "success");
    } catch {
      showToast("Erro ao apagar a turma.");
    }
    setDeleteClassLoading(false);
  };

  // ── Busca quais turmas do ano selecionado têm alunos ──
  const fetchClassesWithStudents = async (ano: string) => {
    setClassesWithStudentsLoading(true);
    try {
      const letras = Array.from({ length: 12 }, (_, i) =>
        String.fromCharCode(65 + i)
      );
      const withStudents: string[] = [];
      const withIncomplete: string[] = [];
      await Promise.all(
        letras.map(async (letra) => {
          const turmaId = `${ano}${letra}`;
          const snap = await getDocs(
            collection(db, "alunos", turmaId, "lista")
          );
          if (!snap.empty) {
            withStudents.push(turmaId);
            const temIncompleto = snap.docs.some((d) => {
              const data = d.data();
              const cpf = (data.cpf || "").replace(/\D/g, "");
              return cpf.length !== 11;
            });
            if (temIncompleto) withIncomplete.push(turmaId);
          }
        })
      );
      setClassesWithStudents(withStudents.sort());
      setClassesWithIncompleteStudents(withIncomplete.sort());
    } catch {
      showToast("Erro ao verificar turmas.");
    }
    setClassesWithStudentsLoading(false);
  };

  // ── Abre modal do aluno e busca seus dados (ingresso + login) ──
  const openStudentModal = async (aluno: any, turmaId: string) => {
    setStudentModal({ ...aluno, turmaId });
    setStudentModalTicket(null);
    setStudentModalResponsaveis([]);
    setEditStudentMode(false);
    setEditStudentError("");
    setStudentModalLoading(true);
    setAssociarForm({
      loteId: "",
      email: "",
      status: "pendente",
      pago: false,
      metodoPagamento: null,
    });
    try {
      // Busca ingresso pelo CPF do aluno
      const cpfDigits = (aluno.cpf || "").replace(/\D/g, "");
      const ticket = allTickets.find(
        (t) =>
          (t.cpf || "").replace(/\D/g, "") === cpfDigits ||
          (usersMap[t.userId] || "").replace(/\D/g, "") === cpfDigits
      );
      setStudentModalTicket(ticket || null);
      // Tenta enriquecer com dados do usuário logado (email, numero)
      if (cpfDigits) {
        const usuariosSnap = await getDocs(collection(db, "usuarios"));
        usuariosSnap.forEach((d) => {
          if ((d.data().cpf || "").replace(/\D/g, "") === cpfDigits) {
            setStudentModal((prev: any) => ({
              ...prev,
              _userData: d.data(),
              _userId: d.id,
            }));
          }
        });
        // Busca responsáveis associados ao aluno pelo nome/id
        const nomeId = aluno.id || aluno.nome?.trim().replace(/\s+/g, "_");
        const responsaveisSnap = await getDocs(collection(db, "responsaveis"));
        const resps: any[] = [];
        responsaveisSnap.forEach((d) => {
          const data = d.data();
          if (
            data.alunoId === nomeId ||
            (cpfDigits &&
              (data.alunoCpf || "").replace(/\D/g, "") === cpfDigits)
          ) {
            resps.push({ id: d.id, ...data });
          }
        });
        setStudentModalResponsaveis(resps);
      }
    } catch {}
    setStudentModalLoading(false);
  };

  // ── Associar ingresso a um aluno pelo modal ──
  const handleAssociarIngresso = async () => {
    if (!studentModal || !associarForm.loteId) return;
    setAssociarLoading(true);
    try {
      const uniqueCode = await generateTicketCode(db);
      const usado = associarForm.status === "validado";
      const agora = new Date().toISOString();
      const loteSelecionado = batches.find((b) => b.id === associarForm.loteId);
      const ticketData = {
        userId: studentModal._userId || `manual_${uniqueCode}`,
        nomeAluno: studentModal.nome,
        ano: studentModal.ano,
        turma: studentModal.turma,
        type: loteSelecionado?.nome || "Acesso Geral",
        loteId: loteSelecionado?.id || null,
        qty: 1,
        price: loteSelecionado?.preco || 0,
        code: uniqueCode,
        criadoEm: agora,
        usado,
        horaEntrada: usado ? agora : null,
        cpf: studentModal.cpf,
        email: associarForm.email || studentModal._userData?.email || "",
        origem: "manual_admin",
        pagamentoConfirmado: associarForm.pago,
        dataPagamento: associarForm.pago ? agora : null,
        metodoPagamento: associarForm.pago
          ? associarForm.metodoPagamento === "dinheiro"
            ? "dinheiro"
            : "pix"
          : null,
      };
      await setDoc(doc(db, "ingressos", uniqueCode), ticketData);

      // Incrementa o contador de ingressos associados no lote (contabiliza qualquer origem)
      if (loteSelecionado?.id) {
        try {
          await updateDoc(doc(db, "lotes", loteSelecionado.id), {
            ingressosAssociados: increment(1),
          });
          setBatches((prev) =>
            prev.map((b) =>
              b.id === loteSelecionado.id
                ? { ...b, ingressosAssociados: (b.ingressosAssociados || 0) + 1 }
                : b
            )
          );
        } catch (e) {
          console.warn("Erro ao incrementar contador do lote:", e);
        }
      }

      // Envia e-mail com o ingresso, para o e-mail já cadastrado no login
      // do aluno/responsável (se existir) ou para o e-mail informado agora
      const emailDestino =
        associarForm.email || studentModal._userData?.email || "";
      let emailEnviado = false;
      if (emailDestino) {
        try {
          await fetch("https://festajunina-api.vercel.app/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: emailDestino,
              nomeAluno: studentModal.nome,
              code: uniqueCode,
              lote: loteSelecionado?.nome || "Acesso Geral",
              preco: `R$ ${Number(loteSelecionado?.preco || 0)
                .toFixed(2)
                .replace(".", ",")}`,
            }),
          });
          emailEnviado = true;
        } catch (emailErr) {
          console.warn("E-mail não enviado:", emailErr);
        }
      }

      setAllTickets((prev) =>
        [...prev, { id: uniqueCode, ...ticketData }].sort((a, b) =>
          (a.nomeAluno || "").localeCompare(b.nomeAluno || "")
        )
      );
      setStudentModalTicket({ id: uniqueCode, ...ticketData });
      showToast(
        emailEnviado
          ? "Ingresso associado e enviado por e-mail com sucesso!"
          : "Ingresso associado com sucesso! (sem e-mail para envio)",
        "success"
      );
    } catch {
      showToast("Erro ao associar ingresso.");
    }
    setAssociarLoading(false);
  };

  // ── Validar / Desvalidar ingresso do aluno ──
  const handleToggleValidarModal = async () => {
    if (!studentModalTicket) return;
    setStudentModalLoading(true);
    try {
      const agora = new Date().toISOString();
      const novoUsado = !studentModalTicket.usado;
      await updateDoc(doc(db, "ingressos", studentModalTicket.id), {
        usado: novoUsado,
        horaEntrada: novoUsado ? agora : null,
      });
      const updated = {
        ...studentModalTicket,
        usado: novoUsado,
        horaEntrada: novoUsado ? agora : null,
      };
      setStudentModalTicket(updated);
      setAllTickets((prev) =>
        prev.map((t) => (t.id === studentModalTicket.id ? updated : t))
      );
      showToast(
        novoUsado ? "Ingresso validado!" : "Validação desfeita!",
        "success"
      );
    } catch {
      showToast("Erro ao atualizar ingresso.");
    }
    setStudentModalLoading(false);
  };

  // ── Excluir ingresso do aluno pelo modal ──
  const handleExcluirIngressoModal = async () => {
    if (!studentModalTicket) return;
    setStudentModalLoading(true);
    try {
      await deleteDoc(doc(db, "ingressos", studentModalTicket.id));

      // Decrementa o contador do lote ao excluir ingresso
      if (studentModalTicket.loteId) {
        try {
          await updateDoc(doc(db, "lotes", studentModalTicket.loteId), {
            ingressosAssociados: increment(-1),
          });
          setBatches((prev) =>
            prev.map((b) =>
              b.id === studentModalTicket.loteId
                ? { ...b, ingressosAssociados: Math.max(0, (b.ingressosAssociados || 0) - 1) }
                : b
            )
          );
        } catch (e) {
          console.warn("Erro ao decrementar contador do lote:", e);
        }
      }

      setAllTickets((prev) =>
        prev.filter((t) => t.id !== studentModalTicket.id)
      );
      setStudentModalTicket(null);
      showToast("Ingresso excluído!", "success");
    } catch {
      showToast("Erro ao excluir ingresso.");
    }
    setStudentModalLoading(false);
  };

  // ── Salvar edição de dados cadastrais do aluno ──
  const handleSaveStudentEdit = async () => {
    if (!studentModal) return;
    setEditStudentError("");
    const cpfDigits = editStudentForm.cpf.replace(/\D/g, "");
    if (cpfDigits && !validateCpfFull(editStudentForm.cpf)) {
      setEditStudentError("CPF inválido");
      return;
    }
    if (
      editStudentForm.email &&
      !/^\S+@\S+\.\S+$/.test(editStudentForm.email)
    ) {
      setEditStudentError("E-mail inválido");
      return;
    }
    setEditStudentSaving(true);
    try {
      const turmaId = studentModal.turmaId;
      const nomeId = studentModal.id;
      const updates: any = {
        cpf: cpfDigits,
        email: editStudentForm.email.trim(),
        telefone: editStudentForm.telefone.trim(),
      };
      await updateDoc(doc(db, "alunos", turmaId, "lista", nomeId), updates);
      // Atualiza estado local
      setStudentModal((prev: any) => ({ ...prev, ...updates }));
      setClassesData((prev) => {
        const n = { ...prev };
        if (n[turmaId]) {
          n[turmaId] = n[turmaId].map((a) =>
            a.id === nomeId ? { ...a, ...updates } : a
          );
        }
        return n;
      });
      // Atualiza lista do modal "sem CPF" se aberto
      setMissingCpfModal((prev) => {
        if (!prev) return prev;
        const filtered = prev.alunos
          .map((a) => (a.id === nomeId ? { ...a, ...updates } : a))
          .filter((a) => (a.cpf || "").replace(/\D/g, "").length !== 11);
        return { ...prev, alunos: filtered };
      });
      setEditStudentMode(false);
      showToast("Dados atualizados com sucesso!", "success");
    } catch (e) {
      console.error(e);
      setEditStudentError("Erro ao salvar. Tente novamente.");
    }
    setEditStudentSaving(false);
  };

  // ── Excluir aluno do Firebase ──
  const handleDeleteStudent = async () => {
    if (!studentModal) return;
    setDeleteStudentLoading(true);
    try {
      const turmaId = studentModal.turmaId;
      const nomeId = studentModal.id;
      await deleteDoc(doc(db, "alunos", turmaId, "lista", nomeId));
      // Remove do cache local
      setClassesData((prev) => {
        const n = { ...prev };
        if (n[turmaId]) {
          n[turmaId] = n[turmaId].filter((a) => a.id !== nomeId);
        }
        return n;
      });
      setStudentResults((prev) =>
        prev.filter((a) => a.id !== nomeId || a.turmaId !== turmaId)
      );
      setConfirmDeleteStudent(false);
      setStudentModal(null);
      showToast("Aluno excluído com sucesso!", "success");
    } catch {
      showToast("Erro ao excluir aluno.");
    }
    setDeleteStudentLoading(false);
  };

  // ── Busca alunos de uma turma específica (ex: "3B") ──
  const fetchClassStudents = async (turmaId: string) => {
    if (classesData[turmaId]) return; // já carregado
    setClassesLoading(true);
    try {
      const snap = await getDocs(collection(db, "alunos", turmaId, "lista"));
      const alunos: any[] = [];
      snap.forEach((d) => {
        const data = d.data();
        // Compatibilidade: dados antigos salvos como "nomeAluno", novos como "nome"
        const nome = data.nome || data.nomeAluno || "";
        alunos.push({ id: d.id, ...data, nome });
      });
      alunos.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
      setClassesData((prev) => ({ ...prev, [turmaId]: alunos }));
    } catch {
      showToast("Erro ao buscar alunos da turma.");
    }
    setClassesLoading(false);
  };

  // ── Pesquisa alunos por nome em todas as turmas ──
  const searchStudents = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setStudentResults([]);
      return;
    }
    setStudentSearchLoading(true);
    try {
      const anosSnap = await getDocs(collection(db, "alunos"));
      const results: any[] = [];
      for (const turmaDoc of anosSnap.docs) {
        const alunosSnap = await getDocs(
          collection(db, "alunos", turmaDoc.id, "lista")
        );
        alunosSnap.forEach((d) => {
          const data = d.data();
          const nomeAluno = data.nome || data.nomeAluno || "";
          if (nomeAluno.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              id: d.id,
              turmaId: turmaDoc.id,
              ...data,
              nome: nomeAluno,
            });
          }
        });
      }
      results.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
      setStudentResults(results);
    } catch {
      showToast("Erro ao pesquisar alunos.");
    }
    setStudentSearchLoading(false);
  };

  // ── Pesquisa alunos por nome para o formulário de adicionar ingresso ──
  const searchStudentsForTicket = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setAddTicketStudentResults([]);
      return;
    }
    setAddTicketStudentSearchLoading(true);
    try {
      const anosSnap = await getDocs(collection(db, "alunos"));
      const results: any[] = [];
      for (const turmaDoc of anosSnap.docs) {
        const alunosSnap = await getDocs(
          collection(db, "alunos", turmaDoc.id, "lista")
        );
        alunosSnap.forEach((d) => {
          const data = d.data();
          const nomeAluno = data.nome || data.nomeAluno || "";
          if (nomeAluno.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              id: d.id,
              turmaId: turmaDoc.id,
              ...data,
              nome: nomeAluno,
            });
          }
        });
      }
      results.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
      setAddTicketStudentResults(results);
    } catch {
      showToast("Erro ao pesquisar alunos.");
    }
    setAddTicketStudentSearchLoading(false);
  };

  // ── Preenche o formulário de ingresso com dados do aluno selecionado ──
  const selectStudentForTicket = (aluno: any) => {
    const turmaId: string = aluno.turmaId || "";
    const ano = turmaId.slice(0, 1);
    const turma = turmaId.slice(1);
    setAddTicketForm((prev) => ({
      ...prev,
      nomeAluno: aluno.nome || "",
      ano: aluno.ano || ano || "",
      turma: aluno.turma || turma || "",
      cpf: formatCpf(aluno.cpf || ""),
      email: aluno.email || "",
    }));
    setAddTicketStudentSearch("");
    setAddTicketStudentResults([]);
    setAddTicketStudentSearchOpen(false);
    setAddTicketErrors({});
  };

  // ── Helpers internos para o cadastro manual ──
  const applyPhoneMaskLocal = (v: string) => {
    const c = v.replace(/\D/g, "").slice(0, 11);
    if (c.length > 6)
      return c.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
    if (c.length > 2) return c.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
    return c.length ? `(${c}` : c;
  };

  const validateCpfFull = (cpf: string) => {
    const c = cpf.replace(/\D/g, "");
    if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
    let rest = (sum * 10) % 11;
    if (rest >= 10) rest = 0;
    if (rest !== parseInt(c[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
    rest = (sum * 10) % 11;
    if (rest >= 10) rest = 0;
    return rest === parseInt(c[10]);
  };

  const handleManualFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    let v = value;
    if (name === "cpf") v = applyCpfMask(value);
    if (name === "telefone") v = applyPhoneMaskLocal(value);
    setManualForm((prev) => ({ ...prev, [name]: v }));
    if (manualErrors[name])
      setManualErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleManualCadastro = async () => {
    const errs: Record<string, string> = {};
    if (manualForm.nomeAluno.trim().length < 3)
      errs.nomeAluno = "Mínimo 3 caracteres";
    if (!manualForm.ano) errs.ano = "Selecione o ano";
    if (!manualForm.turma) errs.turma = "Selecione a turma";
    if (!validateCpfFull(manualForm.cpf)) errs.cpf = "CPF inválido";
    if (manualForm.email && !/^\S+@\S+\.\S+$/.test(manualForm.email))
      errs.email = "E-mail inválido";
    if (
      manualForm.telefone &&
      manualForm.telefone.replace(/\D/g, "").length < 10
    )
      errs.telefone = "Telefone inválido";
    setManualErrors(errs);
    if (Object.keys(errs).length > 0)
      return showToast("Corrija os erros antes de salvar.");

    setManualLoading(true);
    const sala = `${manualForm.ano}${manualForm.turma}`;
    const cpfDigits = manualForm.cpf.replace(/\D/g, "");

    try {
      // Verifica duplicata em todas as salas
      const turmasSnap = await getDocs(collection(db, "alunos"));
      for (const turmaDoc of turmasSnap.docs) {
        const listaSnap = await getDocs(
          collection(db, "alunos", turmaDoc.id, "lista")
        );
        for (const alunoDoc of listaSnap.docs) {
          if ((alunoDoc.data().cpf || "").replace(/\D/g, "") === cpfDigits) {
            setManualLoading(false);
            return showToast(`CPF já cadastrado na sala ${turmaDoc.id}.`);
          }
        }
      }

      const payload: Record<string, string> = {
        nome: manualForm.nomeAluno.trim(),
        cpf: cpfDigits,
        sala,
        ano: manualForm.ano,
        turma: manualForm.turma,
        criadoEm: new Date().toISOString(),
      };
      if (manualForm.email.trim())
        payload.email = manualForm.email.trim().toLowerCase();
      if (manualForm.telefone.trim())
        payload.telefone = manualForm.telefone.trim();

      // 1. Garante que o documento pai da turma existe (ex: alunos/3B)
      await setDoc(
        doc(db, "alunos", sala),
        {
          ano: manualForm.ano,
          turma: manualForm.turma,
          sala,
        },
        { merge: true }
      );

      // 2. Salva o aluno com o nome como ID do documento (ex: Maria_Jose)
      const nomeId = manualForm.nomeAluno.trim().replace(/\s+/g, "_");
      await setDoc(doc(db, "alunos", sala, "lista", nomeId), payload);

      setManualSuccessSala(sala);
      showToast(`Aluno cadastrado na sala ${sala}!`, "success");
      setManualForm(emptyManualForm);
      setManualErrors({});
    } catch (err) {
      console.error(err);
      showToast("Erro ao salvar no banco de dados.");
    }
    setManualLoading(false);
  };

  // ── Handlers do formulário de pai/responsável ──
  const handleParentFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    let v = value;
    if (name === "cpf") v = applyCpfMask(value);
    if (name === "telefone") v = applyPhoneMaskLocal(value);
    setParentForm((prev) => ({ ...prev, [name]: v }));
    if (parentErrors[name])
      setParentErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // ── Busca alunos para associar ao pai ──
  const searchStudentsForParent = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setParentStudentResults([]);
      return;
    }
    setParentStudentSearchLoading(true);
    try {
      const anosSnap = await getDocs(collection(db, "alunos"));
      const results: any[] = [];
      for (const turmaDoc of anosSnap.docs) {
        const alunosSnap = await getDocs(
          collection(db, "alunos", turmaDoc.id, "lista")
        );
        alunosSnap.forEach((d) => {
          const data = d.data();
          const nomeAluno = data.nome || data.nomeAluno || "";
          if (nomeAluno.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              id: d.id,
              turmaId: turmaDoc.id,
              ...data,
              nome: nomeAluno,
            });
          }
        });
      }
      results.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
      setParentStudentResults(results);
    } catch {
      showToast("Erro ao pesquisar alunos.");
    }
    setParentStudentSearchLoading(false);
  };

  // ── Garante que um aluno tenha no máximo 1 "pai" e 1 "mãe" cadastrados ──
  // (responsáveis com relacao "responsavel" não entram nessa restrição)
  const checkRelacaoUnica = async (
    alunoId: string,
    relacao: string,
    excludeId?: string
  ) => {
    if (relacao !== "pai" && relacao !== "mae") return true;
    const snap = await getDocs(collection(db, "responsaveis"));
    for (const d of snap.docs) {
      if (excludeId && d.id === excludeId) continue;
      const data = d.data();
      if (data.alunoId === alunoId && data.relacao === relacao) return false;
    }
    return true;
  };

  // ── Salva pai/responsável no Firebase ──
  const handleParentCadastro = async () => {
    const errs: Record<string, string> = {};
    if (parentForm.nome.trim().length < 3) errs.nome = "Mínimo 3 caracteres";
    if (!validateCpfFull(parentForm.cpf)) errs.cpf = "CPF inválido";
    if (parentForm.email && !/^\S+@\S+\.\S+$/.test(parentForm.email))
      errs.email = "E-mail inválido";
    if (
      parentForm.telefone &&
      parentForm.telefone.replace(/\D/g, "").length < 10
    )
      errs.telefone = "Telefone inválido";
    setParentErrors(errs);
    if (Object.keys(errs).length > 0)
      return showToast("Corrija os erros antes de salvar.");

    setParentLoading(true);
    const cpfDigits = parentForm.cpf.replace(/\D/g, "");

    try {
      // Verifica duplicata de CPF em responsáveis
      const responsaveisSnap = await getDocs(collection(db, "responsaveis"));
      for (const doc_ of responsaveisSnap.docs) {
        if ((doc_.data().cpf || "").replace(/\D/g, "") === cpfDigits) {
          setParentLoading(false);
          return showToast("CPF já cadastrado como responsável.");
        }
      }

      // Garante que o aluno não fique com 2 pais ou 2 mães
      if (
        parentAssociatedStudent &&
        (parentForm.relacao === "pai" || parentForm.relacao === "mae")
      ) {
        const livre = await checkRelacaoUnica(
          parentAssociatedStudent.id,
          parentForm.relacao
        );
        if (!livre) {
          setParentLoading(false);
          return showToast(
            `Este aluno já possui um(a) ${
              parentForm.relacao === "pai" ? "pai" : "mãe"
            } cadastrado(a). Desassocie o atual antes de adicionar outro.`
          );
        }
      }

      const payload: Record<string, any> = {
        nome: parentForm.nome.trim(),
        cpf: cpfDigits,
        relacao: parentForm.relacao,
        criadoEm: new Date().toISOString(),
      };
      if (parentForm.email.trim())
        payload.email = parentForm.email.trim().toLowerCase();
      if (parentForm.telefone.trim())
        payload.telefone = parentForm.telefone.trim();

      // Associa ao aluno se selecionado
      if (parentAssociatedStudent) {
        payload.alunoId = parentAssociatedStudent.id;
        payload.alunoNome = parentAssociatedStudent.nome;
        payload.alunoTurma = parentAssociatedStudent.turmaId;
        payload.alunoAno =
          parentAssociatedStudent.ano ||
          parentAssociatedStudent.turmaId?.slice(0, 1) ||
          "";
      }

      const nomeId = parentForm.nome.trim().replace(/\s+/g, "_");
      await setDoc(doc(db, "responsaveis", nomeId), payload);

      setParentSuccess({ ...payload });
      showToast(`Responsável cadastrado com sucesso!`, "success");
      setParentForm(emptyParentForm);
      setParentErrors({});
      setParentAssociatedStudent(null);
      setParentStudentSearch("");
    } catch (err) {
      console.error(err);
      showToast("Erro ao salvar no banco de dados.");
    }
    setParentLoading(false);
  };

  // ── Busca responsáveis por nome ──
  const searchResponsaveis = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setResponsavelResults([]);
      return;
    }
    setResponsavelSearchLoading(true);
    try {
      const snap = await getDocs(collection(db, "responsaveis"));
      const results: any[] = [];
      snap.forEach((d) => {
        const data = d.data();
        const nome = data.nome || "";
        if (nome.toLowerCase().includes(query.toLowerCase())) {
          results.push({ id: d.id, ...data });
        }
      });
      results.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
      setResponsavelResults(results);
    } catch {
      showToast("Erro ao pesquisar responsáveis.");
    }
    setResponsavelSearchLoading(false);
  };

  // ── Carrega todos os responsáveis do Firebase ──
  const fetchAllResponsaveis = async () => {
    setAllResponsaveisLoading(true);
    try {
      const snap = await getDocs(collection(db, "responsaveis"));
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
      setAllResponsaveis(list);
    } catch {
      showToast("Erro ao carregar responsáveis.");
    }
    setAllResponsaveisLoading(false);
  };

  // ── Limpa todos os responsáveis do Firebase ──
  const handleLimparResponsaveis = async () => {
    setLimparResponsaveisLoading(true);
    try {
      const snap = await getDocs(collection(db, "responsaveis"));
      await Promise.all(
        snap.docs.map((d) => deleteDoc(doc(db, "responsaveis", d.id)))
      );
      setAllResponsaveis([]);
      setResponsavelResults([]);
      setConfirmLimparResponsaveis(false);
      showToast("Todos os responsáveis foram removidos.", "success");
    } catch {
      showToast("Erro ao limpar responsáveis.");
    }
    setLimparResponsaveisLoading(false);
  };

  // ── Abre modal do responsável e busca seu ingresso ──
  const openResponsavelModal = async (resp: any) => {
    setResponsavelModal(resp);
    setResponsavelModalTicket(null);
    setResponsavelModalLoading(true);
    setEditingResponsavel(false);
    setEditResponsavelErrors({});
    setEditingAlunoAssociado(false);
    setEditAlunoSearch("");
    setEditAlunoResults([]);
    setAssociarResponsavelForm({
      loteId: "",
      email: "",
      status: "pendente",
      pago: false,
      metodoPagamento: null,
    });
    try {
      const cpfDigits = (resp.cpf || "").replace(/\D/g, "");
      const ticket = allTickets.find(
        (t) =>
          (t.cpf || "").replace(/\D/g, "") === cpfDigits ||
          (usersMap[t.userId] || "").replace(/\D/g, "") === cpfDigits
      );
      setResponsavelModalTicket(ticket || null);
    } catch {}
    setResponsavelModalLoading(false);
  };

  // ── Associar ingresso ao responsável ──
  const handleAssociarIngressoResponsavel = async () => {
    if (!responsavelModal || !associarResponsavelForm.loteId) return;
    setAssociarResponsavelLoading(true);
    try {
      const uniqueCode = await generateTicketCode(db);
      const usado = associarResponsavelForm.status === "validado";
      const agora = new Date().toISOString();
      const loteSelecionado = batches.find(
        (b) => b.id === associarResponsavelForm.loteId
      );
      const ticketData = {
        userId: `manual_${uniqueCode}`,
        nomeAluno: responsavelModal.nome,
        ano: responsavelModal.alunoAno || "",
        turma: responsavelModal.alunoTurma
          ? responsavelModal.alunoTurma.slice(1)
          : "",
        type: loteSelecionado?.nome || "Acesso Geral",
        loteId: loteSelecionado?.id || null,
        qty: 1,
        price: loteSelecionado?.preco || 0,
        code: uniqueCode,
        criadoEm: agora,
        usado,
        horaEntrada: usado ? agora : null,
        cpf: (responsavelModal.cpf || "").replace(/\D/g, ""),
        email: associarResponsavelForm.email || responsavelModal.email || "",
        origem: "manual_admin",
        tipoTitular: "responsavel",
        pagamentoConfirmado: associarResponsavelForm.pago,
        dataPagamento: associarResponsavelForm.pago ? agora : null,
        metodoPagamento: associarResponsavelForm.pago
          ? associarResponsavelForm.metodoPagamento === "dinheiro"
            ? "dinheiro"
            : "pix"
          : null,
      };
      await setDoc(doc(db, "ingressos", uniqueCode), ticketData);

      // Incrementa o contador de ingressos associados no lote (contabiliza qualquer origem)
      if (loteSelecionado?.id) {
        try {
          await updateDoc(doc(db, "lotes", loteSelecionado.id), {
            ingressosAssociados: increment(1),
          });
          setBatches((prev) =>
            prev.map((b) =>
              b.id === loteSelecionado.id
                ? { ...b, ingressosAssociados: (b.ingressosAssociados || 0) + 1 }
                : b
            )
          );
        } catch (e) {
          console.warn("Erro ao incrementar contador do lote:", e);
        }
      }

      setAllTickets((prev) =>
        [...prev, { id: uniqueCode, ...ticketData }].sort((a, b) =>
          (a.nomeAluno || "").localeCompare(b.nomeAluno || "")
        )
      );
      setResponsavelModalTicket({ id: uniqueCode, ...ticketData });
      showToast("Ingresso associado com sucesso!", "success");
    } catch {
      showToast("Erro ao associar ingresso.");
    }
    setAssociarResponsavelLoading(false);
  };

  // ── Validar/Desvalidar ingresso do responsável ──
  const handleToggleValidarResponsavel = async () => {
    if (!responsavelModalTicket) return;
    setResponsavelModalLoading(true);
    try {
      const agora = new Date().toISOString();
      const novoUsado = !responsavelModalTicket.usado;
      await updateDoc(doc(db, "ingressos", responsavelModalTicket.id), {
        usado: novoUsado,
        horaEntrada: novoUsado ? agora : null,
      });
      const updated = {
        ...responsavelModalTicket,
        usado: novoUsado,
        horaEntrada: novoUsado ? agora : null,
      };
      setResponsavelModalTicket(updated);
      setAllTickets((prev) =>
        prev.map((t) => (t.id === responsavelModalTicket.id ? updated : t))
      );
      showToast(
        novoUsado ? "Ingresso validado!" : "Validação desfeita!",
        "success"
      );
    } catch {
      showToast("Erro ao atualizar ingresso.");
    }
    setResponsavelModalLoading(false);
  };

  // ── Excluir ingresso do responsável ──
  const handleExcluirIngressoResponsavel = async () => {
    if (!responsavelModalTicket) return;
    setResponsavelModalLoading(true);
    try {
      await deleteDoc(doc(db, "ingressos", responsavelModalTicket.id));

      // Decrementa o contador do lote ao excluir ingresso
      if (responsavelModalTicket.loteId) {
        try {
          await updateDoc(doc(db, "lotes", responsavelModalTicket.loteId), {
            ingressosAssociados: increment(-1),
          });
          setBatches((prev) =>
            prev.map((b) =>
              b.id === responsavelModalTicket.loteId
                ? { ...b, ingressosAssociados: Math.max(0, (b.ingressosAssociados || 0) - 1) }
                : b
            )
          );
        } catch (e) {
          console.warn("Erro ao decrementar contador do lote:", e);
        }
      }

      setAllTickets((prev) =>
        prev.filter((t) => t.id !== responsavelModalTicket.id)
      );
      setResponsavelModalTicket(null);
      showToast("Ingresso excluído!", "success");
    } catch {
      showToast("Erro ao excluir ingresso.");
    }
    setResponsavelModalLoading(false);
  };

  // ── Excluir responsável do Firebase ──
  const handleDeleteResponsavel = async () => {
    if (!responsavelModal) return;
    setDeleteResponsavelLoading(true);
    try {
      await deleteDoc(doc(db, "responsaveis", responsavelModal.id));
      setResponsavelResults((prev) =>
        prev.filter((r) => r.id !== responsavelModal.id)
      );
      setAllResponsaveis((prev) =>
        prev.filter((r) => r.id !== responsavelModal.id)
      );
      setConfirmDeleteResponsavel(false);
      setResponsavelModal(null);
      showToast("Responsável excluído com sucesso!", "success");
    } catch {
      showToast("Erro ao excluir responsável.");
    }
    setDeleteResponsavelLoading(false);
  };

  // ── Desassocia um responsável do aluno (mantém o cadastro do responsável) ──
  const handleDesassociarResponsavel = async (resp: any) => {
    if (!resp) return;
    setRemoveResponsavelLoading(true);
    try {
      await updateDoc(doc(db, "responsaveis", resp.id), {
        alunoId: deleteField(),
        alunoNome: deleteField(),
        alunoTurma: deleteField(),
        alunoAno: deleteField(),
        alunoCpf: deleteField(),
      });
      setStudentModalResponsaveis((prev) =>
        prev.filter((r) => r.id !== resp.id)
      );
      setResponsavelResults((prev) =>
        prev.map((r) =>
          r.id === resp.id
            ? {
                ...r,
                alunoId: undefined,
                alunoNome: undefined,
                alunoTurma: undefined,
                alunoAno: undefined,
                alunoCpf: undefined,
              }
            : r
        )
      );
      showToast("Responsável desassociado do aluno.", "success");
    } catch {
      showToast("Erro ao desassociar responsável.");
    }
    setRemoveResponsavelLoading(false);
    setResponsavelToRemove(null);
  };

  // ── Exclui definitivamente um responsável a partir da tela do aluno ──
  const handleExcluirResponsavelFromStudent = async (resp: any) => {
    if (!resp) return;
    setRemoveResponsavelLoading(true);
    try {
      await deleteDoc(doc(db, "responsaveis", resp.id));
      setStudentModalResponsaveis((prev) =>
        prev.filter((r) => r.id !== resp.id)
      );
      setResponsavelResults((prev) => prev.filter((r) => r.id !== resp.id));
      showToast("Responsável excluído com sucesso!", "success");
    } catch {
      showToast("Erro ao excluir responsável.");
    }
    setRemoveResponsavelLoading(false);
    setResponsavelToRemove(null);
  };

  // ── Busca alunos para editar o aluno associado ──
  const handleEditAlunoSearch = async (query: string) => {
    setEditAlunoSearch(query);
    if (query.trim().length < 2) {
      setEditAlunoResults([]);
      return;
    }
    setEditAlunoLoading(true);
    try {
      const snap = await getDocs(collection(db, "alunos"));
      const results: any[] = [];
      for (const turmaDoc of snap.docs) {
        const alunosSnap = await getDocs(
          collection(db, "alunos", turmaDoc.id, "lista")
        );
        alunosSnap.forEach((d) => {
          const data = d.data();
          const nome = data.nome || "";
          if (nome.toLowerCase().includes(query.trim().toLowerCase())) {
            results.push({ id: d.id, turmaId: turmaDoc.id, ...data });
          }
        });
      }
      results.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
      setEditAlunoResults(results.slice(0, 8));
    } catch {
      showToast("Erro ao buscar alunos.");
    }
    setEditAlunoLoading(false);
  };

  // ── Salva o novo aluno associado ao responsável ──
  const handleSaveAlunoAssociado = async (aluno: any) => {
    if (!responsavelModal) return;
    setSavingAlunoAssociado(true);
    try {
      const turmaId = aluno.turmaId || `${aluno.ano}${aluno.turma}`;
      await updateDoc(doc(db, "responsaveis", responsavelModal.id), {
        alunoId: aluno.id,
        alunoNome: aluno.nome,
        alunoTurma: turmaId,
        alunoAno: aluno.ano,
        alunoCpf: (aluno.cpf || "").replace(/\D/g, ""),
      });
      const updated = {
        ...responsavelModal,
        alunoId: aluno.id,
        alunoNome: aluno.nome,
        alunoTurma: turmaId,
        alunoAno: aluno.ano,
        alunoCpf: (aluno.cpf || "").replace(/\D/g, ""),
      };
      setResponsavelModal(updated);
      setResponsavelResults((prev) =>
        prev.map((r) => (r.id === responsavelModal.id ? updated : r))
      );
      setEditingAlunoAssociado(false);
      setEditAlunoSearch("");
      setEditAlunoResults([]);
      showToast("Aluno associado atualizado com sucesso!", "success");
    } catch {
      showToast("Erro ao atualizar aluno associado.");
    }
    setSavingAlunoAssociado(false);
  };

  // ── Remove associação de aluno do responsável ──
  const handleRemoverAlunoAssociado = async () => {
    if (!responsavelModal) return;
    setSavingAlunoAssociado(true);
    try {
      await updateDoc(doc(db, "responsaveis", responsavelModal.id), {
        alunoId: deleteField(),
        alunoNome: deleteField(),
        alunoTurma: deleteField(),
        alunoAno: deleteField(),
        alunoCpf: deleteField(),
      });
      const updated = {
        ...responsavelModal,
        alunoId: undefined,
        alunoNome: undefined,
        alunoTurma: undefined,
        alunoAno: undefined,
        alunoCpf: undefined,
      };
      setResponsavelModal(updated);
      setResponsavelResults((prev) =>
        prev.map((r) => (r.id === responsavelModal.id ? updated : r))
      );
      setEditingAlunoAssociado(false);
      setEditAlunoSearch("");
      setEditAlunoResults([]);
      showToast("Associação removida.", "success");
    } catch {
      showToast("Erro ao remover associação.");
    }
    setSavingAlunoAssociado(false);
  };

  // ── Salva edição de e-mail/telefone/relação/nome do responsável (modal de pais) ──
  const handleSaveResponsavelEdit = async () => {
    if (!responsavelModal) return;
    const errs: Record<string, string> = {};
    if (editResponsavelForm.nome.trim().length < 3)
      errs.nome = "Mínimo 3 caracteres";
    if (
      editResponsavelForm.email &&
      !/^\S+@\S+\.\S+$/.test(editResponsavelForm.email)
    )
      errs.email = "E-mail inválido";
    if (
      editResponsavelForm.telefone &&
      editResponsavelForm.telefone.replace(/\D/g, "").length < 10
    )
      errs.telefone = "Telefone inválido";
    setEditResponsavelErrors(errs);
    if (Object.keys(errs).length > 0)
      return showToast("Corrija os erros antes de salvar.");

    setSavingResponsavelEdit(true);
    try {
      // Se a relação mudou para pai/mãe e o responsável está associado a um aluno,
      // garante que o aluno não fique com 2 pais ou 2 mães
      if (
        responsavelModal.alunoId &&
        (editResponsavelForm.relacao === "pai" ||
          editResponsavelForm.relacao === "mae") &&
        editResponsavelForm.relacao !== responsavelModal.relacao
      ) {
        const livre = await checkRelacaoUnica(
          responsavelModal.alunoId,
          editResponsavelForm.relacao,
          responsavelModal.id
        );
        if (!livre) {
          setSavingResponsavelEdit(false);
          return showToast(
            `Este aluno já possui um(a) ${
              editResponsavelForm.relacao === "pai" ? "pai" : "mãe"
            } cadastrado(a).`
          );
        }
      }

      const nomeTrim = editResponsavelForm.nome.trim();
      const emailTrim = editResponsavelForm.email.trim().toLowerCase();
      const telefoneTrim = editResponsavelForm.telefone.trim();

      await updateDoc(doc(db, "responsaveis", responsavelModal.id), {
        nome: nomeTrim,
        relacao: editResponsavelForm.relacao,
        email: emailTrim ? emailTrim : deleteField(),
        telefone: telefoneTrim ? telefoneTrim : deleteField(),
      });

      const updated = {
        ...responsavelModal,
        nome: nomeTrim,
        relacao: editResponsavelForm.relacao,
        email: emailTrim || null,
        telefone: telefoneTrim || null,
      };
      setResponsavelModal(updated);
      setResponsavelResults((prev) =>
        prev.map((r) => (r.id === responsavelModal.id ? updated : r))
      );
      setStudentModalResponsaveis((prev) =>
        prev.map((r) => (r.id === responsavelModal.id ? updated : r))
      );
      setEditingResponsavel(false);
      showToast("Responsável atualizado com sucesso!", "success");
    } catch (err) {
      console.error(err);
      showToast("Erro ao atualizar responsável.");
    }
    setSavingResponsavelEdit(false);
  };

  const handleSaveBatch = async (e) => {
    e.preventDefault();
    setLoadingBatches(true);
    try {
      // turmasVisiveis: null = todas as turmas; array = somente as turmas listadas
      const todasAsTurmas = [1, 2, 3].flatMap((ano) =>
        Array.from(
          { length: 12 },
          (_, i) => `${ano}${String.fromCharCode(65 + i)}`
        )
      );
      const turmasSelecionadas = batchModal.turmasVisiveis;
      const todasMarcadas =
        !turmasSelecionadas ||
        turmasSelecionadas.length === todasAsTurmas.length;

      const dataToSave = {
        nome: batchModal.nome,
        preco: Number(batchModal.preco),
        quantidade: Number(batchModal.quantidade),
        dataLimite: batchModal.dataLimite || "",
        publico: batchModal.publico || "Ambos",
        visivel: batchModal.visivel !== undefined ? batchModal.visivel : true,
        turmasVisiveis: todasMarcadas ? null : turmasSelecionadas,
        esgotado: batchModal.esgotado === true,
      };

      if (batchModal.id) {
        // Editando
        await updateDoc(doc(db, "lotes", batchModal.id), dataToSave);
        setBatches((prev) =>
          prev.map((b) =>
            b.id === batchModal.id ? { id: b.id, ...dataToSave } : b
          )
        );
        showToast("Lote atualizado com sucesso!", "success");
      } else {
        // Criando Novo Lote
        const newDocRef = doc(collection(db, "lotes"));
        await setDoc(newDocRef, dataToSave);
        setBatches((prev) => [...prev, { id: newDocRef.id, ...dataToSave }]);
        showToast("Lote criado com sucesso!", "success");
      }
      setBatchModal(null);
    } catch (error) {
      showToast("Erro ao salvar o lote.");
    }
    setLoadingBatches(false);
  };

  const handleToggleVisibility = async () => {
    if (!confirmVisibilityModal) return;
    setLoadingBatches(true);
    try {
      const batch = confirmVisibilityModal;
      const novoStatus = !batch.visivel;
      await updateDoc(doc(db, "lotes", batch.id), { visivel: novoStatus });
      setBatches((prev) =>
        prev.map((b) => (b.id === batch.id ? { ...b, visivel: novoStatus } : b))
      );
      showToast(
        novoStatus
          ? "Lote visível para o público."
          : "Lote ocultado com sucesso.",
        "success"
      );
      setConfirmVisibilityModal(null);
    } catch (error) {
      showToast("Erro ao alterar a visibilidade.");
    }
    setLoadingBatches(false);
  };

  // DashboardAdmin.tsx — linha 1230
  const processScan = (code) => {
    // Remove o '#' inicial se vier do input manual ou de um QR que contenha '#'
    const normalized = code.replace(/^#/, "").toUpperCase();

    const t = allTicketsRef.current.find(
      (x) => x.code.toUpperCase() === normalized
    );
    // ...resto igual
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
      const ticketToDelete = allTickets.find((t) => t.id === ticketId);
      await deleteDoc(doc(db, "ingressos", ticketId));

      // Decrementa o contador do lote ao excluir ingresso
      if (ticketToDelete?.loteId) {
        try {
          await updateDoc(doc(db, "lotes", ticketToDelete.loteId), {
            ingressosAssociados: increment(-1),
          });
          setBatches((prev) =>
            prev.map((b) =>
              b.id === ticketToDelete.loteId
                ? { ...b, ingressosAssociados: Math.max(0, (b.ingressosAssociados || 0) - 1) }
                : b
            )
          );
        } catch (e) {
          console.warn("Erro ao decrementar contador do lote:", e);
        }
      }

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
    if (!addTicketForm.loteId) e.loteId = "Selecione um lote";
    setAddTicketErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleGenerateTicket = async () => {
    if (!validateAddTicket())
      return showToast("Corrija os erros para continuar.");

    setIsCreatingTicket(true);
    try {
      const uniqueCode = await generateTicketCode(db);
      const usado = addTicketStatus === "validado";
      const agora = new Date().toISOString();

      const loteSelecionado = batches.find(
        (b) => b.id === addTicketForm.loteId
      );

      const cpfDigits = addTicketForm.cpf.replace(/\D/g, "");
      const usuarioExistenteId = await findUserIdByCpf(db, cpfDigits);
      const userId = usuarioExistenteId || `manual_${uniqueCode}`;

      const ticketData = {
        userId,
        nomeAluno: addTicketForm.nomeAluno.trim(),
        ano: addTicketForm.ano,
        turma: addTicketForm.turma,
        type: loteSelecionado?.nome || "Acesso Geral",
        loteId: loteSelecionado?.id || null,
        qty: 1,
        price: loteSelecionado?.preco || 0,
        code: uniqueCode,
        criadoEm: agora,
        usado,
        horaEntrada: usado ? agora : null,
        cpf: addTicketForm.cpf,
        email: addTicketForm.email,
        origem: "manual_admin",
        pagamentoConfirmado: addTicketPago,
        dataPagamento: addTicketPago ? agora : null,
        metodoPagamento: addTicketPago
          ? addTicketMetodoPagamento === "dinheiro"
            ? "dinheiro"
            : "pix"
          : null,
      };

      await setDoc(doc(db, "ingressos", uniqueCode), ticketData);

      // Incrementa o contador de ingressos associados no lote (contabiliza qualquer origem)
      if (loteSelecionado?.id) {
        try {
          await updateDoc(doc(db, "lotes", loteSelecionado.id), {
            ingressosAssociados: increment(1),
          });
          setBatches((prev) =>
            prev.map((b) =>
              b.id === loteSelecionado.id
                ? { ...b, ingressosAssociados: (b.ingressosAssociados || 0) + 1 }
                : b
            )
          );
        } catch (e) {
          console.warn("Erro ao incrementar contador do lote:", e);
        }
      }

      // Envia e-mail com o ingresso
      try {
        await fetch("https://festajunina-api.vercel.app/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: addTicketForm.email,
            nomeAluno: addTicketForm.nomeAluno.trim(),
            code: uniqueCode,
            lote: loteSelecionado?.nome || "Acesso Geral",
            preco: `R$ ${Number(loteSelecionado?.preco || 0)
              .toFixed(2)
              .replace(".", ",")}`,
          }),
        });
      } catch (emailErr) {
        console.warn("E-mail não enviado:", emailErr);
      }

      setAllTickets((prev) =>
        [...prev, { id: uniqueCode, ...ticketData }].sort((a, b) =>
          (a.nomeAluno || "").localeCompare(b.nomeAluno || "")
        )
      );
      setUsersMap((prev) => ({
        ...prev,
        [userId]: addTicketForm.cpf,
      }));

      setGeneratedTicket({ id: uniqueCode, ...ticketData });
      showToast("Ingresso gerado com sucesso!", "success");
      setAddTicketForm({
        nomeAluno: "",
        ano: "",
        turma: "",
        cpf: "",
        email: "",
        loteId: "",
      });
      setAddTicketStatus("pendente");
      setAddTicketPago(false);
      setAddTicketMetodoPagamento(null);
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

    const turmaLabel = `${adminListYear}º Ano — Turma ${adminListClass}`;
    const dataExport = new Date().toLocaleDateString("pt-BR");
    const totalPresentes = filtered.filter((t) => t.usado).length;
    const totalPendentes = filtered.length - totalPresentes;

    // Cores
    const COR_HEADER = "#1a1a2e"; // azul escuro — cabeçalho colunas
    const COR_TITULO = "#16213e"; // azul mais escuro — linha de título
    const COR_PRESENTE = "#d4edda"; // verde claro
    const COR_PENDENTE = "#fff3cd"; // amarelo claro
    const COR_LINHA_PAR = "#f8f9fa"; // cinza levíssimo
    const COR_RESUMO_BG = "#e8f4fd"; // azul bem claro — linha de resumo

    let tableHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
          table { border-collapse: collapse; width: 100%; }
          td, th { padding: 8px 12px; vertical-align: middle; }
        </style>
      </head>
      <body>
        <table>

          <!-- Linha de título -->
          <tr>
            <td colspan="6"
                style="background-color:${COR_TITULO}; color:#ffffff; font-size:15pt;
                       font-weight:bold; padding:14px 16px; letter-spacing:1px;">
              Lista de Presença — ${turmaLabel}
            </td>
          </tr>

          <!-- Linha de info -->
          <tr>
            <td colspan="6"
                style="background-color:#2c3e6b; color:#c8d8f0; font-size:9pt;
                       padding:6px 16px;">
              Exportado em ${dataExport} &nbsp;|&nbsp;
              ${filtered.length} aluno(s) &nbsp;|&nbsp;
              ${totalPresentes} presente(s) &nbsp;|&nbsp;
              ${totalPendentes} pendente(s)
            </td>
          </tr>

          <!-- Linha vazia separadora -->
          <tr><td colspan="6" style="padding:4px;"></td></tr>

          <!-- Cabeçalho das colunas -->
          <thead>
            <tr style="background-color:${COR_HEADER}; color:#ffffff;">
              <th style="width:50px;  text-align:center; border:1px solid #0d0d1a;">#</th>
              <th style="width:240px; text-align:left;   border:1px solid #0d0d1a;">Nome do Aluno</th>
              <th style="width:80px;  text-align:center; border:1px solid #0d0d1a;">Turma</th>
              <th style="width:130px; text-align:center; border:1px solid #0d0d1a;">Código</th>
              <th style="width:90px;  text-align:center; border:1px solid #0d0d1a;">Status</th>
              <th style="width:160px; text-align:center; border:1px solid #0d0d1a;">Hora de Entrada</th>
            </tr>
          </thead>
          <tbody>
    `;

    filtered.forEach((t, i) => {
      const turmaFmt = `${t.ano}º ${t.turma}`;
      const presente = t.usado;
      const status = presente ? "✓ Presente" : "Pendente";
      const dtValida = presente ? formatDate(t.horaEntrada) : "—";
      const bgRow = presente
        ? COR_PRESENTE
        : i % 2 === 0
        ? "#ffffff"
        : COR_LINHA_PAR;
      const corStatus = presente ? "#155724" : "#856404";
      const bgStatus = presente ? "#c3e6cb" : "#ffeeba";

      tableHTML += `
        <tr style="background-color:${bgRow};">
          <td style="text-align:center; border:1px solid #dee2e6; color:#6c757d; font-size:9pt;">
            ${i + 1}
          </td>
          <td style="border:1px solid #dee2e6; font-weight:${
            presente ? "bold" : "normal"
          };">
            ${t.nomeAluno || "—"}
          </td>
          <td style="text-align:center; border:1px solid #dee2e6; color:#495057;">
            ${turmaFmt}
          </td>
          <td style="text-align:center; border:1px solid #dee2e6; font-family:monospace; color:#495057; font-size:10pt;">
            ${t.code || "—"}
          </td>
          <td style="text-align:center; border:1px solid #dee2e6;">
            <span style="background-color:${bgStatus}; color:${corStatus};
                         padding:2px 8px; border-radius:4px; font-weight:bold; font-size:9pt;">
              ${status}
            </span>
          </td>
          <td style="text-align:center; border:1px solid #dee2e6; color:#495057; font-size:9pt;">
            ${dtValida}
          </td>
        </tr>
      `;
    });

    // Linha de resumo final
    tableHTML += `
          <!-- Linha vazia -->
          <tr><td colspan="6" style="padding:4px;"></td></tr>

          <!-- Resumo -->
          <tr style="background-color:${COR_RESUMO_BG};">
            <td colspan="4"
                style="border:1px solid #b8daff; padding:8px 12px;
                       font-weight:bold; color:#004085;">
              Resumo da Turma
            </td>
            <td colspan="2"
                style="border:1px solid #b8daff; padding:8px 12px; color:#004085;">
              ${totalPresentes} de ${filtered.length} presentes
              (${
                filtered.length > 0
                  ? Math.round((totalPresentes / filtered.length) * 100)
                  : 0
              }%)
            </td>
          </tr>

        </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableHTML], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lista_presenca_${adminListYear}${adminListClass}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ─── COMPONENTES REUTILIZÁVEIS INTERNOS ───
  // Define se "Pendentes" representa quem NÃO entrou (presença) ou quem NÃO pagou (pagamento).
  // Login brandao/brandao -> "presenca" | Login brandao1/brandao1 -> "pagamento"
  const modoPendentes = currentUser?.modoPendentes || "pagamento";

  const getDetailedList = () => {
    let list =
      dashboardDetailModal === "vendidos"
        ? allTickets.filter((t) => t.pagamentoConfirmado)
        : dashboardDetailModal === "entraram"
        ? allTickets.filter((t) => t.usado)
        : modoPendentes === "presenca"
        ? // Pendentes = ingressos pagos que ainda não entraram (não marcaram presença)
          allTickets.filter((t) => t.pagamentoConfirmado && !t.usado)
        : // Pendentes = ingressos que ainda não foram pagos
          allTickets.filter((t) => !t.pagamentoConfirmado);
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
    const cpf = formatCpf(getTicketCpf(t, usersMap));
    const turmaLabel = t.ano && t.turma ? `${t.ano}º ${t.turma}` : "—";

    return (
      <div
        key={t.id}
        className="bg-[#0a0a0a] border border-zinc-800 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4 hover:border-zinc-700 hover:bg-[#0c0c0c] transition-colors"
      >
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

        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-5 pl-[60px] sm:pl-0 shrink-0">
          <div className="flex flex-col items-start sm:items-end gap-1">
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                  t.usado
                    ? "bg-green-500/10 text-green-400"
                    : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {t.usado ? (
                  <LuTicketCheck className="h-3 w-3" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
                {t.usado ? "Validado" : "Pendente"}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                  t.pagamentoConfirmado
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-yellow-500/10 text-yellow-500"
                }`}
              >
                <Banknote className="h-3 w-3" />
                {t.pagamentoConfirmado ? "Pago" : "Não pago"}
              </span>
            </div>
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
              key: "admin_batches",
              label: "Gestão de Lotes",
              icon: IoMdAddCircleOutline,
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

          {/* Botão Adicionar Ingresso com ícone de ticket SVG */}
          <button
            onClick={() => {
              setActiveTab("admin_add_ticket");
              if (window.innerWidth < 1024) setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-4 px-3 lg:px-0 lg:justify-center rounded-xl transition-all h-12 text-sm font-medium whitespace-nowrap ${
              activeTab === "admin_add_ticket"
                ? "bg-white text-black"
                : "text-zinc-500 hover:bg-zinc-900 hover:text-white"
            } ${sidebarOpen ? "lg:px-3 lg:justify-start" : ""}`}
          >
            {/* Ícone ticket + (add ticket) */}
            <LuTicketPlus className="h-5 w-5 shrink-0" />
            <span
              className={
                sidebarOpen ? "opacity-100 block" : "lg:hidden opacity-0 w-0"
              }
            >
              Adicionar Ingresso
            </span>
          </button>

          {/* Botão Importar Alunos */}
          <div className="relative group">
            <button
              onClick={() => {
                setActiveTab("admin_groups");
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-4 px-3 lg:px-0 lg:justify-center rounded-xl transition-all h-12 text-sm font-medium whitespace-nowrap ${
                activeTab === "admin_groups"
                  ? "bg-white text-black"
                  : "text-zinc-500 hover:bg-zinc-900 hover:text-white"
              } ${sidebarOpen ? "lg:px-3 lg:justify-start" : ""}`}
            >
              <MdGroups className="h-5 w-5 shrink-0" />
              <span
                className={
                  sidebarOpen ? "opacity-100 block" : "lg:hidden opacity-0 w-0"
                }
              >
                Importar Alunos
              </span>
            </button>
          </div>
        </nav>
        <div className="p-4 border-t border-zinc-800 shrink-0 space-y-2">
          <button
            onClick={onBack || (() => setConfirmLogoutModal(true))}
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
            onClick={() => setConfirmLogoutModal(true)}
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
              Sair da conta
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
                : activeTab === "admin_batches"
                ? "Gestão de Lotes"
                : activeTab === "admin_groups"
                ? "Alunos"
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
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11px] font-bold text-zinc-600 uppercase tracking-widest mb-2">
                    Painel
                  </p>
                  <h1 className="text-3xl font-black text-white tracking-tight">
                    Visão Geral
                  </h1>
                </div>
                <button
                  onClick={fetchAllTicketsForAdmin}
                  disabled={adminLoading}
                  className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-white transition-colors disabled:opacity-40 uppercase tracking-widest"
                >
                  {adminLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                    </svg>
                  )}
                  Atualizar
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
                <StatCard
                  title="Vendidos"
                  val={allTickets.filter((t) => t.pagamentoConfirmado).length}
                  icon={ShoppingCart}
                  pct={
                    allTickets.length > 0
                      ? (allTickets.filter((t) => t.pagamentoConfirmado)
                          .length /
                          allTickets.length) *
                        100
                      : 0
                  }
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
                  val={
                    (modoPendentes === "presenca"
                      ? allTickets.filter(
                          (t) => t.pagamentoConfirmado && !t.usado
                        )
                      : allTickets.filter((t) => !t.pagamentoConfirmado)
                    ).length
                  }
                  tot={
                    modoPendentes === "presenca"
                      ? allTickets.filter((t) => t.pagamentoConfirmado).length
                      : undefined
                  }
                  icon={Clock}
                  pct={
                    modoPendentes === "presenca"
                      ? allTickets.filter((t) => t.pagamentoConfirmado)
                          .length > 0
                        ? (allTickets.filter(
                            (t) => t.pagamentoConfirmado && !t.usado
                          ).length /
                            allTickets.filter((t) => t.pagamentoConfirmado)
                              .length) *
                          100
                        : 0
                      : allTickets.length > 0
                      ? (allTickets.filter((t) => !t.pagamentoConfirmado)
                          .length /
                          allTickets.length) *
                        100
                      : 0
                  }
                  sub={
                    modoPendentes === "presenca"
                      ? "Não compareceram ao evento"
                      : "Aguardando pagamento"
                  }
                  bgBar="bg-zinc-600"
                  onClick={() => setDashboardDetailModal("pendentes")}
                />
                <StatCard
                  title="Receita (R$)"
                  val={(() => {
                    const pagos = allTickets.filter(
                      (t) => t.pagamentoConfirmado
                    );
                    const TAXA_PIX = 0.0099;
                    const TAXA_CARTAO = 0.0498;
                    const liquido = pagos.reduce((acc, t) => {
                      const bruto = t.price || 0;
                      if (t.metodoPagamento === "cartao")
                        return acc + bruto * (1 - TAXA_CARTAO);
                      if (t.metodoPagamento === "dinheiro") return acc + bruto;
                      return acc + bruto * (1 - TAXA_PIX); // pix ou sem método = pix
                    }, 0);
                    return `R$ ${liquido.toFixed(2).replace(".", ",")}`;
                  })()}
                  icon={Banknote}
                  sub="Valor Líquido Arrecadado"
                  onClick={() => setRevenueModalOpen(true)}
                />
              </div>
            </div>
          )}

          {/* ── LISTAS DE PRESENÇA ── */}
          {activeTab === "admin_list" && (
            <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
              {!adminListYear ? (
                /* ── SELEÇÃO DE ANO ── */
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-bold text-white tracking-tight">
                        Listas de Presença
                      </h1>
                      <p className="text-zinc-500 text-sm mt-1">
                        Selecione o ano para ver as turmas
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

                  <div className="space-y-3">
                    {[1, 2, 3].map((a) => {
                      const totalAno = allTickets.filter(
                        (t) => t.ano === String(a)
                      ).length;
                      const validadosAno = allTickets.filter(
                        (t) => t.ano === String(a) && t.usado
                      ).length;
                      const pct =
                        totalAno > 0
                          ? Math.round((validadosAno / totalAno) * 100)
                          : 0;
                      return (
                        <button
                          key={a}
                          onClick={() => setAdminListYear(String(a))}
                          className="w-full group bg-[#0a0a0a] border border-zinc-800 hover:border-zinc-600 rounded-2xl p-6 flex items-center gap-6 transition-all text-left"
                        >
                          {/* Número do ano */}
                          <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 group-hover:border-zinc-600 flex items-center justify-center shrink-0 transition-colors">
                            <span className="text-2xl font-black text-white">
                              {a}
                            </span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-4 mb-3">
                              <h2 className="text-lg font-bold text-white leading-tight">
                                {a}º Ano Médio
                              </h2>
                              <div className="flex items-center gap-4 shrink-0">
                                <div className="text-right hidden sm:block">
                                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                                    Ingressos
                                  </p>
                                  <p className="text-base font-black text-white mt-0.5">
                                    {totalAno}
                                  </p>
                                </div>
                                <div className="text-right hidden sm:block">
                                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                                    Presentes
                                  </p>
                                  <p className="text-base font-black text-white mt-0.5">
                                    {validadosAno}
                                  </p>
                                </div>
                                <div className="text-right hidden sm:block">
                                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                                    Taxa
                                  </p>
                                  <p className="text-base font-black text-white mt-0.5">
                                    {pct}%
                                  </p>
                                </div>
                              </div>
                            </div>
                            {/* Barra de progresso */}
                            <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-white rounded-full transition-all duration-700"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            {/* Mobile stats */}
                            <div className="flex items-center gap-4 mt-2 sm:hidden">
                              <span className="text-xs text-zinc-500">
                                {totalAno} ingressos
                              </span>
                              <span className="text-xs text-zinc-500">
                                {validadosAno} presentes
                              </span>
                              <span className="text-xs text-zinc-500">
                                {pct}%
                              </span>
                            </div>
                          </div>

                          {/* Seta */}
                          <ChevronRight className="h-5 w-5 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                        </button>
                      );
                    })}
                  </div>

                  {/* Resumo total */}
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    {[
                      { label: "Total Vendidos", val: allTickets.length, key: "todos" },
                      {
                        label: "Entraram",
                        val: allTickets.filter((t) => t.usado).length,
                        key: "entraram",
                      },
                      {
                        label: "Pendentes",
                        val: allTickets.filter((t) => !t.usado).length,
                        key: "pendentes",
                      },
                    ].map(({ label, val, key }) => (
                      <button
                        key={label}
                        onClick={() => setPresencaListModal(key as any)}
                        className="group bg-[#0a0a0a] border border-zinc-800 hover:border-zinc-600 rounded-2xl p-4 text-center transition-all relative overflow-hidden"
                      >
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-zinc-400 transition-colors">
                          {label}
                        </p>
                        <p className="text-3xl font-black text-white mt-1">
                          {val}
                        </p>
                        <ChevronRight className="absolute bottom-3 right-3 w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : !adminListClass ? (
                /* ── SELEÇÃO DE TURMA ── */
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setAdminListYear(null)}
                      className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 rounded-xl transition-all"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h1 className="text-xl font-bold text-white">
                        {adminListYear}º Ano Médio
                      </h1>
                      <p className="text-zinc-500 text-sm">
                        {
                          allTickets.filter((t) => t.ano === adminListYear)
                            .length
                        }{" "}
                        ingressos ·{" "}
                        {
                          allTickets.filter(
                            (t) => t.ano === adminListYear && t.usado
                          ).length
                        }{" "}
                        presentes
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {Array.from({ length: 12 }, (_, i) =>
                      String.fromCharCode(65 + i)
                    ).map((t) => {
                      const total = allTickets.filter(
                        (x) => x.ano === adminListYear && x.turma === t
                      ).length;
                      const validados = allTickets.filter(
                        (x) =>
                          x.ano === adminListYear && x.turma === t && x.usado
                      ).length;
                      const pct =
                        total > 0 ? Math.round((validados / total) * 100) : 0;
                      const isEmpty = total === 0;
                      return (
                        <button
                          key={t}
                          onClick={() => setAdminListClass(t)}
                          className={`group relative bg-[#0a0a0a] border rounded-2xl p-5 flex flex-col text-left transition-all ${
                            isEmpty
                              ? "border-zinc-800/60 opacity-50 hover:opacity-80 hover:border-zinc-700"
                              : "border-zinc-800 hover:border-zinc-500"
                          }`}
                        >
                          {/* Letra da turma */}
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-2xl font-black text-white">
                              {t}
                            </span>
                            {!isEmpty && (
                              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                                {pct}%
                              </span>
                            )}
                          </div>

                          {/* Stats */}
                          <p className="text-xs text-zinc-500 mb-3">
                            {isEmpty
                              ? "0 alunos"
                              : `${validados}/${total} presentes`}
                          </p>

                          {/* Barra de progresso */}
                          <div className="w-full h-0.5 bg-zinc-900 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-white rounded-full transition-all duration-700"
                              style={{ width: isEmpty ? "0%" : `${pct}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* ── LISTA DE ALUNOS DA TURMA ── */
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setAdminListClass(null)}
                        className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 rounded-xl transition-all"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div>
                        <h1 className="text-xl font-bold text-white">
                          {adminListYear}º Ano — Turma {adminListClass}
                        </h1>
                        <p className="text-zinc-500 text-sm">
                          Presença:{" "}
                          <span className="text-white font-semibold">
                            {
                              allTickets.filter(
                                (t) =>
                                  t.ano === adminListYear &&
                                  t.turma === adminListClass &&
                                  t.usado
                              ).length
                            }
                          </span>
                          {" / "}
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
                        <Download className="w-4 h-4" /> Exportar
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

                  {/* Barra de progresso da turma */}
                  {(() => {
                    const tot = allTickets.filter(
                      (t) =>
                        t.ano === adminListYear && t.turma === adminListClass
                    ).length;
                    const val = allTickets.filter(
                      (t) =>
                        t.ano === adminListYear &&
                        t.turma === adminListClass &&
                        t.usado
                    ).length;
                    const pct = tot > 0 ? Math.round((val / tot) * 100) : 0;
                    return tot > 0 ? (
                      <div className="bg-[#0a0a0a] border border-zinc-800 rounded-2xl p-5 flex items-center gap-5">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                              Progresso de Entrada
                            </p>
                            <p className="text-sm font-black text-white">
                              {pct}%
                            </p>
                          </div>
                          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-white rounded-full transition-all duration-700"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-2xl font-black text-white">
                            {val}
                            <span className="text-lg text-zinc-600 font-medium">
                              /{tot}
                            </span>
                          </p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-0.5">
                            presentes
                          </p>
                        </div>
                      </div>
                    ) : null;
                  })()}

                  <div>
                    {allTickets.filter(
                      (t) =>
                        t.ano === adminListYear && t.turma === adminListClass
                    ).length === 0 ? (
                      <div className="p-16 text-center text-zinc-600 flex flex-col items-center gap-4">
                        <ClipboardList className="w-12 h-12 opacity-20" />
                        <p className="text-sm">Nenhum ingresso nesta turma.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
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
                {/* ── Busca rápida de aluno ── */}
                <div ref={addTicketSearchRef} className="relative">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Buscar aluno do sistema para preencher..."
                        value={addTicketStudentSearch}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAddTicketStudentSearch(v);
                          setAddTicketStudentSearchOpen(true);
                          searchStudentsForTicket(v);
                        }}
                        onFocus={() => setAddTicketStudentSearchOpen(true)}
                        className="flex h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900/60 text-white pl-10 pr-4 py-2 text-sm placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white transition-all"
                      />
                      {addTicketStudentSearchLoading && (
                        <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 animate-spin" />
                      )}
                      {addTicketStudentSearch &&
                        !addTicketStudentSearchLoading && (
                          <button
                            type="button"
                            onClick={() => {
                              setAddTicketStudentSearch("");
                              setAddTicketStudentResults([]);
                              setAddTicketStudentSearchOpen(false);
                            }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                    </div>
                  </div>

                  {/* Dropdown de resultados */}
                  {addTicketStudentSearchOpen &&
                    addTicketStudentSearch.length >= 2 && (
                      <div className="absolute z-50 top-[calc(100%+6px)] left-0 right-0 bg-[#111] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
                        {addTicketStudentResults.length === 0 &&
                        !addTicketStudentSearchLoading ? (
                          <div className="py-10 text-center text-zinc-600 flex flex-col items-center gap-2">
                            <Search className="h-6 w-6 opacity-30" />
                            <p className="text-xs">
                              Nenhum aluno encontrado para "
                              {addTicketStudentSearch}"
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                                Selecione um aluno
                              </p>
                              <span className="text-[10px] text-zinc-600">
                                {addTicketStudentResults.length} resultado(s)
                              </span>
                            </div>
                            <div className="max-h-56 overflow-y-auto divide-y divide-zinc-800/40">
                              {addTicketStudentResults.map((aluno, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => selectStudentForTicket(aluno)}
                                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-zinc-900/50 transition-colors text-left"
                                >
                                  <div>
                                    <p className="text-white font-semibold text-sm">
                                      {aluno.nome}
                                    </p>
                                    <p className="text-zinc-500 text-xs mt-0.5 font-mono">
                                      {formatCpf(aluno.cpf)}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-400">
                                      {aluno.ano || aluno.turmaId?.slice(0, 1)}º
                                      · {aluno.turma || aluno.turmaId?.slice(1)}
                                    </span>
                                    <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
                                  </div>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                </div>

                {/* Divisor */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                    ou preencha manualmente
                  </span>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>

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

                  <div className="space-y-2 sm:col-span-2">
                    <Label>Lote</Label>
                    <div className="relative">
                      <select
                        name="loteId"
                        value={addTicketForm.loteId}
                        onChange={handleAddTicketChange}
                        className={`flex h-12 w-full appearance-none rounded-xl border ${
                          addTicketErrors.loteId
                            ? "border-red-500 bg-red-500/10 text-red-100"
                            : "border-zinc-800 bg-black text-white"
                        } px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white transition-all`}
                      >
                        <option value="" disabled>
                          Selecione o lote
                        </option>
                        {batches.map((b) => (
                          <option
                            key={b.id}
                            value={b.id}
                            className="bg-zinc-900"
                          >
                            {b.nome} — R${" "}
                            {Number(b.preco).toFixed(2).replace(".", ",")}
                          </option>
                        ))}
                      </select>
                    </div>
                    {addTicketErrors.loteId && (
                      <p className="text-red-400 text-xs">
                        {addTicketErrors.loteId}
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

                {/* Toggle Pagamento Confirmado */}
                <div className="border-t border-zinc-800 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setAddTicketPago((v) => !v);
                      setAddTicketMetodoPagamento(null);
                    }}
                    className={`w-full flex items-center justify-between px-5 py-4 rounded-xl border transition-all ${
                      addTicketPago
                        ? "border-green-500/40 bg-green-500/5"
                        : "border-zinc-800 bg-black hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Banknote
                        className={`h-5 w-5 ${
                          addTicketPago ? "text-green-400" : "text-zinc-500"
                        }`}
                      />
                      <div className="text-left">
                        <p
                          className={`text-sm font-bold ${
                            addTicketPago ? "text-green-400" : "text-zinc-400"
                          }`}
                        >
                          Pagamento Confirmado
                        </p>
                        <p className="text-xs text-zinc-600 mt-0.5">
                          {addTicketPago
                            ? "Contabilizado na receita e em vendidos"
                            : "Não contabilizado até confirmar"}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                        addTicketPago ? "bg-green-500" : "bg-zinc-700"
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                          addTicketPago ? "left-6" : "left-1"
                        }`}
                      />
                    </div>
                  </button>

                  {/* Seleção de método de pagamento (só quando pago = true) */}
                  {addTicketPago && (
                    <div className="mt-3 p-4 rounded-xl border border-zinc-800 bg-black space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
                        Forma de Pagamento
                      </p>
                      <button
                        type="button"
                        onClick={() => setAddTicketMetodoPagamento("dinheiro")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold transition-all ${
                          addTicketMetodoPagamento === "dinheiro"
                            ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                            : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                        }`}
                      >
                        <Banknote className="h-4 w-4" />
                        Dinheiro
                        {addTicketMetodoPagamento === "dinheiro" && (
                          <span className="ml-auto text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Sem taxa
                          </span>
                        )}
                      </button>
                      <div className="flex items-center gap-2 py-1">
                        <div className="flex-1 h-px bg-zinc-800" />
                        <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                          ou
                        </span>
                        <div className="flex-1 h-px bg-zinc-800" />
                      </div>
                      <p className="text-[10px] text-zinc-600 text-center">
                        Não clicou em Dinheiro? O pagamento será registrado como{" "}
                        <span className="text-zinc-400 font-bold">PIX</span>{" "}
                        (taxa de 0,99%).
                      </p>
                    </div>
                  )}
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

          {/* ── GESTÃO DE LOTES ── */}
          {activeTab === "admin_batches" && (
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <IoMdAddCircleOutline className="h-6 w-6 text-white" />{" "}
                    Gestão de Lotes
                  </h1>
                  <p className="text-zinc-400 text-sm mt-1">
                    Crie e edite lotes de ingressos. Gerencie preços e
                    visibilidade.
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    onClick={() => { fetchBatches(); fetchAllTicketsForAdmin(); }}
                    isLoading={loadingBatches}
                    className="flex-1 sm:flex-none"
                  >
                    Atualizar
                  </Button>
                  <Button
                    className="flex-1 sm:flex-none"
                    onClick={() =>
                      setBatchModal({
                        nome: "",
                        preco: "",
                        quantidade: "",
                        dataLimite: "",
                        publico: "Ambos",
                      })
                    }
                  >
                    <IoMdAddCircleOutline className="w-5 h-5 mr-1" /> Criar Lote
                  </Button>
                </div>
              </div>

              {loadingBatches && batches.length === 0 ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {batches.map((batch) => {
                    const vendidos = (allTickets || []).filter(
                      (t) => t.pagamentoConfirmado && (t.loteId === batch.id || t.type === batch.nome)
                    ).length;
                    const totalNaDB = (allTickets || []).filter(
                      (t) => t.loteId === batch.id || t.type === batch.nome
                    ).length;
                    // Usa o contador persistido no lote (atualizado em toda associação/exclusão).
                    // Faz fallback para a contagem client-side enquanto não há o campo no doc.
                    const totalExibido = batch.ingressosAssociados != null
                      ? Math.max(batch.ingressosAssociados, totalNaDB)
                      : totalNaDB;
                    const limite = Number(batch.quantidade) || 0;
                    const pct = limite > 0 ? Math.min(100, (totalExibido / limite) * 100) : 0;
                    const esgotado = batch.esgotado === true || (limite > 0 && totalExibido >= limite);
                    return (
                    <div
                      key={batch.id}
                      className={`group relative flex flex-col rounded-2xl border transition-all duration-200 overflow-hidden ${
                        batch.visivel
                          ? "bg-[#0a0a0a] border-zinc-800 hover:border-zinc-600"
                          : "bg-[#0a0a0a] border-zinc-800/50 opacity-60 hover:opacity-80 hover:border-zinc-700"
                      }`}
                    >
                      {/* Topo colorido sutil */}
                      <div
                        className={`h-0.5 w-full ${
                          batch.visivel
                            ? "bg-gradient-to-r from-white/20 to-transparent"
                            : "bg-zinc-800"
                        }`}
                      />

                      <div className="p-5 flex flex-col gap-4 flex-1">
                        {/* Header: nome + preço */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold text-base leading-tight truncate">
                              {batch.nome}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <div
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  batch.visivel ? "bg-green-400" : "bg-zinc-600"
                                }`}
                              />
                              <span
                                className={`text-[10px] font-bold uppercase tracking-widest ${
                                  batch.visivel
                                    ? "text-green-400"
                                    : "text-zinc-600"
                                }`}
                              >
                                {batch.visivel ? "Visível" : "Oculto"}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xl font-black text-white tabular-nums">
                              R${" "}
                              {Number(batch.preco).toFixed(2).replace(".", ",")}
                            </p>
                            <p className="text-[10px] text-zinc-600 mt-0.5">
                              por ingresso
                            </p>
                          </div>
                        </div>

                        {/* Pills de info */}
                        <div className="flex flex-wrap gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 font-medium">
                            <Ticket className="w-3 h-3" /> {totalExibido}/{batch.quantidade}{" "}
                            ingressos
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 font-medium">
                            <User className="w-3 h-3" />{" "}
                            {batch.publico || "Ambos"}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 font-medium">
                            <GraduationCap className="w-3 h-3" />
                            {!batch.turmasVisiveis ||
                            batch.turmasVisiveis.length === 36
                              ? "Todas as turmas"
                              : batch.turmasVisiveis.length === 0
                              ? "Nenhuma turma"
                              : batch.turmasVisiveis.length <= 4
                              ? batch.turmasVisiveis.join(", ")
                              : `${batch.turmasVisiveis.length} turmas`}
                          </span>
                          {batch.esgotado && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-[11px] text-red-400 font-bold">
                              Esgotado
                            </span>
                          )}
                          {batch.dataLimite && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 font-medium">
                              <Clock className="w-3 h-3" />{" "}
                              {formatDate(batch.dataLimite)}
                            </span>
                          )}
                        </div>

                        {/* Progresso de vendas */}
                        {limite > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-zinc-400 font-medium">
                                Ingressos
                              </span>
                              <span
                                className={`tabular-nums font-bold ${
                                  esgotado
                                    ? "text-red-400"
                                    : pct >= 80
                                    ? "text-amber-400"
                                    : "text-white"
                                }`}
                              >
                                {totalExibido}/{limite}
                                {esgotado && " · Esgotado"}
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  esgotado
                                    ? "bg-red-500"
                                    : pct >= 80
                                    ? "bg-amber-400"
                                    : "bg-green-500"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}



                        {/* Ações */}
                        <div className="flex items-center gap-2 pt-1 mt-auto">
                          <button
                            onClick={() => setBatchModal(batch)}
                            className="flex-1 h-9 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 text-xs font-semibold hover:bg-zinc-800 hover:text-white hover:border-zinc-700 transition-all"
                          >
                            Editar
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const novo = !batch.bloqueado;
                                await updateDoc(doc(db, "lotes", batch.id), {
                                  bloqueado: novo,
                                });
                                setBatches((prev) =>
                                  prev.map((b) =>
                                    b.id === batch.id ? { ...b, bloqueado: novo } : b
                                  )
                                );
                                showToast(
                                  novo
                                    ? "Lote bloqueado para alunos."
                                    : "Lote desbloqueado.",
                                  "success"
                                );
                              } catch {
                                showToast("Erro ao alterar bloqueio do lote.");
                              }
                            }}
                            title={
                              batch.bloqueado ? "Desbloquear lote" : "Bloquear lote"
                            }
                            className={`h-9 w-9 flex items-center justify-center rounded-xl border transition-all shrink-0 ${
                              batch.bloqueado
                                ? "border-red-500/40 bg-red-500/10 text-red-400 hover:text-red-300"
                                : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-white hover:border-zinc-600"
                            }`}
                          >
                            {batch.bloqueado ? (
                              <Lock size={15} />
                            ) : (
                              <Unlock size={15} />
                            )}
                          </button>
                          <button
                            onClick={() => setConfirmVisibilityModal(batch)}
                            title={
                              batch.visivel ? "Ocultar lote" : "Tornar visível"
                            }
                            className={`h-9 w-9 flex items-center justify-center rounded-xl border transition-all shrink-0 ${
                              batch.visivel
                                ? "border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-white hover:border-zinc-600"
                                : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-white"
                            }`}
                          >
                            {batch.visivel ? (
                              <IoEyeOutline size={15} />
                            ) : (
                              <AiOutlineEyeInvisible size={15} />
                            )}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteBatch(batch)}
                            title="Excluir lote"
                            className="h-9 w-9 flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-all shrink-0"
                          >
                            <Trash2 size={15} />
                          </button>

                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {/* ── ALUNOS (sub-abas) ── */}
          {activeTab === "admin_groups" && (
            <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Sub-tab bar */}
              <div className="flex gap-1 bg-[#0a0a0a] border border-zinc-800 rounded-2xl p-1">
                {(
                  [
                    { key: "import", label: "Importar", icon: FileUp },
                    { key: "manual", label: "Cadastro Manual", icon: UserPlus },
                    { key: "search", label: "Pesquisar Alunos", icon: Search },
                    { key: "classes", label: "Turmas", icon: MdGroups },
                    { key: "responsaveis", label: "Responsáveis", icon: User },
                  ] as {
                    key:
                      | "import"
                      | "manual"
                      | "search"
                      | "classes"
                      | "responsaveis";
                    label: string;
                    icon: any;
                  }[]
                ).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => {
                      setGroupsSubTab(key);
                      if (key === "search") {
                        setStudentSearch("");
                        setStudentResults([]);
                      }
                      if (key !== "manual") {
                        setManualType(null);
                      }
                      if (key === "classes") {
                        setClassesYear(null);
                        setClassesClass(null);
                        setClassesWithStudents([]);
                        fetchBatches();
                      }
                      if (key === "responsaveis") {
                        setResponsavelSearch("");
                        setResponsavelResults([]);
                        fetchBatches();
                        fetchAllResponsaveis();
                      }
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-xs font-semibold transition-all ${
                      groupsSubTab === key
                        ? "bg-white text-black"
                        : "text-zinc-500 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>

              {/* ── SUB-ABA: IMPORTAR ── */}
              {groupsSubTab === "import" && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                      <FileUp className="h-6 w-6 text-white" /> Importar
                    </h1>
                    <p className="text-zinc-400 text-sm mt-1">
                      Importe planilhas para cadastrar alunos ou responsáveis em
                      massa.
                    </p>
                  </div>

                  {/* Toggle Alunos / Pais */}
                  <div className="flex gap-1 bg-zinc-900/60 border border-zinc-800 rounded-xl p-1">
                    {(["alunos", "pais"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => {
                          setImportSubTab(tab);
                          if (tab === "alunos") {
                            setImportParentFiles([]);
                            setImportParentPreview([]);
                            setImportParentErrors([]);
                            setImportParentResult(null);
                            setImportParentTypeErrors([]);
                          } else {
                            setImportFiles([]);
                            setImportPreview([]);
                            setImportErrors([]);
                            setImportResult(null);
                            setImportTypeErrors([]);
                          }
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-xs font-bold transition-all ${
                          importSubTab === tab
                            ? "bg-white text-black"
                            : "text-zinc-500 hover:text-white"
                        }`}
                      >
                        {tab === "alunos" ? (
                          <GraduationCap className="h-3.5 w-3.5" />
                        ) : (
                          <User className="h-3.5 w-3.5" />
                        )}
                        {tab === "alunos" ? "Alunos" : "Responsáveis"}
                      </button>
                    ))}
                  </div>

                  {/* ── IMPORTAR ALUNOS ── */}
                  {importSubTab === "alunos" && (
                    <>
                      {/* Card de instruções */}
                      <div className="bg-[#0a0a0a] border border-zinc-800 rounded-2xl p-5 flex gap-4">
                        <Info className="h-5 w-5 text-zinc-500 shrink-0 mt-0.5" />
                        <div className="space-y-2 text-sm text-zinc-400">
                          <p className="font-semibold text-white">
                            Como preparar o arquivo:
                          </p>
                          <p>
                            Salve a planilha como{" "}
                            <span className="text-white font-semibold">
                              .xlsx
                            </span>{" "}
                            (Excel) ou{" "}
                            <span className="text-white font-semibold">
                              .csv
                            </span>
                            . A primeira linha deve ser o cabeçalho com as
                            colunas:
                          </p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {["ano", "turma", "nome", "cpf"].map((col) => (
                              <span
                                key={col}
                                className="font-mono text-xs bg-zinc-900 border border-zinc-700 px-2.5 py-1 rounded-lg text-zinc-300"
                              >
                                {col}
                              </span>
                            ))}
                          </div>
                          <ul className="space-y-1 text-zinc-500 text-xs mt-2 list-disc list-inside">
                            <li>
                              <span className="text-zinc-400">ano</span> — ano
                              escolar (1, 2 ou 3)
                            </li>
                            <li>
                              <span className="text-zinc-400">turma</span> —
                              letra da turma (A até L)
                            </li>
                            <li>
                              <span className="text-zinc-400">nome</span> — nome
                              completo do aluno
                            </li>
                            <li>
                              <span className="text-zinc-400">cpf</span> — CPF
                              somente números (11 dígitos)
                            </li>
                          </ul>
                          <p className="text-zinc-600 text-xs">
                            Múltiplas planilhas podem ser importadas ao mesmo
                            tempo. Alunos com CPF já cadastrado são ignorados.
                          </p>
                        </div>
                      </div>

                      {/* Zona de drag & drop */}
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setImportDragActive(true);
                        }}
                        onDragLeave={() => setImportDragActive(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setImportDragActive(false);
                          if (e.dataTransfer.files.length > 0)
                            handleImportFilesChange(e.dataTransfer.files);
                        }}
                        onClick={() => importFileRef.current?.click()}
                        className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 cursor-pointer transition-all ${
                          importDragActive
                            ? "border-white bg-white/5"
                            : importFiles.length > 0
                            ? "border-zinc-600 bg-[#0a0a0a]"
                            : "border-zinc-800 bg-[#0a0a0a] hover:border-zinc-600 hover:bg-zinc-900/20"
                        }`}
                      >
                        <input
                          ref={importFileRef}
                          type="file"
                          accept=".csv,.xlsx"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0)
                              handleImportFilesChange(e.target.files);
                          }}
                        />
                        {importFiles.length > 0 ? (
                          <>
                            <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                              <FileSpreadsheet className="h-7 w-7 text-white" />
                            </div>
                            <div className="text-center">
                              {importFiles.length === 1 ? (
                                <>
                                  <p className="text-white font-semibold text-sm">
                                    {importFiles[0].name}
                                  </p>
                                  <p className="text-zinc-500 text-xs mt-1">
                                    {(importFiles[0].size / 1024).toFixed(1)} KB
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="text-white font-semibold text-sm">
                                    {importFiles.length} arquivos selecionados
                                  </p>
                                  <div className="mt-2 space-y-0.5 max-h-24 overflow-y-auto">
                                    {importFiles.map((f, i) => (
                                      <p
                                        key={i}
                                        className="text-zinc-500 text-xs font-mono"
                                      >
                                        {f.name}{" "}
                                        <span className="text-zinc-700">
                                          ({(f.size / 1024).toFixed(1)} KB)
                                        </span>
                                      </p>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setImportFiles([]);
                                setImportPreview([]);
                                setImportErrors([]);
                                setImportResult(null);
                                setImportTypeErrors([]);
                              }}
                              className="text-xs text-zinc-500 hover:text-white transition-colors underline underline-offset-2"
                            >
                              Remover arquivo(s)
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                              <FileUp className="h-7 w-7 text-zinc-500" />
                            </div>
                            <div className="text-center">
                              <p className="text-white font-semibold text-sm">
                                Arraste os arquivos aqui
                              </p>
                              <p className="text-zinc-500 text-xs mt-1">
                                ou clique para selecionar — somente .csv ou
                                .xlsx
                              </p>
                              <p className="text-zinc-600 text-xs mt-0.5">
                                Múltiplos arquivos permitidos
                              </p>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Erros de tipo de arquivo */}
                      {importTypeErrors.length > 0 && (
                        <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-5 animate-in fade-in duration-200">
                          <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="h-4 w-4 text-orange-400" />
                            <p className="text-sm font-bold text-orange-400">
                              Arquivo(s) não aceito(s)
                            </p>
                          </div>
                          <ul className="space-y-1">
                            {importTypeErrors.map((err, i) => (
                              <li
                                key={i}
                                className="text-xs text-orange-300 font-mono"
                              >
                                {err}
                              </li>
                            ))}
                          </ul>
                          <p className="text-xs text-zinc-500 mt-3">
                            Apenas arquivos{" "}
                            <span className="text-zinc-300 font-semibold">
                              .csv
                            </span>{" "}
                            e{" "}
                            <span className="text-zinc-300 font-semibold">
                              .xlsx
                            </span>{" "}
                            são suportados.
                          </p>
                        </div>
                      )}

                      {/* Preview dos dados */}
                      {importPreview.length > 0 && (
                        <div className="bg-[#0a0a0a] border border-zinc-800 rounded-2xl overflow-hidden animate-in fade-in duration-200">
                          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                            <p className="text-sm font-bold text-white">
                              Pré-visualização
                            </p>
                            <span className="text-xs text-zinc-500">
                              {importPreview.length} registros
                            </span>
                          </div>
                          <div
                            className="overflow-y-auto"
                            style={{
                              maxHeight: "480px",
                              scrollbarWidth: "thin",
                              scrollbarColor: "#3f3f46 transparent",
                            }}
                          >
                            <table className="w-full text-sm border-collapse">
                              <colgroup>
                                <col style={{ width: "40px" }} />
                                <col style={{ width: "64px" }} />
                                <col style={{ width: "80px" }} />
                                <col />
                                <col style={{ width: "160px" }} />
                                <col style={{ width: "44px" }} />
                              </colgroup>
                              <thead className="sticky top-0 bg-[#0a0a0a] z-10">
                                <tr className="border-b border-zinc-800">
                                  <th className="text-left pl-5 pr-3 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                                    #
                                  </th>
                                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-l border-zinc-800/60">
                                    Ano
                                  </th>
                                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-l border-zinc-800/60">
                                    Turma
                                  </th>
                                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-l border-zinc-800/60">
                                    Nome
                                  </th>
                                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-l border-zinc-800/60">
                                    CPF
                                  </th>
                                  <th className="px-3 py-3 border-l border-zinc-800/60"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {importPreview.map((row, i) => {
                                  const err = validateRow(row, row._row);
                                  return (
                                    <tr
                                      key={i}
                                      className={`border-b border-zinc-800/30 last:border-0 hover:bg-zinc-900/30 transition-colors ${
                                        err ? "bg-red-500/5" : ""
                                      }`}
                                    >
                                      <td className="pl-5 pr-3 py-3 text-[11px] font-mono text-zinc-600 tabular-nums">
                                        {i + 1}
                                      </td>
                                      <td className="px-4 py-3 font-mono text-zinc-400 text-xs border-l border-zinc-800/40">
                                        {row.ano || "—"}
                                      </td>
                                      <td className="px-4 py-3 font-mono text-zinc-400 text-xs border-l border-zinc-800/40">
                                        {row.turma || "—"}
                                      </td>
                                      <td className="px-4 py-3 text-white font-medium border-l border-zinc-800/40">
                                        {row.nome || "—"}
                                      </td>
                                      <td className="px-4 py-3 font-mono text-zinc-500 text-xs border-l border-zinc-800/40 tabular-nums">
                                        {row.cpf
                                          ? `${row.cpf.slice(
                                              0,
                                              3
                                            )}.${row.cpf.slice(
                                              3,
                                              6
                                            )}.${row.cpf.slice(
                                              6,
                                              9
                                            )}-${row.cpf.slice(9)}`
                                          : "—"}
                                      </td>
                                      <td className="px-3 py-3 border-l border-zinc-800/40">
                                        {err ? (
                                          <XCircle className="h-3.5 w-3.5 text-red-400/70" />
                                        ) : (
                                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Erros de validação */}
                      {importErrors.length > 0 && (
                        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 animate-in fade-in duration-200">
                          <div className="flex items-center gap-2 mb-3">
                            <XCircle className="h-4 w-4 text-red-400" />
                            <p className="text-sm font-bold text-red-400">
                              {importErrors.length} erro(s) encontrado(s)
                            </p>
                          </div>
                          <ul className="space-y-1 max-h-32 overflow-y-auto">
                            {importErrors.map((err, i) => (
                              <li
                                key={i}
                                className="text-xs text-red-300 font-mono"
                              >
                                {err}
                              </li>
                            ))}
                          </ul>
                          <p className="text-xs text-zinc-500 mt-3">
                            Corrija os erros no arquivo e reimporte para
                            continuar.
                          </p>
                        </div>
                      )}

                      {/* Resultado da importação */}
                      {importResult && (
                        <div className="bg-[#0a0a0a] border border-zinc-800 rounded-2xl p-6 animate-in zoom-in-95 duration-200">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                              <CheckCircle className="h-4 w-4 text-zinc-300" />
                            </div>
                            <div>
                              <p className="text-white font-semibold text-sm">
                                Importação concluída
                              </p>
                              <p className="text-zinc-600 text-xs">
                                Alunos cadastrados no Firebase
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 divide-x divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
                            <div className="p-4 text-center">
                              <p className="text-2xl font-black text-white tabular-nums">
                                {importResult.success}
                              </p>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">
                                Cadastrados
                              </p>
                            </div>
                            <div className="p-4 text-center">
                              <p className="text-2xl font-black text-zinc-400 tabular-nums">
                                {importResult.duplicates}
                              </p>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mt-1">
                                Duplicatas
                              </p>
                            </div>
                            <div className="p-4 text-center">
                              <p className="text-2xl font-black text-zinc-400 tabular-nums">
                                {importResult.failed}
                              </p>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mt-1">
                                Falhas
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setImportFiles([]);
                              setImportPreview([]);
                              setImportErrors([]);
                              setImportResult(null);
                              setImportTypeErrors([]);
                            }}
                            className="w-full mt-4 h-11 rounded-xl border border-zinc-800 bg-transparent text-zinc-500 text-sm font-medium hover:bg-zinc-900 hover:text-white transition-all"
                          >
                            Importar outra planilha
                          </button>
                        </div>
                      )}

                      {/* Botão importar */}
                      {importFiles.length > 0 &&
                        importErrors.length === 0 &&
                        !importResult && (
                          <button
                            onClick={handleImportSubmit}
                            disabled={importLoading}
                            className="w-full h-14 rounded-2xl bg-white text-black text-sm font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                          >
                            {importLoading ? (
                              <>
                                <Loader2 className="h-5 w-5 animate-spin" />{" "}
                                Importando alunos...
                              </>
                            ) : (
                              <>
                                <FileUp className="h-5 w-5" /> Importar{" "}
                                {importFiles.length > 1
                                  ? `${importFiles.length} Planilhas`
                                  : "Alunos"}
                              </>
                            )}
                          </button>
                        )}
                    </>
                  )}

                  {/* ── IMPORTAR PAIS/RESPONSÁVEIS ── */}
                  {importSubTab === "pais" && (
                    <>
                      {/* Card de instruções */}
                      <div className="bg-[#0a0a0a] border border-zinc-800 rounded-2xl p-5 flex gap-4">
                        <Info className="h-5 w-5 text-zinc-500 shrink-0 mt-0.5" />
                        <div className="space-y-2 text-sm text-zinc-400">
                          <p className="font-semibold text-white">
                            Como preparar o arquivo:
                          </p>
                          <p>
                            A planilha deve ter as colunas abaixo. O sistema
                            tentará vincular automaticamente ao aluno pelo nome
                            e turma.
                          </p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {[
                              "Responsavel",
                              "CPF",
                              "Nome do Aluno",
                              "Ano",
                              "Turma",
                            ].map((col) => (
                              <span
                                key={col}
                                className="font-mono text-xs bg-zinc-900 border border-zinc-700 px-2.5 py-1 rounded-lg text-zinc-300"
                              >
                                {col}
                              </span>
                            ))}
                          </div>
                          <ul className="space-y-1 text-zinc-500 text-xs mt-2 list-disc list-inside">
                            <li>
                              <span className="text-zinc-400">Responsavel</span>{" "}
                              — nome do pai/mãe/responsável
                            </li>
                            <li>
                              <span className="text-zinc-400">CPF</span> — CPF
                              do responsável (com ou sem pontuação)
                            </li>
                            <li>
                              <span className="text-zinc-400">
                                Nome do Aluno
                              </span>{" "}
                              — nome do aluno já cadastrado no sistema
                            </li>
                            <li>
                              <span className="text-zinc-400">Ano</span> — ano
                              escolar do aluno (1, 2 ou 3)
                            </li>
                            <li>
                              <span className="text-zinc-400">Turma</span> —
                              letra da turma do aluno (A até L)
                            </li>
                          </ul>
                          <p className="text-zinc-600 text-xs">
                            Se o aluno não for encontrado, o responsável é
                            cadastrado sem vínculo. Responsáveis com CPF já
                            cadastrado são ignorados.
                          </p>
                        </div>
                      </div>

                      {/* Zona de drag & drop - Pais */}
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setImportParentDragActive(true);
                        }}
                        onDragLeave={() => setImportParentDragActive(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setImportParentDragActive(false);
                          if (e.dataTransfer.files.length > 0)
                            handleImportParentFilesChange(e.dataTransfer.files);
                        }}
                        onClick={() => importParentFileRef.current?.click()}
                        className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 cursor-pointer transition-all ${
                          importParentDragActive
                            ? "border-white bg-white/5"
                            : importParentFiles.length > 0
                            ? "border-zinc-600 bg-[#0a0a0a]"
                            : "border-zinc-800 bg-[#0a0a0a] hover:border-zinc-600 hover:bg-zinc-900/20"
                        }`}
                      >
                        <input
                          ref={importParentFileRef}
                          type="file"
                          accept=".csv,.xlsx"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0)
                              handleImportParentFilesChange(e.target.files);
                          }}
                        />
                        {importParentFiles.length > 0 ? (
                          <>
                            <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                              <FileSpreadsheet className="h-7 w-7 text-white" />
                            </div>
                            <div className="text-center">
                              {importParentFiles.length === 1 ? (
                                <>
                                  <p className="text-white font-semibold text-sm">
                                    {importParentFiles[0].name}
                                  </p>
                                  <p className="text-zinc-500 text-xs mt-1">
                                    {(importParentFiles[0].size / 1024).toFixed(
                                      1
                                    )}{" "}
                                    KB
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="text-white font-semibold text-sm">
                                    {importParentFiles.length} arquivos
                                    selecionados
                                  </p>
                                  <div className="mt-2 space-y-0.5 max-h-24 overflow-y-auto">
                                    {importParentFiles.map((f, i) => (
                                      <p
                                        key={i}
                                        className="text-zinc-500 text-xs font-mono"
                                      >
                                        {f.name}{" "}
                                        <span className="text-zinc-700">
                                          ({(f.size / 1024).toFixed(1)} KB)
                                        </span>
                                      </p>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setImportParentFiles([]);
                                setImportParentPreview([]);
                                setImportParentErrors([]);
                                setImportParentResult(null);
                                setImportParentTypeErrors([]);
                              }}
                              className="text-xs text-zinc-500 hover:text-white transition-colors underline underline-offset-2"
                            >
                              Remover arquivo(s)
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                              <FileUp className="h-7 w-7 text-zinc-500" />
                            </div>
                            <div className="text-center">
                              <p className="text-white font-semibold text-sm">
                                Arraste os arquivos aqui
                              </p>
                              <p className="text-zinc-500 text-xs mt-1">
                                ou clique para selecionar — somente .csv ou
                                .xlsx
                              </p>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Erros de tipo */}
                      {importParentTypeErrors.length > 0 && (
                        <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-5 animate-in fade-in duration-200">
                          <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="h-4 w-4 text-orange-400" />
                            <p className="text-sm font-bold text-orange-400">
                              Arquivo(s) não aceito(s)
                            </p>
                          </div>
                          <ul className="space-y-1">
                            {importParentTypeErrors.map((err, i) => (
                              <li
                                key={i}
                                className="text-xs text-orange-300 font-mono"
                              >
                                {err}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Preview */}
                      {importParentPreview.length > 0 && (
                        <div className="bg-[#0a0a0a] border border-zinc-800 rounded-2xl overflow-hidden animate-in fade-in duration-200">
                          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                            <p className="text-sm font-bold text-white">
                              Pré-visualização
                            </p>
                            <span className="text-xs text-zinc-500">
                              {importParentPreview.length} registros
                            </span>
                          </div>
                          <div
                            className="overflow-y-auto"
                            style={{
                              maxHeight: "400px",
                              scrollbarWidth: "thin",
                              scrollbarColor: "#3f3f46 transparent",
                            }}
                          >
                            <table className="w-full text-sm border-collapse">
                              <thead className="sticky top-0 bg-[#0a0a0a] z-10">
                                <tr className="border-b border-zinc-800">
                                  <th className="text-left pl-5 pr-3 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                                    #
                                  </th>
                                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-l border-zinc-800/60">
                                    Responsável
                                  </th>
                                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-l border-zinc-800/60">
                                    CPF
                                  </th>
                                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-l border-zinc-800/60">
                                    Aluno
                                  </th>
                                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-l border-zinc-800/60">
                                    Turma
                                  </th>
                                  <th className="px-3 py-3 border-l border-zinc-800/60"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {importParentPreview.map((row, i) => {
                                  const err = validateParentRow(row, row._row);
                                  return (
                                    <tr
                                      key={i}
                                      className={`border-b border-zinc-800/30 last:border-0 hover:bg-zinc-900/30 transition-colors ${
                                        err ? "bg-red-500/5" : ""
                                      }`}
                                    >
                                      <td className="pl-5 pr-3 py-3 text-[11px] font-mono text-zinc-600">
                                        {i + 1}
                                      </td>
                                      <td className="px-4 py-3 text-white font-medium border-l border-zinc-800/40">
                                        {row.nome || "—"}
                                      </td>
                                      <td className="px-4 py-3 font-mono text-zinc-500 text-xs border-l border-zinc-800/40">
                                        {row.cpf ? formatCpf(row.cpf) : "—"}
                                      </td>
                                      <td className="px-4 py-3 text-zinc-300 text-sm border-l border-zinc-800/40">
                                        {row.nomeAluno || "—"}
                                      </td>
                                      <td className="px-4 py-3 font-mono text-zinc-400 text-xs border-l border-zinc-800/40">
                                        {row.ano && row.turma
                                          ? `${row.ano}${row.turma}`
                                          : "—"}
                                      </td>
                                      <td className="px-3 py-3 border-l border-zinc-800/40">
                                        {err ? (
                                          <XCircle className="h-3.5 w-3.5 text-red-400/70" />
                                        ) : (
                                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Erros de validação */}
                      {importParentErrors.length > 0 && (
                        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 animate-in fade-in duration-200">
                          <div className="flex items-center gap-2 mb-3">
                            <XCircle className="h-4 w-4 text-red-400" />
                            <p className="text-sm font-bold text-red-400">
                              {importParentErrors.length} erro(s) encontrado(s)
                            </p>
                          </div>
                          <ul className="space-y-1 max-h-32 overflow-y-auto">
                            {importParentErrors.map((err, i) => (
                              <li
                                key={i}
                                className="text-xs text-red-300 font-mono"
                              >
                                {err}
                              </li>
                            ))}
                          </ul>
                          <p className="text-xs text-zinc-500 mt-3">
                            Corrija os erros no arquivo e reimporte para
                            continuar.
                          </p>
                        </div>
                      )}

                      {/* Resultado */}
                      {importParentResult && (
                        <div className="bg-[#0a0a0a] border border-zinc-800 rounded-2xl p-6 animate-in zoom-in-95 duration-200">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                              <CheckCircle className="h-4 w-4 text-zinc-300" />
                            </div>
                            <div>
                              <p className="text-white font-semibold text-sm">
                                Importação concluída
                              </p>
                              <p className="text-zinc-600 text-xs">
                                Responsáveis cadastrados no Firebase
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 divide-x divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
                            <div className="p-4 text-center">
                              <p className="text-2xl font-black text-white tabular-nums">
                                {importParentResult.success}
                              </p>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">
                                Cadastrados
                              </p>
                            </div>
                            <div className="p-4 text-center">
                              <p className="text-2xl font-black text-zinc-400 tabular-nums">
                                {importParentResult.duplicates}
                              </p>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mt-1">
                                Duplicatas
                              </p>
                            </div>
                            <div className="p-4 text-center">
                              <p className="text-2xl font-black text-yellow-400 tabular-nums">
                                {importParentResult.semAluno}
                              </p>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mt-1">
                                Sem vínculo
                              </p>
                            </div>
                            <div className="p-4 text-center">
                              <p className="text-2xl font-black text-zinc-400 tabular-nums">
                                {importParentResult.failed}
                              </p>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mt-1">
                                Falhas
                              </p>
                            </div>
                          </div>
                          {importParentResult.semAluno > 0 && (
                            <div className="mt-3 flex items-start gap-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                              <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                              <p className="text-xs text-yellow-300">
                                {importParentResult.semAluno} responsável(is)
                                foram cadastrados sem vínculo com aluno porque o
                                nome ou turma não coincidiu com registros
                                existentes. Você pode editar o vínculo
                                manualmente na aba Responsáveis.
                              </p>
                            </div>
                          )}
                          <button
                            onClick={() => {
                              setImportParentFiles([]);
                              setImportParentPreview([]);
                              setImportParentErrors([]);
                              setImportParentResult(null);
                              setImportParentTypeErrors([]);
                            }}
                            className="w-full mt-4 h-11 rounded-xl border border-zinc-800 bg-transparent text-zinc-500 text-sm font-medium hover:bg-zinc-900 hover:text-white transition-all"
                          >
                            Importar outra planilha
                          </button>
                        </div>
                      )}

                      {/* Botão importar */}
                      {importParentFiles.length > 0 &&
                        importParentErrors.length === 0 &&
                        !importParentResult && (
                          <button
                            onClick={handleImportParentSubmit}
                            disabled={importParentLoading}
                            className="w-full h-14 rounded-2xl bg-white text-black text-sm font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                          >
                            {importParentLoading ? (
                              <>
                                <Loader2 className="h-5 w-5 animate-spin" />{" "}
                                Importando responsáveis...
                              </>
                            ) : (
                              <>
                                <FileUp className="h-5 w-5" /> Importar{" "}
                                {importParentFiles.length > 1
                                  ? `${importParentFiles.length} Planilhas`
                                  : "Responsáveis"}
                              </>
                            )}
                          </button>
                        )}
                    </>
                  )}
                </div>
              )}

              {/* ── SUB-ABA: CADASTRO MANUAL ── */}
              {groupsSubTab === "manual" && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                      <UserPlus className="h-6 w-6 text-white" /> Cadastro
                      Manual
                    </h1>
                    <p className="text-zinc-400 text-sm mt-1">
                      Selecione o tipo de cadastro para continuar.
                    </p>
                  </div>

                  {/* Seletor de tipo */}
                  {!manualType && (
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => {
                          setManualType("aluno");
                          setManualSuccessSala(null);
                          setManualForm(emptyManualForm);
                          setManualErrors({});
                        }}
                        className="group bg-[#0a0a0a] border border-zinc-800 rounded-2xl p-6 flex flex-col items-center gap-4 hover:border-zinc-600 hover:bg-zinc-900/40 transition-all duration-200 text-left"
                      >
                        <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:border-zinc-600 transition-all">
                          <GraduationCap className="h-7 w-7 text-white" />
                        </div>
                        <div className="text-center">
                          <p className="text-white font-bold text-sm">Aluno</p>
                          <p className="text-zinc-500 text-xs mt-1">
                            Cadastrar um aluno manualmente
                          </p>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setManualType("pai");
                          setParentSuccess(null);
                          setParentForm(emptyParentForm);
                          setParentErrors({});
                          setParentAssociatedStudent(null);
                          setParentStudentSearch("");
                          setParentStudentResults([]);
                        }}
                        className="group bg-[#0a0a0a] border border-zinc-800 rounded-2xl p-6 flex flex-col items-center gap-4 hover:border-zinc-600 hover:bg-zinc-900/40 transition-all duration-200 text-left"
                      >
                        <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:border-zinc-600 transition-all">
                          <User className="h-7 w-7 text-white" />
                        </div>
                        <div className="text-center">
                          <p className="text-white font-bold text-sm">
                            Pai / Responsável
                          </p>
                          <p className="text-zinc-500 text-xs mt-1">
                            Cadastrar e associar a um aluno
                          </p>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Botão voltar ao seletor */}
                  {manualType && (
                    <button
                      onClick={() => setManualType(null)}
                      className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-semibold transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Alterar tipo de cadastro
                    </button>
                  )}

                  {/* ── FORM: ALUNO ── */}
                  {manualType === "aluno" && (
                    <>
                      {/* Feedback da última sala cadastrada */}
                      {manualSuccessSala && (
                        <div className="bg-emerald-950/60 border border-emerald-800/60 rounded-2xl px-5 py-4 flex items-center gap-3">
                          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                          <p className="text-emerald-300 text-sm">
                            Aluno associado à sala{" "}
                            <span className="font-bold">
                              {manualSuccessSala}
                            </span>
                            . Você pode cadastrar outro abaixo.
                          </p>
                        </div>
                      )}

                      <div className="bg-[#0a0a0a] border border-zinc-800 rounded-2xl overflow-hidden">
                        {/* Preview da sala */}
                        {manualForm.ano && manualForm.turma && (
                          <div className="bg-white/5 border-b border-zinc-800 px-5 py-3 flex items-center gap-2">
                            <MdGroups className="h-4 w-4 text-zinc-400" />
                            <span className="text-zinc-400 text-sm">
                              Será associado à sala{" "}
                              <span className="text-white font-bold">
                                {manualForm.ano}
                                {manualForm.turma}
                              </span>
                            </span>
                          </div>
                        )}

                        <div className="p-5 space-y-4">
                          {/* Nome */}
                          <div className="space-y-1.5">
                            <Label>
                              Nome do Aluno{" "}
                              <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              name="nomeAluno"
                              value={manualForm.nomeAluno}
                              onChange={handleManualFormChange}
                              placeholder="Nome completo do aluno"
                              error={!!manualErrors.nomeAluno}
                            />
                            {manualErrors.nomeAluno && (
                              <p className="text-red-400 text-xs flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                {manualErrors.nomeAluno}
                              </p>
                            )}
                          </div>

                          {/* Ano + Turma */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label>
                                Ano <span className="text-red-500">*</span>
                              </Label>
                              <select
                                name="ano"
                                value={manualForm.ano}
                                onChange={handleManualFormChange}
                                className={`flex h-12 w-full rounded-xl border px-4 py-2 text-sm bg-black text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white transition-all appearance-none ${
                                  manualErrors.ano
                                    ? "border-red-500 bg-red-500/10 text-red-100"
                                    : "border-zinc-800"
                                }`}
                              >
                                <option value="">Selecione</option>
                                {["1", "2", "3"].map((a) => (
                                  <option key={a} value={a}>
                                    {a}º Ano
                                  </option>
                                ))}
                              </select>
                              {manualErrors.ano && (
                                <p className="text-red-400 text-xs flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3 shrink-0" />
                                  {manualErrors.ano}
                                </p>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              <Label>
                                Turma <span className="text-red-500">*</span>
                              </Label>
                              <select
                                name="turma"
                                value={manualForm.turma}
                                onChange={handleManualFormChange}
                                className={`flex h-12 w-full rounded-xl border px-4 py-2 text-sm bg-black text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white transition-all appearance-none ${
                                  manualErrors.turma
                                    ? "border-red-500 bg-red-500/10 text-red-100"
                                    : "border-zinc-800"
                                }`}
                              >
                                <option value="">Selecione</option>
                                {Array.from({ length: 12 }, (_, i) =>
                                  String.fromCharCode(65 + i)
                                ).map((t) => (
                                  <option key={t} value={t}>
                                    Turma {t}
                                  </option>
                                ))}
                              </select>
                              {manualErrors.turma && (
                                <p className="text-red-400 text-xs flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3 shrink-0" />
                                  {manualErrors.turma}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* CPF */}
                          <div className="space-y-1.5">
                            <Label>
                              CPF <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              name="cpf"
                              value={manualForm.cpf}
                              onChange={handleManualFormChange}
                              placeholder="000.000.000-00"
                              inputMode="numeric"
                              error={!!manualErrors.cpf}
                            />
                            {manualErrors.cpf && (
                              <p className="text-red-400 text-xs flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                {manualErrors.cpf}
                              </p>
                            )}
                          </div>

                          {/* Divisor opcional */}
                          <div className="flex items-center gap-3 py-1">
                            <div className="flex-1 h-px bg-zinc-800" />
                            <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
                              Opcional
                            </span>
                            <div className="flex-1 h-px bg-zinc-800" />
                          </div>

                          {/* E-mail */}
                          <div className="space-y-1.5">
                            <Label>E-mail</Label>
                            <Input
                              name="email"
                              value={manualForm.email}
                              onChange={handleManualFormChange}
                              placeholder="aluno@email.com"
                              type="email"
                              error={!!manualErrors.email}
                            />
                            {manualErrors.email && (
                              <p className="text-red-400 text-xs flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                {manualErrors.email}
                              </p>
                            )}
                          </div>

                          {/* Telefone */}
                          <div className="space-y-1.5">
                            <Label>Telefone</Label>
                            <Input
                              name="telefone"
                              value={manualForm.telefone}
                              onChange={handleManualFormChange}
                              placeholder="(31) 99999-9999"
                              inputMode="numeric"
                              error={!!manualErrors.telefone}
                            />
                            {manualErrors.telefone && (
                              <p className="text-red-400 text-xs flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                {manualErrors.telefone}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Botão salvar */}
                        <div className="px-5 pb-5">
                          <Button
                            className="w-full h-14"
                            onClick={handleManualCadastro}
                            isLoading={manualLoading}
                            disabled={manualLoading}
                          >
                            <UserPlus className="h-5 w-5" />
                            {manualLoading ? "Salvando..." : "Cadastrar Aluno"}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── FORM: PAI / RESPONSÁVEL ── */}
                  {manualType === "pai" && (
                    <>
                      {/* Feedback de sucesso */}
                      {parentSuccess && (
                        <div className="bg-emerald-950/60 border border-emerald-800/60 rounded-2xl px-5 py-4 space-y-2">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                            <p className="text-emerald-300 text-sm font-semibold">
                              Responsável cadastrado com sucesso!
                            </p>
                          </div>
                          {parentSuccess.alunoNome && (
                            <div className="ml-8 bg-emerald-950/80 border border-emerald-800/40 rounded-xl px-4 py-3 space-y-1">
                              <p className="text-emerald-200 text-xs font-bold uppercase tracking-widest">
                                Associado a
                              </p>
                              <p className="text-white font-semibold text-sm">
                                {parentSuccess.alunoNome}
                              </p>
                              <p className="text-emerald-400 text-xs">
                                Turma {parentSuccess.alunoTurma} · CPF{" "}
                                {formatCpf(parentSuccess.cpf)}
                              </p>
                            </div>
                          )}
                          <button
                            onClick={() => {
                              setParentSuccess(null);
                            }}
                            className="ml-8 text-xs text-zinc-500 hover:text-white transition-colors underline underline-offset-2"
                          >
                            Cadastrar outro responsável
                          </button>
                        </div>
                      )}

                      {!parentSuccess && (
                        <div className="bg-[#0a0a0a] border border-zinc-800 rounded-2xl overflow-hidden">
                          {/* Preview de associação */}
                          {parentAssociatedStudent && (
                            <div className="bg-white/5 border-b border-zinc-800 px-5 py-3 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <GraduationCap className="h-4 w-4 text-zinc-400 shrink-0" />
                                <span className="text-zinc-400 text-sm truncate">
                                  Pai de{" "}
                                  <span className="text-white font-bold">
                                    {parentAssociatedStudent.nome}
                                  </span>
                                  {" · "}
                                  <span className="text-zinc-400">
                                    Turma {parentAssociatedStudent.turmaId}
                                  </span>
                                  {parentAssociatedStudent.cpf && (
                                    <span className="text-zinc-500">
                                      {" · "}CPF{" "}
                                      {formatCpf(parentAssociatedStudent.cpf)}
                                    </span>
                                  )}
                                </span>
                              </div>
                              <button
                                onClick={() => {
                                  setParentAssociatedStudent(null);
                                  setParentStudentSearch("");
                                  setParentStudentResults([]);
                                }}
                                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          <div className="p-5 space-y-4">
                            {/* Nome */}
                            <div className="space-y-1.5">
                              <Label>
                                Nome do Responsável{" "}
                                <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                name="nome"
                                value={parentForm.nome}
                                onChange={handleParentFormChange}
                                placeholder="Nome completo do pai/responsável"
                                error={!!parentErrors.nome}
                              />
                              {parentErrors.nome && (
                                <p className="text-red-400 text-xs flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3 shrink-0" />
                                  {parentErrors.nome}
                                </p>
                              )}
                            </div>

                            {/* Relação */}
                            <div className="space-y-1.5">
                              <Label>
                                Relação <span className="text-red-500">*</span>
                              </Label>
                              <select
                                name="relacao"
                                value={parentForm.relacao}
                                onChange={handleParentFormChange}
                                className="flex h-12 w-full rounded-xl border border-zinc-800 px-4 py-2 text-sm bg-black text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white transition-all appearance-none"
                              >
                                <option value="pai">Pai</option>
                                <option value="mae">Mãe</option>
                                <option value="responsavel">Responsável</option>
                              </select>
                            </div>

                            {/* CPF */}
                            <div className="space-y-1.5">
                              <Label>
                                CPF <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                name="cpf"
                                value={parentForm.cpf}
                                onChange={handleParentFormChange}
                                placeholder="000.000.000-00"
                                inputMode="numeric"
                                error={!!parentErrors.cpf}
                              />
                              {parentErrors.cpf && (
                                <p className="text-red-400 text-xs flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3 shrink-0" />
                                  {parentErrors.cpf}
                                </p>
                              )}
                            </div>

                            {/* Associar a aluno */}
                            <div className="space-y-1.5">
                              <Label>Associar a Aluno</Label>
                              {!parentAssociatedStudent ? (
                                <div
                                  className="relative"
                                  ref={parentStudentSearchRef}
                                >
                                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
                                  <input
                                    type="text"
                                    placeholder="Pesquisar aluno pelo nome..."
                                    value={parentStudentSearch}
                                    onChange={(e) => {
                                      setParentStudentSearch(e.target.value);
                                      setParentStudentSearchOpen(true);
                                      searchStudentsForParent(e.target.value);
                                    }}
                                    onFocus={() =>
                                      setParentStudentSearchOpen(true)
                                    }
                                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-black border border-zinc-800 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-all"
                                  />
                                  {parentStudentSearchLoading && (
                                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 animate-spin" />
                                  )}
                                  {/* Dropdown de resultados */}
                                  {parentStudentSearchOpen &&
                                    parentStudentSearch.length >= 2 &&
                                    !parentStudentSearchLoading && (
                                      <div className="absolute z-50 w-full mt-1 bg-[#111] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                                        {parentStudentResults.length === 0 ? (
                                          <div className="py-8 text-center text-zinc-600 text-sm">
                                            Nenhum aluno encontrado
                                          </div>
                                        ) : (
                                          parentStudentResults.map(
                                            (aluno, i) => (
                                              <button
                                                key={i}
                                                onClick={() => {
                                                  setParentAssociatedStudent(
                                                    aluno
                                                  );
                                                  setParentStudentSearch("");
                                                  setParentStudentResults([]);
                                                  setParentStudentSearchOpen(
                                                    false
                                                  );
                                                }}
                                                className="w-full text-left px-4 py-3 hover:bg-zinc-900 transition-colors border-b border-zinc-800/50 last:border-0 flex items-center justify-between gap-3"
                                              >
                                                <div className="min-w-0">
                                                  <p className="text-white text-sm font-medium truncate">
                                                    {aluno.nome}
                                                  </p>
                                                  <p className="text-zinc-500 text-xs mt-0.5">
                                                    Turma {aluno.turmaId}
                                                    {aluno.cpf &&
                                                      ` · CPF ${formatCpf(
                                                        aluno.cpf
                                                      )}`}
                                                  </p>
                                                </div>
                                                <GraduationCap className="h-4 w-4 text-zinc-600 shrink-0" />
                                              </button>
                                            )
                                          )
                                        )}
                                      </div>
                                    )}
                                </div>
                              ) : (
                                <div className="h-12 rounded-xl border border-emerald-800/60 bg-emerald-950/30 px-4 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <GraduationCap className="h-4 w-4 text-emerald-400 shrink-0" />
                                    <span className="text-emerald-300 text-sm font-medium truncate">
                                      {parentAssociatedStudent.nome} — Turma{" "}
                                      {parentAssociatedStudent.turmaId}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      setParentAssociatedStudent(null);
                                      setParentStudentSearch("");
                                    }}
                                    className="shrink-0 text-zinc-500 hover:text-white transition-colors"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Divisor opcional */}
                            <div className="flex items-center gap-3 py-1">
                              <div className="flex-1 h-px bg-zinc-800" />
                              <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
                                Opcional
                              </span>
                              <div className="flex-1 h-px bg-zinc-800" />
                            </div>

                            {/* E-mail */}
                            <div className="space-y-1.5">
                              <Label>E-mail</Label>
                              <Input
                                name="email"
                                value={parentForm.email}
                                onChange={handleParentFormChange}
                                placeholder="responsavel@email.com"
                                type="email"
                                error={!!parentErrors.email}
                              />
                              {parentErrors.email && (
                                <p className="text-red-400 text-xs flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3 shrink-0" />
                                  {parentErrors.email}
                                </p>
                              )}
                            </div>

                            {/* Telefone */}
                            <div className="space-y-1.5">
                              <Label>Telefone</Label>
                              <Input
                                name="telefone"
                                value={parentForm.telefone}
                                onChange={handleParentFormChange}
                                placeholder="(31) 99999-9999"
                                inputMode="numeric"
                                error={!!parentErrors.telefone}
                              />
                              {parentErrors.telefone && (
                                <p className="text-red-400 text-xs flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3 shrink-0" />
                                  {parentErrors.telefone}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Botão salvar */}
                          <div className="px-5 pb-5">
                            <Button
                              className="w-full h-14"
                              onClick={handleParentCadastro}
                              isLoading={parentLoading}
                              disabled={parentLoading}
                            >
                              <User className="h-5 w-5" />
                              {parentLoading
                                ? "Salvando..."
                                : "Cadastrar Responsável"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── SUB-ABA: PESQUISAR ALUNOS ── */}
              {groupsSubTab === "search" && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                      <Search className="h-6 w-6 text-white" /> Pesquisar Alunos
                    </h1>
                    <p className="text-zinc-400 text-sm mt-1">
                      Busque por nome em todas as turmas cadastradas.
                    </p>
                  </div>

                  {/* Campo de busca */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Digite o nome do aluno..."
                      value={studentSearch}
                      onChange={(e) => {
                        setStudentSearch(e.target.value);
                        searchStudents(e.target.value);
                      }}
                      className="w-full h-12 pl-11 pr-4 rounded-xl bg-[#0a0a0a] border border-zinc-800 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-all"
                    />
                    {studentSearchLoading && (
                      <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 animate-spin" />
                    )}
                  </div>

                  {/* Resultados */}
                  {studentSearch.length >= 2 && !studentSearchLoading && (
                    <div className="bg-[#0a0a0a] border border-zinc-800 rounded-2xl overflow-hidden">
                      {studentResults.length === 0 ? (
                        <div className="py-16 text-center text-zinc-600 flex flex-col items-center gap-3">
                          <Search className="h-8 w-8 opacity-30" />
                          <p className="text-sm">
                            Nenhum aluno encontrado para "{studentSearch}"
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                            <p className="text-sm font-bold text-white">
                              Resultados
                            </p>
                            <span className="text-xs text-zinc-500">
                              {studentResults.length} aluno(s)
                            </span>
                          </div>
                          <div className="divide-y divide-zinc-800/50">
                            {studentResults.map((aluno, i) => (
                              <button
                                key={i}
                                onClick={() =>
                                  openStudentModal(aluno, aluno.turmaId)
                                }
                                className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-900/40 transition-colors text-left"
                              >
                                <div>
                                  <p className="text-white font-semibold text-sm">
                                    {aluno.nome}
                                  </p>
                                  <p className="text-zinc-500 text-xs mt-0.5 font-mono">
                                    {formatCpf(aluno.cpf)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-bold text-zinc-300">
                                    {aluno.ano}º ano · Turma {aluno.turma}
                                  </span>
                                  <ChevronRight className="h-4 w-4 text-zinc-600" />
                                </div>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {studentSearch.length < 2 && studentSearch.length > 0 && (
                    <p className="text-zinc-600 text-xs text-center">
                      Digite pelo menos 2 letras para pesquisar.
                    </p>
                  )}
                </div>
              )}

              {/* ── SUB-ABA: RESPONSÁVEIS ── */}
              {groupsSubTab === "responsaveis" && (
                <div className="space-y-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <User className="h-6 w-6 text-white" /> Responsáveis
                      </h1>
                      <p className="text-zinc-400 text-sm mt-1">
                        {allResponsaveisLoading
                          ? "Carregando..."
                          : allResponsaveis.length === 0
                          ? "Nenhum responsável cadastrado."
                          : `${allResponsaveis.length} responsável${
                              allResponsaveis.length !== 1 ? "is" : ""
                            } cadastrado${
                              allResponsaveis.length !== 1 ? "s" : ""
                            }.`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={fetchAllResponsaveis}
                        disabled={allResponsaveisLoading}
                        className="h-9 px-3 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 text-xs font-semibold hover:text-white hover:border-zinc-600 transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {allResponsaveisLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Search className="h-3.5 w-3.5" />
                        )}
                        Atualizar
                      </button>
                      {allResponsaveis.length > 0 && (
                        <button
                          onClick={() => setConfirmLimparResponsaveis(true)}
                          className="h-9 px-3 rounded-xl border border-red-500/30 bg-red-500/5 text-red-400 text-xs font-semibold hover:bg-red-500/10 hover:border-red-500/50 transition-all flex items-center gap-1.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Limpar tudo
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Campo de busca */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Filtrar por nome..."
                      value={responsavelSearch}
                      onChange={(e) => {
                        setResponsavelSearch(e.target.value);
                        searchResponsaveis(e.target.value);
                      }}
                      className="w-full h-12 pl-11 pr-10 rounded-xl bg-[#0a0a0a] border border-zinc-800 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-all"
                    />
                    {responsavelSearch.length > 0 && (
                      <button
                        onClick={() => {
                          setResponsavelSearch("");
                          setResponsavelResults([]);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-zinc-600 hover:text-white transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {responsavelSearchLoading && (
                      <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 animate-spin" />
                    )}
                  </div>

                  {/* Lista: resultados de busca OU todos */}
                  {(() => {
                    const isFiltering = responsavelSearch.length >= 2;
                    const list = isFiltering
                      ? responsavelResults
                      : allResponsaveis;
                    const loading = isFiltering
                      ? responsavelSearchLoading
                      : allResponsaveisLoading;

                    if (loading)
                      return (
                        <div className="py-16 flex justify-center">
                          <Loader2 className="h-6 w-6 text-zinc-600 animate-spin" />
                        </div>
                      );

                    if (list.length === 0)
                      return (
                        <div className="py-16 text-center text-zinc-600 flex flex-col items-center gap-3">
                          <User className="h-8 w-8 opacity-20" />
                          <p className="text-sm">
                            {isFiltering
                              ? `Nenhum responsável encontrado para "${responsavelSearch}".`
                              : "Nenhum responsável cadastrado ainda."}
                          </p>
                        </div>
                      );

                    return (
                      <div className="bg-[#0a0a0a] border border-zinc-800 rounded-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
                          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                            {isFiltering ? "Resultados" : "Todos"}
                          </p>
                          <span className="text-xs text-zinc-600">
                            {list.length}
                          </span>
                        </div>
                        <div className="divide-y divide-zinc-800/50 max-h-[60vh] overflow-y-auto">
                          {list.map((resp, i) => {
                            const cpfDigits = (resp.cpf || "").replace(
                              /\D/g,
                              ""
                            );
                            const hasTicket = allTickets.some(
                              (t) =>
                                (t.cpf || "").replace(/\D/g, "") ===
                                  cpfDigits ||
                                (usersMap[t.userId] || "").replace(
                                  /\D/g,
                                  ""
                                ) === cpfDigits
                            );
                            return (
                              <button
                                key={i}
                                onClick={() => openResponsavelModal(resp)}
                                className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-900/40 transition-colors text-left"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-white font-semibold text-sm truncate">
                                      {resp.nome}
                                    </p>
                                    {hasTicket && (
                                      <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-[9px] font-bold text-green-400 uppercase tracking-wider">
                                        ingresso
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-zinc-500 text-xs mt-0.5 font-mono">
                                    {formatCpf(resp.cpf)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-3">
                                  {resp.alunoNome && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-bold text-zinc-300">
                                      <GraduationCap className="h-3 w-3" />
                                      {resp.alunoTurma}
                                    </span>
                                  )}
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-bold text-zinc-400 capitalize">
                                    {resp.relacao || "responsável"}
                                  </span>
                                  <ChevronRight className="h-4 w-4 text-zinc-600" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {responsavelSearch.length === 1 && (
                    <p className="text-zinc-600 text-xs text-center">
                      Digite pelo menos 2 letras para filtrar.
                    </p>
                  )}
                </div>
              )}

              {/* ── SUB-ABA: TURMAS ── */}
              {groupsSubTab === "classes" && (
                <div className="space-y-5">
                  {/* Breadcrumb */}
                  <div className="flex items-center gap-2 text-sm">
                    <button
                      onClick={() => {
                        setClassesYear(null);
                        setClassesClass(null);
                        setClassesWithStudents([]);
                      }}
                      className={`font-semibold transition-colors ${
                        !classesYear
                          ? "text-white"
                          : "text-zinc-500 hover:text-white"
                      }`}
                    >
                      Turmas
                    </button>
                    {classesYear && (
                      <>
                        <ChevronRight className="h-4 w-4 text-zinc-700" />
                        <button
                          onClick={() => setClassesClass(null)}
                          className={`font-semibold transition-colors ${
                            !classesClass
                              ? "text-white"
                              : "text-zinc-500 hover:text-white"
                          }`}
                        >
                          {classesYear}º Ano
                        </button>
                      </>
                    )}
                    {classesClass && (
                      <>
                        <ChevronRight className="h-4 w-4 text-zinc-700" />
                        <span className="text-white font-semibold">
                          Turma {classesClass}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Nível 1: Selecionar Ano */}
                  {!classesYear && (
                    <div className="grid grid-cols-3 gap-4">
                      {["1", "2", "3"].map((ano) => (
                        <button
                          key={ano}
                          onClick={() => {
                            setClassesYear(ano);
                            fetchClassesWithStudents(ano);
                          }}
                          className="group bg-[#0a0a0a] border border-zinc-800 rounded-2xl p-6 flex flex-col items-center gap-3 hover:border-zinc-600 hover:bg-zinc-900/40 transition-all"
                        >
                          <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 group-hover:border-zinc-700 flex items-center justify-center transition-all">
                            <span className="text-2xl font-black text-white">
                              {ano}
                            </span>
                          </div>
                          <div className="text-center">
                            <p className="text-white font-bold text-sm">
                              {ano}º Ano
                            </p>
                            <p className="text-zinc-600 text-xs mt-0.5">
                              12 turmas
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Nível 2: Turmas do Ano (só as que têm alunos) */}
                  {classesYear && !classesClass && (
                    <div className="space-y-3">
                      <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
                        Turmas do {classesYear}º Ano
                      </p>
                      {classesWithStudentsLoading ? (
                        <div className="flex items-center justify-center py-16">
                          <Loader2 className="h-6 w-6 text-zinc-600 animate-spin" />
                        </div>
                      ) : classesWithStudents.filter((id) =>
                          id.startsWith(classesYear)
                        ).length === 0 ? (
                        <div className="py-16 text-center text-zinc-600 flex flex-col items-center gap-3">
                          <MdGroups className="h-10 w-10 opacity-20" />
                          <p className="text-sm">
                            Nenhuma turma com alunos cadastrados no{" "}
                            {classesYear}º ano.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                          {classesWithStudents
                            .filter((id) => id.startsWith(classesYear))
                            .map((turmaId) => {
                              const letra = turmaId.slice(1);
                              return (
                                <button
                                  key={turmaId}
                                  onClick={() => {
                                    setClassesClass(letra);
                                    fetchClassStudents(turmaId);
                                  }}
                                  className="relative group bg-[#0a0a0a] border border-zinc-800 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-zinc-600 hover:bg-zinc-900/40 transition-all"
                                >
                                  {classesWithIncompleteStudents.includes(turmaId) && (
                                    <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-orange-500 rounded-full" />
                                  )}
                                  <span className="text-xl font-black text-white">
                                    {letra}
                                  </span>
                                  <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
                                    Turma
                                  </span>
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Nível 3: Lista de Alunos da Turma */}
                  {classesYear &&
                    classesClass &&
                    (() => {
                      const turmaId = `${classesYear}${classesClass}`;
                      const alunos = classesData[turmaId];
                      return (
                        <div className="bg-[#0a0a0a] border border-zinc-800 rounded-2xl overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                            <div>
                              <p className="text-white font-bold text-sm">
                                {classesYear}º Ano — Turma {classesClass}
                              </p>
                              <p className="text-zinc-500 text-xs mt-0.5">
                                {alunos
                                  ? `${alunos.length} aluno(s) cadastrado(s)`
                                  : "Carregando..."}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {classesLoading && (
                                <Loader2 className="h-4 w-4 text-zinc-500 animate-spin" />
                              )}
                              {alunos &&
                                alunos.length > 0 &&
                                (() => {
                                  const semCpf = alunos.filter(
                                    (a) =>
                                      (a.cpf || "").replace(/\D/g, "")
                                        .length !== 11
                                  );
                                  if (semCpf.length === 0) return null;
                                  return (
                                    <button
                                      onClick={() =>
                                        setMissingCpfModal({
                                          turmaId,
                                          alunos: semCpf,
                                        })
                                      }
                                      title={`${semCpf.length} aluno(s) sem CPF`}
                                      className="h-9 px-2.5 flex items-center justify-center gap-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-all"
                                    >
                                      <AlertTriangle className="h-4 w-4" />
                                      <span className="text-xs font-bold tabular-nums">
                                        {semCpf.length}
                                      </span>
                                    </button>
                                  );
                                })()}
                              {alunos && alunos.length > 0 && (
                                <button
                                  onClick={() => setConfirmDeleteClass(turmaId)}
                                  className="h-9 w-9 flex items-center justify-center rounded-xl border border-zinc-800 text-zinc-600 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 transition-all"
                                  title="Apagar turma"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {!alunos || classesLoading ? (
                            <div className="py-16 flex items-center justify-center">
                              <Loader2 className="h-6 w-6 text-zinc-600 animate-spin" />
                            </div>
                          ) : alunos.length === 0 ? (
                            <div className="py-16 text-center text-zinc-600 flex flex-col items-center gap-3">
                              <MdGroups className="h-10 w-10 opacity-20" />
                              <p className="text-sm">
                                Nenhum aluno cadastrado nesta turma.
                              </p>
                            </div>
                          ) : (
                            <div className="divide-y divide-zinc-800/50">
                              {/* Header da tabela */}
                              <div className="grid grid-cols-[32px_1fr_150px_40px] gap-0 px-5 py-3 bg-zinc-900/30">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                                  #
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                                  Nome
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                                  CPF
                                </span>
                                <span></span>
                              </div>
                              {alunos.map((aluno, i) => {
                                const cpfDigits = (aluno.cpf || "").replace(
                                  /\D/g,
                                  ""
                                );
                                const cpfMissing = cpfDigits.length !== 11;
                                const hasTicket =
                                  !cpfMissing &&
                                  allTickets.some(
                                    (t) =>
                                      (t.cpf || "").replace(/\D/g, "") ===
                                        cpfDigits ||
                                      (usersMap[t.userId] || "").replace(
                                        /\D/g,
                                        ""
                                      ) === cpfDigits
                                  );
                                return (
                                  <div
                                    key={aluno.id || i}
                                    className="grid grid-cols-[32px_1fr_150px_40px] items-center px-5 py-3.5 hover:bg-zinc-900/30 transition-colors"
                                  >
                                    <span className="text-[11px] font-mono text-zinc-600 tabular-nums">
                                      {i + 1}
                                    </span>
                                    <div className="min-w-0 pr-3">
                                      <div className="flex items-center gap-2">
                                        {cpfMissing && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openStudentModal(
                                                aluno,
                                                `${classesYear}${classesClass}`
                                              );
                                            }}
                                            title="Aluno sem CPF — clique para editar"
                                            className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 transition-colors"
                                          >
                                            <AlertTriangle className="h-3 w-3" />
                                          </button>
                                        )}
                                        <p className="text-white font-medium text-sm truncate">
                                          {aluno.nome}
                                        </p>
                                        {hasTicket && (
                                          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-[9px] font-bold text-green-400 uppercase tracking-wider">
                                            ingresso
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <span className="text-zinc-500 font-mono text-xs tabular-nums">
                                      {formatCpf(aluno.cpf)}
                                    </span>
                                    <div className="flex justify-end">
                                      <button
                                        onClick={() =>
                                          openStudentModal(
                                            aluno,
                                            `${classesYear}${classesClass}`
                                          )
                                        }
                                        className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-600 hover:text-white hover:bg-zinc-800 transition-all"
                                        title="Ver detalhes"
                                      >
                                        <Info className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── MODAL CONFIRMAR EXCLUSÃO DE TURMA ── */}
      {confirmDeleteClass && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => !deleteClassLoading && setConfirmDeleteClass(null)}
        >
          <div
            className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-white font-bold text-base">
                  Apagar turma {confirmDeleteClass}?
                </p>
                <p className="text-zinc-500 text-sm mt-1">
                  Todos os alunos desta turma serão removidos do sistema
                  permanentemente. Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteClass(null)}
                disabled={deleteClassLoading}
                className="flex-1 h-11 rounded-xl border border-zinc-800 text-zinc-400 text-sm font-semibold hover:bg-zinc-900 hover:text-white transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteClass(confirmDeleteClass)}
                disabled={deleteClassLoading}
                className="flex-1 h-11 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {deleteClassLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ALUNOS SEM CPF DA TURMA ── */}
      {missingCpfModal && (
        <div
          className="fixed inset-0 z-[115] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setMissingCpfModal(null)}
        >
          <div
            className="bg-[#0a0a0a] border border-zinc-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm leading-tight">
                    Alunos sem CPF
                  </p>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    {missingCpfModal.alunos.length} aluno(s) — Turma{" "}
                    {missingCpfModal.turmaId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMissingCpfModal(null)}
                className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {missingCpfModal.alunos.length === 0 ? (
                <div className="py-10 text-center text-zinc-500 flex flex-col items-center gap-2">
                  <CheckCircle className="h-8 w-8 text-green-400" />
                  <p className="text-sm">Todos os alunos têm CPF cadastrado.</p>
                </div>
              ) : (
                missingCpfModal.alunos.map((aluno) => (
                  <button
                    key={aluno.id}
                    onClick={() => {
                      setMissingCpfModal(null);
                      openStudentModal(aluno, missingCpfModal.turmaId);
                    }}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0" />
                      <span className="text-white text-sm font-medium truncate">
                        {aluno.nome}
                      </span>
                    </div>
                    <Pencil className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DO ALUNO ── */}
      {studentModal && (
        <div
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setStudentModal(null)}
        >
          <div
            className="bg-[#0a0a0a] border border-zinc-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  <User className="h-5 w-5 text-zinc-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm leading-tight">
                    {studentModal.nome}
                  </p>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    {studentModal.ano}º Ano · Turma {studentModal.turma}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmDeleteStudent(true)}
                  className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-full transition-colors"
                  title="Excluir aluno"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setStudentModal(null)}
                  className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {studentModalLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 text-zinc-600 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Dados cadastrais */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                        Dados Cadastrais
                      </p>
                      {!editStudentMode ? (
                        <button
                          onClick={() => {
                            setEditStudentError("");
                            setEditStudentForm({
                              cpf: formatCpf(studentModal.cpf || "") === "—" ? "" : formatCpf(studentModal.cpf || ""),
                              email:
                                studentModal.email ||
                                studentModal._userData?.email ||
                                "",
                              telefone:
                                studentModal.telefone ||
                                studentModal._userData?.telefone ||
                                studentModal._userData?.phone ||
                                "",
                            });
                            setEditStudentMode(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 hover:bg-zinc-900 text-[11px] font-bold transition-colors"
                        >
                          <Pencil className="h-3 w-3" /> Editar
                        </button>
                      ) : null}
                    </div>
                    {!editStudentMode ? (
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl divide-y divide-zinc-800/60">
                        {[
                          {
                            label: "CPF",
                            value:
                              (studentModal.cpf || "").replace(/\D/g, "")
                                .length === 11
                                ? formatCpf(studentModal.cpf)
                                : null,
                            warn:
                              (studentModal.cpf || "").replace(/\D/g, "")
                                .length !== 11,
                          },
                          {
                            label: "E-mail",
                            value:
                              studentModal.email ||
                              studentModal._userData?.email ||
                              null,
                          },
                          {
                            label: "Telefone",
                            value:
                              studentModal.telefone ||
                              studentModal._userData?.telefone ||
                              studentModal._userData?.phone ||
                              null,
                          },
                          {
                            label: "Importado em",
                            value: studentModal.cadastradoEm
                              ? new Date(
                                  studentModal.cadastradoEm
                                ).toLocaleDateString("pt-BR")
                              : null,
                          },
                        ].map(({ label, value, warn }: any) => (
                          <div
                            key={label}
                            className="flex items-center justify-between px-4 py-3"
                          >
                            <span className="text-zinc-500 text-xs font-semibold flex items-center gap-1.5">
                              {warn && (
                                <AlertTriangle className="h-3 w-3 text-orange-400" />
                              )}
                              {label}
                            </span>
                            <span
                              className={`text-xs font-mono ${
                                value
                                  ? "text-white"
                                  : warn
                                    ? "text-orange-400 italic"
                                    : "text-zinc-700 italic"
                              }`}
                            >
                              {value || (warn ? "sem CPF" : "não informado")}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                            CPF
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={editStudentForm.cpf}
                            onChange={(e) =>
                              setEditStudentForm((p) => ({
                                ...p,
                                cpf: applyCpfMask(e.target.value),
                              }))
                            }
                            placeholder="000.000.000-00"
                            className="mt-1 w-full h-10 bg-black/40 border border-zinc-800 rounded-xl px-3 text-white text-sm font-mono focus:outline-none focus:border-zinc-600"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                            E-mail
                          </label>
                          <input
                            type="email"
                            value={editStudentForm.email}
                            onChange={(e) =>
                              setEditStudentForm((p) => ({
                                ...p,
                                email: e.target.value,
                              }))
                            }
                            placeholder="email@exemplo.com"
                            className="mt-1 w-full h-10 bg-black/40 border border-zinc-800 rounded-xl px-3 text-white text-sm focus:outline-none focus:border-zinc-600"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                            Telefone
                          </label>
                          <input
                            type="tel"
                            value={editStudentForm.telefone}
                            onChange={(e) => {
                              const c = e.target.value
                                .replace(/\D/g, "")
                                .slice(0, 11);
                              let v = c;
                              if (c.length > 6)
                                v = c.replace(
                                  /^(\d{2})(\d{5})(\d{0,4})/,
                                  "($1) $2-$3"
                                );
                              else if (c.length > 2)
                                v = c.replace(
                                  /^(\d{2})(\d{0,5})/,
                                  "($1) $2"
                                );
                              else if (c.length) v = `(${c}`;
                              setEditStudentForm((p) => ({
                                ...p,
                                telefone: v,
                              }));
                            }}
                            placeholder="(00) 00000-0000"
                            className="mt-1 w-full h-10 bg-black/40 border border-zinc-800 rounded-xl px-3 text-white text-sm focus:outline-none focus:border-zinc-600"
                          />
                        </div>
                        {editStudentError && (
                          <div className="flex items-center gap-2 text-orange-400 text-xs font-semibold">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {editStudentError}
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => {
                              setEditStudentMode(false);
                              setEditStudentError("");
                            }}
                            disabled={editStudentSaving}
                            className="flex-1 h-10 rounded-xl border border-zinc-800 text-zinc-400 text-xs font-bold hover:bg-zinc-900 hover:text-white transition-all disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handleSaveStudentEdit}
                            disabled={editStudentSaving}
                            className="flex-1 h-10 rounded-xl bg-white text-black text-xs font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                          >
                            {editStudentSaving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="h-3.5 w-3.5" />
                            )}
                            Salvar
                          </button>
                        </div>
                      </div>
                    )}
                    {/* Status de login */}
                    <div
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold ${
                        studentModal._userData
                          ? "bg-green-500/5 border-green-500/20 text-green-400"
                          : "bg-zinc-900 border-zinc-800 text-zinc-500"
                      }`}
                    >
                      {studentModal._userData ? (
                        <>
                          <CheckCircle className="h-3.5 w-3.5" /> Aluno já
                          realizou login no sistema
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3.5 w-3.5" /> Aluno ainda
                          não fez login
                        </>
                      )}
                    </div>
                  </div>

                  {/* Seção de Responsáveis */}
                  {studentModalResponsaveis.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                        Responsáveis
                      </p>
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl divide-y divide-zinc-800/60">
                        {studentModalResponsaveis.map((resp) => (
                          <div
                            key={resp.id}
                            className="px-4 py-3 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-white text-sm font-semibold truncate">
                                  {resp.nome}
                                </p>
                                <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-400 capitalize">
                                  {resp.relacao || "responsável"}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-zinc-500 text-xs font-mono">
                                  {formatCpf(resp.cpf)}
                                </span>
                                {resp.telefone && (
                                  <span className="text-zinc-600 text-xs">
                                    {resp.telefone}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {(() => {
                                const cpfR = (resp.cpf || "").replace(
                                  /\D/g,
                                  ""
                                );
                                const ticket = allTickets.find(
                                  (t) =>
                                    (t.cpf || "").replace(/\D/g, "") === cpfR
                                );
                                return ticket ? (
                                  <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-bold text-green-400 uppercase tracking-wider">
                                    <LuTicketCheck className="h-3 w-3" />{" "}
                                    ingresso
                                  </span>
                                ) : (
                                  <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
                                    sem ingresso
                                  </span>
                                );
                              })()}
                              <button
                                onClick={() => setResponsavelToRemove(resp)}
                                className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors"
                                title="Remover responsável"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Seção de Ingresso */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                      Ingresso
                    </p>

                    {studentModalTicket ? (
                      /* Ingresso existente */
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                        {/* Status badge */}
                        <div
                          className={`flex items-center gap-2 px-4 py-3 border-b border-zinc-800 ${
                            studentModalTicket.usado
                              ? "bg-green-500/5"
                              : "bg-zinc-900/30"
                          }`}
                        >
                          {studentModalTicket.usado ? (
                            <>
                              <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                              <span className="text-green-400 text-xs font-bold">
                                Validado — entrada confirmada
                              </span>
                            </>
                          ) : (
                            <>
                              <Clock className="h-4 w-4 text-zinc-400 shrink-0" />
                              <span className="text-zinc-400 text-xs font-bold">
                                Pendente de validação
                              </span>
                            </>
                          )}
                        </div>
                        {/* Dados do ingresso */}
                        <div className="divide-y divide-zinc-800/60">
                          {[
                            { label: "Código", value: studentModalTicket.code },
                            { label: "Lote", value: studentModalTicket.type },
                            {
                              label: "Valor",
                              value:
                                studentModalTicket.price != null
                                  ? `R$ ${Number(studentModalTicket.price)
                                      .toFixed(2)
                                      .replace(".", ",")}`
                                  : null,
                            },
                            {
                              label: "Pagamento",
                              value: studentModalTicket.pagamentoConfirmado
                                ? `Confirmado${
                                    studentModalTicket.metodoPagamento
                                      ? " · " +
                                        studentModalTicket.metodoPagamento
                                      : ""
                                  }`
                                : "Pendente",
                            },
                            {
                              label: "Emitido em",
                              value: studentModalTicket.criadoEm
                                ? formatDate(studentModalTicket.criadoEm)
                                : null,
                            },
                            {
                              label: "Entrada em",
                              value:
                                studentModalTicket.usado &&
                                studentModalTicket.horaEntrada
                                  ? formatDate(studentModalTicket.horaEntrada)
                                  : null,
                            },
                          ]
                            .filter(({ value }) => value)
                            .map(({ label, value }) => (
                              <div
                                key={label}
                                className="flex items-center justify-between px-4 py-2.5"
                              >
                                <span className="text-zinc-500 text-xs font-semibold">
                                  {label}
                                </span>
                                <span className="text-white text-xs font-mono">
                                  {value}
                                </span>
                              </div>
                            ))}
                        </div>
                        {/* Ações */}
                        <div className="flex gap-2 p-4 border-t border-zinc-800">
                          <button
                            onClick={handleToggleValidarModal}
                            disabled={studentModalLoading}
                            className={`flex-1 h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
                              studentModalTicket.usado
                                ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700"
                                : "bg-white text-black hover:bg-zinc-200"
                            }`}
                          >
                            {studentModalTicket.usado ? (
                              <>
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                  <path d="M3 3v5h5" />
                                </svg>{" "}
                                Desvalidar
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-3.5 w-3.5" /> Validar
                              </>
                            )}
                          </button>
                          <button
                            onClick={handleExcluirIngressoModal}
                            disabled={studentModalLoading}
                            className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-all disabled:opacity-50 shrink-0"
                            title="Excluir ingresso"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Sem ingresso — form para associar */
                      <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-4 space-y-4">
                        <p className="text-zinc-500 text-xs">
                          Este aluno ainda não possui ingresso. Associe um
                          agora:
                        </p>

                        {/* Lote */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block">
                            Lote
                          </label>
                          <select
                            value={associarForm.loteId}
                            onChange={(e) =>
                              setAssociarForm((p) => ({
                                ...p,
                                loteId: e.target.value,
                              }))
                            }
                            className="flex h-11 w-full appearance-none rounded-xl border border-zinc-800 bg-black text-white px-4 text-sm focus:outline-none focus:border-zinc-600 transition-all"
                          >
                            <option value="" disabled>
                              Selecione o lote
                            </option>
                            {batches.map((b) => (
                              <option
                                key={b.id}
                                value={b.id}
                                className="bg-zinc-900"
                              >
                                {b.nome} — R${" "}
                                {Number(b.preco).toFixed(2).replace(".", ",")}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* E-mail (opcional se já tiver do login) */}
                        {!studentModal._userData?.email && (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block">
                              E-mail (opcional)
                            </label>
                            <input
                              type="email"
                              placeholder="email@exemplo.com"
                              value={associarForm.email}
                              onChange={(e) =>
                                setAssociarForm((p) => ({
                                  ...p,
                                  email: e.target.value,
                                }))
                              }
                              className="flex h-11 w-full rounded-xl border border-zinc-800 bg-black text-white px-4 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-all"
                            />
                          </div>
                        )}

                        {/* Status + Pagamento */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block">
                              Status
                            </label>
                            <div className="flex rounded-xl border border-zinc-800 overflow-hidden">
                              {(["pendente", "validado"] as const).map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() =>
                                    setAssociarForm((p) => ({
                                      ...p,
                                      status: s,
                                    }))
                                  }
                                  className={`flex-1 py-2.5 text-[11px] font-bold transition-all capitalize ${
                                    associarForm.status === s
                                      ? "bg-white text-black"
                                      : "bg-black text-zinc-500 hover:text-white"
                                  }`}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block">
                              Pagamento
                            </label>
                            <div className="flex rounded-xl border border-zinc-800 overflow-hidden">
                              {([false, true] as const).map((v) => (
                                <button
                                  key={String(v)}
                                  type="button"
                                  onClick={() =>
                                    setAssociarForm((p) => ({ ...p, pago: v }))
                                  }
                                  className={`flex-1 py-2.5 text-[11px] font-bold transition-all ${
                                    associarForm.pago === v
                                      ? "bg-white text-black"
                                      : "bg-black text-zinc-500 hover:text-white"
                                  }`}
                                >
                                  {v ? "Pago" : "Pendente"}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            fetchBatches();
                            handleAssociarIngresso();
                          }}
                          disabled={!associarForm.loteId || associarLoading}
                          className="w-full h-11 rounded-xl bg-white text-black text-xs font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-50"
                        >
                          {associarLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <LuTicketPlus className="h-4 w-4" />
                          )}
                          Associar Ingresso
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DO RESPONSÁVEL ── */}
      {responsavelModal && (
        <div
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setResponsavelModal(null)}
        >
          <div
            className="bg-[#0a0a0a] border border-zinc-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  <User className="h-5 w-5 text-zinc-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm leading-tight">
                    {responsavelModal.nome}
                  </p>
                  <p className="text-zinc-500 text-xs mt-0.5 capitalize">
                    {responsavelModal.relacao || "Responsável"}
                    {responsavelModal.alunoNome &&
                      ` · Pai de ${responsavelModal.alunoNome}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditResponsavelForm({
                      nome: responsavelModal.nome || "",
                      email: responsavelModal.email || "",
                      telefone: responsavelModal.telefone || "",
                      relacao: responsavelModal.relacao || "responsavel",
                    });
                    setEditResponsavelErrors({});
                    setEditingResponsavel(true);
                  }}
                  className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-full transition-colors"
                  title="Editar responsável"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setConfirmDeleteResponsavel(true)}
                  className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-full transition-colors"
                  title="Excluir responsável"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setResponsavelModal(null)}
                  className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {responsavelModalLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 text-zinc-600 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Dados cadastrais */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                      Dados Cadastrais
                    </p>
                    {editingResponsavel ? (
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-3">
                        <div>
                          <Label>Nome</Label>
                          <Input
                            value={editResponsavelForm.nome}
                            onChange={(e) =>
                              setEditResponsavelForm((p) => ({
                                ...p,
                                nome: e.target.value,
                              }))
                            }
                            error={editResponsavelErrors.nome}
                          />
                          {editResponsavelErrors.nome && (
                            <p className="text-red-400 text-[11px] mt-1">
                              {editResponsavelErrors.nome}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label>E-mail</Label>
                          <Input
                            type="email"
                            placeholder="email@exemplo.com"
                            value={editResponsavelForm.email}
                            onChange={(e) =>
                              setEditResponsavelForm((p) => ({
                                ...p,
                                email: e.target.value,
                              }))
                            }
                            error={editResponsavelErrors.email}
                          />
                          {editResponsavelErrors.email && (
                            <p className="text-red-400 text-[11px] mt-1">
                              {editResponsavelErrors.email}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label>Telefone</Label>
                          <Input
                            placeholder="(31) 99999-9999"
                            value={editResponsavelForm.telefone}
                            onChange={(e) =>
                              setEditResponsavelForm((p) => ({
                                ...p,
                                telefone: applyPhoneMaskLocal(e.target.value),
                              }))
                            }
                            error={editResponsavelErrors.telefone}
                          />
                          {editResponsavelErrors.telefone && (
                            <p className="text-red-400 text-[11px] mt-1">
                              {editResponsavelErrors.telefone}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label>Relação</Label>
                          <select
                            value={editResponsavelForm.relacao}
                            onChange={(e) =>
                              setEditResponsavelForm((p) => ({
                                ...p,
                                relacao: e.target.value,
                              }))
                            }
                            className="flex h-12 w-full rounded-xl border border-zinc-800 px-4 py-2 text-sm bg-black text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white transition-all appearance-none"
                          >
                            <option value="pai">Pai</option>
                            <option value="mae">Mãe</option>
                            <option value="responsavel">Responsável</option>
                          </select>
                        </div>
                        <p className="text-zinc-600 text-[11px]">
                          O CPF não pode ser alterado por aqui.
                        </p>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => setEditingResponsavel(false)}
                            disabled={savingResponsavelEdit}
                            className="flex-1 h-10 rounded-xl border border-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-900 transition-all disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handleSaveResponsavelEdit}
                            disabled={savingResponsavelEdit}
                            className="flex-1 h-10 rounded-xl bg-white text-black text-xs font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-50"
                          >
                            {savingResponsavelEdit && (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                            Salvar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl divide-y divide-zinc-800/60">
                        {[
                          {
                            label: "CPF",
                            value: formatCpf(responsavelModal.cpf),
                          },
                          {
                            label: "E-mail",
                            value: responsavelModal.email || null,
                          },
                          {
                            label: "Telefone",
                            value: responsavelModal.telefone || null,
                          },
                          {
                            label: "Relação",
                            value: responsavelModal.relacao
                              ? responsavelModal.relacao
                                  .charAt(0)
                                  .toUpperCase() +
                                responsavelModal.relacao.slice(1)
                              : null,
                          },
                          {
                            label: "Cadastrado em",
                            value: responsavelModal.criadoEm
                              ? new Date(
                                  responsavelModal.criadoEm
                                ).toLocaleDateString("pt-BR")
                              : null,
                          },
                        ].map(({ label, value }) => (
                          <div
                            key={label}
                            className="flex items-center justify-between px-4 py-3"
                          >
                            <span className="text-zinc-500 text-xs font-semibold">
                              {label}
                            </span>
                            <span
                              className={`text-xs font-mono ${
                                value ? "text-white" : "text-zinc-700 italic"
                              }`}
                            >
                              {value || "não informado"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Aluno associado */}
                    <div className="space-y-2">
                      {editingAlunoAssociado ? (
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                            Buscar aluno para associar
                          </p>
                          <div className="relative">
                            <Input
                              placeholder="Digite o nome do aluno..."
                              value={editAlunoSearch}
                              onChange={(e) =>
                                handleEditAlunoSearch(e.target.value)
                              }
                              autoFocus
                            />
                            {editAlunoLoading && (
                              <Loader2 className="absolute right-3 top-3.5 h-4 w-4 text-zinc-500 animate-spin" />
                            )}
                          </div>
                          {editAlunoResults.length > 0 && (
                            <div className="bg-black border border-zinc-800 rounded-xl divide-y divide-zinc-800/60 max-h-48 overflow-y-auto">
                              {editAlunoResults.map((aluno) => (
                                <button
                                  key={aluno.id + aluno.turmaId}
                                  onClick={() =>
                                    handleSaveAlunoAssociado(aluno)
                                  }
                                  disabled={savingAlunoAssociado}
                                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-900 transition-colors disabled:opacity-50"
                                >
                                  <GraduationCap className="h-4 w-4 text-zinc-500 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-white text-sm font-semibold truncate">
                                      {aluno.nome}
                                    </p>
                                    <p className="text-zinc-500 text-xs">
                                      Turma {aluno.turmaId} · {aluno.ano}º Ano
                                    </p>
                                  </div>
                                  {savingAlunoAssociado && (
                                    <Loader2 className="h-3 w-3 text-zinc-500 animate-spin ml-auto shrink-0" />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                          {editAlunoSearch.trim().length >= 2 &&
                            !editAlunoLoading &&
                            editAlunoResults.length === 0 && (
                              <p className="text-zinc-600 text-xs text-center py-2">
                                Nenhum aluno encontrado.
                              </p>
                            )}
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => {
                                setEditingAlunoAssociado(false);
                                setEditAlunoSearch("");
                                setEditAlunoResults([]);
                              }}
                              disabled={savingAlunoAssociado}
                              className="flex-1 h-10 rounded-xl border border-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-900 transition-all disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                            {responsavelModal.alunoNome && (
                              <button
                                onClick={handleRemoverAlunoAssociado}
                                disabled={savingAlunoAssociado}
                                className="flex-1 h-10 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-red-500/20 transition-all disabled:opacity-50"
                              >
                                {savingAlunoAssociado ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Unlink className="h-3.5 w-3.5" />
                                )}
                                Remover associação
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-zinc-900/50 border-zinc-800 text-xs font-semibold text-zinc-300 group cursor-pointer hover:border-zinc-700 transition-colors"
                          onClick={() => setEditingAlunoAssociado(true)}
                          title="Clique para editar o aluno associado"
                        >
                          <GraduationCap className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                          {responsavelModal.alunoNome ? (
                            <>
                              Associado a{" "}
                              <span className="text-white font-bold">
                                {responsavelModal.alunoNome}
                              </span>
                              {" · "}Turma {responsavelModal.alunoTurma}
                              {responsavelModal.alunoAno &&
                                ` · ${responsavelModal.alunoAno}º Ano`}
                            </>
                          ) : (
                            <span className="text-zinc-600 italic">
                              Sem aluno associado
                            </span>
                          )}
                          <Pencil className="h-3 w-3 text-zinc-600 group-hover:text-zinc-400 ml-auto shrink-0 transition-colors" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Seção de Ingresso */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                      Ingresso
                    </p>

                    {responsavelModalTicket ? (
                      /* Ingresso existente */
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                        <div
                          className={`flex items-center gap-2 px-4 py-3 border-b border-zinc-800 ${
                            responsavelModalTicket.usado
                              ? "bg-green-500/5"
                              : "bg-zinc-900/30"
                          }`}
                        >
                          {responsavelModalTicket.usado ? (
                            <>
                              <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                              <span className="text-green-400 text-xs font-bold">
                                Validado — entrada confirmada
                              </span>
                            </>
                          ) : (
                            <>
                              <Clock className="h-4 w-4 text-zinc-400 shrink-0" />
                              <span className="text-zinc-400 text-xs font-bold">
                                Pendente de validação
                              </span>
                            </>
                          )}
                        </div>
                        <div className="divide-y divide-zinc-800/60">
                          {[
                            {
                              label: "Código",
                              value: responsavelModalTicket.code,
                            },
                            {
                              label: "Lote",
                              value: responsavelModalTicket.type,
                            },
                            {
                              label: "Valor",
                              value:
                                responsavelModalTicket.price != null
                                  ? `R$ ${Number(responsavelModalTicket.price)
                                      .toFixed(2)
                                      .replace(".", ",")}`
                                  : null,
                            },
                            {
                              label: "Pagamento",
                              value: responsavelModalTicket.pagamentoConfirmado
                                ? `Confirmado${
                                    responsavelModalTicket.metodoPagamento
                                      ? " · " +
                                        responsavelModalTicket.metodoPagamento
                                      : ""
                                  }`
                                : "Pendente",
                            },
                            {
                              label: "Emitido em",
                              value: responsavelModalTicket.criadoEm
                                ? formatDate(responsavelModalTicket.criadoEm)
                                : null,
                            },
                            {
                              label: "Entrada em",
                              value:
                                responsavelModalTicket.usado &&
                                responsavelModalTicket.horaEntrada
                                  ? formatDate(
                                      responsavelModalTicket.horaEntrada
                                    )
                                  : null,
                            },
                          ]
                            .filter(({ value }) => value)
                            .map(({ label, value }) => (
                              <div
                                key={label}
                                className="flex items-center justify-between px-4 py-2.5"
                              >
                                <span className="text-zinc-500 text-xs font-semibold">
                                  {label}
                                </span>
                                <span className="text-white text-xs font-mono">
                                  {value}
                                </span>
                              </div>
                            ))}
                        </div>
                        <div className="flex gap-2 p-4 border-t border-zinc-800">
                          <button
                            onClick={handleToggleValidarResponsavel}
                            disabled={responsavelModalLoading}
                            className={`flex-1 h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
                              responsavelModalTicket.usado
                                ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700"
                                : "bg-white text-black hover:bg-zinc-200"
                            }`}
                          >
                            {responsavelModalTicket.usado ? (
                              <>
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                  <path d="M3 3v5h5" />
                                </svg>{" "}
                                Desvalidar
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-3.5 w-3.5" /> Validar
                              </>
                            )}
                          </button>
                          <button
                            onClick={handleExcluirIngressoResponsavel}
                            disabled={responsavelModalLoading}
                            className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-all disabled:opacity-50 shrink-0"
                            title="Excluir ingresso"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Sem ingresso — form para associar */
                      <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-4 space-y-4">
                        <p className="text-zinc-500 text-xs">
                          Este responsável ainda não possui ingresso. Associe um
                          agora:
                        </p>

                        {/* Lote */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block">
                            Lote
                          </label>
                          <select
                            value={associarResponsavelForm.loteId}
                            onChange={(e) =>
                              setAssociarResponsavelForm((p) => ({
                                ...p,
                                loteId: e.target.value,
                              }))
                            }
                            className="flex h-11 w-full appearance-none rounded-xl border border-zinc-800 bg-black text-white px-4 text-sm focus:outline-none focus:border-zinc-600 transition-all"
                          >
                            <option value="" disabled>
                              Selecione o lote
                            </option>
                            {batches.map((b) => (
                              <option
                                key={b.id}
                                value={b.id}
                                className="bg-zinc-900"
                              >
                                {b.nome} — R${" "}
                                {Number(b.preco).toFixed(2).replace(".", ",")}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* E-mail */}
                        {!responsavelModal.email && (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block">
                              E-mail (opcional)
                            </label>
                            <input
                              type="email"
                              placeholder="email@exemplo.com"
                              value={associarResponsavelForm.email}
                              onChange={(e) =>
                                setAssociarResponsavelForm((p) => ({
                                  ...p,
                                  email: e.target.value,
                                }))
                              }
                              className="flex h-11 w-full rounded-xl border border-zinc-800 bg-black text-white px-4 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-all"
                            />
                          </div>
                        )}

                        {/* Status + Pagamento */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block">
                              Status
                            </label>
                            <div className="flex rounded-xl border border-zinc-800 overflow-hidden">
                              {(["pendente", "validado"] as const).map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() =>
                                    setAssociarResponsavelForm((p) => ({
                                      ...p,
                                      status: s,
                                    }))
                                  }
                                  className={`flex-1 py-2.5 text-[11px] font-bold transition-all capitalize ${
                                    associarResponsavelForm.status === s
                                      ? "bg-white text-black"
                                      : "bg-black text-zinc-500 hover:text-white"
                                  }`}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block">
                              Pagamento
                            </label>
                            <div className="flex rounded-xl border border-zinc-800 overflow-hidden">
                              {([false, true] as const).map((v) => (
                                <button
                                  key={String(v)}
                                  type="button"
                                  onClick={() =>
                                    setAssociarResponsavelForm((p) => ({
                                      ...p,
                                      pago: v,
                                    }))
                                  }
                                  className={`flex-1 py-2.5 text-[11px] font-bold transition-all ${
                                    associarResponsavelForm.pago === v
                                      ? "bg-white text-black"
                                      : "bg-black text-zinc-500 hover:text-white"
                                  }`}
                                >
                                  {v ? "Pago" : "Pendente"}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            fetchBatches();
                            handleAssociarIngressoResponsavel();
                          }}
                          disabled={
                            !associarResponsavelForm.loteId ||
                            associarResponsavelLoading
                          }
                          className="w-full h-11 rounded-xl bg-white text-black text-xs font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-50"
                        >
                          {associarResponsavelLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <LuTicketPlus className="h-4 w-4" />
                          )}
                          Associar Ingresso
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── POP DE CONFIRMAÇÃO: LIMPAR TODOS RESPONSÁVEIS ── */}
      {confirmLimparResponsaveis && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() =>
            !limparResponsaveisLoading && setConfirmLimparResponsaveis(false)
          }
        >
          <div
            className="bg-[#0a0a0a] border border-zinc-800 p-6 rounded-3xl max-w-sm w-full flex flex-col items-center text-center shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mb-4">
              <Trash2 className="h-7 w-7" />
            </div>
            <h4 className="text-white font-bold text-lg mb-1">
              Limpar todos os responsáveis?
            </h4>
            <p className="text-zinc-500 text-sm mb-1">
              <span className="text-white font-semibold">
                {allResponsaveis.length} responsável(is)
              </span>{" "}
              serão removidos.
            </p>
            <p className="text-zinc-600 text-xs mb-6">
              Esta ação é irreversível. Todos os registros de responsáveis serão
              excluídos permanentemente do sistema.
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setConfirmLimparResponsaveis(false)}
                disabled={limparResponsaveisLoading}
                className="flex-1 h-11 rounded-xl bg-transparent border border-zinc-800 text-zinc-300 text-sm font-semibold hover:bg-zinc-900 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleLimparResponsaveis}
                disabled={limparResponsaveisLoading}
                className="flex-1 h-11 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {limparResponsaveisLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Limpar tudo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── POP DE CONFIRMAÇÃO: EXCLUIR RESPONSÁVEL ── */}
      {confirmDeleteResponsavel && responsavelModal && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setConfirmDeleteResponsavel(false)}
        >
          <div
            className="bg-[#0a0a0a] border border-zinc-800 p-6 rounded-3xl max-w-sm w-full flex flex-col items-center text-center shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mb-4">
              <Trash2 className="h-7 w-7" />
            </div>
            <h4 className="text-white font-bold text-lg mb-1">
              Excluir responsável?
            </h4>
            <p className="text-zinc-500 text-sm mb-1">
              <span className="text-white font-semibold">
                {responsavelModal.nome}
              </span>
            </p>
            <p className="text-zinc-600 text-xs mb-6">
              Esta ação é irreversível. O responsável será removido
              permanentemente.
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setConfirmDeleteResponsavel(false)}
                disabled={deleteResponsavelLoading}
                className="flex-1 h-11 rounded-xl bg-transparent border border-zinc-800 text-zinc-300 text-sm font-semibold hover:bg-zinc-900 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteResponsavel}
                disabled={deleteResponsavelLoading}
                className="flex-1 h-11 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {deleteResponsavelLoading ? (
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

      {/* ── POP DE CONFIRMAÇÃO: REMOVER RESPONSÁVEL (tela do aluno) ── */}
      {responsavelToRemove && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setResponsavelToRemove(null)}
        >
          <div
            className="bg-[#0a0a0a] border border-zinc-800 p-6 rounded-3xl max-w-sm w-full flex flex-col items-center text-center shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mb-4">
              <Trash2 className="h-7 w-7" />
            </div>
            <h4 className="text-white font-bold text-lg mb-1">
              Remover responsável
            </h4>
            <p className="text-zinc-500 text-sm mb-1">
              <span className="text-white font-semibold">
                {responsavelToRemove.nome}
              </span>
            </p>
            <p className="text-zinc-600 text-xs mb-6">
              Você pode apenas desvincular este responsável do aluno (o cadastro
              dele continua existindo) ou excluí-lo permanentemente do sistema.
            </p>
            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={() =>
                  handleDesassociarResponsavel(responsavelToRemove)
                }
                disabled={removeResponsavelLoading}
                className="w-full h-11 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all disabled:opacity-50"
              >
                {removeResponsavelLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}
                Desassociar do aluno
              </button>
              <button
                onClick={() =>
                  handleExcluirResponsavelFromStudent(responsavelToRemove)
                }
                disabled={removeResponsavelLoading}
                className="w-full h-11 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {removeResponsavelLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Excluir permanentemente
              </button>
              <button
                onClick={() => setResponsavelToRemove(null)}
                disabled={removeResponsavelLoading}
                className="w-full h-11 rounded-xl bg-transparent border border-zinc-800 text-zinc-300 text-sm font-semibold hover:bg-zinc-900 transition-all disabled:opacity-50 mt-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── POP DE CONFIRMAÇÃO: EXCLUIR ALUNO ── */}
      {confirmDeleteStudent && studentModal && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setConfirmDeleteStudent(false)}
        >
          <div
            className="bg-[#0a0a0a] border border-zinc-800 p-6 rounded-3xl max-w-sm w-full flex flex-col items-center text-center shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mb-4">
              <Trash2 className="h-7 w-7" />
            </div>
            <h4 className="text-white font-bold text-lg mb-1">
              Excluir aluno?
            </h4>
            <p className="text-zinc-500 text-sm mb-1">
              <span className="text-white font-semibold">
                {studentModal.nome}
              </span>
            </p>
            <p className="text-zinc-600 text-xs mb-6">
              Esta ação é irreversível. O aluno será removido da turma{" "}
              <span className="text-zinc-400 font-semibold">
                {studentModal.turmaId}
              </span>
              .
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setConfirmDeleteStudent(false)}
                disabled={deleteStudentLoading}
                className="flex-1 h-11 rounded-xl bg-transparent border border-zinc-800 text-zinc-300 text-sm font-semibold hover:bg-zinc-900 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteStudent}
                disabled={deleteStudentLoading}
                className="flex-1 h-11 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {deleteStudentLoading ? (
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

      {/* ── MODAIS GLOBAIS ── */}

      {/* Modal de Confirmação de Logout */}
      {confirmLogoutModal && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all animate-in fade-in"
          onClick={() => setConfirmLogoutModal(false)}
        >
          <div
            className="bg-[#0a0a0a] border border-zinc-800 p-6 sm:p-8 rounded-3xl max-w-sm w-full flex flex-col items-center text-center relative shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mb-5">
              <LogOut className="h-8 w-8" />
            </div>
            <h4 className="text-white font-bold text-xl mb-2">
              Sair da conta?
            </h4>
            <p className="text-zinc-500 text-sm mb-6">
              Tem certeza que deseja encerrar sua sessão?
            </p>
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={() => setConfirmLogoutModal(false)}
              >
                Cancelar
              </Button>
              <button
                onClick={() => {
                  setConfirmLogoutModal(false);
                  onLogout && onLogout();
                }}
                className="flex-1 h-11 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação / Edição de Lote */}
      {batchModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all"
          onClick={() => setBatchModal(null)}
        >
          <div
            className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl w-full max-w-lg relative shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 sm:p-8 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <IoMdAddCircleOutline className="w-6 h-6" />
                {batchModal.id ? "Editar Lote" : "Novo Lote"}
              </h3>
              <button
                onClick={() => setBatchModal(null)}
                className="text-zinc-500 hover:text-white bg-zinc-900 p-2 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={handleSaveBatch}
              className="p-6 sm:p-8 space-y-5 overflow-y-auto"
            >
              <div>
                <Label>Nome do lote</Label>
                <Input
                  required
                  value={batchModal.nome || ""}
                  onChange={(e) =>
                    setBatchModal({ ...batchModal, nome: e.target.value })
                  }
                  placeholder="Ex: Lote 1 - Antecipado"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Preço (R$)</Label>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={batchModal.preco || ""}
                    onChange={(e) =>
                      setBatchModal({ ...batchModal, preco: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Quantidade Limite</Label>
                  <Input
                    required
                    type="number"
                    min="1"
                    value={batchModal.quantidade || ""}
                    onChange={(e) =>
                      setBatchModal({
                        ...batchModal,
                        quantidade: e.target.value,
                      })
                    }
                    placeholder="Qtd."
                  />
                </div>
              </div>
              <div>
                <Label>Data e Horário Limite (Opcional)</Label>
                <Input
                  type="datetime-local"
                  value={batchModal.dataLimite || ""}
                  onChange={(e) =>
                    setBatchModal({ ...batchModal, dataLimite: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Público-alvo</Label>
                <select
                  required
                  value={batchModal.publico || "Ambos"}
                  onChange={(e) =>
                    setBatchModal({ ...batchModal, publico: e.target.value })
                  }
                  className="flex h-12 w-full appearance-none rounded-xl border border-zinc-800 bg-black text-white px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white transition-all"
                >
                  <option value="Alunos">Apenas Alunos</option>
                  <option value="Pais/Responsáveis">Pais / Responsáveis</option>
                  <option value="Ambos">Ambos (Todos)</option>
                </select>
              </div>

              {/* ── Visibilidade por Turma ── */}
              {(batchModal.publico || "Ambos") !== "Pais/Responsáveis" && (
              <div className="border border-zinc-800 rounded-xl overflow-hidden">
                {/* Cabeçalho colapsável */}
                <button
                  type="button"
                  onClick={() =>
                    setBatchModal({
                      ...batchModal,
                      _turmasOpen: !batchModal._turmasOpen,
                    })
                  }
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-zinc-900 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        !batchModal.turmasVisiveis ||
                        batchModal.turmasVisiveis.length === 36
                          ? "bg-green-400"
                          : batchModal.turmasVisiveis.length === 0
                          ? "bg-red-400"
                          : "bg-yellow-400"
                      }`}
                    />
                    <span className="text-sm font-semibold text-white">
                      Visibilidade por Turma
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500">
                      {!batchModal.turmasVisiveis ||
                      batchModal.turmasVisiveis.length === 36
                        ? "Todas as turmas"
                        : batchModal.turmasVisiveis.length === 0
                        ? "Nenhuma turma"
                        : `${batchModal.turmasVisiveis.length} de 36 turmas`}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${
                        batchModal._turmasOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {/* Painel expandido */}
                {batchModal._turmasOpen && (
                  <div className="border-t border-zinc-800 bg-black">
                    {/* Barra de ação rápida */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                        Selecionar
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const todas = [1, 2, 3].flatMap((ano) =>
                              Array.from(
                                { length: 12 },
                                (_, i) => `${ano}${String.fromCharCode(65 + i)}`
                              )
                            );
                            setBatchModal({
                              ...batchModal,
                              turmasVisiveis: todas,
                              _turmasOpen: true,
                            });
                          }}
                          className="px-3 py-1 rounded-lg text-[10px] font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                        >
                          Todas
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setBatchModal({
                              ...batchModal,
                              turmasVisiveis: [],
                              _turmasOpen: true,
                            })
                          }
                          className="px-3 py-1 rounded-lg text-[10px] font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                        >
                          Nenhuma
                        </button>
                      </div>
                    </div>

                    {/* Grade por ano */}
                    <div className="p-4 space-y-5">
                      {[1, 2, 3].map((ano) => {
                        const turmasDoAno = Array.from(
                          { length: 12 },
                          (_, i) => `${ano}${String.fromCharCode(65 + i)}`
                        );
                        const selecionadas = batchModal.turmasVisiveis;
                        const todasAsTurmas = [1, 2, 3].flatMap((a) =>
                          Array.from(
                            { length: 12 },
                            (_, i) => `${a}${String.fromCharCode(65 + i)}`
                          )
                        );
                        const todasMarcadas =
                          !selecionadas || selecionadas.length === 36;
                        const anoMarcadas = turmasDoAno.filter(
                          (t) =>
                            todasMarcadas || (selecionadas || []).includes(t)
                        );
                        const todoAnoMarcado = anoMarcadas.length === 12;
                        const parcialAno =
                          anoMarcadas.length > 0 && anoMarcadas.length < 12;

                        const toggleAno = () => {
                          const base = todasMarcadas
                            ? [...todasAsTurmas]
                            : [...(selecionadas || [])];
                          if (todoAnoMarcado) {
                            setBatchModal({
                              ...batchModal,
                              turmasVisiveis: base.filter(
                                (t) => !turmasDoAno.includes(t)
                              ),
                              _turmasOpen: true,
                            });
                          } else {
                            setBatchModal({
                              ...batchModal,
                              turmasVisiveis: [
                                ...new Set([...base, ...turmasDoAno]),
                              ],
                              _turmasOpen: true,
                            });
                          }
                        };

                        const toggleTurma = (turma) => {
                          const base = todasMarcadas
                            ? [...todasAsTurmas]
                            : [...(selecionadas || [])];
                          const incluida = base.includes(turma);
                          setBatchModal({
                            ...batchModal,
                            turmasVisiveis: incluida
                              ? base.filter((t) => t !== turma)
                              : [...base, turma],
                            _turmasOpen: true,
                          });
                        };

                        return (
                          <div key={ano}>
                            {/* Header do ano com toggle */}
                            <div className="flex items-center justify-between mb-2.5">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={toggleAno}
                                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                                    todoAnoMarcado
                                      ? "bg-white border-white"
                                      : parcialAno
                                      ? "bg-zinc-700 border-zinc-600"
                                      : "border-zinc-700 bg-transparent hover:border-zinc-500"
                                  }`}
                                >
                                  {todoAnoMarcado && (
                                    <svg
                                      viewBox="0 0 10 10"
                                      className="w-3 h-3"
                                    >
                                      <path
                                        d="M1.5 5L4 7.5L8.5 2.5"
                                        stroke="black"
                                        strokeWidth="2"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  )}
                                  {parcialAno && (
                                    <svg
                                      viewBox="0 0 10 10"
                                      className="w-3 h-3"
                                    >
                                      <path
                                        d="M2 5H8"
                                        stroke="white"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                      />
                                    </svg>
                                  )}
                                </button>
                                <span className="text-xs font-bold text-zinc-200 tracking-wide">
                                  {ano}º Ano
                                </span>
                              </div>
                              <span className="text-[10px] text-zinc-600 font-medium">
                                {anoMarcadas.length}/12
                              </span>
                            </div>

                            {/* Turmas */}
                            <div className="grid grid-cols-6 gap-1.5">
                              {turmasDoAno.map((turma) => {
                                const marcada =
                                  todasMarcadas ||
                                  (selecionadas || []).includes(turma);
                                return (
                                  <button
                                    key={turma}
                                    type="button"
                                    onClick={() => toggleTurma(turma)}
                                    className={`h-9 rounded-lg text-xs font-bold transition-all ${
                                      marcada
                                        ? "bg-white text-black shadow-sm"
                                        : "bg-zinc-900 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 border border-zinc-800"
                                    }`}
                                  >
                                    {turma.slice(1)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="px-4 pb-3 text-[10px] text-zinc-600">
                      Turmas marcadas enxergam este lote na hora da compra.
                    </div>
                  </div>
                )}
              </div>
              )}
              {/* ── Toggle Esgotado Manualmente ── */}
              <button
                type="button"
                onClick={() =>
                  setBatchModal({ ...batchModal, esgotado: !batchModal.esgotado })
                }
                className={`w-full flex items-center justify-between px-5 py-4 rounded-xl border transition-all ${
                  batchModal.esgotado
                    ? "border-red-500/40 bg-red-500/5"
                    : "border-zinc-800 bg-black hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      batchModal.esgotado
                        ? "bg-red-500 border-red-500"
                        : "border-zinc-600 bg-transparent"
                    }`}
                  >
                    {batchModal.esgotado && (
                      <svg viewBox="0 0 10 10" className="w-3 h-3">
                        <path
                          d="M1.5 5L4 7.5L8.5 2.5"
                          stroke="white"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-bold ${batchModal.esgotado ? "text-red-400" : "text-zinc-400"}`}>
                      Marcar como Esgotado
                    </p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {batchModal.esgotado
                        ? "Usuários verão este lote como esgotado"
                        : "Esgotamento automático por quantidade ativo"}
                    </p>
                  </div>
                </div>
              </button>

              <div className="pt-4 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12"
                  onClick={() => setBatchModal(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-12"
                  isLoading={loadingBatches}
                >
                  Salvar Lote
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Visibilidade do Lote */}
      {confirmVisibilityModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all"
          onClick={() => setConfirmVisibilityModal(null)}
        >
          <div
            className="bg-[#0a0a0a] border border-zinc-800 p-6 sm:p-8 rounded-3xl max-w-sm w-full flex flex-col items-center text-center relative shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center justify-center mb-5">
              {confirmVisibilityModal.visivel ? (
                <AiOutlineEyeInvisible className="h-8 w-8 text-zinc-400" />
              ) : (
                <IoEyeOutline className="h-8 w-8 text-white" />
              )}
            </div>
            <h4 className="text-white font-bold text-lg mb-2">
              {confirmVisibilityModal.visivel
                ? "Deseja ocultar este lote?"
                : "Deseja tornar este lote visível novamente?"}
            </h4>
            <p className="text-zinc-500 text-sm mb-6">
              {confirmVisibilityModal.visivel
                ? "Ele deixará de aparecer para compra, mas ainda poderá ser editado no painel."
                : "Ele voltará a ficar disponível para compra pelo público."}
            </p>
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={() => setConfirmVisibilityModal(null)}
              >
                Cancelar
              </Button>
              <Button
                className={`flex-1 h-11 border-none ${
                  confirmVisibilityModal.visivel
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-white hover:bg-zinc-200 text-black"
                }`}
                isLoading={loadingBatches}
                onClick={handleToggleVisibility}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Outros Modais Existentes (Scanner, Detalhes, Dashboard, Excluir) */}
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
                      {formatCpf(
                        getTicketCpf(scanResultModal.ticket, usersMap)
                      )}
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
                  <LuTicketCheck className="h-3 w-3" />
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
                    {formatCpf(getTicketCpf(infoModalTicket, usersMap))}
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
                    Pagamento
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                      infoModalTicket.pagamentoConfirmado
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-yellow-500/10 text-yellow-500"
                    }`}
                  >
                    <Banknote className="h-3 w-3" />
                    {infoModalTicket.pagamentoConfirmado
                      ? `Pago · ${formatDate(infoModalTicket.dataPagamento)}`
                      : "Não pago"}
                  </span>
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
              {/* Botão confirmar/cancelar pagamento */}
              {!infoModalTicket.pagamentoConfirmado ? (
                <button
                  onClick={async () => {
                    setAdminLoading(true);
                    try {
                      const agora = new Date().toISOString();
                      await updateDoc(
                        doc(db, "ingressos", infoModalTicket.id),
                        {
                          pagamentoConfirmado: true,
                          dataPagamento: agora,
                        }
                      );
                      setAllTickets((prev) =>
                        prev.map((t) =>
                          t.id === infoModalTicket.id
                            ? {
                                ...t,
                                pagamentoConfirmado: true,
                                dataPagamento: agora,
                              }
                            : t
                        )
                      );
                      setInfoModalTicket((prev) =>
                        prev
                          ? {
                              ...prev,
                              pagamentoConfirmado: true,
                              dataPagamento: agora,
                            }
                          : prev
                      );
                      showToast("Pagamento confirmado!", "success");
                    } catch {
                      showToast("Erro ao confirmar pagamento.");
                    }
                    setAdminLoading(false);
                  }}
                  disabled={adminLoading}
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {adminLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Banknote className="h-4 w-4" />
                  )}
                  Confirmar Pagamento
                </button>
              ) : (
                <button
                  onClick={async () => {
                    setAdminLoading(true);
                    try {
                      await updateDoc(
                        doc(db, "ingressos", infoModalTicket.id),
                        {
                          pagamentoConfirmado: false,
                          dataPagamento: null,
                        }
                      );
                      setAllTickets((prev) =>
                        prev.map((t) =>
                          t.id === infoModalTicket.id
                            ? {
                                ...t,
                                pagamentoConfirmado: false,
                                dataPagamento: null,
                              }
                            : t
                        )
                      );
                      setInfoModalTicket((prev) =>
                        prev
                          ? {
                              ...prev,
                              pagamentoConfirmado: false,
                              dataPagamento: null,
                            }
                          : prev
                      );
                      showToast("Pagamento removido.", "success");
                    } catch {
                      showToast("Erro ao remover pagamento.");
                    }
                    setAdminLoading(false);
                  }}
                  disabled={adminLoading}
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800 text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {adminLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Banknote className="h-4 w-4" />
                  )}
                  Remover Pagamento
                </button>
              )}

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
                    <LuTicketCheck className="h-4 w-4" />
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
                  {dashboardDetailModal === "pendentes" &&
                    (modoPendentes === "presenca"
                      ? "Pagos que ainda não entraram · "
                      : "Ingressos não pagos · ")}
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

      {/* ── MODAL DE RECEITA DETALHADA ── */}
      {revenueModalOpen &&
        (() => {
          const pagos = allTickets.filter((t) => t.pagamentoConfirmado);

          const ticketsPix = pagos.filter(
            (t) => !t.metodoPagamento || t.metodoPagamento === "pix"
          );
          const ticketsCartao = pagos.filter(
            (t) => t.metodoPagamento === "cartao"
          );
          const ticketsDinheiro = pagos.filter(
            (t) => t.metodoPagamento === "dinheiro"
          );

          const somarBruto = (arr) =>
            arr.reduce((s, t) => s + (t.price || 0), 0);

          const TAXA_PIX = 0.0099;
          const TAXA_CARTAO = 0.0498;

          const brutoPix = somarBruto(ticketsPix);
          const brutoCartao = somarBruto(ticketsCartao);
          const brutoDinheiro = somarBruto(ticketsDinheiro);

          const taxaPix = brutoPix * TAXA_PIX;
          const taxaCartao = brutoCartao * TAXA_CARTAO;

          const totalBruto = brutoPix + brutoCartao + brutoDinheiro;
          const totalTaxas = taxaPix + taxaCartao;
          const totalLiquido = totalBruto - totalTaxas;

          const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

          const metodos = [
            {
              label: "PIX",
              taxa: "0,99%",
              qtd: ticketsPix.length,
              bruto: brutoPix,
              taxaValor: taxaPix,
            },
            {
              label: "Cartão de Crédito",
              taxa: "4,98%",
              qtd: ticketsCartao.length,
              bruto: brutoCartao,
              taxaValor: taxaCartao,
            },
            {
              label: "Dinheiro",
              taxa: "0%",
              qtd: ticketsDinheiro.length,
              bruto: brutoDinheiro,
              taxaValor: 0,
            },
          ].filter((m) => m.qtd > 0);

          return (
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
              onClick={() => setRevenueModalOpen(false)}
            >
              <div
                className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-7 py-6 border-b border-zinc-800/60 shrink-0">
                  <div>
                    <h3 className="text-white font-bold text-lg tracking-tight">
                      Receita Detalhada
                    </h3>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      {pagos.length} pagamento{pagos.length !== 1 ? "s" : ""}{" "}
                      confirmado{pagos.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-full transition-colors"
                    onClick={() => setRevenueModalOpen(false)}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="overflow-y-auto flex-1">
                  {pagos.length === 0 ? (
                    <div className="py-20 text-center text-zinc-600 flex flex-col items-center gap-3">
                      <Banknote className="w-10 h-10 opacity-20" />
                      <p className="text-sm">
                        Nenhum pagamento confirmado ainda.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Métodos de pagamento */}
                      <div className="px-7 py-5 space-y-px">
                        {metodos.map((m, idx) => (
                          <div key={m.label}>
                            {idx > 0 && (
                              <div className="h-px bg-zinc-800/60 my-4" />
                            )}
                            <div className="space-y-3">
                              {/* Cabeçalho do método */}
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-white font-semibold text-sm">
                                    {m.label}
                                  </p>
                                  <p className="text-zinc-600 text-xs mt-0.5">
                                    {m.qtd} ingresso{m.qtd !== 1 ? "s" : ""} ·
                                    taxa {m.taxa}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-white font-bold font-mono text-sm">
                                    {fmt(m.bruto - m.taxaValor)}
                                  </p>
                                  <p className="text-zinc-600 text-[10px] uppercase tracking-widest font-bold mt-0.5">
                                    líquido
                                  </p>
                                </div>
                              </div>
                              {/* Linha de valores */}
                              <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2.5">
                                  <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mb-1">
                                    Bruto
                                  </p>
                                  <p className="text-white font-mono text-sm font-bold">
                                    {fmt(m.bruto)}
                                  </p>
                                </div>
                                <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2.5">
                                  <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mb-1">
                                    Taxa
                                  </p>
                                  <p className="text-red-400 font-mono text-sm font-bold">
                                    −{fmt(m.taxaValor)}
                                  </p>
                                </div>
                                <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2.5">
                                  <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mb-1">
                                    Líquido
                                  </p>
                                  <p className="text-white font-mono text-sm font-bold">
                                    {fmt(m.bruto - m.taxaValor)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Bloco de totais */}
                      <div className="border-t border-zinc-800/60 mx-7 mb-7 pt-5 space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                          Total
                        </p>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400 text-sm">
                              Valor bruto
                            </span>
                            <span className="text-white font-mono text-sm font-bold">
                              {fmt(totalBruto)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-red-400 text-sm font-medium">
                              Taxas Mercado Pago
                            </span>
                            <span className="text-red-400 font-mono text-sm font-bold">
                              −{fmt(totalTaxas)}
                            </span>
                          </div>
                        </div>

                        {/* Total líquido */}
                        <div className="mt-4 flex items-center justify-between bg-white rounded-2xl px-5 py-4">
                          <div>
                            <p className="text-black font-bold text-base">
                              Total líquido
                            </p>
                            <p className="text-zinc-500 text-xs mt-0.5">
                              Após descontar taxas
                            </p>
                          </div>
                          <p className="text-black font-black font-mono text-2xl">
                            {fmt(totalLiquido)}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {/* ── MODAL: CONFIRMAR EXCLUSÃO DE LOTE ── */}
      {confirmDeleteBatch && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => !deletingBatch && setConfirmDeleteBatch(null)}
        >
          <div
            className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 p-7 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Excluir Lote</h3>
                <p className="text-zinc-500 text-xs mt-0.5">Esta ação não pode ser desfeita</p>
              </div>
            </div>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Tem certeza que deseja excluir o lote{" "}
              <span className="text-white font-semibold">"{confirmDeleteBatch.nome}"</span>?
              {(allTickets || []).filter((t) => t.loteId === confirmDeleteBatch.id || t.type === confirmDeleteBatch.nome).length > 0 && (
                <span className="block mt-2 text-amber-400 text-xs font-semibold">
                  ⚠ Atenção: existem{" "}
                  {(allTickets || []).filter((t) => t.loteId === confirmDeleteBatch.id || t.type === confirmDeleteBatch.nome).length}{" "}
                  ingresso(s) vinculado(s) a este lote.
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteBatch(null)}
                disabled={deletingBatch}
                className="flex-1 h-11 rounded-xl border border-zinc-800 text-zinc-300 text-sm font-semibold hover:bg-zinc-900 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setDeletingBatch(true);
                  try {
                    await deleteDoc(doc(db, "lotes", confirmDeleteBatch.id));
                    setBatches((prev) => prev.filter((b) => b.id !== confirmDeleteBatch.id));
                    setConfirmDeleteBatch(null);
                    showToast("Lote excluído com sucesso.", "success");
                  } catch {
                    showToast("Erro ao excluir lote.");
                  }
                  setDeletingBatch(false);
                }}
                disabled={deletingBatch}
                className="flex-1 h-11 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletingBatch && <Loader2 className="h-4 w-4 animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 bg-zinc-900 text-white border border-zinc-800 shadow-2xl rounded-xl p-4 flex items-center gap-3 z-[150]">
          <AlertCircle className="h-5 w-5" />
          {toast.message}
        </div>
      )}

      {/* ── MODAL: LISTA DE INGRESSOS (Presença) ── */}
      {presencaListModal && (() => {
        const filteredTickets =
          presencaListModal === "entraram"
            ? allTickets.filter((t) => t.usado)
            : presencaListModal === "pendentes"
            ? allTickets.filter((t) => !t.usado)
            : allTickets;

        const titulo =
          presencaListModal === "entraram"
            ? "Entraram"
            : presencaListModal === "pendentes"
            ? "Pendentes"
            : "Todos os Ingressos";

        const sorted = [...filteredTickets].sort((a, b) =>
          (a.nomeAluno || "").localeCompare(b.nomeAluno || "")
        );

        return (
          <div
            className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setPresencaListModal(null)}
          >
            <div
              className="bg-[#0a0a0a] border border-zinc-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800/60 shrink-0">
                <div>
                  <h3 className="text-white font-bold text-lg tracking-tight">
                    {titulo}
                  </h3>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    {sorted.length} ingresso{sorted.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-full transition-colors"
                  onClick={() => setPresencaListModal(null)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Filtros rápidos */}
              <div className="flex gap-2 px-6 py-3 border-b border-zinc-800/40 shrink-0">
                {(["todos", "entraram", "pendentes"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setPresencaListModal(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                      presencaListModal === f
                        ? "bg-white text-black"
                        : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                    }`}
                  >
                    {f === "todos" ? "Todos" : f === "entraram" ? "Entraram" : "Pendentes"}
                    <span className="ml-1.5 opacity-60">
                      {f === "todos"
                        ? allTickets.length
                        : f === "entraram"
                        ? allTickets.filter((t) => t.usado).length
                        : allTickets.filter((t) => !t.usado).length}
                    </span>
                  </button>
                ))}
              </div>

              {/* Lista */}
              <div className="overflow-y-auto flex-1">
                {sorted.length === 0 ? (
                  <div className="py-16 flex flex-col items-center gap-3 text-zinc-600">
                    <Ticket className="w-10 h-10 opacity-20" />
                    <p className="text-sm">Nenhum ingresso encontrado.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/50">
                    {sorted.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-4 px-6 py-4 hover:bg-zinc-900/40 transition-colors"
                      >
                        {/* Ícone de status */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            t.usado
                              ? "bg-green-500/15 border border-green-500/30"
                              : "bg-zinc-800 border border-zinc-700"
                          }`}
                        >
                          {t.usado ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          ) : (
                            <Clock className="w-4 h-4 text-zinc-500" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate leading-tight">
                            {t.nomeAluno || "—"}
                          </p>
                          <p className="text-zinc-500 text-xs mt-0.5 truncate">
                            {t.ano ? `${t.ano}º Ano` : ""}
                            {t.ano && t.turma ? ` · Turma ${t.turma}` : ""}
                            {t.type ? ` · ${t.type}` : ""}
                          </p>
                        </div>

                        {/* Código + badge */}
                        <div className="text-right shrink-0">
                          <p className="text-zinc-400 font-mono text-xs font-bold">
                            {t.code || t.id}
                          </p>
                          <span
                            className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                              t.usado
                                ? "bg-green-500/15 text-green-400"
                                : t.pagamentoConfirmado
                                ? "bg-blue-500/15 text-blue-400"
                                : "bg-zinc-800 text-zinc-500"
                            }`}
                          >
                            {t.usado ? "Entrou" : t.pagamentoConfirmado ? "Pago" : "Pendente"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
