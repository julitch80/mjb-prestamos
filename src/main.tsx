import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './data/installPrompt'
import * as Sentry from '@sentry/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { initAutoUpdate } from './autoUpdate'
import { initAuthGoogle } from './data/authStore'

initAutoUpdate()
initAuthGoogle() // no-op en modo 'pin' (default) o sin Firebase configurado

// Sentry — solo activo si hay DSN configurado (en producción)
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,        // datos frescos por 30s
      refetchInterval: 1000 * 30,  // revalida cada 30s en background
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
