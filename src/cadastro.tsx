// @ts-nocheck
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
  Lock,
} from "lucide-react";
import { MdQrCode2 } from "react-icons/md";
import { IoMdDownload } from "react-icons/io";
// Importações REAIS do Firebase consolidadas
import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  fetchSignInMethodsForEmail
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  collectionGroup,
  addDoc,
  query,
  where,
  limit,
  getDocs,
  updateDoc,
  runTransaction,
  increment,
} from "firebase/firestore";

// Mercado Pago Public Key (modo transparente)
// ⚠️ MODO DE TESTE — Public Key de teste do Mercado Pago.
// Troque para "APP_USR-c2f301db-a6e5-49aa-9030-ddda699ca4ed" em produção.
const MP_PUBLIC_KEY = "APP_USR-acf7dac7-662d-4531-b60b-29ee7bdefb08";

// Carrega o SDK do MP dinamicamente
const loadMpSdk = () =>
  new Promise((resolve) => {
    if ((window as any).MercadoPago)
      return resolve((window as any).MercadoPago);
    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.onload = () => resolve((window as any).MercadoPago);
    document.head.appendChild(script);
  });

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
setPersistence(auth, browserLocalPersistence).catch((err) =>
  console.error("Erro ao configurar persistência de login:", err)
);
const db = getFirestore(app);

// Chave usada no localStorage para lembrar que o usuário já está logado,
// permitindo que o App.tsx pule a LP e abra direto o painel/ingressos.
const SESSION_KEY = "fj_session";

// Wrapper seguro para localStorage. Em alguns navegadores/contextos mobile
// (Safari em modo privado no iOS, WebViews dentro de apps como Instagram/
// Facebook/TikTok, ou Android com bloqueio de dados de sites) o acesso ao
// localStorage lança uma exceção síncrona (SecurityError/QuotaExceededError)
// em vez de simplesmente falhar. Sem este wrapper, qualquer setItem/removeItem
// direto quebrava o app inteiro (tela branca) nesses celulares, mesmo
// funcionando perfeitamente no PC e em outros aparelhos.
const safeStorage = {
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("Não foi possível salvar no localStorage:", e);
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("Não foi possível remover do localStorage:", e);
    }
  },
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("Não foi possível ler do localStorage:", e);
      return null;
    }
  },
};

