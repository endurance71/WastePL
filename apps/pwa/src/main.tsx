import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import './styles/index.css';

// Register Service Worker from vite-plugin-pwa
if ('serviceWorker' in navigator && (import.meta.env.PROD || window.location.port === '4173' || window.location.search.includes('sw=1'))) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('WastePL PWA ServiceWorker zarejestrowany:', reg.scope);
      })
      .catch((err) => {
        console.warn('Błąd rejestracji ServiceWorker:', err);
      });
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
