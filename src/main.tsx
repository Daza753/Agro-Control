import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
      const appRegistrations = registrations.filter((registration) => (
        [registration.active, registration.waiting, registration.installing]
          .some((worker) => worker?.scriptURL === new URL('./sw.js', window.location.href).href)
      ));
      if (!appRegistrations.length) return;

      const wasControlling = Boolean(navigator.serviceWorker.controller);
      await Promise.all(appRegistrations.map((registration) => registration.unregister()));
      await caches.delete('finca-control-shell-v2');
      if (wasControlling) window.location.reload();
    }).catch((error: unknown) => {
      console.warn('No se pudo desactivar la caché offline durante el desarrollo.', error);
    });
  });
} else if ('serviceWorker' in navigator && ['http:', 'https:'].includes(window.location.protocol)) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch((error: unknown) => {
      console.warn('No se pudo habilitar el modo offline de la aplicación.', error);
    });
  });
}
