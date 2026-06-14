import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBGV0JAs7kI4JiKVvZDphaZ2h8hOXZAmps",
  authDomain: "festajunina-brandao.firebaseapp.com",
  projectId: "festajunina-brandao",
  storageBucket: "festajunina-brandao.firebasestorage.app",
  messagingSenderId: "609151203088",
  appId: "1:609151203088:web:231ac7eaeaf666d9511795",
  measurementId: "G-0Y2T5K1L6E",
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta os serviços que vamos usar no cadastro.tsx
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
