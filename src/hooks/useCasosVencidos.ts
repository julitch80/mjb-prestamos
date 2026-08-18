import { useEffect, useState } from 'react';
import {
  listarInformesContencion,
  listarRemisionesSeguro,
  listarSeguimientos,
} from '../data/api';
import { nivelAlerta, type CasoResumen } from '../components/SeguimientoCaso';

// Cuántos casos llevan 8 días o más sin seguimiento (docs/plan-gestor-casos.md
// sección 4). Lo consultan a la vez el badge del menú (App) y el aviso del
// panel de inicio, que se montan juntos: sin caché serían seis llamadas a
// Apps Script en cada arranque en vez de tres, y Apps Script no es rápido.
// La promesa se guarda a nivel de módulo para que el segundo consumidor se
// cuelgue de la misma petición en vuelo en lugar de disparar otra.
let peticionEnVuelo: Promise<number> | null = null;

async function contarCasosVencidos(): Promise<number> {
  const [informes, remisiones, seguimientos] = await Promise.all([
    listarInformesContencion(),
    listarRemisionesSeguro(),
    listarSeguimientos(),
  ]);

  const ultimoPorCaso = new Map<string, string>();
  for (const s of seguimientos) {
    const actual = ultimoPorCaso.get(s.casoId);
    if (!actual || s.fecha > actual) ultimoPorCaso.set(s.casoId, s.fecha);
  }

  const casos: CasoResumen[] = [
    ...informes.map((i): CasoResumen => ({
      id: i.id, tipo: 'contencion', estudianteNombre: i.estudianteNombre, grado: i.grado,
      fecha: i.fecha, estado: i.estado ?? 'abierto', proximaRevision: i.proximaRevision,
      ultimoSeguimiento: ultimoPorCaso.get(i.id),
    })),
    ...remisiones.map((r): CasoResumen => ({
      id: r.id, tipo: 'seguro', estudianteNombre: r.estudianteNombre, grado: r.grado,
      fecha: r.fecha, estado: r.estado ?? 'abierto', proximaRevision: r.proximaRevision,
      ultimoSeguimiento: ultimoPorCaso.get(r.id),
    })),
  ];

  return casos.filter(c => nivelAlerta(c) !== 'ninguna').length;
}

/** Devuelve 0 mientras carga y también si la consulta falla: el backend filtra
 *  por rol quién ve qué, y un error de red no debe tumbar el menú ni el inicio. */
export function useCasosVencidos(userId: string | null): number {
  const [vencidos, setVencidos] = useState(0);

  useEffect(() => {
    if (!userId) { setVencidos(0); return; }
    let vivo = true;
    if (!peticionEnVuelo) {
      peticionEnVuelo = contarCasosVencidos().catch(() => 0);
    }
    peticionEnVuelo.then(n => { if (vivo) setVencidos(n); });
    return () => { vivo = false; };
  }, [userId]);

  return vencidos;
}

/** Obliga a recontar en la próxima consulta — se llama tras guardar un
 *  seguimiento, para que el contador no quede mostrando el número viejo. */
export function invalidarCasosVencidos() {
  peticionEnVuelo = null;
}
