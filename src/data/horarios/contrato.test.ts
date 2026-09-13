/**
 * Pruebas del contrato con el motor de horarios.
 *
 * Dos cosas se comprueban por encima de todo. Una: que partir el horario por
 * jornada no pierda ni duplique nada, porque el colegio entero tiene que seguir
 * cuadrando al sumar las partes. Otra: que un `salida.json` real se lea sin
 * perder un dato — si la app descartara un campo en silencio, el horario se
 * vería bien y estaría incompleto, el peor fallo posible porque no se nota.
 */

import { describe, expect, it } from 'vitest';

import { ASIGNACION_2026 } from '../asignacionAcademica';
import {
  construirEntrada, hayDatosDeSede, jornadasDeSalida, leerSalida,
  nombreArchivoEntrada, sedesParaGenerar,
} from './contrato';
import salidaReal from './fixtures/salida-motor.json';

const esDeClase = (id: string) => id !== 'ci' && !id.startsWith('mt_');
const filasDeClase = ASIGNACION_2026.filter(f => esDeClase(f.asignaturaId));

const manana = construirEntrada({ sede: 'central', jornada: 'manana', anio: 2026 });
const tarde = construirEntrada({ sede: 'central', jornada: 'tarde', anio: 2026 });

describe('construirEntrada: alcance por sede y jornada', () => {
  it('cada archivo cubre una sola jornada', () => {
    expect(manana.alcance).toEqual({
      sede: 'central', sede_nombre: 'Sede Central', jornada: 'manana',
    });
    expect(manana.grupos.every(g => g.jornada === 'manana')).toBe(true);
    expect(tarde.grupos.every(g => g.jornada === 'tarde')).toBe(true);
  });

  it('diez grupos en cada jornada', () => {
    expect(manana.grupos).toHaveLength(10);
    expect(tarde.grupos).toHaveLength(10);
  });

  it('las dos mitades suman el colegio entero, sin perder ni duplicar', () => {
    expect(manana.asignacion.length + tarde.asignacion.length).toBe(filasDeClase.length);
    const horas = (e: typeof manana) => e.asignacion.reduce((s, f) => s + f.horas, 0);
    expect(horas(manana) + horas(tarde)).toBe(filasDeClase.reduce((s, f) => s + f.horas, 0));

    const gruposManana = new Set(manana.grupos.map(g => g.id));
    const gruposTarde = new Set(tarde.grupos.map(g => g.id));
    for (const g of gruposManana) expect(gruposTarde.has(g)).toBe(false);
  });

  it('cada jornada trae solo su franja de Centro de Interés', () => {
    expect(Object.keys(manana.config.centro_interes)).toEqual(['manana']);
    expect(Object.keys(tarde.config.centro_interes)).toEqual(['tarde']);
  });

  it('se puede declarar que ese año no hay Centro de Interés', () => {
    const sinCI = construirEntrada({ sede: 'central', jornada: 'tarde', centroInteres: null });
    expect(sinCI.config.centro_interes).toEqual({});
  });

  it('en la mañana el aula es del docente; en la tarde, del grupo', () => {
    expect(manana.docentes.some(d => d.aula_fija)).toBe(true);
    expect(tarde.docentes.every(d => d.aula_fija === undefined)).toBe(true);
    expect(tarde.grupos.every(g => g.aula_fija)).toBe(true);
    expect(manana.grupos.every(g => g.aula_fija === undefined)).toBe(true);
  });

  it('a un docente mixto solo se le bloquean franjas de la jornada que se genera', () => {
    for (const [entrada, j] of [[manana, 'manana'], [tarde, 'tarde']] as const) {
      const marta = entrada.docentes.find(d => d.id === 'marta');
      expect(marta?.no_disponible.length).toBeGreaterThan(0);
      expect(marta!.no_disponible.every(f => f.jornada === j)).toBe(true);
    }
  });

  it('solo se arrastra la media técnica de docentes de esa jornada', () => {
    for (const entrada of [manana, tarde]) {
      const ids = new Set(entrada.docentes.map(d => d.id));
      for (const mt of entrada.config.contrajornada_media_tecnica) {
        expect(ids.has(mt.docente)).toBe(true);
      }
    }
  });

  it('todo lo que se referencia existe dentro del mismo archivo', () => {
    for (const entrada of [manana, tarde]) {
      const docentes = new Set(entrada.docentes.map(d => d.id));
      const grupos = new Set(entrada.grupos.map(g => g.id));
      const asignaturas = new Set(entrada.asignaturas.map(a => a.id));
      for (const f of entrada.asignacion) {
        expect(docentes.has(f.docente)).toBe(true);
        expect(grupos.has(f.grupo)).toBe(true);
        expect(asignaturas.has(f.asignatura)).toBe(true);
      }
    }
  });

  it('el Auditorio nunca se ofrece como salón de clase', () => {
    for (const entrada of [manana, tarde]) {
      const auditorio = entrada.aulas.find(a => a.id === 'Auditorio');
      if (auditorio) expect(auditorio.apta_para_clase).toBe(false);
    }
  });

  it('el Patio va marcado como espacio que no se disputa', () => {
    // Dos grupos de educación física comparten cancha. Si el motor no lo supiera,
    // se prohibiría horarios que el colegio da por buenos y el validador avisaría
    // de un choque inexistente.
    for (const entrada of [manana, tarde]) {
      const patio = entrada.aulas.find(a => a.id === 'Patio');
      if (patio) expect(patio.exclusiva).toBe(false);
      for (const a of entrada.aulas.filter(x => x.id !== 'Patio')) {
        expect(a.exclusiva).toBe(true);
      }
    }
  });

  it('el nombre del archivo distingue sede y jornada', () => {
    expect(nombreArchivoEntrada(2027, 'central', 'manana'))
      .toBe('entrada_horario_2027_central_manana.json');
    expect(nombreArchivoEntrada(2027, 'central', 'tarde'))
      .not.toBe(nombreArchivoEntrada(2027, 'central', 'manana'));
  });
});

