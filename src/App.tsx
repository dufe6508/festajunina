import { useState, useEffect } from 'react';
import CadastroApp from './cadastro';
import './styles.css';

export default function App() {
  const [currentPage, setCurrentPage] = useState<'landing' | 'cadastro'>('landing');

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data === 'open-cadastro') {
        setCurrentPage('cadastro');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  if (currentPage === 'cadastro') {
    return <CadastroApp onBack={() => setCurrentPage('landing')} />;
  }

  return (
    <iframe
      src="/lp.html"
      style={{ width: '100%', height: '100vh', border: 'none' }}
      title="Festa Junina"
    />
  );
}