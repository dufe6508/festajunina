import React, { useState, useEffect, useRef } from "react";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ShoppingCart,
  Plus,
  Minus,
  CreditCard,
  ArrowLeft,
  Copy,
  LogOut,
  User,
  Ticket as TicketIcon,
  CircleUser,
  Home,
  Menu,
  X,
  GraduationCap,
  Phone,
  Mail,
  BookOpen,
  Clock,
  MapPin,
  Calendar,
} from "lucide-react";
import { MdQrCode2 } from "react-icons/md";
// Importações REAIS do Firebase consolidadas
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";

import { initMercadoPago, Payment } from "@mercadopago/sdk-react";

initMercadoPago("TEST-0e376194-c29f-4c9b-850b-fadfab595d80", { locale: "pt-BR" });

// Importando o nosso novo Dashboard separado
import DashboardAdmin from "./DashboardAdmin";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBGV0JAs7kI4JiKVvZDphaZ2h8hOXZAmps",
  authDomain: "festajunina-brandao.firebaseapp.com",
  projectId: "festajunina-brandao",
  storageBucket: "festajunina-brandao.firebasestorage.app",
  messagingSenderId: "609151203088",
  appId: "1:609151203088:web:231ac7eaeaf666d9511795",
  measurementId: "G-0Y2T5K1L6E",
};

// Inicialização
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ─── Ícone do Google ─── */
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

/* ─── Componentes Base ─── */
const Label = ({ children, htmlFor, className = "" }) => (
  <label
    htmlFor={htmlFor}
    className={`text-sm font-medium leading-none text-zinc-400 ${className}`}
  >
    {children}
  </label>
);

const Input = React.forwardRef(({ className = "", error, ...props }, ref) => (
  <input
    ref={ref}
    className={`flex h-12 w-full rounded-xl border ${
      error
        ? "border-red-500 bg-red-500/10 text-red-100"
        : "border-zinc-800 bg-zinc-950 text-white"
    } px-4 py-2 text-base sm:text-sm placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white transition-all ${className}`}
    {...props}
  />
));
Input.displayName = "Input";

const Select = ({ value, onChange, options, placeholder, error, name }) => (
  <div className="relative">
    <select
      name={name}
      value={value}
      onChange={onChange}
      className={`flex h-12 w-full appearance-none rounded-xl border ${
        error
          ? "border-red-500 bg-red-500/10 text-red-100"
          : "border-zinc-800 bg-zinc-950 text-white"
      } px-4 py-2 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-white transition-all`}
    >
      <option value="" disabled className="text-zinc-500">
        {placeholder}
      </option>
      {options.map((opt) => (
        <option
          key={opt.value}
          value={opt.value}
          className="bg-zinc-900 text-white"
        >
          {opt.label}
        </option>
      ))}
    </select>
    <ChevronDown className="absolute right-4 top-4 h-4 w-4 text-zinc-500 pointer-events-none" />
  </div>
);

