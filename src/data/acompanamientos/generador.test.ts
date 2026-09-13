import { describe, it, expect } from 'vitest';
import { generarAlternativas } from './generador';
import { revisar } from './revision';
import { distribucionInicial } from './inicial';
import { clasesEnDia, DIA_CARGADO } from './clases';
import type { Distribucion } from './tipos';

const CANDADOS_INICIALES = [
  { docenteId: 'doris', dia: 'lunes' as const, zona: 'restaurante' },
  { docenteId: 'doris', dia: 'viernes' as const, zona: 'restaurante' },
  { docenteId: 'margara', dia: 'miercoles' as const, zona: 'restaurante' },
  { docenteId: 'margara', dia: 'jueves' as const, zona: 'restaurante' },
];

function tieneCandado(dist: Distribucion, docenteId: string, dia: string, zonaId: string): boolean {
  return dist.asignaciones.some(
    (a) => a.docenteId === docenteId && a.dia === dia && a.zonaId === zonaId && a.candado,
  );
}

describe('generarAlternativas — 200 semillas sobre la distribución inicial real', () => {
  const jornadas: Distribucion['jornada'][] = ['manana', 'tarde'];

  for (const jornada of jornadas) {
    it(`${jornada}: ninguna alternativa rompe una regla (salvo casilla_incompleta listada en faltantes)`, () => {
      const base = distribucionInicial(jornada);
      for (let semilla = 0; semilla < 200; semilla++) {
        const alts = generarAlternativas(base, { semilla, cantidad: 2 });
        for (const alt of alts) {
          const { bloqueos } = revisar(alt.distribucion);
          const bloqueosNoCasillaIncompleta = bloqueos.filter((b) => b.tipo !== 'casilla_incompleta');
          expect(bloqueosNoCasillaIncompleta, `semilla ${semilla}: ${JSON.stringify(bloqueosNoCasillaIncompleta)}`).toEqual([]);
        }
      }
    });

    it(`${jornada}: nadie queda en dos zonas el mismo día, en 200 semillas`, () => {
      const base = distribucionInicial(jornada);
      for (let semilla = 0; semilla < 200; semilla++) {
        const alts = generarAlternativas(base, { semilla, cantidad: 2 });
        for (const alt of alts) {
          const porDocenteDia = new Map<string, Set<string>>();
          for (const a of alt.distribucion.asignaciones) {
            if (!porDocenteDia.has(a.docenteId)) porDocenteDia.set(a.docenteId, new Set());
            porDocenteDia.get(a.docenteId)!.add(a.dia);
          }
          // Cuenta cuántas zonas distintas cubre cada docente cada día.
          const zonasPorDocenteDia = new Map<string, Set<string>>();
          for (const a of alt.distribucion.asignaciones) {
            const clave = `${a.docenteId}|${a.dia}`;
            if (!zonasPorDocenteDia.has(clave)) zonasPorDocenteDia.set(clave, new Set());
            zonasPorDocenteDia.get(clave)!.add(a.zonaId);
          }
          for (const [, zonas] of zonasPorDocenteDia) {
            expect(zonas.size).toBeLessThanOrEqual(1);
          }
        }
      }
    });

    if (jornada === 'manana') {
      it('Edgar nunca aparece en la mañana, en 200 semillas', () => {
        const base = distribucionInicial('manana');
        for (let semilla = 0; semilla < 200; semilla++) {
          const alts = generarAlternativas(base, { semilla, cantidad: 2 });
          for (const alt of alts) {
            expect(alt.distribucion.asignaciones.some((a) => a.docenteId === 'edgar')).toBe(false);
          }
        }
      });
    }

    it(`${jornada}: los candados de Doris y Margarita nunca se mueven, en 200 semillas`, () => {
      const base = distribucionInicial(jornada);
      if (jornada !== 'manana') return; // los candados iniciales son de la mañana (restaurante)
      for (let semilla = 0; semilla < 200; semilla++) {
        const alts = generarAlternativas(base, { semilla, cantidad: 2 });
        for (const alt of alts) {
          for (const c of CANDADOS_INICIALES) {
            expect(tieneCandado(alt.distribucion, c.docenteId, c.dia, c.zona)).toBe(true);
          }
        }
      }
    });

    it(`${jornada}: con la distribución inicial real no hay faltantes`, () => {
      const base = distribucionInicial(jornada);
      for (let semilla = 0; semilla < 20; semilla++) {
        const alts = generarAlternativas(base, { semilla, cantidad: 2 });
        for (const alt of alts) {
          expect(alt.metricas.faltantes).toEqual([]);
        }
      }
    });
  }
});