describe('sedes', () => {
  it('solo la Central tiene datos hoy', () => {
    const sedes = sedesParaGenerar();
    expect(sedes.find(s => s.id === 'central')?.tieneDatos).toBe(true);
    for (const s of sedes.filter(x => x.id !== 'central')) expect(s.tieneDatos).toBe(false);
  });

  it('una sede sin datos no inventa un horario: sale vacía', () => {
    expect(hayDatosDeSede('gustavo_rodas')).toBe(false);
    const vacia = construirEntrada({ sede: 'gustavo_rodas', jornada: 'manana' });
    expect(vacia.asignacion).toEqual([]);
    expect(vacia.grupos).toEqual([]);
    expect(vacia.alcance.sede_nombre).toBe('Gustavo Rodas Isaza');
  });
});

describe('leerSalida', () => {
  const texto = JSON.stringify(salidaReal);

  it('lee un archivo real del motor sin perder nada', () => {
    const r = leerSalida(texto);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor).toEqual(salidaReal);
  });

  it('conserva la materia de cada clase, que el formato viejo no guardaba', () => {
    const r = leerSalida(texto);
    if (!r.ok) throw new Error('debería haberse leído');
    expect(r.valor.horario.every(c => typeof c.asignatura === 'string')).toBe(true);
  });

  it('dice qué jornadas cubre el horario cargado', () => {
    const r = leerSalida(texto);
    if (!r.ok) throw new Error('debería haberse leído');
    expect(jornadasDeSalida(r.valor).length).toBeGreaterThan(0);
  });

  it('conserva el informe de calidad completo', () => {
    const r = leerSalida(texto);
    if (!r.ok) throw new Error('debería haberse leído');
    expect(Object.keys(r.valor.calidad).sort()).toEqual([
      'dias_por_docente_mixto',
      'docentes_con_varios_dias_llenos',
      'huecos_por_docente_mixto',
      'pct_exigentes_en_primeras_horas',
      'pct_horas_en_bloques_dobles',
    ]);
  });

  it('rechaza un archivo que no es JSON', () => {
    const r = leerSalida('esto no es json');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores[0]).toContain('no es un JSON válido');
  });

  it('dice qué campo falta', () => {
    const roto = { ...salidaReal } as Record<string, unknown>;
    delete roto.calidad;
    const r = leerSalida(JSON.stringify(roto));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores).toContain('Falta el campo "calidad".');
  });

  it('reconoce el archivo de entrada cargado por equivocación', () => {
    // Los dos archivos son JSON y acaban juntos en la carpeta de descargas, así
    // que confundirlos es lo normal, no un descuido raro.
    const r = leerSalida(JSON.stringify(manana));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0]).toContain('archivo de datos del paso 1');
  });

  it('señala la clase concreta que viene mal', () => {
    const roto = JSON.parse(JSON.stringify(salidaReal));
    roto.horario[2].dia = 'sabado';
    delete roto.horario[5].aula;
    const r = leerSalida(JSON.stringify(roto));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores).toContain('horario[2]: "sabado" no es un día lectivo.');
    expect(r.errores).toContain('horario[5]: falta "aula".');
  });
});
