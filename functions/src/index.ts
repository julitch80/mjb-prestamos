import { onCall } from 'firebase-functions/v2/https';

// Función de prueba del checkpoint Fase 0. Se ampliará en etapas siguientes.
export const ping = onCall({ region: 'us-central1' }, () => {
  return { ok: true, ts: Date.now() };
});