const Button = ({
  children,
  className = "",
  isLoading,
  variant = "primary",
  ...props
}) => {
  const variants = {
    primary: "bg-white text-black hover:bg-zinc-200",
    secondary:
      "bg-zinc-900 text-white border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700",
    outline:
      "bg-transparent text-zinc-300 border border-zinc-800 hover:bg-zinc-900 hover:text-white",
    ghost: "bg-transparent text-zinc-400 hover:bg-zinc-900 hover:text-white",
    danger:
      "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:pointer-events-none disabled:opacity-50 h-12 px-6 py-2 ${variants[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
};

/* ─── App Principal ─── */
export default function CadastroApp({ onBack = () => {} }) {
  const [view, setView] = useState("loading");
  const [activeTab, setActiveTab] = useState("inicio");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [toast, setToast] = useState(null);

  const [formData, setFormData] = useState({
    nomeResponsavel: "",
    cpf: "",
    email: "",
    senha: "",
    confirmarSenha: "",
    telefone: "",
    ano: "",
    turma: "",
    nomeAluno: "",
  });
  const [errors, setErrors] = useState({});
  const [currentUser, setCurrentUser] = useState(null);

  const adminBypassRef = useRef(false); // Ref para gerenciar o Bypass Admin

  const [cart, setCart] = useState({ ingresso: 0 });
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [cardData, setCardData] = useState({
    number: "",
    name: "",
    expiry: "",
    cvv: "",
  });

  const [purchasedTickets, setPurchasedTickets] = useState([]);
  const [selectedQr, setSelectedQr] = useState(null);
  const prices = { ingresso: 15 };
  const totalCart = cart.ingresso * prices.ingresso;

  // 1. Ouvinte de Autenticação do Firebase e Persistência de Login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Se tivermos forçado um login de admin, ignoramos o listener do Firebase
      if (adminBypassRef.current) return;

      if (user) {
        try {
          const docRef = doc(db, "usuarios", user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const userData = docSnap.data();
            setCurrentUser({ ...userData, uid: user.uid, email: user.email });

            if (!userData.cpf) {
              setFormData((prev) => ({
                ...prev,
                email: user.email,
                nomeResponsavel:
                  userData.nomeResponsavel || user.displayName || "",
              }));
              setView("complete_profile");
              return;
            }
          } else {
            setCurrentUser({
              nomeResponsavel: user.displayName,
              email: user.email,
              uid: user.uid,
            });
            setFormData((prev) => ({
              ...prev,
              email: user.email,
              nomeResponsavel: user.displayName || "",
            }));
            setView("complete_profile");
            return;
          }

          const q = query(
            collection(db, "ingressos"),
            where("userId", "==", user.uid)
          );
          const querySnapshot = await getDocs(q);

          const tickets = [];
          querySnapshot.forEach((doc) => {
            tickets.push({ id: doc.id, ...doc.data() });
          });

          setPurchasedTickets(tickets);
          setView("dashboard");
        } catch (err) {
          console.error("Erro ao buscar dados do usuário:", err);
          setView("auth_choice");
        }
      } else {
        setCurrentUser(null);
        setView("auth_choice");
      }
    });

    return () => unsubscribe();
  }, []);

  const showToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const applyPhoneMask = (v) => {
    let c = v.replace(/\D/g, "").slice(0, 11);
    if (c.length > 6) return c.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    if (c.length > 2) return c.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
    return c.length ? `(${c}` : c;
  };
  const applyCpfMask = (v) => {
    let c = v.replace(/\D/g, "").slice(0, 11);
    if (c.length > 9)
      return c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (c.length > 6) return c.replace(/^(\d{3})(\d{3})(\d{0,3})/, "$1.$2.$3");
    if (c.length > 3) return c.replace(/^(\d{3})(\d{0,3})/, "$1.$2");
    return c;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let v = value;
    if (name === "telefone") v = applyPhoneMask(value);
    if (name === "cpf") v = applyCpfMask(value);
    setFormData((prev) => ({ ...prev, [name]: v }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  // 2. Login Real via E-mail/Senha
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.senha)
      return showToast("Preencha E-mail/Usuário e Senha.");

    // --- LOGICA DE BYPASS PARA DIRETORIA ---
    if (
      formData.email.toLowerCase() === "brandao" &&
      formData.senha === "brandao"
    ) {
      setIsLoading(true);
      adminBypassRef.current = true;

      // Simulamos um pequeno delay de rede para parecer natural
      setTimeout(() => {
        setCurrentUser({
          uid: "admin_master_123",
          isAdmin: true,
          nomeResponsavel: "Administração Brandão",
          nomeAluno: "Diretoria",
          email: "admin@brandao.com",
        });
        setIsLoading(false);
        setView("dashboard");
      }, 800);
      return;
    }
    // ----------------------------------------

    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, formData.email, formData.senha);
    } catch (error) {
      setIsLoading(false);
      let msg = "E-mail ou senha incorretos.";
      if (error.code === "auth/user-not-found") msg = "Usuário não encontrado.";
      if (error.code === "auth/wrong-password") msg = "Senha incorreta.";
      showToast(msg);
    }
  };

  // 3. Autenticação com Google
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const docRef = doc(db, "usuarios", user.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        await setDoc(docRef, {
          nomeResponsavel: user.displayName || "Usuário",
          email: user.email,
          criadoEm: new Date().toISOString(),
          cpf: "",
        });
      }
    } catch (error) {
      setIsLoading(false);
      if (error.code === "auth/unauthorized-domain") {
        showToast("Domínio não autorizado no Firebase.");
      } else if (error.code === "auth/popup-closed-by-user") {
        showToast("O pop-up foi fechado antes de concluir o login.");
      } else {
        showToast("Erro ao fazer login com o Google.");
      }
    }
  };

  const validateRegister = () => {
    const e = {};
    if (formData.nomeResponsavel.length < 3)
      e.nomeResponsavel = "Mínimo 3 caracteres";
    if (formData.cpf.replace(/\D/g, "").length !== 11) e.cpf = "CPF inválido";
    if (!/^\S+@\S+\.\S+$/.test(formData.email)) e.email = "E-mail inválido";
    if (formData.senha.length < 6) e.senha = "Mínimo 6 caracteres";
    if (formData.senha !== formData.confirmarSenha)
      e.confirmarSenha = "Senhas não coincidem";
    if (formData.telefone.replace(/\D/g, "").length < 10)
      e.telefone = "Telefone inválido";
    if (!formData.ano) e.ano = "Selecione o ano";
    if (!formData.turma) e.turma = "Selecione a turma";
    if (formData.nomeAluno.length < 3) e.nomeAluno = "Mínimo 3 caracteres";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // 4. Cadastro Real via Firebase (Com verificação de CPF)
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!validateRegister())
      return showToast("Corrija os erros para continuar.");

    setIsLoading(true);

    try {
      const qCpf = query(
        collection(db, "usuarios"),
        where("cpf", "==", formData.cpf)
      );
      const snapCpf = await getDocs(qCpf);
      if (!snapCpf.empty) {
        setIsLoading(false);
        return showToast("Este CPF já está cadastrado em outra conta.");
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.senha
      );
      const user = userCredential.user;

      const userData = {
        nomeResponsavel: formData.nomeResponsavel,
        cpf: formData.cpf,
        telefone: formData.telefone,
        ano: formData.ano,
        turma: formData.turma,
        nomeAluno: formData.nomeAluno,
        email: formData.email,
        criadoEm: new Date().toISOString(),
      };

      await setDoc(doc(db, "usuarios", user.uid), userData);

      setIsSuccess(true);
      setIsLoading(false);

      setTimeout(() => {
        setIsSuccess(false);
      }, 2000);
    } catch (error) {
      setIsLoading(false);
      let msg = "Erro ao criar conta.";
      if (error.code === "auth/email-already-in-use")
        msg = "Este e-mail já está em uso.";
      showToast(msg);
    }
  };

  // Completar perfil (para quem loga com Google)
  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    const eErrors = {};
    if (formData.cpf.replace(/\D/g, "").length !== 11)
      eErrors.cpf = "CPF inválido";
    if (formData.telefone.replace(/\D/g, "").length < 10)
      eErrors.telefone = "Telefone inválido";
    if (!formData.ano) eErrors.ano = "Selecione o ano";
    if (!formData.turma) eErrors.turma = "Selecione a turma";
    if (formData.nomeAluno.length < 3)
      eErrors.nomeAluno = "Mínimo 3 caracteres";

    setErrors(eErrors);
    if (Object.keys(eErrors).length > 0)
      return showToast("Corrija os erros para continuar.");

    setIsLoading(true);
    try {
      const qCpf = query(
        collection(db, "usuarios"),
        where("cpf", "==", formData.cpf)
      );
      const snapCpf = await getDocs(qCpf);
      if (!snapCpf.empty) {
        setIsLoading(false);
        return showToast("Este CPF já está cadastrado em outra conta.");
      }

      const userData = {
        nomeResponsavel:
          formData.nomeResponsavel || currentUser.nomeResponsavel,
        cpf: formData.cpf,
        telefone: formData.telefone,
        ano: formData.ano,
        turma: formData.turma,
        nomeAluno: formData.nomeAluno,
      };

      await updateDoc(doc(db, "usuarios", currentUser.uid), userData);

      setIsSuccess(true);
      setIsLoading(false);

      setTimeout(async () => {
        setCurrentUser({ ...currentUser, ...userData });
        const q = query(
          collection(db, "ingressos"),
          where("userId", "==", currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        const tickets = [];
        querySnapshot.forEach((docSnap) =>
          tickets.push({ id: docSnap.id, ...docSnap.data() })
        );
        setPurchasedTickets(tickets);

        setIsSuccess(false);
        setView("dashboard");
      }, 2000);
    } catch (err) {
      setIsLoading(false);
      showToast("Erro ao salvar perfil no banco de dados.");
    }
  };

  // 5. Logout Seguro via Firebase
  const handleLogout = async () => {
    // Se for admin, apenas limpamos o bypass e a sessão mockada
    if (currentUser?.isAdmin) {
      adminBypassRef.current = false;
      setCurrentUser(null);
      setView("auth_choice");
    } else {
      await signOut(auth);
    }
    setCart({ ingresso: 0 });
  };

  // Validação de Limite de Carrinho
  const updateCart = (item, amount) => {
    if (purchasedTickets.length > 0) {
      return showToast("Permitido apenas um ingresso por pessoa.");
    }
    setCart((prev) => {
      const newVal = Math.max(0, prev[item] + amount);
      if (newVal > 1) {
        showToast("Permitido apenas um ingresso por pessoa.");
        return { ...prev, [item]: 1 };
      }
      return { ...prev, [item]: newVal };
    });
  };

  const handleCheckout = async () => {
    if (totalCart === 0) return showToast("Adicione itens ao carrinho.");
    setIsPaymentLoading(true);
    try {
      const res = await fetch("/api/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalCart,
          userEmail: currentUser?.email,
          userName: currentUser?.nomeResponsavel,
          userCpf: currentUser?.cpf,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.preferenceId) {
        showToast("Erro ao iniciar pagamento. Tente novamente.");
        setIsPaymentLoading(false);
        return;
      }
      setMpPreferenceId(data.preferenceId);
      setView("payment");
    } catch (err) {
      console.error(err);
      showToast("Erro de conexão. Tente novamente.");
    }
    setIsPaymentLoading(false);
  };

  const handleCardChange = (e) => {
    let { name, value } = e.target;
    if (name === "number")
      value = value
        .replace(/\D/g, "")
        .replace(/(\d{4})(?=\d)/g, "$1 ")
        .slice(0, 19);
    if (name === "expiry")
      value = value
        .replace(/\D/g, "")
        .slice(0, 4)
        .replace(/^(\d{2})(\d{0,2})/, (_, p1, p2) => (p2 ? `${p1}/${p2}` : p1));
    if (name === "cvv") value = value.replace(/\D/g, "").slice(0, 4);
    setCardData((prev) => ({ ...prev, [name]: value }));
  };

  const [mpPreferenceId, setMpPreferenceId] = useState(null);

  // Cria a preferência no Mercado Pago via Vercel Function
  const executePayment = async () => {
    if (totalCart === 0) return showToast("Carrinho vazio.");
    setIsPaymentLoading(true);
    try {
      const res = await fetch("/api/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalCart,
          userEmail: currentUser?.email,
          userName: currentUser?.nomeResponsavel,
          userCpf: currentUser?.cpf,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.preferenceId) {
        showToast("Erro ao iniciar pagamento. Tente novamente.");
        setIsPaymentLoading(false);
        return;
      }
      setMpPreferenceId(data.preferenceId);
    } catch (err) {
      console.error(err);
      showToast("Erro de conexão. Tente novamente.");
    }
    setIsPaymentLoading(false);
  };

  // Chamado pelo Wallet do MP quando pagamento é aprovado/pendente
  const handleMpSuccess = async (paymentData) => {
    try {
      const uniqueCode = `#FJ-${Math.floor(1000 + Math.random() * 9000)}`;
      const ticketData = {
        userId: currentUser.uid,
        nomeAluno: currentUser.nomeAluno || currentUser.nomeResponsavel || "Usuário",
        type: "Acesso Geral",
        qty: cart.ingresso,
        price: 15,
        code: uniqueCode,
        criadoEm: new Date().toISOString(),
        paymentMethod: "mercadopago",
        mpPaymentId: paymentData?.paymentId || "",
      };
      await setDoc(doc(db, "ingressos", uniqueCode), ticketData);
      setPurchasedTickets((prev) => [...prev, { id: uniqueCode, ...ticketData }]);
      setMpPreferenceId(null);
      setCart({ ingresso: 0 });
      setView("success_purchase");
    } catch (err) {
      console.error(err);
      showToast("Pagamento recebido, mas erro ao salvar ingresso. Contate o suporte.");
    }
  };

  const anoLabel = { "1": "1º Ano", "2": "2º Ano", "3": "3º Ano" };

  /* ─── NAV ITEMS ─── */
  const navItems = [
    { key: "inicio", label: "Início", icon: Home },
    { key: "loja", label: "Ingressos", icon: ShoppingCart },
    { key: "ingressos", label: "Carteira", icon: TicketIcon },
    { key: "perfil", label: "Perfil", icon: User },
  ];

  /* ─── LOADING INICIAL ─── */
  if (view === "loading")
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );

  /* ─── AUTH CHOICE ─── */
  if (view === "auth_choice")
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl mb-6">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Festa Junina
            </h1>
            <p className="text-zinc-400 mt-2 text-sm">
              Acesse para gerenciar sua entrada
            </p>
          </div>
          <div className="bg-[#0a0a0a] rounded-3xl border border-zinc-800 p-8 space-y-4">
            <Button className="w-full" onClick={() => setView("login")}>
              Entrar com E-mail ou Usuário
            </Button>
            <Button
              className="w-full bg-white text-black hover:bg-zinc-200"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <GoogleIcon /> Continuar com Google
            </Button>
            <div className="pt-4 mt-2 border-t border-zinc-800">
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => setView("register")}
              >
                Criar conta nova
              </Button>
            </div>
            <div className="pt-2 text-center">
              <button
                onClick={onBack}
                className="text-sm text-zinc-500 hover:text-white transition-colors"
              >
                Voltar à página inicial
              </button>
            </div>
          </div>
        </div>
      </div>
    );

  /* ─── LOGIN ─── */
  if (view === "login")
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0a0a0a] rounded-3xl border border-zinc-800 p-8">
          <button
            onClick={() => setView("auth_choice")}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Entrar
            </h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              {/* O segredo para não bloquear o input de usuário é deixar como text em vez de email */}
              <Label>E-mail ou Usuário</Label>
              <Input
                name="email"
                type="text"
                placeholder="seu@email.com ou usuário"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input
                name="senha"
                type="password"
                placeholder="••••••••"
                value={formData.senha}
                onChange={handleChange}
                required
              />
            </div>
            <Button type="submit" className="w-full mt-4" isLoading={isLoading}>
              Acessar
            </Button>
          </form>
          <div className="mt-6 flex items-center justify-center gap-4">
            <div className="flex-1 h-px bg-zinc-800"></div>
            <span className="text-zinc-500 text-sm">ou</span>
            <div className="flex-1 h-px bg-zinc-800"></div>
          </div>
          <Button
            className="w-full mt-6 bg-white text-black hover:bg-zinc-200"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            <GoogleIcon /> Entrar com Google
          </Button>
          {toast && (
            <div className="mt-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {toast.message}
            </div>
          )}
        </div>
      </div>
    );

  /* ─── REGISTER ─── */
  if (view === "register")
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 py-12">
        {isSuccess ? (
          <div className="max-w-md w-full bg-[#0a0a0a] rounded-3xl p-10 text-center space-y-5 border border-zinc-800">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-black" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Conta criada!
            </h2>
            <p className="text-zinc-400 text-sm">Entrando no sistema...</p>
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-zinc-500" />
          </div>
        ) : (
          <div className="max-w-xl w-full bg-[#0a0a0a] rounded-3xl border border-zinc-800 p-6 sm:p-10">
            <button
              onClick={() => setView("auth_choice")}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-8 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Nova conta
              </h1>
            </div>
            <form onSubmit={handleRegister} className="space-y-6">
              <div className="space-y-2">
                <Label>Nome Completo (Responsável ou Aluno)</Label>
                <Input
                  name="nomeResponsavel"
                  value={formData.nomeResponsavel}
                  onChange={handleChange}
                  error={errors.nomeResponsavel}
                />
                {errors.nomeResponsavel && (
                  <p className="text-xs text-red-400">
                    {errors.nomeResponsavel}
                  </p>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input
                    name="cpf"
                    value={formData.cpf}
                    onChange={handleChange}
                    error={errors.cpf}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                  {errors.cpf && (
                    <p className="text-xs text-red-400">{errors.cpf}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Telefone (WhatsApp)</Label>
                  <Input
                    name="telefone"
                    maxLength={15}
                    value={formData.telefone}
                    onChange={handleChange}
                    error={errors.telefone}
                    placeholder="(00) 00000-0000"
                  />
                  {errors.telefone && (
                    <p className="text-xs text-red-400">{errors.telefone}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  error={errors.email}
                  placeholder="seu@email.com"
                />
                {errors.email && (
                  <p className="text-xs text-red-400">{errors.email}</p>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input
                    name="senha"
                    type="password"
                    value={formData.senha}
                    onChange={handleChange}
                    error={errors.senha}
                    placeholder="Mínimo 6 caracteres"
                  />
                  {errors.senha && (
                    <p className="text-xs text-red-400">{errors.senha}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Confirmar Senha</Label>
                  <Input
                    name="confirmarSenha"
                    type="password"
                    value={formData.confirmarSenha}
                    onChange={handleChange}
                    error={errors.confirmarSenha}
                  />
                  {errors.confirmarSenha && (
                    <p className="text-xs text-red-400">
                      {errors.confirmarSenha}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-zinc-800">
                <p className="text-xs font-bold uppercase tracking-wider text-white mb-5">
                  Dados Escolares
                </p>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label>Ano</Label>
                    <Select
                      name="ano"
                      value={formData.ano}
                      onChange={handleChange}
                      error={errors.ano}
                      placeholder="Selecione"
                      options={[
                        { value: "1", label: "1º Ano" },
                        { value: "2", label: "2º Ano" },
                        { value: "3", label: "3º Ano" },
                      ]}
                    />
                    {errors.ano && (
                      <p className="text-xs text-red-400">{errors.ano}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Turma</Label>
                    <Select
                      name="turma"
                      value={formData.turma}
                      onChange={handleChange}
                      error={errors.turma}
                      placeholder="Selecione"
                      options={Array.from({ length: 6 }, (_, i) => ({
                        value: String.fromCharCode(65 + i),
                        label: `Turma ${String.fromCharCode(65 + i)}`,
                      }))}
                    />
                    {errors.turma && (
                      <p className="text-xs text-red-400">{errors.turma}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2 mt-5">
                  <Label>Nome do Aluno</Label>
                  <Input
                    name="nomeAluno"
                    value={formData.nomeAluno}
                    onChange={handleChange}
                    error={errors.nomeAluno}
                  />
                  {errors.nomeAluno && (
                    <p className="text-xs text-red-400">{errors.nomeAluno}</p>
                  )}
                </div>
              </div>
              <Button
                type="submit"
                className="w-full mt-4"
                isLoading={isLoading}
              >
                Criar conta e Acessar
              </Button>
            </form>
            {toast && (
              <div className="fixed bottom-4 right-4 bg-zinc-900 border border-zinc-800 shadow-2xl rounded-xl p-4 flex items-center gap-3 z-50">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <p className="text-sm text-white">{toast.message}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );

  /* ─── COMPLETE PROFILE (APÓS GOOGLE LOGIN) ─── */
  if (view === "complete_profile")
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 py-12">
        {isSuccess ? (
          <div className="max-w-md w-full bg-[#0a0a0a] rounded-3xl p-10 text-center space-y-5 border border-zinc-800">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-black" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Perfil atualizado!
            </h2>
            <p className="text-zinc-400 text-sm">Preparando seu painel...</p>
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-zinc-500" />
          </div>
        ) : (
          <div className="max-w-xl w-full bg-[#0a0a0a] rounded-3xl border border-zinc-800 p-6 sm:p-10">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Complete seu perfil
              </h1>
              <p className="text-zinc-400 text-sm mt-2">
                Falta pouco! Precisamos dos seus dados para vincular e garantir
                a segurança do seu ingresso.
              </p>
            </div>
            <form onSubmit={handleCompleteProfile} className="space-y-6">
              <div className="space-y-2">
                <Label>Nome Completo (Responsável ou Aluno)</Label>
                <Input
                  name="nomeResponsavel"
                  value={formData.nomeResponsavel || ""}
                  onChange={handleChange}
                  error={errors.nomeResponsavel}
                />
                {errors.nomeResponsavel && (
                  <p className="text-xs text-red-400">
                    {errors.nomeResponsavel}
                  </p>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input
                    name="cpf"
                    value={formData.cpf || ""}
                    onChange={handleChange}
                    error={errors.cpf}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                  {errors.cpf && (
                    <p className="text-xs text-red-400">{errors.cpf}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Telefone (WhatsApp)</Label>
                  <Input
                    name="telefone"
                    maxLength={15}
                    value={formData.telefone || ""}
                    onChange={handleChange}
                    error={errors.telefone}
                    placeholder="(00) 00000-0000"
                  />
                  {errors.telefone && (
                    <p className="text-xs text-red-400">{errors.telefone}</p>
                  )}
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-zinc-800">
                <p className="text-xs font-bold uppercase tracking-wider text-white mb-5">
                  Dados Escolares
                </p>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label>Ano</Label>
                    <Select
                      name="ano"
                      value={formData.ano || ""}
                      onChange={handleChange}
                      error={errors.ano}
                      placeholder="Selecione"
                      options={[
                        { value: "1", label: "1º Ano" },
                        { value: "2", label: "2º Ano" },
                        { value: "3", label: "3º Ano" },
                      ]}
                    />
                    {errors.ano && (
                      <p className="text-xs text-red-400">{errors.ano}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Turma</Label>
                    <Select
                      name="turma"
                      value={formData.turma || ""}
                      onChange={handleChange}
                      error={errors.turma}
                      placeholder="Selecione"
                      options={Array.from({ length: 6 }, (_, i) => ({
                        value: String.fromCharCode(65 + i),
                        label: `Turma ${String.fromCharCode(65 + i)}`,
                      }))}
                    />
                    {errors.turma && (
                      <p className="text-xs text-red-400">{errors.turma}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2 mt-5">
                  <Label>Nome do Aluno</Label>
                  <Input
                    name="nomeAluno"
                    value={formData.nomeAluno || ""}
                    onChange={handleChange}
                    error={errors.nomeAluno}
                  />
                  {errors.nomeAluno && (
                    <p className="text-xs text-red-400">{errors.nomeAluno}</p>
                  )}
                </div>
              </div>
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full mt-4 h-12"
                  isLoading={isLoading}
                >
                  Salvar e Continuar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full mt-2"
                  onClick={handleLogout}
                >
                  Cancelar e sair
                </Button>
              </div>
            </form>
            {toast && (
              <div className="fixed bottom-4 right-4 bg-zinc-900 border border-zinc-800 shadow-2xl rounded-xl p-4 flex items-center gap-3 z-50">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <p className="text-sm text-white">{toast.message}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );

  /* ─── DASHBOARD ─── */
  if (view === "dashboard") {
    // Se o usuário logado for ADMIN, mostra a tela de administração
    if (currentUser?.isAdmin) {
      return (
        <DashboardAdmin
          currentUser={currentUser}
          onLogout={handleLogout}
          onBack={onBack}
        />
      );
    }

    // Se NÃO for admin, retorna a tela normal de usuário
    return (
      <div className="flex h-screen bg-black overflow-hidden selection:bg-white selection:text-black">
        {/* Overlay mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* SIDEBAR — Oculta no mobile, exposta por menu. Recolhida/Fixa no Desktop. */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-40 bg-[#0a0a0a] border-r border-zinc-800 flex flex-col transition-all duration-300 ease-in-out ${
            sidebarOpen
              ? "w-64"
              : "w-0 lg:w-20 overflow-hidden lg:overflow-visible"
          }`}
        >
          <div className="h-20 flex items-center justify-between lg:justify-center px-6 lg:px-0 border-b border-zinc-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0">
                <GraduationCap className="h-5 w-5 text-black" />
              </div>
              <span
                className={`font-bold text-white tracking-tight whitespace-nowrap transition-opacity duration-300 ${
                  sidebarOpen ? "opacity-100" : "lg:hidden opacity-0 w-0"
                }`}
              >
                EE C. Brandão
              </span>
            </div>
            <button
              className="p-2 text-zinc-500 hover:text-white transition lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
            {navItems.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => {
                  setActiveTab(key);
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}
                title={label}
                className={`w-full flex items-center gap-4 px-3 lg:px-0 lg:justify-center rounded-xl transition-all h-12 text-sm font-medium whitespace-nowrap
                ${
                  activeTab === key
                    ? "bg-white text-black"
                    : "text-zinc-500 hover:bg-zinc-900 hover:text-white"
                }
                ${sidebarOpen ? "lg:px-3 lg:justify-start" : ""}
              `}
              >
                <Icon className={`h-5 w-5 shrink-0`} />
                <span
                  className={`transition-all duration-300 ${
                    sidebarOpen
                      ? "opacity-100 block"
                      : "lg:hidden opacity-0 w-0"
                  }`}
                >
                  {label}
                </span>

                {/* Badge na sidebar */}
                {key === "ingressos" &&
                  purchasedTickets.length > 0 &&
                  sidebarOpen && (
                    <span
                      className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        activeTab === key
                          ? "bg-black text-white"
                          : "bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      {purchasedTickets.length}
                    </span>
                  )}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-zinc-800 shrink-0 space-y-2">
            {/* Botão Retornar à Landing Page */}
            <button
              onClick={onBack}
              title="Voltar ao Site"
              className={`w-full flex items-center gap-4 px-3 lg:px-0 lg:justify-center h-12 rounded-xl text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-white transition-all whitespace-nowrap ${
                sidebarOpen ? "lg:px-3 lg:justify-start" : ""
              }`}
            >
              <ArrowLeft className="h-5 w-5 shrink-0" />
              <span
                className={`transition-all duration-300 ${
                  sidebarOpen ? "opacity-100 block" : "lg:hidden opacity-0 w-0"
                }`}
              >
                Voltar ao Site
              </span>
            </button>

            <button
              onClick={handleLogout}
              title="Sair"
              className={`w-full flex items-center gap-4 px-3 lg:px-0 lg:justify-center h-12 rounded-xl text-sm font-medium text-red-500 hover:bg-zinc-900 hover:text-red-400 transition-all whitespace-nowrap ${
                sidebarOpen ? "lg:px-3 lg:justify-start" : ""
              }`}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span
                className={`transition-all duration-300 ${
                  sidebarOpen ? "opacity-100 block" : "lg:hidden opacity-0 w-0"
                }`}
              >
                Sair da conta
              </span>
            </button>
          </div>
        </aside>

        {/* MAIN AREA */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          {/* HEADER */}
          <header className="h-20 bg-black/80 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between px-6 sm:px-8 shrink-0 z-10 sticky top-0">
            <div className="flex items-center gap-4">
              <button
                className="p-2 -ml-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-6 w-6" />
              </button>
              <button
                className="hidden lg:block p-2 -ml-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h2 className="text-base font-semibold text-white tracking-wide">
                  {activeTab === "inicio" && "Painel"}
                  {activeTab === "loja" && "Comprar"}
                  {activeTab === "ingressos" && "Carteira"}
                  {activeTab === "perfil" && "Perfil"}
                </h2>
              </div>
            </div>

            <button
              onClick={() => setActiveTab("perfil")}
              className="flex items-center gap-3 hover:bg-[#0a0a0a] rounded-full sm:rounded-xl px-2 py-1.5 sm:pr-4 transition group border border-transparent hover:border-zinc-800"
            >
              <div className="text-right hidden sm:block">
                <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider leading-none">
                  Acesso
                </p>
                <p className="text-sm font-semibold text-white mt-1 leading-none truncate max-w-[120px]">
                  {currentUser?.nomeAluno?.split(" ")[0] ||
                    currentUser?.nomeResponsavel?.split(" ")[0] ||
                    "Usuário"}
                </p>
              </div>
              <div className="h-10 w-10 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 group-hover:border-zinc-600 transition shrink-0">
                <CircleUser className="h-5 w-5 text-zinc-400 group-hover:text-white" />
              </div>
            </button>
          </header>

          {/* CONTEÚDO */}
          <main className="flex-1 overflow-y-auto bg-black">
            {/* ── ABA: INÍCIO (MINIMALISTA) ── */}
            {activeTab === "inicio" && (
              <div className="p-4 sm:p-8 max-w-lg mx-auto w-full space-y-8">
                {/* Header Saudação */}
                <div className="pt-2 pb-4 border-b border-zinc-900">
                  <h1 className="text-3xl font-bold text-white tracking-tight">
                    Olá,{" "}
                    {currentUser?.nomeAluno?.split(" ")[0] ||
                      currentUser?.nomeResponsavel?.split(" ")[0] ||
                      "Visitante"}
                    .
                  </h1>
                  <p className="text-zinc-500 text-sm mt-1">
                    Bem-vindo ao seu painel.
                  </p>
                </div>

                {/* Status do Ingresso - Foco Principal */}
                <div>
                  <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-4">
                    Seu Acesso
                  </h2>
                  <div className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl p-6 sm:p-8">
                    {purchasedTickets.length > 0 ? (
                      <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center mb-5">
                          <MdQrCode2 className="h-8 w-8" />
                        </div>
                        <h3 className="text-xl font-bold text-white">
                          Ingresso Liberado
                        </h3>
                        <p className="text-zinc-400 text-sm mt-2 mb-8">
                          Seu QR Code de entrada está pronto na sua carteira
                          digital.
                        </p>
                        <Button
                          className="w-full"
                          onClick={() =>
                            setSelectedQr(
                              purchasedTickets[purchasedTickets.length - 1]
                                ?.code
                            )
                          }
                        >
                          Exibir QR Code
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-full flex items-center justify-center mb-5">
                          <TicketIcon className="h-8 w-8" />
                        </div>
                        <h3 className="text-xl font-bold text-white">
                          Nenhum ingresso
                        </h3>
                        <p className="text-zinc-400 text-sm mt-2 mb-8">
                          Você ainda não garantiu seu acesso para a festa.
                        </p>
                        <Button
                          className="w-full"
                          onClick={() => setActiveTab("loja")}
                        >
                          Comprar Agora — R$ 15
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Detalhes Minimalistas do Evento */}
                <div>
                  <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-4">
                    O Evento
                  </h2>
                  <div className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl p-6 space-y-6">
                    <div className="flex items-center gap-4">
                      <Calendar className="h-5 w-5 text-zinc-500 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-white">
                          27 de Junho de 2026
                        </p>
                        <p className="text-xs text-zinc-500">Sábado</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Clock className="h-5 w-5 text-zinc-500 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-white">
                          13h às 17h
                        </p>
                        <p className="text-xs text-zinc-500">
                          Horário de Brasília
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <MapPin className="h-5 w-5 text-zinc-500 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Escola Aires da Mata Machado
                        </p>
                        <p className="text-xs text-zinc-500">
                          Av. Sen. Levindo Coelho, 632
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── ABA: LOJA ── */}
            {activeTab === "loja" && (
              <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
                <div className="grid lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-[#0a0a0a] p-6 sm:p-8 rounded-3xl border border-zinc-800 flex flex-col sm:flex-row justify-between gap-6">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-xl text-white">
                            Ingresso Único
                          </h3>
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-white text-black px-2 py-0.5 rounded-full">
                            Geral
                          </span>
                        </div>
                        <p className="text-sm text-zinc-400">
                          Acesso garantido ao evento. Apresentação obrigatória
                          na portaria.
                        </p>
                        <p className="text-white font-black text-2xl mt-4">
                          R$ 15,00
                        </p>

                        {purchasedTickets.length > 0 && (
                          <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl text-sm flex items-center gap-3 mt-6">
                            <CheckCircle2 className="h-5 w-5 shrink-0" />
                            Você já garantiu sua entrada. Permitido um ingresso
                            por CPF.
                          </div>
                        )}
                      </div>

                      {purchasedTickets.length === 0 && (
                        <div className="flex items-center gap-3 self-start sm:self-center bg-black border border-zinc-800 rounded-xl p-1.5 mt-4 sm:mt-0">
                          <button
                            onClick={() => updateCart("ingresso", -1)}
                            className="p-3 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white transition"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-8 text-center font-bold text-white text-lg">
                            {cart.ingresso}
                          </span>
                          <button
                            onClick={() => updateCart("ingresso", 1)}
                            className="p-3 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white transition"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resumo */}
                  <div className="lg:col-span-1">
                    <div className="bg-[#0a0a0a] p-6 sm:p-8 rounded-3xl border border-zinc-800 sticky top-6">
                      <h3 className="font-bold flex items-center gap-2 mb-6 text-white border-b border-zinc-800 pb-4">
                        <ShoppingCart className="h-5 w-5 text-zinc-400" />{" "}
                        Resumo
                      </h3>
                      <div className="space-y-4 text-sm mb-6">
                        {cart.ingresso > 0 && (
                          <div className="flex justify-between text-zinc-300">
                            <span>{cart.ingresso}× Ingresso</span>
                            <span className="font-semibold text-white">
                              R${" "}
                              {(cart.ingresso * 15)
                                .toFixed(2)
                                .replace(".", ",")}
                            </span>
                          </div>
                        )}
                        {totalCart === 0 && (
                          <div className="py-8 text-center text-zinc-500 bg-black rounded-xl border border-dashed border-zinc-800 text-sm">
                            Carrinho vazio
                          </div>
                        )}
                      </div>
                      <div className="border-t border-zinc-800 pt-6 mb-6 flex justify-between items-end">
                        <span className="text-zinc-500 font-medium">Total</span>
                        <span className="text-2xl font-bold text-white">
                          R$ {totalCart.toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                      <Button
                        className="w-full h-14"
                        onClick={handleCheckout}
                        isLoading={isPaymentLoading}
                        disabled={
                          totalCart === 0 || purchasedTickets.length > 0 || isPaymentLoading
                        }
                      >
                        {purchasedTickets.length > 0
                          ? "Limite Atingido"
                          : isPaymentLoading
                          ? "Carregando..."
                          : "Continuar"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── ABA: MEUS INGRESSOS ── */}
            {activeTab === "ingressos" && (
              <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
                {purchasedTickets.length === 0 ? (
                  <div className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl p-12 text-center">
                    <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6">
                      <TicketIcon className="h-8 w-8 text-zinc-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white">
                      Carteira Vazia
                    </h3>
                    <p className="text-zinc-400 text-sm mt-2 mb-8">
                      Você ainda não adquiriu ingressos.
                    </p>
                    <Button onClick={() => setActiveTab("loja")}>
                      Ir para a Loja
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between pb-2">
                      <h3 className="font-bold text-white">
                        {purchasedTickets.length} ingresso(s)
                      </h3>
                    </div>
                    {purchasedTickets.map((t) => (
                      <div
                        key={t.id}
                        className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 relative overflow-hidden"
                      >
                        <div className="flex-1 w-full text-center sm:text-left">
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">
                            Passaporte
                          </p>
                          <p className="font-bold text-2xl text-white">
                            {t.type}
                          </p>
                          <p className="text-zinc-400 mt-1 text-sm">
                            Quantidade: {t.qty}
                          </p>
                        </div>

                        <div className="w-full sm:w-auto bg-black border border-zinc-800 rounded-2xl p-4 flex flex-col items-center gap-3">
                          <div
                            className="bg-white p-2 rounded-xl cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => setSelectedQr(t.code)}
                            title="Clique para ampliar"
                          >
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                                t.code
                              )}`}
                              alt={`QR Code ${t.code}`}
                              className="w-24 h-24 object-contain"
                            />
                          </div>
                          <p className="font-mono font-bold text-white text-sm">
                            {t.code}
                          </p>
                          <Button
                            variant="ghost"
                            className="h-8 text-xs w-full mt-1 border border-zinc-800"
                            onClick={() => setSelectedQr(t.code)}
                          >
                            Ampliar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ── ABA: PERFIL ── */}
            {activeTab === "perfil" && (
              <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
                {/* Avatar */}
                <div className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl p-8 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                  <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-700 shrink-0">
                    <CircleUser className="h-10 w-10 text-zinc-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {currentUser?.nomeAluno || currentUser?.nomeResponsavel}
                    </h2>
                    <p className="text-sm text-zinc-400 mt-1">
                      {currentUser?.email}
                    </p>
                    {(currentUser?.ano || currentUser?.turma) && (
                      <span className="inline-block mt-3 text-xs font-bold bg-white text-black px-3 py-1.5 rounded-full">
                        {currentUser.ano &&
                          `${
                            anoLabel[currentUser.ano] || currentUser.ano
                          } Médio`}
                        {currentUser.ano && currentUser.turma && " · "}
                        {currentUser.turma && `Turma ${currentUser.turma}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Dados */}
                <div className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl overflow-hidden">
                  <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50">
                    <h3 className="font-semibold text-white text-sm">
                      Informações Cadastrais
                    </h3>
                  </div>
                  <div className="divide-y divide-zinc-800/50">
                    {[
                      {
                        icon: User,
                        label: "Nome do Responsável",
                        value: currentUser?.nomeResponsavel,
                      },
                      {
                        icon: BookOpen,
                        label: "Nome do Aluno",
                        value:
                          currentUser?.nomeAluno ||
                          currentUser?.aluno ||
                          currentUser?.nomeResponsavel,
                      },
                      {
                        icon: GraduationCap,
                        label: "Turma",
                        value:
                          currentUser?.ano && currentUser?.turma
                            ? `${
                                anoLabel[currentUser.ano] || currentUser.ano
                              } Médio — Turma ${currentUser.turma}`
                            : "—",
                      },
                      {
                        icon: Mail,
                        label: "E-mail",
                        value: currentUser?.email,
                      },
                      {
                        icon: Phone,
                        label: "Telefone",
                        value: currentUser?.telefone || "—",
                      },
                      {
                        icon: User,
                        label: "CPF",
                        value: currentUser?.cpf || "—",
                      },
                    ].map(({ icon: Icon, label, value }) => (
                      <div
                        key={label}
                        className="flex items-center gap-4 px-6 py-4 hover:bg-zinc-900 transition"
                      >
                        <Icon className="h-5 w-5 text-zinc-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                            {label}
                          </p>
                          <p className="text-sm font-semibold text-white mt-1 truncate">
                            {value || "—"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  variant="danger"
                  className="w-full h-14"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" /> Sair da conta
                </Button>
              </div>
            )}
          </main>
        </div>

        {/* QR Code Modal Gigante */}
        {selectedQr && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all"
            onClick={() => setSelectedQr(null)}
          >
            <div
              className="bg-[#0a0a0a] border border-zinc-800 p-8 rounded-3xl max-w-sm w-full flex flex-col items-center relative shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white bg-zinc-900 rounded-full transition-colors"
                onClick={() => setSelectedQr(null)}
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-xl font-bold text-white mb-2">
                Seu Passaporte
              </h3>
              <p className="text-sm text-zinc-400 mb-8 text-center">
                Apresente este código na portaria do evento para liberar sua
                entrada.
              </p>

              <div className="bg-white p-4 rounded-2xl w-full flex justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                    selectedQr
                  )}`}
                  alt="QR Code Ampliado"
                  className="w-full max-w-[250px] aspect-square object-contain"
                />
              </div>

              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mt-8">
                Código Verificador
              </p>
              <p className="font-mono text-3xl font-black text-white mt-2 tracking-wider">
                {selectedQr}
              </p>
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-4 right-4 bg-zinc-900 text-white border border-zinc-800 shadow-2xl rounded-xl p-4 flex items-center gap-3 z-50 max-w-xs">
            {toast.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-white shrink-0" />
            )}
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        )}
      </div>
    );
  }

  /* ─── PAGAMENTO ─── */
  if (view === "payment")
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0a0a0a] rounded-3xl border border-zinc-800 overflow-hidden">
          {/* Header */}
          <div className="bg-[#0a0a0a] p-6 border-b border-zinc-800 flex items-center gap-4">
            <button
              onClick={() => { setView("dashboard"); setMpPreferenceId(null); }}
              className="p-2 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-full transition"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-white">Pagamento</h2>
              <p className="text-zinc-500 text-sm">
                Total:{" "}
                <strong className="text-white">
                  R$ {totalCart.toFixed(2).replace(".", ",")}
                </strong>
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Resumo do pedido */}
            <div className="bg-black rounded-2xl border border-zinc-800 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center">
                  <TicketIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Ingresso – Acesso Geral</p>
                  <p className="text-xs text-zinc-500">Festa Junina Brandão</p>
                </div>
              </div>
              <span className="text-white font-bold">
                R$ {totalCart.toFixed(2).replace(".", ",")}
              </span>
            </div>

            {/* Payment Brick — checkout transparente (PIX, cartão, boleto) */}
            {mpPreferenceId ? (
              <div>
                <Payment
                  initialization={{
                    amount: totalCart,
                    preferenceId: mpPreferenceId,
                  }}
                  customization={{
                    paymentMethods: {
                      ticket: "all",
                      bankTransfer: "all",
                      creditCard: "all",
                      debitCard: "all",
                      mercadoPago: "wallet_purchase",
                    },
                  }}
                  onSubmit={async ({ selectedPaymentMethod, formData: mpFormData }) => {
                    try {
                      const res = await fetch("/api/process-payment", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(mpFormData),
                      });
                      const result = await res.json();
                      if (result.status === "approved" || result.status === "pending") {
                        await handleMpSuccess({ paymentId: result.id });
                      } else {
                        showToast("Pagamento não aprovado. Tente novamente.");
                      }
                    } catch (err) {
                      console.error(err);
                      showToast("Erro ao processar pagamento.");
                    }
                  }}
                  onError={(err) => {
                    console.error("MP Brick error:", err);
                    showToast("Erro no checkout. Tente novamente.");
                    setMpPreferenceId(null);
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                <span className="ml-3 text-zinc-500 text-sm">Carregando formas de pagamento...</span>
              </div>
            )}

            <p className="text-[11px] text-zinc-600 text-center">
              Pagamento 100% seguro processado pelo Mercado Pago
            </p>
          </div>

          {toast && (
            <div className="fixed bottom-4 right-4 bg-zinc-900 text-white border border-zinc-800 shadow-2xl rounded-xl p-4 flex items-center gap-3 z-50">
              {toast.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-white" />
              ) : (
                <AlertCircle className="h-5 w-5 text-white" />
              )}
              <p className="text-sm font-medium">{toast.message}</p>
            </div>
          )}
        </div>
      </div>
    );

  /* ─── SUCESSO ─── */
  if (view === "success_purchase")
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0a0a0a] rounded-3xl p-8 sm:p-10 text-center space-y-6 border border-zinc-800">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-12 w-12 text-black" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">
              Sucesso!
            </h2>
            <p className="text-zinc-400 text-sm mt-2">
              Seu ingresso foi gerado.
            </p>
          </div>
          <div className="bg-black p-6 rounded-2xl border border-zinc-800">
            <div className="bg-white p-2 rounded-xl inline-block">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                  purchasedTickets[purchasedTickets.length - 1]?.code || ""
                )}`}
                alt="QR Code"
                className="w-24 h-24 object-contain"
              />
            </div>
            <p className="text-[11px] text-zinc-500 uppercase font-bold tracking-widest mt-5">
              Lote
            </p>
            <p className="font-mono text-xl font-bold text-white mt-1">
              {purchasedTickets[purchasedTickets.length - 1]?.code}
            </p>
          </div>
          <div className="flex flex-col gap-3 pt-4">
            <Button
              className="w-full h-14"
              onClick={() => {
                setCart({ ingresso: 0 });
                setActiveTab("ingressos");
                setView("dashboard");
              }}
            >
              <TicketIcon className="h-5 w-5" /> Abrir Carteira
            </Button>
            <Button
              variant="ghost"
              className="w-full h-14"
              onClick={() => {
                setCart({ ingresso: 0 });
                setActiveTab("inicio");
                setView("dashboard");
              }}
            >
              Voltar ao Painel
            </Button>
          </div>
        </div>
      </div>
    );
}