describe('generarAlternativas — profesor con día de 5-6 clases', () => {
  it('Mónica C. (mañana, viernes: 6 clases) no queda asignada el viernes en ninguna alternativa, salvo que se cuente en diasCargados', () => {
    expect(clasesEnDia('monica_c', 'manana', 'viernes')).toBeGreaterThanOrEqual(DIA_CARGADO);
    const base = distribucionInicial('manana');
    for (let semilla = 0; semilla < 50; semilla++) {
      const alts = generarAlternativas(base, { semilla, cantidad: 2 });
      for (const alt of alts) {
        const asignadaViernes = alt.distribucion.asignaciones.some(
          (a) => a.docenteId === 'monica_c' && a.dia === 'viernes',
        );
        if (asignadaViernes) {
          expect(alt.metricas.diasCargados).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('generarAlternativas — 6.2 métricas sobre una distribución pequeña armada a mano', () => {
  /**
   * Base: 1 sola zona (cupo 1), 5 casillas (una por día), con Doris fija por
   * candado el lunes. Se generó con semilla 99 y se comprobó que es estable
   * (misma semilla, mismo resultado — ver la prueba de abajo). Rastreado el
   * resultado real:
   *   lunes=doris(candado), martes=claudia, miercoles=adolfo, jueves=gloria_a,
   *   viernes=beatriz.
   * - diferenciaCarga: de los 15 docentes de la jornada mañana, 5 quedan con
   *   1 acompañamiento (peso 1, ninguno es mixto) y los otros 10 con 0 →
   *   max=1, min=0 → diferenciaCarga = 1.
   * - profesoresQueCambian: la base solo tenía a Doris asignada (lunes). La
   *   nueva agrega a claudia, adolfo, gloria_a y beatriz (Doris no cambia,
   *   sigue solo en z1|lunes) → 4 profesores cambian.
   * - diasCargados: ninguno de los cinco días usados es un día de 5-6 clases
   *   para el profesor que lo cubre → 0.
   */
  it('reproduce las métricas calculadas a mano', () => {
    const base: Distribucion = {
      jornada: 'manana',
      zonas: [{ id: 'z1', nombre: 'Zona 1', cupo: 1 }],
      asignaciones: [{ zonaId: 'z1', dia: 'lunes', docenteId: 'doris', candado: true }],
    };
    const alts = generarAlternativas(base, { semilla: 99, cantidad: 1 });
    expect(alts).toHaveLength(1);
    const { metricas } = alts[0];
    expect(metricas.diferenciaCarga).toBe(1);
    expect(metricas.profesoresQueCambian).toBe(4);
    expect(metricas.diasCargados).toBe(0);
    expect(metricas.faltantes).toEqual([]);
  });
});

describe('generarAlternativas — 6.3 zona imposible de cubrir', () => {
  it('una zona con cupo 6 (más profesores de los disponibles un día) produce faltantes y solo el bloqueo casilla_incompleta', () => {
    const base: Distribucion = {
      jornada: 'manana',
      // 20 > los 15 docentes de mañana: imposible de llenar cualquier día.
      zonas: [{ id: 'zx', nombre: 'Zona Imposible', cupo: 20 }],
      asignaciones: [],
    };
    const alts = generarAlternativas(base, { semilla: 7, cantidad: 1 });
    const alt = alts[0];
    expect(alt.metricas.faltantes.length).toBeGreaterThan(0);
    for (const f of alt.metricas.faltantes) {
      expect(f.motivo.length).toBeGreaterThan(0);
    }
    const { bloqueos } = revisar(alt.distribucion);
    const tipos = new Set(bloqueos.map((b) => b.tipo));
    expect([...tipos]).toEqual(['casilla_incompleta']);
  });
});

describe('generarAlternativas — cantidad, reproducibilidad y desempeño', () => {
  it('devuelve entre 2 y 3 alternativas distintas entre sí', () => {
    const base = distribucionInicial('manana');
    const alts = generarAlternativas(base, { semilla: 5, cantidad: 3 });
    expect(alts.length).toBeGreaterThanOrEqual(2);
    expect(alts.length).toBeLessThanOrEqual(3);
    for (let i = 0; i < alts.length; i++) {
      for (let j = i + 1; j < alts.length; j++) {
        const setA = new Set(alts[i].distribucion.asignaciones.map((a) => `${a.zonaId}|${a.dia}|${a.docenteId}`));
        const setB = new Set(alts[j].distribucion.asignaciones.map((a) => `${a.zonaId}|${a.dia}|${a.docenteId}`));
        let dif = 0;
        for (const k of setA) if (!setB.has(k)) dif += 1;
        for (const k of setB) if (!setA.has(k)) dif += 1;
        expect(dif).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('la misma semilla da el mismo resultado', () => {
    const base = distribucionInicial('tarde');
    const a = generarAlternativas(base, { semilla: 123, cantidad: 2 });
    const b = generarAlternativas(base, { semilla: 123, cantidad: 2 });
    expect(JSON.stringify(a.map((x) => x.distribucion.asignaciones))).toBe(
      JSON.stringify(b.map((x) => x.distribucion.asignaciones)),
    );
  });

  it('corre en menos de 2 segundos por jornada', () => {
    for (const jornada of ['manana', 'tarde'] as const) {
      const base = distribucionInicial(jornada);
      const t0 = performance.now();
      generarAlternativas(base, { semilla: 1, cantidad: 3 });
      const t1 = performance.now();
      expect(t1 - t0).toBeLessThan(2000);
    }
  });
});
