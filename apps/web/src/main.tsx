import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App.js';
import { useServerStatusStore } from './shared/store/serverStatusStore.js';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('No se encontró el elemento #root.');

useServerStatusStore.getState().start();

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