// Error Boundary global: captura qualquer erro de renderização que escape
// dos try/catch internos e mostra uma tela de recuperação em vez de deixar
// a página em branco. Sem isso, um erro pontual (de rede, de um campo nulo,
// de uma lib externa, etc.) derruba a árvore inteira do React silenciosamente.
// Detecta se o erro capturado foi provocado pela tradução automática do
// navegador (Google Translate / tradutor nativo do Chrome/Safari no
// mobile). Esses tradutores reescrevem o DOM por fora do React, e quando o
// React tenta atualizar/remover um nó que o tradutor já alterou, ele lança
// erros típicos como "removeChild"/"insertBefore"/"NotFoundError" ou
// "Failed to execute ... on 'Node'". Isso NÃO é um bug do app — é
// incompatibilidade entre o tradutor automático e o React.
const isLikelyTranslateError = (error) => {
  const msg = String(error?.message || error || "");
  return (
    /removeChild|insertBefore|appendChild/i.test(msg) ||
    /NotFoundError/i.test(msg) ||
    /Failed to execute .* on 'Node'/i.test(msg) ||
    /The node to be removed is not a child/i.test(msg)
  );
};

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, isTranslateError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, isTranslateError: isLikelyTranslateError(error) };
  }
  componentDidCatch(error, info) {
    console.error("Erro capturado pelo ErrorBoundary:", error, info);
  }
  handleReload = () => {
    this.setState({ hasError: false });
    try {
      window.location.reload();
    } catch (e) {
      console.warn(e);
    }
  };
  render() {
    if (this.state.hasError) {
      if (this.state.isTranslateError) {
        return <TranslateWarningScreen onReload={this.handleReload} />;
      }
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
          <div className="max-w-sm space-y-4">
            <p className="text-white font-bold text-lg">
              Ops! Algo deu errado.
            </p>
            <p className="text-zinc-400 text-sm">
              Tente recarregar a página. Se o problema continuar, verifique
              se o navegador está em modo de navegação privada/anônima ou
              com bloqueio de dados de sites ativado.
            </p>
            <button
              onClick={this.handleReload}
              className="bg-white text-black font-semibold rounded-xl px-6 py-3 text-sm"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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

/* ─── Logo Mercado Pago (Handshake) ─── */
const MercadoPagoIcon = ({ className = "h-6 w-6" }) => (
  <svg
    viewBox="195 125 320 165"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      className="cls-3"
      fill="#00bcff"
      d="m350.04,138.92c-77.83,0-140.91,40.36-140.91,90.15s63.09,94.05,140.91,94.05,140.91-44.27,140.91-94.05-63.09-90.15-140.91-90.15Z"
    />
    <path
      fill="#fff"
      d="m304.18,201.2c-.07.14-1.45,1.56-.55,2.71,2.18,2.78,8.91,4.38,15.72,2.85,4.05-.91,9.25-5.04,14.28-9.03,5.45-4.33,10.86-8.67,16.3-10.39,5.76-1.83,9.45-1.05,11.89-.31,2.67.8,5.82,2.56,10.84,6.32,9.45,7.1,47.43,40.26,54,45.99,5.28-2.39,30.47-12.56,62.39-19.6-2.78-17.02-13.01-33.25-28.72-45.99-21.89,9.19-50.42,14.7-76.58,1.93-.13-.05-14.29-6.75-28.25-6.42-20.75.48-29.74,9.46-39.25,18.97l-12.05,12.99Z"
    />
    <path
      fill="#fff"
      d="m425.1,242.95c-.45-.4-44.67-39.09-54.69-46.62-5.8-4.35-9.02-5.46-12.41-5.89-1.76-.23-4.2.1-5.9.57-4.66,1.27-10.75,5.34-16.16,9.63-5.6,4.46-10.88,8.66-15.79,9.76-6.26,1.4-13.91-.25-17.4-2.61-1.41-.95-2.41-2.05-2.89-3.16-1.29-2.99,1.09-5.38,1.48-5.78l12.2-13.2c1.42-1.41,2.85-2.83,4.31-4.23-3.94.51-7.58,1.52-11.12,2.5-4.42,1.24-8.68,2.42-12.98,2.42-1.8,0-11.42-1.58-13.25-2.07-11.05-3.02-23.56-5.97-38.04-12.73-17.35,12.91-28.65,28.77-32,46.56,2.49.66,9.02,2.15,10.71,2.52,39.26,8.73,51.49,17.72,53.71,19.6,2.4-2.67,5.87-4.36,9.73-4.36,4.35,0,8.26,2.19,10.64,5.56,2.25-1.78,5.35-3.3,9.36-3.29,1.82,0,3.71.34,5.62.98,4.43,1.52,6.72,4.47,7.9,7.14,1.48-.67,3.31-1.17,5.46-1.16,2.12,0,4.32.48,6.53,1.44,7.24,3.11,8.36,10.22,7.71,15.58.52-.06,1.04-.08,1.56-.08,8.58,0,15.56,6.98,15.56,15.57,0,2.66-.68,5.16-1.86,7.35,2.34,1.31,8.29,4.28,13.52,3.62,4.17-.53,5.76-1.95,6.32-2.76.39-.55.8-1.2.42-1.66l-11.08-12.3s-1.82-1.73-1.22-2.39c.62-.68,1.75.3,2.55.96,5.64,4.71,12.52,11.81,12.52,11.81.12.08.57.98,3.12,1.43,2.19.39,6.07.17,8.76-2.04.67-.56,1.35-1.25,1.93-1.97-.05.04-.09.08-.13.1,2.84-3.63-.32-7.29-.32-7.29l-12.93-14.52s-1.85-1.71-1.22-2.4c.56-.6,1.75.3,2.56.98,4.09,3.42,9.88,9.23,15.42,14.66,1.09.79,5.96,3.8,12.41-.43,3.92-2.57,4.7-5.73,4.59-8.1-.27-3.15-2.73-5.4-2.73-5.4l-17.66-17.76s-1.87-1.59-1.21-2.4c.54-.68,1.75.3,2.55.96,5.62,4.71,20.86,18.68,20.86,18.68.22.15,5.48,3.9,11.99-.24,2.33-1.49,3.81-3.73,3.94-6.34.22-4.52-2.96-7.2-2.96-7.2Z"
    />
    <path
      fill="#fff"
      d="m339.41,265.46c-2.74-.03-5.74,1.6-6.13,1.36-.22-.14.17-1.24.42-1.88.27-.63,3.87-11.48-4.92-15.25-6.73-2.89-10.85.36-12.26,1.83-.37.38-.54.35-.58-.13-.14-1.96-1.01-7.24-6.82-9.02-8.3-2.54-13.64,3.25-14.99,5.35-.61-4.73-4.61-8.4-9.5-8.41-5.32,0-9.64,4.3-9.65,9.63,0,5.32,4.31,9.64,9.64,9.64,2.59,0,4.93-1.03,6.66-2.69.06.05.08.14.05.32-.41,2.39-1.15,11.04,7.92,14.57,3.64,1.41,6.73.36,9.29-1.43.76-.54.89-.31.78.41-.33,2.23.09,6.99,6.77,9.7,5.08,2.07,8.09-.04,10.07-1.87.86-.78,1.09-.65,1.14.56.24,6.44,5.59,11.56,12.09,11.57,6.7,0,12.13-5.41,12.13-12.1,0-6.7-5.42-12.06-12.12-12.13Z"
    />
    <path
      fill="#0a0080"
      d="m350.01,135.19c-79.31,0-143.6,42.18-143.6,93.92,0,1.34-.02,5.03-.02,5.5,0,54.9,56.19,99.35,143.6,99.35s143.61-44.45,143.61-99.34v-5.51c0-51.74-64.29-93.92-143.59-93.92Zm137.12,83.51c-31.21,6.94-54.49,17.01-60.32,19.61-13.62-11.89-45.1-39.26-53.63-45.66-4.87-3.67-8.2-5.6-11.12-6.47-1.31-.4-3.12-.85-5.45-.85-2.17,0-4.5.39-6.93,1.17-5.51,1.75-11,6.11-16.31,10.33l-.27.22c-4.95,3.93-10.06,8-13.93,8.86-1.69.38-3.43.58-5.16.58-4.34,0-8.23-1.26-9.69-3.12-.24-.31-.08-.81.48-1.52l.07-.1,11.99-12.91c9.39-9.39,18.25-18.25,38.66-18.72.34-.01.68-.02,1.02-.02,12.7.01,25.4,5.69,26.83,6.36,11.91,5.81,24.21,8.76,36.56,8.77,12.85,0,26.11-3.17,40.05-9.58,14.56,12.24,24.21,26.99,27.15,43.06Zm-137.1-77.97c42.1,0,79.76,12.07,105.09,31.07-12.24,5.3-23.91,7.97-35.17,7.97-11.52-.01-23.03-2.78-34.21-8.23-.59-.28-14.61-6.89-29.2-6.9-.38,0-.77,0-1.15.01-17.14.4-26.8,6.49-33.29,11.82-6.31.16-11.76,1.68-16.61,3.03-4.33,1.2-8.06,2.24-11.7,2.24-1.5,0-4.2-.14-4.44-.15-4.18-.13-25.18-5.28-41.95-11.61,25.27-17.96,61.89-29.26,102.64-29.26Zm-107.61,33.01c17.51,7.16,38.76,12.7,45.48,13.13,1.87.12,3.87.34,5.87.34,4.46,0,8.91-1.25,13.21-2.45,2.54-.71,5.35-1.49,8.3-2.05-.79.77-1.58,1.56-2.37,2.35l-12.17,13.17c-.96.97-3.04,3.55-1.67,6.73.54,1.28,1.65,2.51,3.2,3.55,2.9,1.95,8.1,3.28,12.92,3.28,1.83,0,3.57-.18,5.15-.54,5.11-1.14,10.46-5.41,16.13-9.92,4.52-3.59,10.94-8.15,15.86-9.49,1.38-.37,3.06-.61,4.42-.61.41,0,.79.02,1.14.07,3.24.41,6.38,1.51,11.99,5.72,10,7.51,54.22,46.2,54.65,46.58.03.02,2.85,2.46,2.65,6.5-.11,2.26-1.36,4.26-3.54,5.65-1.89,1.2-3.83,1.81-5.8,1.81-2.96,0-4.99-1.39-5.13-1.48-.16-.13-15.31-14.03-20.89-18.7-.89-.74-1.75-1.4-2.62-1.4-.47,0-.88.2-1.16.55-.88,1.08.1,2.58,1.26,3.56l17.7,17.8s2.21,2.06,2.45,4.79c.14,2.95-1.27,5.42-4.2,7.34-2.09,1.38-4.2,2.07-6.27,2.07-2.72,0-4.63-1.24-5.05-1.53l-2.54-2.5c-4.64-4.57-9.43-9.29-12.94-12.21-.86-.71-1.77-1.37-2.64-1.37-.43,0-.82.16-1.12.48-.4.44-.68,1.24.32,2.57.4.55.89,1,.89,1l12.91,14.51c.1.13,2.66,3.17.29,6.19l-.46.58c-.39.42-.8.82-1.2,1.16-2.2,1.81-5.14,2-6.31,2-.63,0-1.22-.05-1.75-.15-1.27-.23-2.13-.58-2.55-1.07l-.16-.16c-.7-.73-7.21-7.38-12.6-11.87-.71-.6-1.6-1.34-2.51-1.34-.45,0-.85.18-1.17.52-1.06,1.17.54,2.91,1.22,3.55l11.01,12.15c-.01.11-.15.36-.41.74-.4.55-1.73,1.88-5.73,2.38-.48.06-.98.09-1.46.09-4.12,0-8.52-2-10.79-3.2,1.03-2.18,1.57-4.58,1.57-6.98,0-9.07-7.36-16.44-16.43-16.45-.19,0-.4,0-.59.01.29-4.14-.29-11.98-8.34-15.43-2.32-1-4.63-1.52-6.87-1.52-1.76,0-3.45.3-5.04.91-1.67-3.24-4.44-5.6-8.04-6.83-2-.69-3.98-1.04-5.9-1.04-3.35,0-6.44.99-9.19,2.94-2.64-3.28-6.62-5.22-10.81-5.22-3.67,0-7.2,1.47-9.81,4.06-3.43-2.62-17.03-11.26-53.44-19.53-1.74-.39-5.69-1.52-8.17-2.25,3.41-16.34,13.8-31.27,29.2-43.52Zm67.54,94.78l-.39-.35h-.4c-.32,0-.66.13-1.11.45-1.86,1.31-3.63,1.94-5.44,1.94-1,0-2.02-.2-3.04-.59-8.44-3.29-7.78-11.25-7.36-13.65.06-.49-.06-.86-.37-1.12l-.6-.49-.56.53c-1.65,1.59-3.8,2.45-6.06,2.45-4.83,0-8.77-3.93-8.76-8.77,0-4.83,3.94-8.76,8.78-8.75,4.37,0,8.09,3.28,8.64,7.65l.3,2.35,1.29-1.99c.14-.23,3.69-5.59,10.2-5.58,1.24,0,2.52.2,3.81.6,5.19,1.58,6.07,6.29,6.2,8.25.09,1.14.91,1.2,1.06,1.2.45,0,.78-.28,1.01-.53.98-1.02,3.11-2.72,6.45-2.72,1.53,0,3.15.37,4.83,1.09,8.25,3.54,4.51,14.02,4.47,14.13-.71,1.74-.74,2.5-.07,2.95l.32.15h.24c.37,0,.83-.16,1.6-.42,1.12-.39,2.81-.97,4.4-.97h0c6.21.07,11.26,5.13,11.26,11.26,0,6.2-5.06,11.24-11.27,11.24-6.07,0-11.01-4.73-11.23-10.74-.02-.52-.07-1.88-1.23-1.88-.47,0-.89.29-1.36.72-1.34,1.24-3.04,2.49-5.52,2.49-1.13,0-2.35-.26-3.64-.79-6.41-2.6-6.5-7-6.24-8.77.07-.47.09-.96-.23-1.35Zm40.07,48.88c-76.26,0-138.08-39.55-138.08-88.33,0-1.96.14-3.91.33-5.84.61.15,6.67,1.59,7.92,1.88,37.19,8.26,49.48,16.85,51.56,18.48-.7,1.69-1.07,3.51-1.07,5.35,0,7.69,6.25,13.95,13.93,13.95.86,0,1.72-.08,2.56-.24,1.16,5.66,4.86,9.95,10.51,12.15,1.65.63,3.32.96,4.97.96,1.06,0,2.13-.13,3.17-.39,1.05,2.65,3.39,5.96,8.65,8.09,1.84.74,3.68,1.13,5.47,1.13,1.46,0,2.89-.26,4.25-.76,2.52,6.13,8.51,10.2,15.19,10.2,4.43,0,8.68-1.8,11.78-4.99,2.65,1.48,8.25,4.15,13.91,4.16.73,0,1.41-.05,2.11-.13,5.62-.71,8.23-2.91,9.43-4.62.22-.3.41-.62.58-.95,1.32.38,2.78.69,4.46.7,3.07,0,6.01-1.05,8.99-3.21,2.93-2.11,5.01-5.14,5.31-7.72,0-.03,0-.07.01-.11.99.2,2,.3,3.01.3,3.16,0,6.27-.98,9.24-2.93,5.73-3.75,6.72-8.66,6.63-11.87,1.01.21,2.03.32,3.05.32,2.96,0,5.88-.89,8.65-2.66,3.55-2.27,5.69-5.75,6.02-9.79.21-2.75-.47-5.53-1.91-7.91,9.58-4.13,31.48-12.12,57.27-17.93.11,1.46.17,2.93.17,4.41,0,48.78-61.82,88.33-138.07,88.33Z"
    />
  </svg>
);

const MercadoPagoLogo = ({ className = "h-8" }) => (
  <svg
    viewBox="100 100 500 480"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill="#00bcff"
      d="m350.04,138.92c-77.83,0-140.91,40.36-140.91,90.15s63.09,94.05,140.91,94.05,140.91-44.27,140.91-94.05-63.09-90.15-140.91-90.15Z"
    />
    <path
      fill="#fff"
      d="m304.18,201.2c-.07.14-1.45,1.56-.55,2.71,2.18,2.78,8.91,4.38,15.72,2.85,4.05-.91,9.25-5.04,14.28-9.03,5.45-4.33,10.86-8.67,16.3-10.39,5.76-1.83,9.45-1.05,11.89-.31,2.67.8,5.82,2.56,10.84,6.32,9.45,7.1,47.43,40.26,54,45.99,5.28-2.39,30.47-12.56,62.39-19.6-2.78-17.02-13.01-33.25-28.72-45.99-21.89,9.19-50.42,14.7-76.58,1.93-.13-.05-14.29-6.75-28.25-6.42-20.75.48-29.74,9.46-39.25,18.97l-12.05,12.99Z"
    />
    <path
      fill="#fff"
      d="m425.1,242.95c-.45-.4-44.67-39.09-54.69-46.62-5.8-4.35-9.02-5.46-12.41-5.89-1.76-.23-4.2.1-5.9.57-4.66,1.27-10.75,5.34-16.16,9.63-5.6,4.46-10.88,8.66-15.79,9.76-6.26,1.4-13.91-.25-17.4-2.61-1.41-.95-2.41-2.05-2.89-3.16-1.29-2.99,1.09-5.38,1.48-5.78l12.2-13.2c1.42-1.41,2.85-2.83,4.31-4.23-3.94.51-7.58,1.52-11.12,2.5-4.42,1.24-8.68,2.42-12.98,2.42-1.8,0-11.42-1.58-13.25-2.07-11.05-3.02-23.56-5.97-38.04-12.73-17.35,12.91-28.65,28.77-32,46.56,2.49.66,9.02,2.15,10.71,2.52,39.26,8.73,51.49,17.72,53.71,19.6,2.4-2.67,5.87-4.36,9.73-4.36,4.35,0,8.26,2.19,10.64,5.56,2.25-1.78,5.35-3.3,9.36-3.29,1.82,0,3.71.34,5.62.98,4.43,1.52,6.72,4.47,7.9,7.14,1.48-.67,3.31-1.17,5.46-1.16,2.12,0,4.32.48,6.53,1.44,7.24,3.11,8.36,10.22,7.71,15.58.52-.06,1.04-.08,1.56-.08,8.58,0,15.56,6.98,15.56,15.57,0,2.66-.68,5.16-1.86,7.35,2.34,1.31,8.29,4.28,13.52,3.62,4.17-.53,5.76-1.95,6.32-2.76.39-.55.8-1.2.42-1.66l-11.08-12.3s-1.82-1.73-1.22-2.39c.62-.68,1.75.3,2.55.96,5.64,4.71,12.52,11.81,12.52,11.81.12.08.57.98,3.12,1.43,2.19.39,6.07.17,8.76-2.04.67-.56,1.35-1.25,1.93-1.97-.05.04-.09.08-.13.1,2.84-3.63-.32-7.29-.32-7.29l-12.93-14.52s-1.85-1.71-1.22-2.4c.56-.6,1.75.3,2.56.98,4.09,3.42,9.88,9.23,15.42,14.66,1.09.79,5.96,3.8,12.41-.43,3.92-2.57,4.7-5.73,4.59-8.1-.27-3.15-2.73-5.4-2.73-5.4l-17.66-17.76s-1.87-1.59-1.21-2.4c.54-.68,1.75.3,2.55.96,5.62,4.71,20.86,18.68,20.86,18.68.22.15,5.48,3.9,11.99-.24,2.33-1.49,3.81-3.73,3.94-6.34.22-4.52-2.96-7.2-2.96-7.2Z"
    />
    <path
      fill="#fff"
      d="m339.41,265.46c-2.74-.03-5.74,1.6-6.13,1.36-.22-.14.17-1.24.42-1.88.27-.63,3.87-11.48-4.92-15.25-6.73-2.89-10.85.36-12.26,1.83-.37.38-.54.35-.58-.13-.14-1.96-1.01-7.24-6.82-9.02-8.3-2.54-13.64,3.25-14.99,5.35-.61-4.73-4.61-8.4-9.5-8.41-5.32,0-9.64,4.3-9.65,9.63,0,5.32,4.31,9.64,9.64,9.64,2.59,0,4.93-1.03,6.66-2.69.06.05.08.14.05.32-.41,2.39-1.15,11.04,7.92,14.57,3.64,1.41,6.73.36,9.29-1.43.76-.54.89-.31.78.41-.33,2.23.09,6.99,6.77,9.7,5.08,2.07,8.09-.04,10.07-1.87.86-.78,1.09-.65,1.14.56.24,6.44,5.59,11.56,12.09,11.57,6.7,0,12.13-5.41,12.13-12.1,0-6.7-5.42-12.06-12.12-12.13Z"
    />
    <path
      fill="#0a0080"
      d="m350.01,135.19c-79.31,0-143.6,42.18-143.6,93.92,0,1.34-.02,5.03-.02,5.5,0,54.9,56.19,99.35,143.6,99.35s143.61-44.45,143.61-99.34v-5.51c0-51.74-64.29-93.92-143.59-93.92Zm137.12,83.51c-31.21,6.94-54.49,17.01-60.32,19.61-13.62-11.89-45.1-39.26-53.63-45.66-4.87-3.67-8.2-5.6-11.12-6.47-1.31-.4-3.12-.85-5.45-.85-2.17,0-4.5.39-6.93,1.17-5.51,1.75-11,6.11-16.31,10.33l-.27.22c-4.95,3.93-10.06,8-13.93,8.86-1.69.38-3.43.58-5.16.58-4.34,0-8.23-1.26-9.69-3.12-.24-.31-.08-.81.48-1.52l.07-.1,11.99-12.91c9.39-9.39,18.25-18.25,38.66-18.72.34-.01.68-.02,1.02-.02,12.7.01,25.4,5.69,26.83,6.36,11.91,5.81,24.21,8.76,36.56,8.77,12.85,0,26.11-3.17,40.05-9.58,14.56,12.24,24.21,26.99,27.15,43.06Zm-137.1-77.97c42.1,0,79.76,12.07,105.09,31.07-12.24,5.3-23.91,7.97-35.17,7.97-11.52-.01-23.03-2.78-34.21-8.23-.59-.28-14.61-6.89-29.2-6.9-.38,0-.77,0-1.15.01-17.14.4-26.8,6.49-33.29,11.82-6.31.16-11.76,1.68-16.61,3.03-4.33,1.2-8.06,2.24-11.7,2.24-1.5,0-4.2-.14-4.44-.15-4.18-.13-25.18-5.28-41.95-11.61,25.27-17.96,61.89-29.26,102.64-29.26Zm-107.61,33.01c17.51,7.16,38.76,12.7,45.48,13.13,1.87.12,3.87.34,5.87.34,4.46,0,8.91-1.25,13.21-2.45,2.54-.71,5.35-1.49,8.3-2.05-.79.77-1.58,1.56-2.37,2.35l-12.17,13.17c-.96.97-3.04,3.55-1.67,6.73.54,1.28,1.65,2.51,3.2,3.55,2.9,1.95,8.1,3.28,12.92,3.28,1.83,0,3.57-.18,5.15-.54,5.11-1.14,10.46-5.41,16.13-9.92,4.52-3.59,10.94-8.15,15.86-9.49,1.38-.37,3.06-.61,4.42-.61.41,0,.79.02,1.14.07,3.24.41,6.38,1.51,11.99,5.72,10,7.51,54.22,46.2,54.65,46.58.03.02,2.85,2.46,2.65,6.5-.11,2.26-1.36,4.26-3.54,5.65-1.89,1.2-3.83,1.81-5.8,1.81-2.96,0-4.99-1.39-5.13-1.48-.16-.13-15.31-14.03-20.89-18.7-.89-.74-1.75-1.4-2.62-1.4-.47,0-.88.2-1.16.55-.88,1.08.1,2.58,1.26,3.56l17.7,17.8s2.21,2.06,2.45,4.79c.14,2.95-1.27,5.42-4.2,7.34-2.09,1.38-4.2,2.07-6.27,2.07-2.72,0-4.63-1.24-5.05-1.53l-2.54-2.5c-4.64-4.57-9.43-9.29-12.94-12.21-.86-.71-1.77-1.37-2.64-1.37-.43,0-.82.16-1.12.48-.4.44-.68,1.24.32,2.57.4.55.89,1,.89,1l12.91,14.51c.1.13,2.66,3.17.29,6.19l-.46.58c-.39.42-.8.82-1.2,1.16-2.2,1.81-5.14,2-6.31,2-.63,0-1.22-.05-1.75-.15-1.27-.23-2.13-.58-2.55-1.07l-.16-.16c-.7-.73-7.21-7.38-12.6-11.87-.71-.6-1.6-1.34-2.51-1.34-.45,0-.85.18-1.17.52-1.06,1.17.54,2.91,1.22,3.55l11.01,12.15c-.01.11-.15.36-.41.74-.4.55-1.73,1.88-5.73,2.38-.48.06-.98.09-1.46.09-4.12,0-8.52-2-10.79-3.2,1.03-2.18,1.57-4.58,1.57-6.98,0-9.07-7.36-16.44-16.43-16.45-.19,0-.4,0-.59.01.29-4.14-.29-11.98-8.34-15.43-2.32-1-4.63-1.52-6.87-1.52-1.76,0-3.45.3-5.04.91-1.67-3.24-4.44-5.6-8.04-6.83-2-.69-3.98-1.04-5.9-1.04-3.35,0-6.44.99-9.19,2.94-2.64-3.28-6.62-5.22-10.81-5.22-3.67,0-7.2,1.47-9.81,4.06-3.43-2.62-17.03-11.26-53.44-19.53-1.74-.39-5.69-1.52-8.17-2.25,3.41-16.34,13.8-31.27,29.2-43.52Zm67.54,94.78l-.39-.35h-.4c-.32,0-.66.13-1.11.45-1.86,1.31-3.63,1.94-5.44,1.94-1,0-2.02-.2-3.04-.59-8.44-3.29-7.78-11.25-7.36-13.65.06-.49-.06-.86-.37-1.12l-.6-.49-.56.53c-1.65,1.59-3.8,2.45-6.06,2.45-4.83,0-8.77-3.93-8.76-8.77,0-4.83,3.94-8.76,8.78-8.75,4.37,0,8.09,3.28,8.64,7.65l.3,2.35,1.29-1.99c.14-.23,3.69-5.59,10.2-5.58,1.24,0,2.52.2,3.81.6,5.19,1.58,6.07,6.29,6.2,8.25.09,1.14.91,1.2,1.06,1.2.45,0,.78-.28,1.01-.53.98-1.02,3.11-2.72,6.45-2.72,1.53,0,3.15.37,4.83,1.09,8.25,3.54,4.51,14.02,4.47,14.13-.71,1.74-.74,2.5-.07,2.95l.32.15h.24c.37,0,.83-.16,1.6-.42,1.12-.39,2.81-.97,4.4-.97h0c6.21.07,11.26,5.13,11.26,11.26,0,6.2-5.06,11.24-11.27,11.24-6.07,0-11.01-4.73-11.23-10.74-.02-.52-.07-1.88-1.23-1.88-.47,0-.89.29-1.36.72-1.34,1.24-3.04,2.49-5.52,2.49-1.13,0-2.35-.26-3.64-.79-6.41-2.6-6.5-7-6.24-8.77.07-.47.09-.96-.23-1.35Zm40.07,48.88c-76.26,0-138.08-39.55-138.08-88.33,0-1.96.14-3.91.33-5.84.61.15,6.67,1.59,7.92,1.88,37.19,8.26,49.48,16.85,51.56,18.48-.7,1.69-1.07,3.51-1.07,5.35,0,7.69,6.25,13.95,13.93,13.95.86,0,1.72-.08,2.56-.24,1.16,5.66,4.86,9.95,10.51,12.15,1.65.63,3.32.96,4.97.96,1.06,0,2.13-.13,3.17-.39,1.05,2.65,3.39,5.96,8.65,8.09,1.84.74,3.68,1.13,5.47,1.13,1.46,0,2.89-.26,4.25-.76,2.52,6.13,8.51,10.2,15.19,10.2,4.43,0,8.68-1.8,11.78-4.99,2.65,1.48,8.25,4.15,13.91,4.16.73,0,1.41-.05,2.11-.13,5.62-.71,8.23-2.91,9.43-4.62.22-.3.41-.62.58-.95,1.32.38,2.78.69,4.46.7,3.07,0,6.01-1.05,8.99-3.21,2.93-2.11,5.01-5.14,5.31-7.72,0-.03,0-.07.01-.11.99.2,2,.3,3.01.3,3.16,0,6.27-.98,9.24-2.93,5.73-3.75,6.72-8.66,6.63-11.87,1.01.21,2.03.32,3.05.32,2.96,0,5.88-.89,8.65-2.66,3.55-2.27,5.69-5.75,6.02-9.79.21-2.75-.47-5.53-1.91-7.91,9.58-4.13,31.48-12.12,57.27-17.93.11,1.46.17,2.93.17,4.41,0,48.78-61.82,88.33-138.07,88.33Z"
    />
    <g>
      <path
        fill="#0a0080"
        d="m570.03,391.04c-5.21-6.54-13.13-9.8-23.75-9.8s-18.53,3.27-23.74,9.8c-5.22,6.53-7.83,14.25-7.83,23.16s2.61,16.81,7.83,23.26c5.21,6.43,13.13,9.65,23.74,9.65s18.54-3.22,23.75-9.65c5.22-6.45,7.82-14.19,7.82-23.26s-2.6-16.63-7.82-23.16Zm-12.92,37.48c-2.53,3.35-6.15,5.04-10.89,5.04s-8.36-1.69-10.91-5.04c-2.55-3.35-3.82-8.13-3.82-14.32s1.27-10.95,3.82-14.29c2.55-3.34,6.19-5.01,10.91-5.01s8.35,1.67,10.89,5.01c2.53,3.34,3.8,8.11,3.8,14.29s-1.27,10.97-3.8,14.32Z"
      />
      <path
        fill="#0a0080"
        d="m436.75,385.57c-5.29-2.68-11.34-4.03-18.15-4.03-10.47,0-17.86,2.73-22.17,8.18-2.71,3.49-4.22,7.95-4.58,13.37h15.65c.38-2.4,1.15-4.29,2.31-5.69,1.61-1.89,4.36-2.84,8.23-2.84,3.46,0,6.08.48,7.88,1.45,1.78.96,2.68,2.72,2.68,5.26,0,2.09-1.16,3.61-3.49,4.61-1.3.57-3.46,1.04-6.48,1.42l-5.55.68c-6.3.8-11.08,2.13-14.32,3.99-5.92,3.41-8.88,8.93-8.88,16.55,0,5.87,1.83,10.41,5.52,13.61,3.67,3.21,8.34,4.55,13.98,4.81,35.38,1.58,34.98-18.64,35.3-22.84v-23.27c0-7.47-2.65-12.55-7.93-15.25Zm-8.22,35.32c-.11,5.42-1.66,9.15-4.64,11.2-2.99,2.05-6.24,3.07-9.78,3.07-2.24,0-4.14-.63-5.7-1.85-1.56-1.23-2.34-3.24-2.34-6.01,0-3.1,1.28-5.39,3.83-6.88,1.51-.87,3.99-1.61,7.45-2.2l3.69-.69c1.84-.35,3.28-.73,4.34-1.13,1.07-.38,2.1-.9,3.13-1.56v6.03Z"
      />
      <path
        fill="#0a0080"
        d="m356.09,395.4c4.05,0,7.01,1.25,8.94,3.75,1.31,1.84,2.13,3.93,2.45,6.24h17.45c-.95-8.81-4.03-14.95-9.24-18.43-5.22-3.47-11.9-5.21-20.07-5.21-9.61,0-17.15,2.95-22.61,8.84-5.46,5.9-8.2,14.15-8.2,24.75,0,9.38,2.47,17.03,7.42,22.93,4.95,5.89,12.66,8.84,23.14,8.84s18.42-3.53,23.76-10.61c3.35-4.38,5.23-9.03,5.62-13.94h-17.39c-.36,3.25-1.37,5.9-3.06,7.94-1.67,2.03-4.5,3.06-8.5,3.06-5.63,0-9.47-2.57-11.5-7.72-1.12-2.75-1.69-6.38-1.69-10.91s.57-8.54,1.69-11.43c2.12-5.39,6.05-8.1,11.79-8.1Z"
      />
      <path
        fill="#0a0080"
        d="m320.13,381.75c-35.85,0-33.72,31.73-33.72,31.73v32.23h16.27v-30.23c0-4.96.63-8.62,1.86-11.01,2.23-4.23,6.6-6.35,13.1-6.35.49,0,1.13.03,1.92.07.79.04,1.69.11,2.73.23v-16.55c-.72-.05-1.19-.07-1.39-.1-.21-.02-.46-.03-.77-.03Z"
      />
      <path
        fill="#0a0080"
        d="m273.37,393.77c-2.81-4.16-6.38-7.21-10.68-9.15-4.31-1.92-9.15-2.88-14.52-2.88-9.06,0-16.42,2.85-22.1,8.56-5.67,5.72-8.52,13.92-8.52,24.63,0,11.43,3.15,19.67,9.44,24.74,6.28,5.06,13.54,7.61,21.76,7.61,9.96,0,17.71-3.01,23.24-9.02,2.99-3.16,4.86-6.29,5.65-9.38h-17.26c-.68.98-1.41,1.81-2.22,2.46-2.3,1.89-5.42,2.47-9.09,2.47-3.47,0-6.2-.52-8.66-2.07-4.06-2.5-6.35-6.72-6.59-12.91h45.01c.06-5.34-.11-9.43-.54-12.27-.74-4.84-2.4-9.1-4.92-12.77Zm-39.15,14.38c.58-4.02,2.03-7.2,4.3-9.56,2.29-2.35,5.5-3.53,9.65-3.53,3.81,0,7.01,1.11,9.59,3.34,2.57,2.22,4,5.48,4.3,9.75h-27.83Z"
      />
      <path
        fill="#0a0080"
        d="m185.23,381.53c-7.55,0-14.08,3.31-18.47,8.61-4.17-5.3-10.59-8.61-18.48-8.61-15.89,0-26.13,11.67-26.13,27.12v37.06h14.87v-37.41c0-6.83,4.62-11.55,11.27-11.55,9.8,0,10.81,8.13,10.81,11.55v37.41h14.87v-37.41c0-6.83,4.73-11.55,11.26-11.55,9.8,0,10.93,8.13,10.93,11.55v37.41h14.85v-37.06c0-15.93-9.56-27.12-25.79-27.12Z"
      />
      <path
        fill="#0a0080"
        d="m493.48,373.62l-.02,17.43c-1.81-2.92-4.17-5.2-7.08-6.83-2.9-1.64-6.23-2.47-9.98-2.47-8.13,0-14.6,3.03-19.46,9.06-4.86,6.05-7.29,14.77-7.29,25.31,0,9.15,2.47,16.65,7.4,22.49,4.93,5.83,14.6,8.39,23.19,8.39,29.95,0,29.6-25.68,29.6-25.68v-59.11s-16.37-1.75-16.37,11.41Zm-3.13,55.04c-2.37,3.4-5.86,5.1-10.43,5.1s-7.98-1.72-10.23-5.13c-2.25-3.43-3.37-8.41-3.37-14.11,0-5.3,1.1-9.72,3.31-13.29,2.21-3.57,5.67-5.36,10.4-5.36,3.1,0,5.82.98,8.17,2.94,3.81,3.25,5.73,9.09,5.73,16.64,0,5.4-1.2,9.81-3.58,13.21Z"
      />
    </g>
    <path
      fill="#0a0080"
      d="m257.85,474.48c-13.4-.63-20.16,2.56-24.57,5.93-6.09,4.65-9.8,11.53-9.8,22.52v56.51h7.88c2.11,0,4.22-.73,5.77-2.16,1.74-1.6,2.61-3.56,2.61-5.86v-21.12c1.92,3.31,4.45,5.74,7.65,7.32,3.03,1.41,6.53,2.12,10.51,2.12,7.49,0,13.64-2.98,18.41-8.97,4.78-6.15,7.17-14.15,7.17-24.06s-2.26-16.97-7.68-23.57c-4.38-5.34-11.04-8.35-17.94-8.66Zm5.55,46.38c-2.39,3.31-5.66,4.96-9.8,4.96-4.46,0-7.89-1.64-10.28-4.96-2.39-2.99-3.59-7.45-3.59-13.45,0-6.43,1.11-11.16,3.34-14.15,2.4-3.29,5.75-4.96,10.05-4.96s7.89,1.66,10.28,4.96c2.4,3.31,3.59,8.02,3.59,14.15,0,5.68-1.19,10.14-3.59,13.45Z"
    />
    <path
      fill="#0a0080"
      d="m397.57,480.31c-5.53-4.19-11.18-6.38-20.89-6.12-9.86.27-17.03,3.03-21.49,9.07-4.46,6.05-6.68,13.95-6.68,23.68,0,8.33,1.68,15.04,5.04,20.17,3.37,5.1,7.4,8.6,12.1,10.47,4.68,1.89,9.42,2.28,14.2,1.19,4.77-1.11,8.57-3.84,11.39-8.24v3.99c-.32,5.03-1.53,8.8-3.63,11.32-2.13,2.5-4.47,4.04-7.06,4.59-2.56.54-5.16.24-7.73-.95-2.59-1.17-4.5-2.87-5.75-5.06h-17.14c4.44,13.34,12.41,19.23,26.77,20.27,23.16,1.67,30.54-17.94,30.52-28.52v-33.25c0-10.99-3.58-18.03-9.63-22.63Zm-6.81,32.66c-.63,3.68-1.64,6.4-3.06,8.12-2.97,4.08-7.6,5.53-13.84,4.37-6.27-1.19-9.4-7.2-9.4-18.03,0-5.03.93-9.51,2.82-13.45,1.88-3.91,5.47-5.89,10.79-5.89,3.91,0,6.89,1.42,8.92,4.24,2.04,2.83,3.34,6.05,3.88,9.67.55,3.61.5,7.27-.12,10.96Z"
    />
    <path
      fill="#0a0080"
      d="m334.59,478.67c-5.29-2.67-11.34-4.03-18.15-4.03-10.47,0-17.85,2.73-22.15,8.19-2.7,3.48-4.22,7.94-4.58,13.36h15.65c.38-2.39,1.15-4.29,2.3-5.68,1.61-1.89,4.36-2.85,8.23-2.85,3.47,0,6.09.48,7.88,1.45,1.78.96,2.67,2.72,2.67,5.26,0,2.08-1.16,3.62-3.49,4.6-1.3.57-3.46,1.04-6.48,1.42l-5.54.67c-6.3.8-11.09,2.13-14.31,3.99-5.93,3.41-8.88,8.92-8.88,16.54,0,5.87,1.83,10.41,5.52,13.61,3.67,3.21,8.34,4.55,13.99,4.81,35.36,1.58,34.96-18.64,35.28-22.84v-23.27c0-7.46-2.63-12.54-7.92-15.24Zm-8.22,35.31c-.1,5.43-1.66,9.15-4.63,11.2-2.98,2.05-6.24,3.07-9.78,3.07-2.24,0-4.13-.63-5.7-1.85s-2.34-3.23-2.34-6c0-3.1,1.28-5.39,3.83-6.87,1.52-.87,3.99-1.61,7.45-2.2l3.7-.68c1.84-.35,3.29-.72,4.33-1.12,1.07-.39,2.11-.91,3.14-1.56v6.03Z"
    />
    <path
      fill="#0a0080"
      d="m468.71,483.8c-5.22-6.54-13.14-9.81-23.76-9.81s-18.52,3.26-23.73,9.81c-5.22,6.53-7.83,14.24-7.83,23.15s2.61,16.8,7.83,23.25c5.21,6.42,13.13,9.64,23.73,9.64s18.53-3.22,23.76-9.64c5.21-6.45,7.81-14.19,7.81-23.25s-2.6-16.62-7.81-23.15Zm-12.93,37.46c-2.53,3.36-6.15,5.05-10.87,5.05s-8.36-1.69-10.91-5.05c-2.56-3.35-3.83-8.12-3.83-14.31s1.27-10.95,3.83-14.29c2.54-3.34,6.18-5.01,10.91-5.01s8.35,1.67,10.87,5.01c2.53,3.34,3.79,8.1,3.79,14.29s-1.26,10.96-3.79,14.31Z"
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

const Select = ({ value, onChange, options, placeholder, error, name }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  const handleSelect = (opt) => {
    onChange({ target: { name, value: opt.value } });
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-12 w-full items-center justify-between rounded-xl border px-4 py-2 text-sm transition-all focus:outline-none ${
          error
            ? "border-red-500 bg-red-500/10 text-red-100"
            : open
            ? "border-zinc-600 bg-zinc-900 text-white"
            : "border-zinc-800 bg-zinc-950 text-white hover:border-zinc-600"
        }`}
      >
        <span className={selected ? "text-white" : "text-zinc-500"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/60">
          <div className="max-h-52 overflow-y-auto py-1 scrollbar-thin">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  opt.value === value
                    ? "bg-white/10 text-white font-medium"
                    : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                {opt.value === value && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white shrink-0" />
                )}
                <span className={opt.value === value ? "" : "ml-[18px]"}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

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

// Formatação de data extraída dos Lotes
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

/* ─── App Principal ─── */
function CadastroAppInner({ onBack = () => {} }) {
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
  const [cpfNotFound, setCpfNotFound] = useState(false); // CPF não está na lista de alunos
  const [registerAsPai, setRegisterAsPai] = useState(false); // Usuário optou por se cadastrar como pai/responsável
  const [showPaiInfo, setShowPaiInfo] = useState(false); // Exibe aviso sobre lote de pais
  const [cpfStudentData, setCpfStudentData] = useState<{
    nome: string;
    ano: string;
    turma: string;
  } | null>(null); // Dados do aluno encontrado pelo CPF
  const [cpfLookupStatus, setCpfLookupStatus] = useState<
    "idle" | "loading" | "found" | "pai_found" | "not_found"
  >("idle"); // Status da busca pelo CPF
  const [cpfPaiData, setCpfPaiData] = useState<{
    nome: string;
    relacao: string;
    alunoNome?: string;
    alunoTurma?: string;
  } | null>(null); // Dados do responsável encontrado pelo CPF
  const [currentUser, setCurrentUser] = useState(null);

  const adminBypassRef = useRef(false); // Ref para gerenciar o Bypass Admin

  // Estados dos Lotes Visíveis
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  // Carrinho refatorado para suportar Lotes por ID
  // Formato: { [batchId]: { qty: number, nome: string, preco: number } }
  const [cart, setCart] = useState({});
  const cartRef = useRef(cart); // Ref para evitar closure stale no polling do PIX
  useEffect(() => { cartRef.current = cart; }, [cart]);
  const cartItems = Object.values(cart);
  const totalCart = cartItems.reduce(
    (acc, item) => acc + item.qty * item.preco,
    0
  );

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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Busca todos os ingressos de um usuário, tanto os já vinculados ao uid
  // quanto os que foram criados manualmente pelo admin (cadastro manual ou
  // pelo card do aluno) e só têm o CPF preenchido. Quando encontra um
  // ingresso "órfão" que bate pelo CPF, vincula ele ao uid real para que
  // as próximas consultas (e o restante do sistema) já encontrem direto.
  const fetchTicketsForUser = async (uid, cpf) => {
    const cpfDigits = (cpf || "").replace(/\D/g, "");
    const snap = await getDocs(collection(db, "ingressos"));
    const tickets = [];
    const orfaosParaVincular = [];

    snap.forEach((d) => {
      const data = d.data();
      const ticketCpfDigits = (data.cpf || "").replace(/\D/g, "");
      const bateUid = data.userId === uid;
      const bateCpf = !!cpfDigits && ticketCpfDigits === cpfDigits;

      if (bateUid || bateCpf) {
        tickets.push({ id: d.id, ...data });
        if (bateCpf && !bateUid) orfaosParaVincular.push(d.id);
      }
    });

    if (uid && orfaosParaVincular.length > 0) {
      await Promise.all(
        orfaosParaVincular.map((ticketId) =>
          updateDoc(doc(db, "ingressos", ticketId), { userId: uid }).catch(
            () => {}
          )
        )
      );
      tickets.forEach((t) => {
        if (orfaosParaVincular.includes(t.id)) t.userId = uid;
      });
    }

    return tickets;
  };

  // 1. Ouvinte de Autenticação do Firebase e Persistência de Login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
      // Se tivermos forçado um login de admin, ignoramos o listener do Firebase
      if (adminBypassRef.current) return;

      if (user) {
        try {
          const docRef = doc(db, "usuarios", user.uid);
          const docSnap = await getDoc(docRef);

          let userData;
          if (docSnap.exists()) {
            userData = docSnap.data();
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

          const tickets = await fetchTicketsForUser(user.uid, userData.cpf);

          setPurchasedTickets(tickets);
          safeStorage.set(SESSION_KEY, "1");
          setActiveTab("ingressos");
          setView("dashboard");
        } catch (err) {
          console.error("Erro ao buscar dados do usuário:", err);
          setView("auth_choice");
        }
      } else {
        setCurrentUser(null);
        safeStorage.remove(SESSION_KEY);
        setView("auth_choice");
      }
      },
      (error) => {
        // Erro do próprio listener (ex.: config inválida do Firebase).
        // Sem isso, a tela ficaria presa em "loading" para sempre.
        console.error("Erro no onAuthStateChanged:", error);
        setView("auth_choice");
      }
    );

    return () => unsubscribe();
  }, []);

  // Busca de Lotes Dinâmicos quando acessa a Loja
  useEffect(() => {
    if (activeTab === "loja") {
      fetchBatches();
    }
  }, [activeTab]);

  const fetchBatches = async () => {
    setLoadingBatches(true);
    try {
      // Antes lia TODA a coleção "ingressos" só para contar quantos foram
      // vendidos por lote — isso gerava milhares de leituras no Firestore
      // a cada visita à loja. Agora usamos o contador "ingressosAssociados"
      // já mantido no próprio documento do lote (mesmo padrão do painel
      // admin), então só lemos os documentos de "lotes".
      const snap = await getDocs(collection(db, "lotes"));

      const list = [];

      // Turma do aluno logado, ex: "1A", "2B". Pais/responsáveis não têm ano/turma.
      const turmaDoUsuario =
        currentUser?.ano && currentUser?.turma
          ? `${currentUser.ano}${currentUser.turma}`
          : null;

      // true = aluno cadastrado com ano/turma, false = pai/responsável
      const isAluno = !!turmaDoUsuario;

      snap.forEach((docSnap) => {
        const data = docSnap.data();

        // 1) Só exibe lotes marcados como visíveis
        if (!data.visivel) return;

        const publico = data.publico || "Ambos";
        if (publico === "Alunos" && !isAluno) return;
        if (publico === "Pais/Responsáveis" && isAluno) return;

        if (
          turmaDoUsuario &&
          Array.isArray(data.turmasVisiveis) &&
          data.turmasVisiveis.length > 0 &&
          !data.turmasVisiveis.includes(turmaDoUsuario)
        ) {
          return;
        }

        const vendidos = Number(data.ingressosAssociados) || 0;
        const bloqueadoParaAluno = !!data.bloqueado && isAluno;
        list.push({ id: docSnap.id, ...data, vendidos, bloqueadoParaAluno });
      });

      // Ordenação simples por nome
      setBatches(
        list.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
      );
    } catch (err) {
      showToast("Erro ao carregar lotes disponíveis.");
    }
    setLoadingBatches(false);
  };


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

  const validateCpf = (cpf) => {
    const c = cpf.replace(/\D/g, "");
    if (c.length !== 11) return false;
    // Rejeita sequências iguais (ex: 111.111.111-11)
    if (/^(\d)\1{10}$/.test(c)) return false;
    // Valida 1º dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
    let rest = (sum * 10) % 11;
    if (rest === 10 || rest === 11) rest = 0;
    if (rest !== parseInt(c[9])) return false;
    // Valida 2º dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
    rest = (sum * 10) % 11;
    if (rest === 10 || rest === 11) rest = 0;
    return rest === parseInt(c[10]);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let v = value;
    if (name === "telefone") v = applyPhoneMask(value);
    if (name === "cpf") {
      v = applyCpfMask(value);
      // Dispara lookup automático quando CPF fica completo (11 dígitos)
      handleCpfLookup(v);
    }
    setFormData((prev) => ({ ...prev, [name]: v }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

// Executa uma promise com tempo limite. Se a promise não resolver dentro do
// prazo (ex.: conexão lenta/instável, rede bloqueando o Firestore), rejeita
// em vez de ficar pendente para sempre — isso é o que evita a tela de
// "carregando" infinita ao verificar o CPF.
const withTimeout = (promise, ms = 20000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]);

const checkCpfInStudents = async (
  cpf: string
): Promise<{ nome: string; ano: string; turma: string } | null> => {
  const cpfDigits = cpf.replace(/\D/g, "");
  try {
    // Busca direta via collectionGroup: consulta TODAS as subcoleções
    // "lista" (de qualquer turma) em uma única query no servidor,
    // em vez de buscar turma por turma e aluno por aluno no cliente.
    const q = query(
      collectionGroup(db, "lista"),
      where("cpf", "==", cpfDigits),
      limit(1)
    );
    const snap = await withTimeout(getDocs(q));
    if (snap.empty) return null;
    const docRef = snap.docs[0];
    const data = docRef.data();
    // turmaId é o id do documento pai (ex: "1A", "2B")
    const turmaId = docRef.ref.parent.parent?.id || "";
    return {
      nome: data.nome || data.nomeAluno || "",
      ano: data.ano || turmaId.slice(0, 1),
      turma: data.turma || turmaId.slice(1),
    };
  } catch (err) {
    console.warn("Falha ao verificar CPF em alunos:", err);
  }
  return null;
};

// Verifica se o CPF existe na coleção de responsáveis cadastrados pelo admin
const checkCpfInResponsaveis = async (
  cpf: string
): Promise<{ nome: string; relacao: string; alunoNome?: string; alunoTurma?: string } | null> => {
  const cpfDigits = cpf.replace(/\D/g, "");
  try {
    const q = query(
      collection(db, "responsaveis"),
      where("cpf", "==", cpfDigits),
      limit(1)
    );
    const snap = await withTimeout(getDocs(q));
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    return {
      nome: data.nome || "",
      relacao: data.relacao || "responsavel",
      alunoNome: data.alunoNome || undefined,
      alunoTurma: data.alunoTurma || undefined,
    };
  } catch (err) {
    console.warn("Falha ao verificar CPF em responsáveis:", err);
  }
  return null;
};

  // Busca automática ao digitar o CPF completo no formulário de cadastro
  const handleCpfLookup = async (cpf: string) => {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) {
      setCpfLookupStatus("idle");
      setCpfStudentData(null);
      setCpfPaiData(null);
      setFormData((prev) => ({ ...prev, ano: "", turma: "", nomeAluno: "" }));
      return;
    }
    setCpfLookupStatus("loading");
    try {
      const found = await checkCpfInStudents(cpf);
      if (found) {
        setCpfStudentData(found);
        setCpfLookupStatus("found");
        setCpfPaiData(null);
        setFormData((prev) => ({
          ...prev,
          ano: found.ano,
          turma: found.turma,
          nomeAluno: found.nome,
        }));
        return;
      }
      // Não encontrou como aluno — verifica se é responsável cadastrado pelo admin
      const foundPai = await checkCpfInResponsaveis(cpf);
      if (foundPai) {
        setCpfPaiData(foundPai);
        setCpfLookupStatus("pai_found");
        setCpfStudentData(null);
        setFormData((prev) => ({
          ...prev,
          ano: "",
          turma: "",
          nomeAluno: "",
          nomeResponsavel: foundPai.nome,
        }));
        return;
      }
      setCpfStudentData(null);
      setCpfPaiData(null);
      setCpfLookupStatus("not_found");
      setFormData((prev) => ({ ...prev, ano: "", turma: "", nomeAluno: "" }));
      setCpfNotFound(true);
    } catch (err) {
      // Rede falhou/travou nas duas buscas. Em vez de ficar parado em
      // "loading" para sempre, volta para "idle" e avisa o usuário, que
      // pode então digitar de novo ou tentar com outra conexão.
      console.warn("Erro ao verificar CPF:", err);
      setCpfStudentData(null);
      setCpfPaiData(null);
      setCpfLookupStatus("idle");
      showToast("Verifique sua rede");
    }
  };

  // 2. Login Real via E-mail/Senha
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.senha)
      return showToast("Preencha E-mail/Usuário e Senha.");

    // --- LOGICA DE BYPASS PARA DIRETORIA (visão de presença) ---
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
          // Define o que o card/lista "Pendentes" mostra no painel:
          // "presenca" => quem NÃO entrou (não marcou presença no evento)
          modoPendentes: "presenca",
        });
        safeStorage.set(SESSION_KEY, "1");
        setIsLoading(false);
        setView("dashboard");
      }, 800);
      return;
    }
    // ----------------------------------------

    // --- LOGICA DE BYPASS PARA DIRETORIA (visão financeira) ---
    if (
      formData.email.toLowerCase() === "brandao1" &&
      formData.senha === "brandao1"
    ) {
      setIsLoading(true);
      adminBypassRef.current = true;

      setTimeout(() => {
        setCurrentUser({
          uid: "admin_master_124",
          isAdmin: true,
          nomeResponsavel: "Administração Brandão",
          nomeAluno: "Diretoria",
          email: "admin2@brandao.com",
          // "pagamento" => quem NÃO pagou o ingresso (comportamento original)
          modoPendentes: "pagamento",
        });
        safeStorage.set(SESSION_KEY, "1");
        setIsLoading(false);
        setView("dashboard");
      }, 800);
      return;
    }
    // ----------------------------------------

    // --- LOGICA DE BYPASS PARA USUÁRIO DE TESTE ---
    if (
      formData.email.toLowerCase() === "teste" &&
      formData.senha === "teste"
    ) {
      setIsLoading(true);
      adminBypassRef.current = true;
      const testUid = "usuario_teste";

      try {
        const docRef = doc(db, "usuarios", testUid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().cpf) {
          // Já completou o cadastro de teste antes — vai direto pro painel
          const userData = docSnap.data();
          const testUser = {
            ...userData,
            uid: testUid,
            isTest: true,
            email: userData.email || "teste@teste.com",
          };
          setCurrentUser(testUser);

          const tickets = await fetchTicketsForUser(testUid, userData.cpf);
          setPurchasedTickets(tickets);

          safeStorage.set(SESSION_KEY, "1");
          setIsLoading(false);
          setActiveTab("ingressos");
          setView("dashboard");
        } else {
          // Primeiro acesso de teste — abre a tela de cadastro/perfil
          setCurrentUser({
            uid: testUid,
            isTest: true,
            email: "teste@teste.com",
            nomeResponsavel: "Usuário Teste",
          });
          setFormData((prev) => ({
            ...prev,
            email: "teste@teste.com",
            nomeResponsavel: "Usuário Teste",
          }));
          safeStorage.set(SESSION_KEY, "1");
          setIsLoading(false);
          setView("complete_profile");
        }
      } catch (err) {
        console.error(err);
        setIsLoading(false);
        showToast("Erro ao carregar conta de teste.");
      }
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

      setIsLoading(false);
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

  const validateRegister = (isPai = false) => {
    const e = {};
    // Para pais, valida o nome digitado; para alunos, o nome vem do CPF automaticamente
    // Se cpfPaiData está disponível, o nome vem do sistema — não precisa digitar
    if (isPai && !cpfPaiData && formData.nomeResponsavel.length < 3)
      e.nomeResponsavel = "Mínimo 3 caracteres";
    if (!validateCpf(formData.cpf)) e.cpf = "CPF inválido";
    if (!/^\S+@\S+\.\S+$/.test(formData.email)) e.email = "E-mail inválido";
    if (formData.senha.length < 6) e.senha = "Mínimo 6 caracteres";
    if (formData.senha !== formData.confirmarSenha)
      e.confirmarSenha = "Senhas não coincidem";
    if (formData.telefone.replace(/\D/g, "").length < 10)
      e.telefone = "Telefone inválido";
    // Campos de aluno só são obrigatórios se não for pai
    if (!isPai) {
      if (!formData.ano) e.ano = "Selecione o ano";
      if (!formData.turma) e.turma = "Selecione a turma";
      if (formData.nomeAluno.length < 3) e.nomeAluno = "Mínimo 3 caracteres";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // 4. Cadastro Real via Firebase (Com verificação de CPF)
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!validateRegister(false))
      return showToast("Corrija os erros para continuar.");

    // CPF ainda não foi verificado ou não foi encontrado
    if (cpfLookupStatus !== "found") {
      if (cpfLookupStatus === "pai_found") {
        // CPF de pai — chama o handler correto
        await handleRegisterAsPai(e);
        return;
      }
      if (cpfLookupStatus === "not_found") {
        setCpfNotFound(true);
      } else {
        showToast("Aguarde a verificação do CPF ou insira um CPF válido.");
      }
      return;
    }

    setIsLoading(true);
    setCpfNotFound(false);

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
        nomeResponsavel: formData.nomeAluno, // para alunos, o nome vem do CPF automaticamente
        cpf: formData.cpf,
        telefone: formData.telefone,
        ano: formData.ano,
        turma: formData.turma,
        nomeAluno: formData.nomeAluno,
        email: formData.email,
        criadoEm: new Date().toISOString(),
        tipo: "aluno",
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

  // 4b. Cadastro como Pai/Responsável (CPF livre, sem vínculo com aluno)
  const handleRegisterAsPai = async (e?) => {
    e?.preventDefault();
    if (!validateRegister(true))
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
        nomeResponsavel: cpfPaiData?.nome || formData.nomeResponsavel,
        cpf: formData.cpf,
        telefone: formData.telefone,
        email: formData.email,
        criadoEm: new Date().toISOString(),
        tipo: "pai",
        relacao: cpfPaiData?.relacao || "responsavel",
        // ano e turma intencionalmente ausentes → sistema identifica como pai
      };

      await setDoc(doc(db, "usuarios", user.uid), userData);

      setIsSuccess(true);
      setIsLoading(false);
      setTimeout(() => setIsSuccess(false), 2000);
    } catch (error) {
      setIsLoading(false);
      let msg = "Erro ao criar conta.";
      if (error.code === "auth/email-already-in-use")
        msg = "Este e-mail já está em uso.";
      showToast(msg);
    }
  };

  // Completar perfil (para quem loga com Google ou cai na race condition do cadastro e-mail)
  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    const eErrors = {};
    if (!validateCpf(formData.cpf)) eErrors.cpf = "CPF inválido";
    if (formData.telefone.replace(/\D/g, "").length < 10)
      eErrors.telefone = "Telefone inválido";
    // ano, turma e nomeAluno vêm automaticamente do CPF lookup
    if (cpfLookupStatus !== "found" && cpfLookupStatus !== "pai_found") {
      eErrors.cpf = "CPF não verificado na lista de alunos ou responsáveis";
    }

    setErrors(eErrors);
    if (Object.keys(eErrors).length > 0)
      return showToast("Corrija os erros para continuar.");

    setIsLoading(true);
    setCpfNotFound(false);

    const isPai = cpfLookupStatus === "pai_found";

    try {
      if (!currentUser?.isTest) {
        if (!isPai) {
          // Verifica se o CPF está na lista de alunos do sistema
          const alunoExiste = await checkCpfInStudents(formData.cpf);
          if (!alunoExiste) {
            setIsLoading(false);
            setCpfNotFound(true);
            return;
          }
        }

        const qCpf = query(
          collection(db, "usuarios"),
          where("cpf", "==", formData.cpf)
        );
        const snapCpf = await getDocs(qCpf);
        // Se o único doc com esse CPF for o próprio usuário, tudo bem (race condition do e-mail)
        const duplicado = snapCpf.docs.some((d) => d.id !== currentUser?.uid);
        if (duplicado) {
          setIsLoading(false);
          return showToast("Este CPF já está cadastrado em outra conta.");
        }
      }

      const userData = isPai
        ? {
            nomeResponsavel: cpfPaiData?.nome || formData.nomeResponsavel,
            cpf: formData.cpf,
            telefone: formData.telefone,
            email: currentUser.email,
            tipo: "pai",
            relacao: cpfPaiData?.relacao || "responsavel",
          }
        : {
            nomeResponsavel: formData.nomeAluno || currentUser.nomeResponsavel,
            cpf: formData.cpf,
            telefone: formData.telefone,
            ano: formData.ano,
            turma: formData.turma,
            nomeAluno: formData.nomeAluno,
            tipo: "aluno",
          };

      if (currentUser?.isTest) {
        // Conta de teste: o documento ainda não existe na 1ª vez, então usamos setDoc/merge
        await setDoc(
          doc(db, "usuarios", currentUser.uid),
          { ...userData, email: currentUser.email, isTest: true },
          { merge: true }
        );
      } else {
        // Usa setDoc com merge para cobrir tanto update quanto criação (race condition)
        await setDoc(
          doc(db, "usuarios", currentUser.uid),
          { ...userData, criadoEm: new Date().toISOString() },
          { merge: true }
        );
      }

      setIsSuccess(true);
      setIsLoading(false);

      setTimeout(async () => {
        setCurrentUser({ ...currentUser, ...userData });
        const tickets = await fetchTicketsForUser(
          currentUser.uid,
          userData.cpf
        );
        setPurchasedTickets(tickets);

        safeStorage.set(SESSION_KEY, "1");
        setIsSuccess(false);
        setView("dashboard");
      }, 2000);
    } catch (err) {
      setIsLoading(false);
      showToast("Erro ao salvar perfil no banco de dados.");
    }
  };

  // 5. Logout Seguro via Firebase
  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    safeStorage.remove(SESSION_KEY);
    // Se for admin ou conta de teste, apenas limpamos o bypass e a sessão mockada
    if (currentUser?.isAdmin || currentUser?.isTest) {
      adminBypassRef.current = false;
    } else {
      await signOut(auth);
    }
    setCurrentUser(null);
    setCart({});
    setView("auth_choice");
  };

  // Validação de Limite de Carrinho com Suporte aos Lotes Dinâmicos
  const updateCart = (batch, amount) => {
    if (purchasedTickets.length > 0) {
      return showToast("Você já garantiu seu ingresso. Limite de 1 por CPF.");
    }
    setCart((prev) => {
      const currentQty = prev[batch.id]?.qty || 0;
      const newQty = Math.max(0, currentQty + amount);

      // Limita compras de todos os lotes somados a 1
      const otherItemsCount = Object.entries(prev)
        .filter(([id]) => id !== batch.id)
        .reduce((acc, [, item]) => acc + item.qty, 0);

      if (otherItemsCount + newQty > 1) {
        showToast("Permitido apenas um ingresso por pessoa no total.");
        return prev;
      }

      // Bloqueio manual do lote (admin)
      if (amount > 0 && batch.bloqueadoParaAluno) {
        showToast("Este lote está bloqueado.");
        return prev;
      }

      // Bloqueia se o lote já atingiu o limite
      const limite = Number(batch.quantidade) || 0;
      const vendidos = Number(batch.vendidos) || 0;
      if (amount > 0 && limite > 0 && vendidos + newQty > limite) {
        showToast("Este lote está esgotado.");
        return prev;
      }


      const newCart = { ...prev };
      if (newQty === 0) {
        delete newCart[batch.id];
      } else {
        newCart[batch.id] = {
          qty: newQty,
          preco: Number(batch.preco),
          nome: batch.nome,
          loteId: batch.id,
        };
      }
      return newCart;
    });
  };

  const handleCheckout = () => {
    if (totalCart === 0) return showToast("Adicione itens ao carrinho.");
    setPaymentMethod("pix");
    setPixData(null);
    setCardData({ number: "", name: "", expiry: "", cvv: "" });
    setView("payment");
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
  const [pixData, setPixData] = useState(null); // { qrCode, qrCodeBase64, paymentId }
  const [pixCopied, setPixCopied] = useState(false);
  const [pixStatus, setPixStatus] = useState(null); // "pending" | "approved" | "rejected" | "cancelled"
  const [pixChecking, setPixChecking] = useState(false);
  const [cardInstallments, setCardInstallments] = useState([]);
  const isGeneratingTicketRef = useRef(false);

  // Gera pagamento PIX via API transparente
  const handlePixPayment = async () => {
    setIsPaymentLoading(true);

    if (!currentUser?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentUser.email)) {
      showToast("Atualize seu e-mail no perfil antes de pagar.");
      setIsPaymentLoading(false);
      setActiveTab("perfil");
      return;
    }

    // --- BYPASS PARA CONTA DE TESTE: gera o ingresso sem cobrar de fato ---
    if (currentUser?.isTest) {
      await handleMpSuccess({
        paymentId: `TESTE-PIX-${Date.now()}`,
        isTest: true,
      });
      setIsPaymentLoading(false);
      return;
    }
    // ----------------------------------------------------------------------

    try {
      const cpfClean = (currentUser?.cpf || "").replace(/\D/g, "");
      const nomeCompleto = currentUser?.nomeAluno || currentUser?.nomeResponsavel || "Comprador";
      const body = {
        transaction_amount: totalCart,
        description: "Ingresso - Festa Junina Brandão",
        payment_method_id: "pix",
        external_reference: currentUser?.uid || "",
        metadata: { user_id: currentUser?.uid || "", user_email: currentUser?.email || "" },
        payer: {
          email: currentUser?.email || "comprador@email.com",
          first_name: nomeCompleto.split(" ")[0],
          last_name: nomeCompleto.split(" ").slice(1).join(" ") || ".",
          identification: { type: "CPF", number: cpfClean },
        },
      };
      const res = await fetch("/api/process-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (result.point_of_interaction?.transaction_data) {
        const txData = result.point_of_interaction.transaction_data;
        setPixData({
          qrCode: txData.qr_code,
          qrCodeBase64: txData.qr_code_base64,
          paymentId: result.id,
        });
        setPixStatus("pending");
      } else {
        showToast(result.message || "Erro ao gerar PIX. Tente novamente.");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro de conexão ao gerar PIX.");
    }
    setIsPaymentLoading(false);
  };

  // Gera token e paga com cartão via API transparente
  const handleCardPayment = async () => {
    setIsPaymentLoading(true);

    if (!currentUser?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentUser.email)) {
      showToast("Atualize seu e-mail no perfil antes de pagar.");
      setIsPaymentLoading(false);
      setActiveTab("perfil");
      return;
    }

    // --- BYPASS PARA CONTA DE TESTE: gera o ingresso sem cobrar de fato ---
    if (currentUser?.isTest) {
      await handleMpSuccess({
        paymentId: `TESTE-CARTAO-${Date.now()}`,
        isTest: true,
      });
      setIsPaymentLoading(false);
      return;
    }
    // ----------------------------------------------------------------------

    try {
      const MercadoPago = await loadMpSdk();
      const mp = new MercadoPago(MP_PUBLIC_KEY, { locale: "pt-BR" });

      const [expMonth, expYear] = cardData.expiry.split("/");
      const cardToken = await mp.createCardToken({
        cardNumber: cardData.number.replace(/\s/g, ""),
        cardholderName: cardData.name,
        cardExpirationMonth: expMonth,
        cardExpirationYear: `20${expYear}`,
        securityCode: cardData.cvv,
        identificationType: "CPF",
        identificationNumber: (currentUser?.cpf || "").replace(/\D/g, ""),
      });

      if (!cardToken?.id) {
        showToast("Dados do cartão inválidos. Verifique e tente novamente.");
        setIsPaymentLoading(false);
        return;
      }

      const cpfClean = (currentUser?.cpf || "").replace(/\D/g, "");
      const nomeCompletoCartao = currentUser?.nomeAluno || currentUser?.nomeResponsavel || "Comprador";
      const body = {
        transaction_amount: totalCart,
        token: cardToken.id,
        description: "Ingresso - Festa Junina Brandão",
        installments: 1,
        payment_method_id: cardToken.payment_method_id || undefined,
        external_reference: currentUser?.uid || "",
        metadata: { user_id: currentUser?.uid || "", user_email: currentUser?.email || "" },
        payer: {
          email: currentUser?.email || "comprador@email.com",
          first_name: nomeCompletoCartao.split(" ")[0],
          last_name: nomeCompletoCartao.split(" ").slice(1).join(" ") || ".",
          identification: { type: "CPF", number: cpfClean },
        },
      };

      const res = await fetch("/api/process-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();

      if (result.status === "approved") {
        await handleMpSuccess({ paymentId: result.id, status: "approved" });
      } else if (
        result.status === "in_process" ||
        result.status === "pending"
      ) {
        await handleMpSuccess({ paymentId: result.id, status: result.status });
      } else {
        showToast(
          result.message ||
            "Pagamento não aprovado. Verifique os dados do cartão."
        );
      }
    } catch (err) {
      console.error(err);
      showToast(
        "Erro ao processar cartão. Verifique os dados e tente novamente."
      );
    }
    setIsPaymentLoading(false);
  };

  // Chamado pelo Wallet do MP quando pagamento é aprovado/pendente
  const gerarCodigoIngresso = async () => {
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

  // 🔒 Criação ATÔMICA do ingresso (mesma estratégia usada no webhook
  // api/mp-webhook.js): usa o próprio mpPaymentId como ID de um documento de
  // "reserva" em pagamentos_processados/{paymentId}. Tudo — checar se já foi
  // processado, gerar o código sequencial e criar o ingresso — acontece
  // dentro de UMA ÚNICA transação do Firestore. Antes, o código fazia um
  // getDocs (consulta) e SÓ DEPOIS um setDoc (criação) como duas operações
  // separadas — se o webhook do servidor processasse o mesmo pagamento entre
  // essas duas etapas, os dois lados viam "não existe" e cada um criava o
  // seu próprio ingresso, gerando duplicidade. Com a transação, o Firestore
  // garante que apenas um dos dois processos (cliente OU webhook) consegue
  // criar a reserva — o outro lê o resultado já existente e não duplica.
  const criarIngressoAtomico = async (paymentId, montarTicket) => {
    const reservaRef = doc(db, "pagamentos_processados", String(paymentId));
    const counterRef = doc(db, "config", "ticketCounter");

    return runTransaction(db, async (transaction) => {
      const reservaSnap = await transaction.get(reservaRef);
      if (reservaSnap.exists()) {
        return { code: reservaSnap.data().code, criadoAgora: false };
      }

      const counterSnap = await transaction.get(counterRef);
      const atual = counterSnap.exists() ? counterSnap.data().ultimo || 0 : 0;
      const proximo = atual + 1;
      const code = `FJ-${String(proximo).padStart(4, "0")}`;
      const ticket = montarTicket(code);

      transaction.set(counterRef, { ultimo: proximo });
      transaction.set(doc(db, "ingressos", code), ticket);
      transaction.set(reservaRef, {
        code,
        mpPaymentId: String(paymentId),
        origem: "cliente",
        criadoEm: new Date().toISOString(),
      });

      return { code, criadoAgora: true, ticket };
    });
  };

  const handleMpSuccess = async (paymentData) => {
    // 🔒 Trava local: impede que duas chamadas concorrentes (ex: ticks do
    // polling do PIX disparando quase juntos) entrem na função ao mesmo tempo
    if (isGeneratingTicketRef.current) return;
    isGeneratingTicketRef.current = true;
    try {
      const paymentId = paymentData?.paymentId || "";

      // Resgata o nome do lote que estava no carrinho.
      // Usa cartRef.current (não cart) para garantir o valor mais recente
      // mesmo dentro de callbacks assíncronos / closures do polling do PIX.
      const cartValues = Object.values(cartRef.current);
      const purchasedItem = cartValues[0] || {
        nome: "Acesso Geral",
        preco: 15,
        qty: 1,
      };

      // Só consideramos o ingresso "pago" quando o teste-bypass é usado ou
      // quando o Mercado Pago de fato retornou status "approved". Status
      // "pending"/"in_process" gera o ingresso (reserva o lugar), mas marca
      // como não pago até a confirmação chegar.
      const statusReal = paymentData?.status || "approved";
      const estaPago = !!paymentData?.isTest || statusReal === "approved";

      const montarTicket = (uniqueCode) => ({
        userId: currentUser.uid,
        nomeAluno:
          currentUser.nomeAluno || currentUser.nomeResponsavel || "Usuário",
        type: purchasedItem.nome, // Salva o nome do lote escolhido
        loteId: purchasedItem.loteId || null,
        qty: purchasedItem.qty,
        price: purchasedItem.preco,
        code: uniqueCode,
        criadoEm: new Date().toISOString(),
        paymentMethod: paymentData?.isTest ? "teste" : "mercadopago",
        mpPaymentId: paymentData?.paymentId || "",
        statusPagamento: paymentData?.isTest ? "approved" : statusReal,
        turma: currentUser.turma || "",
        ano: currentUser.ano || "",
        isTest: !!paymentData?.isTest,
        pagamentoConfirmado: estaPago,
        dataPagamento: estaPago ? new Date().toISOString() : null,
        ...(currentUser.tipo === "pai" ? { tipoTitular: "responsavel" } : {}),
      });

      // 🔒 Pagamentos de teste não têm mpPaymentId real e nunca passam pelo
      // webhook, então seguem o fluxo simples (sem precisar de reserva).
      let uniqueCode;
      let ticketData;
      let criadoAgora = true;

      if (paymentId) {
        const resultado = await criarIngressoAtomico(paymentId, montarTicket);
        uniqueCode = resultado.code;
        criadoAgora = resultado.criadoAgora;
        ticketData = resultado.ticket || (await getDoc(doc(db, "ingressos", uniqueCode))).data();

        if (!criadoAgora) {
          // O webhook (ou outra aba/tentativa) já processou este pagamento.
          // Não duplica nada — só mostra o ingresso já existente.
          setPurchasedTickets((prev) => [
            ...prev,
            { id: uniqueCode, ...ticketData },
          ]);
          setMpPreferenceId(null);
          setPixData(null);
          setPixStatus(null);
          setCart({});
          setView("success_purchase");
          return;
        }
      } else {
        uniqueCode = await gerarCodigoIngresso();
        ticketData = montarTicket(uniqueCode);
        await setDoc(doc(db, "ingressos", uniqueCode), ticketData);
      }

      // Mantém o contador "ingressosAssociados" do lote em dia (mesmo campo
      // que o painel admin usa), evitando que a loja precise reler todos os
      // ingressos só para saber quantos já foram vendidos. Só conta para o
      // limite do lote quando o pagamento já está confirmado.
      if (purchasedItem.loteId && estaPago) {
        updateDoc(doc(db, "lotes", purchasedItem.loteId), {
          ingressosAssociados: increment(purchasedItem.qty || 1),
        }).catch((err) =>
          console.warn("Falha ao atualizar contador do lote:", err)
        );
      }

      setPurchasedTickets((prev) => [
        ...prev,
        { id: uniqueCode, ...ticketData },
      ]);

      // Envia e-mail SÓ quando o pagamento está confirmado.
      // Pagamentos pending/in_process serão entregues pelo webhook do MP quando aprovarem.
      if (!paymentData?.isTest && estaPago) {
        try {
          const emailRes = await fetch("https://festajunina-api.vercel.app/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: currentUser.email,
              nomeAluno: ticketData.nomeAluno,
              code: uniqueCode,
              lote: purchasedItem.nome,
              preco: `R$ ${purchasedItem.preco.toFixed(2).replace(".", ",")}`,
            }),
          });
          if (!emailRes.ok) {
            const errBody = await emailRes.text();
            console.error("E-mail falhou:", emailRes.status, errBody);
            await updateDoc(doc(db, "ingressos", uniqueCode), {
              emailEnviado: false,
              emailErro: `${emailRes.status} ${errBody.slice(0, 200)}`,
            }).catch(() => {});
          } else {
            await updateDoc(doc(db, "ingressos", uniqueCode), {
              emailEnviado: true,
              emailEnviadoEm: new Date().toISOString(),
            }).catch(() => {});
          }
        } catch (emailErr) {
          console.error("E-mail não enviado:", emailErr);
          await updateDoc(doc(db, "ingressos", uniqueCode), {
            emailEnviado: false,
            emailErro: String(emailErr?.message || emailErr).slice(0, 200),
          }).catch(() => {});
        }
      }

      setMpPreferenceId(null);
      setPixData(null);
      setPixStatus(null);
      setCart({});
      setView("success_purchase");
    } catch (err) {
      console.error(err);
      showToast(
        "Pagamento recebido, mas erro ao salvar ingresso. Contate o suporte."
      );
    } finally {
      isGeneratingTicketRef.current = false;
    }
  };

  // Verifica o status do pagamento PIX no Mercado Pago
  const checkPixStatus = async (paymentId) => {
    try {
      setPixChecking(true);
      const res = await fetch(`/api/payment-status?id=${paymentId}`);
      const data = await res.json();
      return data?.status;
    } catch (err) {
      console.error("Erro ao verificar status PIX:", err);
      return null;
    } finally {
      setPixChecking(false);
    }
  };

  // Polling automático: verifica o pagamento PIX a cada 5s até aprovação
  useEffect(() => {
    if (!pixData?.paymentId || pixStatus === "approved") return;

    const interval = setInterval(async () => {
      const status = await checkPixStatus(pixData.paymentId);
      if (!status) return;

      if (status === "approved") {
        setPixStatus("approved");
        clearInterval(interval);
        setPixData(null); // evita novo disparo do useEffect enquanto o ingresso é salvo
        await handleMpSuccess({ paymentId: pixData.paymentId, status: "approved" });
      } else if (status === "rejected" || status === "cancelled") {
        setPixStatus(status);
        clearInterval(interval);
        showToast("Pagamento PIX não aprovado. Gere um novo código.");
        setPixData(null);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [pixData?.paymentId, pixStatus]);

  const anoLabel = { "1": "1º Ano", "2": "2º Ano", "3": "3º Ano" };

  /* ─── NAV ITEMS ─── */
  const navItems = [
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
            <div className="space-y-2 text-center">
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
            <div className="space-y-2 text-center">
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
              onClick={() => {
                setView("auth_choice");
                setCpfNotFound(false);
                setRegisterAsPai(false);
                setCpfLookupStatus("idle");
                setCpfStudentData(null);
      setCpfPaiData(null);
                setFormData((prev) => ({ ...prev, cpf: "", ano: "", turma: "", nomeAluno: "", nomeResponsavel: "" }));
              }}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-8 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Nova conta
              </h1>
              <p className="text-zinc-400 text-sm mt-1">
                Comece digitando seu CPF para identificarmos você
              </p>
            </div>

            {/* ── CPF não encontrado: tela de bloqueio ── */}
            {cpfNotFound ? (
              <div className="space-y-6">
                {!registerAsPai ? (
                  <div className="flex flex-col items-center text-center gap-5 py-4">
                    <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                      <AlertCircle className="h-8 w-8 text-red-400" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-white font-bold text-lg">
                        CPF não cadastrado no sistema
                      </h2>
                      <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mx-auto">
                        O CPF informado não consta na lista de alunos da escola.
                        Apenas alunos cadastrados pela instituição podem criar
                        uma conta.
                      </p>
                      <p className="text-zinc-500 text-sm mt-1">
                        Se você acredita que isso é um engano, entre em contato
                        com a escola.
                      </p>
                    </div>

                    <div className="w-full space-y-3 pt-2">
                      <a
                        href="https://wa.me/5531999848388?text=Ol%C3%A1!%20Tentei%20criar%20minha%20conta%20na%20Festa%20Junina%20e%20meu%20CPF%20n%C3%A3o%20foi%20reconhecido.%20Pode%20me%20ajudar%3F"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-3 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold text-sm px-6 py-3.5 rounded-2xl transition-all w-full justify-center"
                      >
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current shrink-0">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        Falar com a organização no WhatsApp
                      </a>

                      {!showPaiInfo ? (
                        <button
                          onClick={() => setShowPaiInfo(true)}
                          className="w-full text-sm text-zinc-400 hover:text-white transition-colors underline underline-offset-2"
                        >
                          Sou pai
                        </button>
                      ) : (
                        <div className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-5 py-4 text-left space-y-1">
                          <p className="text-white font-semibold text-sm flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-zinc-400 shrink-0" />
                            Lote exclusivo para pais
                          </p>
                          <p className="text-zinc-400 text-sm leading-relaxed">
                            Os ingressos para pais e responsáveis estarão
                            disponíveis a partir do dia{" "}
                            <span className="text-white font-bold">21 de junho</span>
                            , com quantidade limitada. Fique de olho!
                          </p>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setCpfNotFound(false);
                          setShowPaiInfo(false);
                          setCpfLookupStatus("idle");
                          setCpfStudentData(null);
      setCpfPaiData(null);
                          setFormData((prev) => ({ ...prev, cpf: "", ano: "", turma: "", nomeAluno: "" }));
                        }}
                        className="w-full text-sm text-zinc-500 hover:text-white transition-colors underline underline-offset-2"
                      >
                        Digitei o CPF errado
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Formulário pai/responsável ── */
                  <form onSubmit={handleRegisterAsPai} className="space-y-5">
                    <div className="flex items-center gap-3 mb-2">
                      <button type="button" onClick={() => setRegisterAsPai(false)} className="text-zinc-500 hover:text-white transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <div>
                        <p className="text-white font-bold text-sm">Cadastro de Pai / Responsável</p>
                        <p className="text-zinc-500 text-xs mt-0.5">Preencha seus dados para criar a conta</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Nome Completo</Label>
                      <Input name="nomeResponsavel" value={formData.nomeResponsavel} onChange={handleChange} error={errors.nomeResponsavel} placeholder="Seu nome completo" />
                      {errors.nomeResponsavel && <p className="text-xs text-red-400">{errors.nomeResponsavel}</p>}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>CPF</Label>
                        <Input name="cpf" value={formData.cpf} onChange={handleChange} error={errors.cpf} placeholder="000.000.000-00" maxLength={14} />
                        {errors.cpf && <p className="text-xs text-red-400">{errors.cpf}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label>Telefone (WhatsApp)</Label>
                        <Input name="telefone" maxLength={15} value={formData.telefone} onChange={handleChange} error={errors.telefone} placeholder="(00) 00000-0000" />
                        {errors.telefone && <p className="text-xs text-red-400">{errors.telefone}</p>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>E-mail</Label>
                      <Input name="email" type="email" value={formData.email} onChange={handleChange} error={errors.email} placeholder="seu@email.com" />
                      {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Senha</Label>
                        <Input name="senha" type="password" value={formData.senha} onChange={handleChange} error={errors.senha} placeholder="Mínimo 6 caracteres" />
                        {errors.senha && <p className="text-xs text-red-400">{errors.senha}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label>Confirmar Senha</Label>
                        <Input name="confirmarSenha" type="password" value={formData.confirmarSenha} onChange={handleChange} error={errors.confirmarSenha} />
                        {errors.confirmarSenha && <p className="text-xs text-red-400">{errors.confirmarSenha}</p>}
                      </div>
                    </div>
                    <Button type="submit" className="w-full mt-2" isLoading={isLoading}>
                      Criar conta como Pai/Responsável
                    </Button>
                  </form>
                )}
              </div>
            ) : (
              /* ══════════════════════════════════════════
                 NOVO FLUXO: CPF primeiro → resto depois
                 ══════════════════════════════════════════ */
              <form onSubmit={handleRegister} className="space-y-6">

                {/* ── ETAPA 1: CPF ── */}
                <div className="space-y-2">
                  <Label>
                    {cpfLookupStatus === "pai_found" ? "CPF do Responsável" : "CPF do Aluno ou Responsável"}
                  </Label>
                  <div className="relative">
                    <Input
                      name="cpf"
                      value={formData.cpf}
                      onChange={handleChange}
                      error={errors.cpf}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      autoFocus
                    />
                    {cpfLookupStatus === "loading" && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 animate-spin" />
                    )}
                    {(cpfLookupStatus === "found" || cpfLookupStatus === "pai_found") && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-400" />
                    )}
                  </div>
                  {errors.cpf && <p className="text-xs text-red-400">{errors.cpf}</p>}
                  {cpfLookupStatus === "idle" && (
                    <p className="text-xs text-zinc-500">
                      Digite seu CPF — alunos e responsáveis cadastrados são identificados automaticamente.
                    </p>
                  )}
                  {cpfLookupStatus === "loading" && (
                    <p className="text-xs text-zinc-500 animate-pulse">Verificando CPF no sistema...</p>
                  )}
                </div>

                {/* ── ETAPA 2a: aluno encontrado ── */}
                {cpfLookupStatus === "found" && (
                  <>
                    {/* Card com dados do aluno identificado */}
                    <div className="rounded-2xl border border-green-500/20 bg-green-500/5 px-5 py-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                        <GraduationCap className="h-5 w-5 text-green-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{formData.nomeAluno}</p>
                        <p className="text-zinc-400 text-xs mt-0.5">
                          {formData.ano}º Ano &middot; Turma {formData.turma}
                        </p>
                      </div>
                      <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
                        <CheckCircle2 className="h-3 w-3" /> Identificado
                      </span>
                    </div>

                    {/* Campos de conta */}
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
                      {errors.telefone && <p className="text-xs text-red-400">{errors.telefone}</p>}
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
                      <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-1">
                        <Mail className="h-3 w-3 shrink-0" />
                        Seu ingresso e informações do evento serão enviados aqui.
                      </p>
                      {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
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
                        {errors.senha && <p className="text-xs text-red-400">{errors.senha}</p>}
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
                        {errors.confirmarSenha && <p className="text-xs text-red-400">{errors.confirmarSenha}</p>}
                      </div>
                    </div>

                    <Button type="submit" className="w-full mt-2" isLoading={isLoading}>
                      Criar conta e Acessar
                    </Button>
                  </>
                )}

                {/* ── ETAPA 2b: responsável/pai encontrado ── */}
                {cpfLookupStatus === "pai_found" && cpfPaiData && (
                  <div className="space-y-5">
                    {/* Card pai identificado */}
                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 px-5 py-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <User className="h-5 w-5 text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{cpfPaiData.nome}</p>
                        <p className="text-zinc-400 text-xs mt-0.5 capitalize">
                          {cpfPaiData.relacao}
                          {cpfPaiData.alunoNome && ` · Pai de ${cpfPaiData.alunoNome}`}
                        </p>
                      </div>
                      <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                        <CheckCircle2 className="h-3 w-3" /> Pai/Responsável
                      </span>
                    </div>

                    <div className="space-y-2">
                      <Label>Telefone (WhatsApp)</Label>
                      <Input name="telefone" maxLength={15} value={formData.telefone} onChange={handleChange} error={errors.telefone} placeholder="(00) 00000-0000" />
                      {errors.telefone && <p className="text-xs text-red-400">{errors.telefone}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>E-mail</Label>
                      <Input name="email" type="email" value={formData.email} onChange={handleChange} error={errors.email} placeholder="seu@email.com" />
                      <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-1">
                        <Mail className="h-3 w-3 shrink-0" />
                        Seu ingresso e informações do evento serão enviados aqui.
                      </p>
                      {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label>Senha</Label>
                        <Input name="senha" type="password" value={formData.senha} onChange={handleChange} error={errors.senha} placeholder="Mínimo 6 caracteres" />
                        {errors.senha && <p className="text-xs text-red-400">{errors.senha}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label>Confirmar Senha</Label>
                        <Input name="confirmarSenha" type="password" value={formData.confirmarSenha} onChange={handleChange} error={errors.confirmarSenha} />
                        {errors.confirmarSenha && <p className="text-xs text-red-400">{errors.confirmarSenha}</p>}
                      </div>
                    </div>
                    <Button type="button" onClick={handleRegisterAsPai} className="w-full mt-2" isLoading={isLoading}>
                      Criar conta como Pai/Responsável
                    </Button>
                  </div>
                )}
              </form>
            )}

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
            {/* ── Bloqueio: CPF não cadastrado no sistema ── */}
            {cpfNotFound ? (
              <div className="space-y-6">
                <div className="flex flex-col items-center text-center gap-5 py-6">
                  <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <AlertCircle className="h-8 w-8 text-red-400" />
                  </div>
                  <div className="space-y-2 text-center">
                    <h2 className="text-white font-bold text-lg">
                      CPF não cadastrado no sistema
                    </h2>
                    <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mx-auto">
                      O CPF informado não consta na lista de alunos da
                      organização. Apenas alunos cadastrados pela instituição
                      podem criar uma conta.
                    </p>
                    <p className="text-zinc-500 text-sm mt-1">
                      Se você acredita que isso é um engano, entre em contato
                      com a organização.
                    </p>
                  </div>
                  <a
                    href="https://wa.me/5531999848388?text=Ol%C3%A1!%20Tentei%20criar%20minha%20conta%20na%20Festa%20Junina%20e%20meu%20CPF%20n%C3%A3o%20foi%20reconhecido.%20Pode%20me%20ajudar%3F"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold text-sm px-6 py-3.5 rounded-2xl transition-all w-full justify-center"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5 fill-current shrink-0"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    Falar com a organização no WhatsApp
                  </a>
                  {/* Botão Sou pai */}
                  {!showPaiInfo ? (
                    <button
                      onClick={() => setShowPaiInfo(true)}
                      className="text-sm text-zinc-400 hover:text-white transition-colors underline underline-offset-2"
                    >
                      Sou pai
                    </button>
                  ) : (
                    <div className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-5 py-4 text-left space-y-1">
                      <p className="text-white font-semibold text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-zinc-400 shrink-0" />
                        Lote exclusivo para pais
                      </p>
                      <p className="text-zinc-400 text-sm leading-relaxed">
                        Os ingressos para pais e responsáveis estarão
                        disponíveis a partir do dia{" "}
                        <span className="text-white font-bold">
                          21 de junho
                        </span>
                        , com quantidade limitada. Fique de olho!
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setCpfNotFound(false);
                      setShowPaiInfo(false);
                      setCpfLookupStatus("idle");
                      setCpfStudentData(null);
      setCpfPaiData(null);
                      setFormData((prev) => ({
                        ...prev,
                        cpf: "",
                        ano: "",
                        turma: "",
                        nomeAluno: "",
                      }));
                    }}
                    className="text-sm text-zinc-500 hover:text-white transition-colors underline underline-offset-2"
                  >
                    Digitei o CPF errado
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCompleteProfile} className="space-y-6">

                {/* ── ETAPA 1: CPF ── */}
                <div className="space-y-2">
                  <Label>
                    {cpfLookupStatus === "pai_found" ? "CPF do Responsável" : "CPF do Aluno ou Responsável"}
                  </Label>
                  <div className="relative">
                    <Input
                      name="cpf"
                      value={formData.cpf || ""}
                      onChange={handleChange}
                      error={errors.cpf}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      autoFocus
                    />
                    {cpfLookupStatus === "loading" && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 animate-spin" />
                    )}
                    {(cpfLookupStatus === "found" || cpfLookupStatus === "pai_found") && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-400" />
                    )}
                  </div>
                  {errors.cpf && <p className="text-xs text-red-400">{errors.cpf}</p>}
                  {cpfLookupStatus === "idle" && (
                    <p className="text-xs text-zinc-500">
                      Digite seu CPF — alunos e responsáveis cadastrados são identificados automaticamente.
                    </p>
                  )}
                  {cpfLookupStatus === "loading" && (
                    <p className="text-xs text-zinc-500 animate-pulse">Verificando CPF no sistema...</p>
                  )}
                </div>

                {/* ── ETAPA 2: exibida após CPF encontrado ── */}
                {cpfLookupStatus === "found" && (
                  <>
                    {/* Card com dados identificados */}
                    <div className="rounded-2xl border border-green-500/20 bg-green-500/5 px-5 py-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                        <GraduationCap className="h-5 w-5 text-green-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{formData.nomeAluno}</p>
                        <p className="text-zinc-400 text-xs mt-0.5">
                          {formData.ano}º Ano &middot; Turma {formData.turma}
                        </p>
                      </div>
                      <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
                        <CheckCircle2 className="h-3 w-3" /> Identificado
                      </span>
                    </div>

                    {/* Só telefone — o resto vem automático */}
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
                      {errors.telefone && <p className="text-xs text-red-400">{errors.telefone}</p>}
                    </div>

                    <div className="pt-2">
                      <Button type="submit" className="w-full mt-2 h-12" isLoading={isLoading}>
                        Salvar e Continuar
                      </Button>
                      <Button type="button" variant="ghost" className="w-full mt-2" onClick={confirmLogout}>
                        Cancelar e sair
                      </Button>
                    </div>
                  </>
                )}

                {/* Botão cancelar visível enquanto aguarda CPF */}
                {cpfLookupStatus !== "found" && (
                  <Button type="button" variant="ghost" className="w-full" onClick={confirmLogout}>
                    Cancelar e sair
                  </Button>
                )}
              </form>
            )}{" "}
            {/* fim do bloco cpfNotFound / form */}
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
          onLogout={confirmLogout}
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
              title="Página Inicial"
              className={`w-full flex items-center gap-4 px-3 lg:px-0 lg:justify-center h-12 rounded-xl text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-white transition-all whitespace-nowrap ${
                sidebarOpen ? "lg:px-3 lg:justify-start" : ""
              }`}
            >
              <Home className="h-5 w-5 shrink-0" />
              <span
                className={`transition-all duration-300 ${
                  sidebarOpen ? "opacity-100 block" : "lg:hidden opacity-0 w-0"
                }`}
              >
                Página Inicial
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
                              purchasedTickets[purchasedTickets.length - 1] ||
                                null
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
                          Ver Lotes Disponíveis
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
                    {loadingBatches ? (
                      <div className="py-12 flex justify-center">
                        <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
                      </div>
                    ) : batches.length === 0 ? (
                      <div className="bg-[#0a0a0a] p-8 rounded-3xl border border-zinc-800 text-center text-zinc-500">
                        Nenhum lote disponível no momento.
                      </div>
                    ) : (
                      batches.map((batch) => {
                        const qtyInCart = cart[batch.id]?.qty || 0;
                        const limite = Number(batch.quantidade) || 0;
                        const vendidos = Number(batch.vendidos) || 0;
                        const restantes = Math.max(0, limite - vendidos);
                        const pct = limite > 0 ? Math.min(100, (vendidos / limite) * 100) : 0;
                        const esgotado = limite > 0 && vendidos >= limite;
                        const bloqueado = !!batch.bloqueadoParaAluno;
                        const indisponivel = esgotado || bloqueado;
                        return (
                          <div
                            key={batch.id}
                            className={`bg-[#0a0a0a] p-6 sm:p-8 rounded-3xl border border-zinc-800 flex flex-col sm:flex-row justify-between gap-6 ${
                              indisponivel ? "opacity-60" : ""
                            }`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <h3 className="font-bold text-xl text-white">
                                  {batch.nome}
                                </h3>
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-white text-black px-2 py-0.5 rounded-full">
                                  Lote
                                </span>
                                {bloqueado && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <Lock className="w-3 h-3" /> Bloqueado
                                  </span>
                                )}
                                {esgotado && !bloqueado && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider bg-red-500 text-white px-2 py-0.5 rounded-full">
                                    Esgotado
                                  </span>
                                )}
                              </div>

                              <p className="text-sm text-zinc-400">
                                Acesso garantido ao evento.
                                {batch.dataLimite &&
                                  ` Disponível até ${formatDate(
                                    batch.dataLimite
                                  )}`}
                              </p>
                              <p className="text-white font-black text-2xl mt-4">
                                R${" "}
                                {Number(batch.preco)
                                  .toFixed(2)
                                  .replace(".", ",")}
                              </p>

                               {purchasedTickets.length > 0 && (
                                <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl text-sm flex items-center gap-3 mt-6">
                                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                                  Você já garantiu sua entrada. Limite de 1
                                  ingresso por CPF.
                                </div>
                              )}
                            </div>

                            {purchasedTickets.length === 0 && !indisponivel && (
                              <div className="flex items-center gap-3 self-start sm:self-center bg-black border border-zinc-800 rounded-xl p-1.5 mt-4 sm:mt-0">
                                <button
                                  onClick={() => updateCart(batch, -1)}
                                  className="p-3 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white transition"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <span className="w-8 text-center font-bold text-white text-lg">
                                  {qtyInCart}
                                </span>
                                <button
                                  onClick={() => updateCart(batch, 1)}
                                  className="p-3 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white transition"
                                >

                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Resumo */}
                  <div className="lg:col-span-1">
                    <div className="bg-[#0a0a0a] p-6 sm:p-8 rounded-3xl border border-zinc-800 sticky top-6">
                      <h3 className="font-bold flex items-center gap-2 mb-6 text-white border-b border-zinc-800 pb-4">
                        <ShoppingCart className="h-5 w-5 text-zinc-400" />{" "}
                        Resumo
                      </h3>
                      <div className="space-y-4 text-sm mb-6">
                        {cartItems.length > 0 ? (
                          cartItems.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between text-zinc-300"
                            >
                              <span>
                                {item.qty}× {item.nome}
                              </span>
                              <span className="font-semibold text-white">
                                R${" "}
                                {(item.qty * item.preco)
                                  .toFixed(2)
                                  .replace(".", ",")}
                              </span>
                            </div>
                          ))
                        ) : (
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
                          totalCart === 0 ||
                          purchasedTickets.length > 0 ||
                          isPaymentLoading
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
                    {purchasedTickets.map((t) => {
                      const isPaiTicket = t.tipoTitular === "responsavel" || currentUser?.tipo === "pai";
                      const anoDoTicket = t.ano || currentUser?.ano;
                      const turmaDoTicket = t.turma || currentUser?.turma;
                      const turmaLabel =
                        anoDoTicket && turmaDoTicket
                          ? `${
                              anoLabel[anoDoTicket] || anoDoTicket
                            } Médio · Turma ${turmaDoTicket}`
                          : turmaDoTicket
                          ? `Turma ${turmaDoTicket}`
                          : null;

                      return (
                        <div
                          key={t.id}
                          className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl overflow-hidden"
                        >
                          {/* Stripe topo */}
                          <div className="h-1 bg-white w-full" />

                          <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
                            {/* Info do ingresso */}
                            <div className="flex-1 w-full space-y-4">
                              <div>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                                  {isPaiTicket ? "Ingresso de Pai/Responsável" : "Passaporte"}
                                  {t.isTest && (
                                    <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-[9px] font-bold tracking-widest">
                                      TESTE
                                    </span>
                                  )}
                                </p>
                                <p className="font-black text-2xl text-white leading-tight">
                                  {t.type}
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-black border border-zinc-800 rounded-xl px-4 py-3">
                                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5">
                                    {isPaiTicket ? "Responsável" : "Aluno"}
                                  </p>
                                  <p className="text-sm font-semibold text-white truncate">
                                    {t.nomeAluno ||
                                      currentUser?.nomeAluno ||
                                      currentUser?.nomeResponsavel ||
                                      "—"}
                                  </p>
                                </div>

                                <div className="bg-black border border-zinc-800 rounded-xl px-4 py-3">
                                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5">
                                    {isPaiTicket ? "Tipo" : "Turma"}
                                  </p>
                                  <p className="text-sm font-semibold text-white truncate">
                                    {isPaiTicket
                                      ? (currentUser?.relacao ? currentUser.relacao.charAt(0).toUpperCase() + currentUser.relacao.slice(1) : "Pai/Responsável")
                                      : (turmaLabel || "—")}
                                  </p>
                                </div>

                                <div className="bg-black border border-zinc-800 rounded-xl px-4 py-3">
                                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5">
                                    Lote
                                  </p>
                                  <p className="text-sm font-semibold text-white truncate">
                                    {t.type}
                                  </p>
                                </div>

                                <div className="bg-black border border-zinc-800 rounded-xl px-4 py-3">
                                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5">
                                    Comprado em
                                  </p>
                                  <p className="text-sm font-semibold text-white">
                                    {t.criadoEm
                                      ? new Date(t.criadoEm).toLocaleDateString(
                                          "pt-BR",
                                          {
                                            day: "2-digit",
                                            month: "2-digit",
                                            year: "numeric",
                                          }
                                        )
                                      : "—"}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* QR Code */}
                            <div className="w-full sm:w-auto bg-black border border-zinc-800 rounded-2xl p-4 flex flex-col items-center gap-3 shrink-0">
                              <div
                                className="bg-white p-2 rounded-xl cursor-pointer hover:scale-105 transition-transform"
                                onClick={() => setSelectedQr(t)}
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
                                className="h-8 text-xs w-full border border-zinc-800"
                                onClick={() => setSelectedQr(t)}
                              >
                                Ampliar / Baixar
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
        {selectedQr &&
          (() => {
            const ticket =
              typeof selectedQr === "object"
                ? selectedQr
                : { code: selectedQr };
            const anoT = ticket.ano || currentUser?.ano;
            const turmaT = ticket.turma || currentUser?.turma;
            const turmaLabelModal =
              anoT && turmaT
                ? `${anoLabel[anoT] || anoT} Médio · Turma ${turmaT}`
                : turmaT
                ? `Turma ${turmaT}`
                : null;

            const handleDownloadQr = async () => {
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(
                ticket.code
              )}&margin=20`;
              try {
                const res = await fetch(qrUrl);
                const blob = await res.blob();
                const objectUrl = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = objectUrl;
                a.download = `ingresso-${ticket.code}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(objectUrl);
              } catch {
                // fallback: abre em nova aba para salvar manualmente
                window.open(qrUrl, "_blank");
              }
            };

            return (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                onClick={() => setSelectedQr(null)}
              >
                <div
                  className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl max-w-sm w-full flex flex-col items-center relative shadow-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-7 w-full flex flex-col items-center">
                    <button
                      className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white transition-colors"
                      onClick={() => setSelectedQr(null)}
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <h3 className="text-lg font-bold text-white mb-1 text-center">
                      Seu Passaporte
                    </h3>
                    <p className="text-xs text-zinc-500 mb-6 text-center">
                      Apresente na portaria para liberar sua entrada
                    </p>

                    {/* QR */}
                    <div className="bg-white p-3 rounded-2xl w-full flex justify-center mb-6">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                          ticket.code
                        )}`}
                        alt="QR Code Ampliado"
                        className="w-full max-w-[250px] aspect-square object-contain"
                      />
                    </div>

                    {/* Info resumida */}
                    <div className="w-full space-y-px rounded-xl overflow-hidden border border-zinc-800 mb-6">
                      {[
                        {
                          label: "Aluno",
                          value: ticket.nomeAluno || currentUser?.nomeAluno,
                        },
                        { label: "Turma", value: turmaLabelModal },
                        { label: "Lote", value: ticket.type },
                        {
                          label: "Comprado em",
                          value: ticket.criadoEm
                            ? new Date(ticket.criadoEm).toLocaleDateString(
                                "pt-BR",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                }
                              )
                            : null,
                        },
                      ]
                        .filter((r) => r.value)
                        .map(({ label, value }) => (
                          <div
                            key={label}
                            className="flex justify-between items-center bg-zinc-950 px-4 py-3"
                          >
                            <span className="text-xs text-zinc-500">
                              {label}
                            </span>
                            <span className="text-sm font-medium text-white">
                              {value}
                            </span>
                          </div>
                        ))}
                    </div>

                    <p className="text-[11px] text-zinc-500 tracking-widest mb-1">
                      Código verificador
                    </p>
                    <p className="font-mono text-2xl font-bold text-white mb-6 tracking-wider">
                      {ticket.code}
                    </p>

                    {/* Download button */}
                    <Button className="w-full h-12" onClick={handleDownloadQr}>
                      <IoMdDownload className="h-5 w-5" /> Baixar QR Code como
                      Imagem
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}

        {/* MODAL CONFIRMAÇÃO DE LOGOUT */}
        {showLogoutConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <div
              className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl max-w-sm w-full p-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-zinc-800">
                <LogOut className="h-7 w-7 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-white text-center mb-2">
                Sair da conta?
              </h3>
              <p className="text-sm text-zinc-400 text-center mb-8">
                Você precisará fazer login novamente para acessar seus
                ingressos.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={confirmLogout}
                  className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
                >
                  Sim, sair da conta
                </button>
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-xl transition-colors border border-zinc-800"
                >
                  Cancelar
                </button>
              </div>
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

  /* ─── PAGAMENTO TRANSPARENTE ─── */
  if (view === "payment")
    return (
      <div className="min-h-screen bg-[#EBEBEB] flex flex-col items-center py-6 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-[#E6E6E6] shadow-sm">
          {/* Header */}
          <div className="bg-white px-5 py-4 border-b border-[#EEEEEE] flex items-center gap-3">
            <button
              onClick={() => {
                setView("dashboard");
                setPixData(null);
              }}
              className="p-1 -ml-1 hover:bg-zinc-100 text-zinc-700 rounded-full transition"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-[#333333]">
                Pagamento
              </h2>
            </div>
            <MercadoPagoIcon className="h-10 w-10 shrink-0" />
          </div>

          {/* Total destacado */}
          <div className="px-5 pt-5 pb-2">
            <p className="text-[13px] text-[#999999]">Total a pagar</p>
            <p className="text-[28px] font-semibold text-[#333333] tracking-tight">
              R$ {totalCart.toFixed(2).replace(".", ",")}
            </p>
          </div>

          <div className="px-5 pb-6 sm:px-6 space-y-4">
            {/* Resumo do pedido */}
            {cartItems.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#F7F7F7] rounded-xl border border-[#EEEEEE] p-3.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center shrink-0 border border-[#EEEEEE]">
                    <TicketIcon className="h-4 w-4 text-[#00A650]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#333333]">
                      {item.nome}
                    </p>
                    <p className="text-xs text-[#999999]">
                      Festa Junina Brandão
                    </p>
                  </div>
                </div>
                <span className="text-[#333333] font-semibold text-sm">
                  R$ {(item.qty * item.preco).toFixed(2).replace(".", ",")}
                </span>
              </div>
            ))}

            {/* ── PIX: Exibe QR Code ── */}
            {pixData ? (
              <div className="space-y-4">
                <div className="bg-[#E0F7E9] border border-[#CFF0DD] rounded-xl p-3.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#00A650] flex items-center justify-center shrink-0">
                    <MdQrCode2 className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#00A650]">
                      Pix gerado com sucesso!
                    </p>
                    <p className="text-xs text-[#4D9D75]">
                      Escaneie ou copie o código abaixo
                    </p>
                  </div>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center bg-[#F7F7F7] border border-[#EEEEEE] rounded-xl p-5">
                  <div className="bg-white p-3 rounded-xl border border-[#EEEEEE]">
                    {pixData.qrCodeBase64 ? (
                      <img
                        src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                        alt="QR Code PIX"
                        className="w-48 h-48 object-contain"
                      />
                    ) : (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                          pixData.qrCode
                        )}`}
                        alt="QR Code PIX"
                        className="w-48 h-48 object-contain"
                      />
                    )}
                  </div>
                  <p className="text-xs text-[#999999] mt-3 text-center max-w-[260px]">
                    Abra o app do seu banco, escolha pagar via Pix e escaneie o
                    código acima
                  </p>
                </div>

                {/* Código copia e cola */}
                <div>
                  <p className="text-xs text-[#999999] mb-2 font-medium">
                    Código Pix copia e cola
                  </p>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-[#F7F7F7] border border-[#EEEEEE] rounded-xl px-3 py-3 text-xs text-[#666666] font-mono truncate">
                      {pixData.qrCode?.slice(0, 44)}...
                    </div>
                    <button
                      onClick={() => {
                        const copyFallback = (text) => {
                          try {
                            const ta = document.createElement("textarea");
                            ta.value = text;
                            ta.style.position = "fixed";
                            ta.style.opacity = "0";
                            document.body.appendChild(ta);
                            ta.focus();
                            ta.select();
                            document.execCommand("copy");
                            document.body.removeChild(ta);
                            return true;
                          } catch (e) {
                            return false;
                          }
                        };

                        if (navigator.clipboard?.writeText) {
                          navigator.clipboard
                            .writeText(pixData.qrCode)
                            .then(() => {
                              setPixCopied(true);
                              setTimeout(() => setPixCopied(false), 2500);
                            })
                            .catch(() => {
                              if (copyFallback(pixData.qrCode)) {
                                setPixCopied(true);
                                setTimeout(() => setPixCopied(false), 2500);
                              } else {
                                showToast(
                                  "Não foi possível copiar. Selecione o código manualmente."
                                );
                              }
                            });
                        } else if (copyFallback(pixData.qrCode)) {
                          setPixCopied(true);
                          setTimeout(() => setPixCopied(false), 2500);
                        } else {
                          showToast(
                            "Não foi possível copiar. Selecione o código manualmente."
                          );
                        }
                      }}
                      className="bg-[#F7F7F7] border border-[#EEEEEE] rounded-xl px-4 flex items-center justify-center text-[#009EE3] hover:bg-[#EEF8FD] hover:border-[#009EE3] transition"
                    >
                      {pixCopied ? (
                        <CheckCircle2 className="w-4 h-4 text-[#00A650]" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-[#999999] text-xs py-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#009EE3]" />
                  {pixChecking
                    ? "Verificando pagamento..."
                    : "Aguardando confirmação automática do Pix..."}
                </div>

                <p className="text-xs text-[#999999] text-center">
                  A confirmação é automática após o pagamento.
                </p>

                <button
                  onClick={() => {
                    setPixData(null);
                    setPixStatus(null);
                  }}
                  className="w-full text-xs text-[#999999] hover:text-[#666666] transition py-1"
                >
                  Cancelar e escolher outro método
                </button>
              </div>
            ) : (
              <>
                {/* ── Seletor de método ── */}
                <div>
                  <p className="text-[13px] text-[#999999] mb-2 font-medium">
                    Forma de pagamento
                  </p>
                  <div className="space-y-2 text-center">
                    <button
                      onClick={() => setPaymentMethod("pix")}
                      className={`w-full flex items-center gap-3 rounded-xl border p-3.5 transition text-left ${
                        paymentMethod === "pix"
                          ? "border-[#009EE3] bg-[#EEF8FD]"
                          : "border-[#EEEEEE] bg-white hover:border-[#CCCCCC]"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-[#00A650] flex items-center justify-center shrink-0">
                        <MdQrCode2 className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[#333333]">
                          Pix
                        </p>
                        <p className="text-xs text-[#999999]">
                          Aprovação imediata
                        </p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          paymentMethod === "pix"
                            ? "border-[#009EE3]"
                            : "border-[#CCCCCC]"
                        }`}
                      >
                        {paymentMethod === "pix" && (
                          <div className="w-2.5 h-2.5 rounded-full bg-[#009EE3]" />
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => setPaymentMethod("card")}
                      className={`w-full flex items-center gap-3 rounded-xl border p-3.5 transition text-left ${
                        paymentMethod === "card"
                          ? "border-[#009EE3] bg-[#EEF8FD]"
                          : "border-[#EEEEEE] bg-white hover:border-[#CCCCCC]"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-[#F0F0F0] flex items-center justify-center shrink-0">
                        <CreditCard className="w-5 h-5 text-[#666666]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[#333333]">
                          Cartão de crédito ou débito
                        </p>
                        <p className="text-xs text-[#999999]">
                          Visa, Mastercard, Elo e outros
                        </p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          paymentMethod === "card"
                            ? "border-[#009EE3]"
                            : "border-[#CCCCCC]"
                        }`}
                      >
                        {paymentMethod === "card" && (
                          <div className="w-2.5 h-2.5 rounded-full bg-[#009EE3]" />
                        )}
                      </div>
                    </button>
                  </div>
                </div>

                {/* ── PIX: botão gerar ── */}
                {paymentMethod === "pix" && (
                  <div className="space-y-4">
                    <div className="bg-[#F7F7F7] border border-[#EEEEEE] rounded-xl p-3.5 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#999999]">Nome</span>
                        <span className="text-[#333333] font-medium">
                          {currentUser?.nomeResponsavel}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#999999]">CPF</span>
                        <span className="text-[#333333] font-medium">
                          {currentUser?.cpf}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm pt-1 border-t border-[#EEEEEE]">
                        <span className="text-[#999999]">Valor</span>
                        <span className="text-[#333333] font-bold">
                          R$ {totalCart.toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    </div>
                    <Button
                      className="w-full h-14 !bg-[#009EE3] !text-white hover:!bg-[#0089C7] !rounded-lg !font-semibold"
                      onClick={handlePixPayment}
                      isLoading={isPaymentLoading}
                    >
                      <MdQrCode2 className="h-5 w-5" /> Pagar com Pix
                    </Button>
                  </div>
                )}

                {/* ── Cartão: formulário ── */}
                {paymentMethod === "card" && (
                  <div className="space-y-4">
                    {/* Preview do cartão */}
                    <div className="relative w-full aspect-[1.586/1] max-h-40 rounded-2xl bg-gradient-to-br from-[#2D2D2D] to-[#0F0F0F] p-5 text-white overflow-hidden shadow-md">
                      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/5" />
                      <div className="absolute -right-2 top-10 w-20 h-20 rounded-full bg-white/5" />
                      <div className="flex justify-between items-start">
                        <div className="w-10 h-7 rounded bg-gradient-to-br from-[#FFD700] to-[#C9A227]" />
                        <CreditCard className="w-6 h-6 text-white/70" />
                      </div>
                      <p className="mt-6 font-mono text-lg tracking-widest text-white/90">
                        {cardData.number || "•••• •••• •••• ••••"}
                      </p>
                      <div className="flex justify-between mt-4 text-xs text-white/70 uppercase">
                        <span>{cardData.name || "NOME NO CARTÃO"}</span>
                        <span>{cardData.expiry || "MM/AA"}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label className="!text-[#666666]">
                          Número do cartão
                        </Label>
                        <Input
                          name="number"
                          value={cardData.number}
                          onChange={handleCardChange}
                          placeholder="0000 0000 0000 0000"
                          maxLength={19}
                          className="mt-1 !h-12 !rounded-lg !border-[#DDDDDD] !bg-white !text-[#333333] font-mono tracking-wider focus-visible:!ring-[#009EE3]"
                        />
                      </div>
                      <div>
                        <Label className="!text-[#666666]">
                          Nome no cartão
                        </Label>
                        <Input
                          name="name"
                          value={cardData.name}
                          onChange={handleCardChange}
                          placeholder="NOME COMO NO CARTÃO"
                          className="mt-1 !h-12 !rounded-lg !border-[#DDDDDD] !bg-white !text-[#333333] uppercase focus-visible:!ring-[#009EE3]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="!text-[#666666]">Validade</Label>
                          <Input
                            name="expiry"
                            value={cardData.expiry}
                            onChange={handleCardChange}
                            placeholder="MM/AA"
                            maxLength={5}
                            className="mt-1 !h-12 !rounded-lg !border-[#DDDDDD] !bg-white !text-[#333333] font-mono focus-visible:!ring-[#009EE3]"
                          />
                        </div>
                        <div>
                          <Label className="!text-[#666666]">CVV</Label>
                          <Input
                            name="cvv"
                            value={cardData.cvv}
                            onChange={handleCardChange}
                            placeholder="123"
                            maxLength={4}
                            className="mt-1 !h-12 !rounded-lg !border-[#DDDDDD] !bg-white !text-[#333333] font-mono focus-visible:!ring-[#009EE3]"
                          />
                        </div>
                      </div>
                    </div>
                    <Button
                      className="w-full h-14 !bg-[#009EE3] !text-white hover:!bg-[#0089C7] !rounded-lg !font-semibold disabled:!opacity-50"
                      onClick={handleCardPayment}
                      isLoading={isPaymentLoading}
                      disabled={
                        !cardData.number ||
                        !cardData.name ||
                        !cardData.expiry ||
                        !cardData.cvv ||
                        isPaymentLoading
                      }
                    >
                      <CreditCard className="h-5 w-5" /> Pagar R${" "}
                      {totalCart.toFixed(2).replace(".", ",")}
                    </Button>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#999999] pt-2">
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 shrink-0"
                fill="none"
              >
                <path
                  d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3z"
                  fill="#999999"
                />
              </svg>
              <span>Pagamento 100% seguro processado pelo</span>
            </div>
            <div className="flex items-center justify-center pt-1">
              <MercadoPagoLogo className="h-20" />
            </div>
          </div>

          {toast && (
            <div className="fixed bottom-4 right-4 bg-white text-[#333333] border border-[#EEEEEE] shadow-xl rounded-xl p-4 flex items-center gap-3 z-50 max-w-xs">
              {toast.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-[#00A650] shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-[#F23D4F] shrink-0" />
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
            {purchasedTickets[purchasedTickets.length - 1]?.isTest && (
              <span className="inline-block mt-3 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-[11px] font-bold uppercase tracking-widest">
                Ingresso de Teste
              </span>
            )}
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
                setCart({});
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
                setCart({});
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

// Export default agora envolve o app com o AppErrorBoundary: se qualquer
// erro inesperado escapar dos try/catch internos durante a renderização,
// o usuário vê uma tela de recuperação ("Recarregar") em vez de uma tela
// branca sem explicação.
// Tenta desativar a tradução automática do navegador em todas as camadas
// possíveis. Isso reduz MUITO a chance do erro acontecer (em vez de só
// tratar o erro depois que ele já ocorreu):
// 1. <html translate="no">      → padrão suportado por Chrome/Edge/Safari
// 2. <meta name="google" content="notranslate"> → instrução específica do Google Translate
// 3. classe "notranslate" no <html> e <body> → Google Translate respeita essa classe
// Nada disso garante 100% (o usuário/SO pode forçar a tradução mesmo assim),
// por isso o AppErrorBoundary acima continua como rede de segurança.
function useDisableAutoTranslate() {
  useEffect(() => {
    try {
      const html = document.documentElement;
      html.setAttribute("translate", "no");
      html.classList.add("notranslate");
      document.body?.classList.add("notranslate");

      if (!document.querySelector('meta[name="google"]')) {
        const meta = document.createElement("meta");
        meta.name = "google";
        meta.content = "notranslate";
        document.head.appendChild(meta);
      }
    } catch (e) {
      console.warn("Não foi possível aplicar notranslate:", e);
    }
  }, []);
}

// Rede de segurança extra: alguns erros provocados pelo tradutor automático
// (removeChild/insertBefore em nós que o tradutor já alterou) acontecem
// "fora de turno" — não durante a renderização do React — e por isso NÃO
// são capturados pelo AppErrorBoundary (Error Boundaries só pegam erros
// lançados durante o ciclo de render/lifecycle do React). Sem isso, esses
// erros aparecem como "Uncaught" no console e a tela fica branca, sem
// nenhuma tela de aviso sendo exibida. Este hook captura esse tipo de erro
// em qualquer lugar da página, mostra um aviso (via setShowTranslateWarning)
// e só então recarrega — em vez de recarregar silenciosamente.
function useGlobalTranslateErrorGuard(setShowTranslateWarning) {
  useEffect(() => {
    const handler = (event) => {
      const msg = String(event?.message || event?.error?.message || "");
      if (isLikelyTranslateError(msg)) {
        console.warn(
          "Erro de tradução automática detectado fora do React — recarregando a página.",
          msg
        );
        try {
          event.preventDefault();
        } catch (e) {}
        setShowTranslateWarning(true);
        // Dá tempo do usuário ler o aviso antes de recarregar. Pequeno
        // atraso adicional evita loop de reload caso o tradutor reaplique
        // a tradução imediatamente após o reload.
        setTimeout(() => {
          try {
            window.location.reload();
          } catch (e) {}
        }, 2200);
      }
    };
    window.addEventListener("error", handler);
    return () => window.removeEventListener("error", handler);
  }, [setShowTranslateWarning]);
}

// Tela de aviso reutilizada pelo AppErrorBoundary e pelo guard global —
// mesmo texto/instruções nos dois casos, para o usuário sempre ver a mesma
// orientação independente de onde o erro foi capturado.
function TranslateWarningScreen({ onReload }) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
      <div className="max-w-sm space-y-4">
        <p className="text-white font-bold text-lg">
          Desative a tradução automática
        </p>
        <p className="text-zinc-400 text-sm">
          Detectamos que a tradução automática do navegador (Google Tradutor)
          está ativa nesta página, e ela conflita com o funcionamento do app.
          Desative a tradução e recarregue:
        </p>
        <div className="text-left text-zinc-400 text-sm space-y-2 bg-zinc-900 rounded-xl p-4">
          <p className="text-white font-semibold">No Chrome (Android):</p>
          <p>Toque nos 3 pontinhos (⋮) → desmarque "Traduzir página".</p>
          <p className="text-white font-semibold pt-2">No Safari (iPhone):</p>
          <p>Toque em "Aa" na barra de endereço → "Desativar Tradução".</p>
        </div>
        {onReload && (
          <button
            onClick={onReload}
            className="bg-white text-black font-semibold rounded-xl px-6 py-3 text-sm"
          >
            Já desativei, recarregar
          </button>
        )}
        {!onReload && (
          <p className="text-zinc-500 text-xs">Recarregando automaticamente…</p>
        )}
      </div>
    </div>
  );
}

export default function CadastroApp(props) {
  const [showTranslateWarning, setShowTranslateWarning] = useState(false);
  useDisableAutoTranslate();
  useGlobalTranslateErrorGuard(setShowTranslateWarning);

  if (showTranslateWarning) {
    return <TranslateWarningScreen onReload={null} />;
  }

  return (
    <AppErrorBoundary>
      <CadastroAppInner {...props} />
    </AppErrorBoundary>
  );
}
