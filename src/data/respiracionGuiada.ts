// Lógica pura de la «Respiración guiada» (Gestión del Riesgo → contención emocional).
// Todo se calcula a partir del tiempo transcurrido, para que la animación no derive.

export type TipoFase = 'inhala' | 'inhala2' | 'sostén' | 'exhala';

export interface FaseRespiracion {
  tipo: TipoFase;
  seg: number;
  desde: number; // escala del círculo al empezar la fase (0..1)
  hasta: number; // escala al terminar
}

export interface TecnicaRespiracion {
  id: string;
  nombre: string;
  patron: string;
  explicacion: string;
  fases: FaseRespiracion[];
}

export const ESCALA_MIN = 0.5;
export const ESCALA_MAX = 1;

const f = (tipo: TipoFase, seg: number, desde: number, hasta: number): FaseRespiracion => ({ tipo, seg, desde, hasta });

export const TECNICAS_RESPIRACION: TecnicaRespiracion[] = [
  {
    id: 'calma',
    nombre: 'Calma',
    patron: '4-2-6',
    explicacion: 'Aire por la nariz, una pausa suave y salida lenta. La mejor para empezar.',
    fases: [f('inhala', 4, ESCALA_MIN, ESCALA_MAX), f('sostén', 2, ESCALA_MAX, ESCALA_MAX), f('exhala', 6, ESCALA_MAX, ESCALA_MIN)],
  },
  {
    id: '4-2-8',
    nombre: '4-2-8',
    patron: '4-2-8',
    explicacion: 'Igual que Calma, pero la salida del aire es más larga: relaja más.',
    fases: [f('inhala', 4, ESCALA_MIN, ESCALA_MAX), f('sostén', 2, ESCALA_MAX, ESCALA_MAX), f('exhala', 8, ESCALA_MAX, ESCALA_MIN)],
  },
  {
    id: 'caja',
    nombre: 'Caja',
    patron: '4-4-4-4',
    explicacion: 'Cuatro tiempos iguales, como dibujar un cuadrado. Ayuda a ordenar la mente.',
    fases: [
      f('inhala', 4, ESCALA_MIN, ESCALA_MAX),
      f('sostén', 4, ESCALA_MAX, ESCALA_MAX),
      f('exhala', 4, ESCALA_MAX, ESCALA_MIN),
      f('sostén', 4, ESCALA_MIN, ESCALA_MIN),
    ],
  },
  {
    id: 'suspiro',
    nombre: 'Suspiro',
    patron: '2+1-6',
    explicacion: 'Dos tomas de aire por la nariz (una larga y una corta) y un suspiro largo por la boca.',
    fases: [f('inhala', 2, ESCALA_MIN, 0.82), f('inhala2', 1, 0.82, ESCALA_MAX), f('exhala', 6, ESCALA_MAX, ESCALA_MIN)],
  },
  {
    id: 'coherente',
    nombre: 'Coherente',
    patron: '5-5',
    explicacion: 'Cinco segundos entrando y cinco saliendo, sin pausas. Un vaivén tranquilo.',
    fases: [f('inhala', 5, ESCALA_MIN, ESCALA_MAX), f('exhala', 5, ESCALA_MAX, ESCALA_MIN)],
  },
];

export const TECNICA_DEFECTO = 'calma';

export const TEXTO_FASE: Record<TipoFase, string> = {
  inhala: 'Inhala',
  inhala2: 'Un poco más',
  sostén: 'Sostén',
  exhala: 'Exhala',
};

/** Segundos que dura un ciclo completo. */
export function duracionCiclo(t: TecnicaRespiracion): number {
  return t.fases.reduce((s, x) => s + x.seg, 0);
}

export interface EstadoRespiracion {
  ciclo: number; // ciclos completos terminados
  indiceFase: number;
  fase: FaseRespiracion;
  segRestantes: number; // entero para mostrar (4, 3, 2, 1)
  progreso: number; // 0..1 dentro de la fase
  escala: number; // 0..1 (ESCALA_MIN..ESCALA_MAX)
}

/** Fase, cuenta regresiva y escala para un instante dado (segundos desde el inicio). */
export function estadoEn(t: TecnicaRespiracion, transcurridoS: number): EstadoRespiracion {
  const total = duracionCiclo(t);
  const s = Math.max(0, transcurridoS);
  const ciclo = Math.floor(s / total);
  let resto = s - ciclo * total;
  let i = 0;
  while (i < t.fases.length - 1 && resto >= t.fases[i].seg) {
    resto -= t.fases[i].seg;
    i++;
  }
  const fase = t.fases[i];
  const progreso = Math.min(1, resto / fase.seg);
  const segRestantes = Math.max(1, Math.ceil(fase.seg - resto - 1e-9));
  // suavizado (ease in-out) para que el círculo no arranque ni frene en seco
  const suave = progreso * progreso * (3 - 2 * progreso);
  const escala = fase.desde + (fase.hasta - fase.desde) * suave;
  return { ciclo, indiceFase: i, fase, segRestantes, progreso, escala };
}

export const MENSAJE_A_LOS_S = 180;
export const buscarTecnica = (id: string): TecnicaRespiracion =>
  TECNICAS_RESPIRACION.find(x => x.id === id) ?? TECNICAS_RESPIRACION[0];
