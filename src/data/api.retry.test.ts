import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Reintentos de callApi (el lunes 2026-09-21 el módulo de Tareas dio "Error
// de red" un rato: getDatosTareas tardó 3,5-11,7s por saturación del límite
// de ejecuciones simultáneas de Apps Script — profesores + la agenda
// pública por QR). Solo las acciones de lectura ('get*'/'listar*') deben
// reintentar; una escritura nunca debe reintentarse aquí, para no arriesgar
// duplicar un registro (una reserva, una tarea, etc.) por reenviar la misma
// petición.
//
// Este archivo corre en el entorno 'node' de vitest (sin jsdom instalado),
// así que se stubea un `document`/`window` mínimos: solo lo que
// jsonpFallback necesita (createElement('script'), body.appendChild/
// removeChild, y el callback global en window).

function documentFalso() {
  const scripts: any[] = [];
  const body = {
    appendChild(node: any) {
      node.parentNode = body;
      scripts.push(node);
      // jsonpFallback agrega el <script> y el navegador real dispararía la
      // petición de inmediato; aquí se simula resolviendo/onerror según el
      // mock de fetch configurado en window.__jsonpRespuesta.
      const url = new URL(node.src);
      const cbName = url.searchParams.get('callback')!;
      const respuesta = (globalThis as any).__jsonpRespuesta;
      queueMicrotask(() => {
        if (respuesta?.error) {
          node.onerror?.();
        } else {
          (globalThis as any)[cbName]?.(respuesta);
        }
      });
      return node;
    },
    removeChild(node: any) {
      const i = scripts.indexOf(node);
      if (i >= 0) scripts.splice(i, 1);
    },
  };
  return {
    createElement: (tag: string) => ({ tagName: tag.toUpperCase(), parentNode: null }),
    body,
  };
}

async function importApiFresco() {
  vi.resetModules();
  return import('./api');
}

describe('callApi — reintento en acciones de lectura', () => {
  beforeEach(() => {
    vi.stubGlobal('document', documentFalso());
    vi.stubGlobal('window', globalThis);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as any).__jsonpRespuesta;
  });

  it(
    'reintenta una lectura que falla y devuelve el resultado si el segundo intento funciona',
    async () => {
      const fetchMock = vi.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ ok: true, reservas: [] }) });
      vi.stubGlobal('fetch', fetchMock);

      const { getReservas } = await importApiFresco();
      const resultado = await getReservas();

      expect(resultado).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
    15000,
  );

  it(
    'agota los reintentos de una lectura (3 intentos de fetch) y cae al respaldo JSONP',
    async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));
      vi.stubGlobal('fetch', fetchMock);
      (globalThis as any).__jsonpRespuesta = { ok: true, reservas: [] };

      const { getReservas } = await importApiFresco();
      const resultado = await getReservas();

      expect(resultado).toEqual([]);
      // Intento inicial + 2 reintentos (lectura) antes de caer a JSONP.
      expect(fetchMock).toHaveBeenCalledTimes(3);
    },
    15000,
  );

  it(
    'NO reintenta una escritura: un solo intento de fetch antes de caer a JSONP',
    async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));
      vi.stubGlobal('fetch', fetchMock);
      (globalThis as any).__jsonpRespuesta = { ok: true, id: 'RES-1' };

      const { crearReserva } = await importApiFresco();
      const resultado = await crearReserva({
        recurso: 'Aula 1', fecha: '2026-09-21', bloque: 1,
        solicitante: 'x', proposito: 'y', equipos: '',
      });

      expect(resultado).toEqual({ ok: true, id: 'RES-1' });
      // Una escritura no espera ni reintenta: un único intento de fetch.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
    15000,
  );
});
