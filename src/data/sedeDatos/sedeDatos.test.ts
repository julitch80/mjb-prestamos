import { describe, expect, it } from 'vitest';
import { temasDeSede, sedesDeUsuario } from './temas';
import { calcularAvance, estaCompleto, preguntasSinResponder, respuestaVacia, entradaVacia } from './avance';
import { armarFilasExcel, estadoExcel, COLUMNAS_TEMA } from './excelFilas';
import { elegirMimeType, extensionDeMime, formatearDuracion } from './audio';
import { siguienteEtiqueta, validarArchivo, formatearRef, nombreCorto } from './archivos';
import type { RespuestaTema, SedeDatosDoc } from './tipos';

describe('temasDeSede', () => {
  it('Gustavo Rodas tiene 9 temas y La Finquita 8', () => {
    expect(temasDeSede('gustavo_rodas')).toHaveLength(9);
    expect(temasDeSede('la_finquita')).toHaveLength(8);
  });
  it('los docentes prellenados salen de USUARIOS (gri_* / fin_*)', () => {
    const gr = temasDeSede('gustavo_rodas').find(t => t.id === 'docentes')!;
    expect(gr.prellenado.map(f => f.etiqueta)).toContain('Edwin Alexis Toro Dávila');
    expect(gr.prellenado.length).toBe(12);
    const fin = temasDeSede('la_finquita').find(t => t.id === 'docentes')!;
    expect(fin.prellenado.map(f => f.etiqueta)).toContain('Soraya Bodther');
    expect(fin.prellenado.length).toBe(6);
    expect(fin.preguntas.map(p => p.id)).toContain('apellido_soraya');
  });
  it('los directores cubren todos los grupos de ambas jornadas', () => {
    expect(temasDeSede('gustavo_rodas').find(t => t.id === 'directores')!.prellenado).toHaveLength(12);
    expect(temasDeSede('la_finquita').find(t => t.id === 'directores')!.prellenado).toHaveLength(6);
  });
  it('asistencia lleva las 7 preguntas y cada sede la tiene', () => {
    for (const s of ['gustavo_rodas', 'la_finquita'] as const) {
      expect(temasDeSede(s).find(t => t.id === 'asistencia')!.preguntas).toHaveLength(7);
    }
  });
  it('cada hoja de Excel de un tema es válida y los ids no se repiten', () => {
    for (const s of ['gustavo_rodas', 'la_finquita'] as const) {
      const ids = temasDeSede(s).map(t => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('sedesDeUsuario', () => {
  it('cada coordinador responde su sede; el superusuario ambas; el docente ninguna', () => {
    expect(sedesDeUsuario('coord_manana', 'coordinador')).toEqual(['gustavo_rodas']);
    expect(sedesDeUsuario('coord_tarde', 'coordinador')).toEqual(['la_finquita']);
    expect(sedesDeUsuario('julian', 'superusuario')).toHaveLength(2);
    expect(sedesDeUsuario('x', 'docente')).toEqual([]);
  });
});

describe('avance', () => {
  const temas = temasDeSede('la_finquita');
  const tema = (id: string) => temas.find(t => t.id === id)!;
  it('«bien» solo completa si las preguntas del tema están contestadas', () => {
    const r: RespuestaTema = { ...respuestaVacia(), estado: 'bien' };
    expect(estaCompleto(tema('directores'), r)).toBe(true);
    expect(estaCompleto(tema('docentes'), r)).toBe(false);
    r.preguntas.apellido_soraya = { valor: 'Sí, así', detalle: '', entrada: entradaVacia() };
    expect(preguntasSinResponder(tema('docentes'), r)).toEqual([]);
    expect(estaCompleto(tema('docentes'), r)).toBe(true);
  });
  it('corregir/respondido sin contenido no cuenta; con texto sí', () => {
    const r: RespuestaTema = { ...respuestaVacia(), estado: 'respondido' };
    expect(estaCompleto(tema('acompanamientos'), r)).toBe(false);
    r.entrada.texto = 'Patio: Marta, lunes';
    expect(estaCompleto(tema('acompanamientos'), r)).toBe(true);
  });
  it('una nota de voz o una referencia a archivo basta', () => {
    const r: RespuestaTema = { ...respuestaVacia(), estado: 'respondido' };
    r.entrada.refs = [{ etiqueta: 'A1', donde: 'p.2' }];
    expect(estaCompleto(tema('horario'), r)).toBe(true);
  });
  it('después deja el tema abierto y se cuenta aparte', () => {
    const av = calcularAvance(temas, { directores: { ...respuestaVacia(), estado: 'bien' }, horas: { ...respuestaVacia(), estado: 'despues' } });
    expect(av.total).toBe(8);
    expect(av.hechos).toBe(1);
    expect(av.despues).toBe(1);
    expect(av.abiertos).toContain('horas');
  });
});

describe('armarFilasExcel', () => {
  const doc: SedeDatosDoc = {
    sede: 'la_finquita',
    archivos: [{ id: 'f_1', etiqueta: 'A1', nombre: 'Horario', nombreOriginal: 'h.pdf', ruta: 'sedeDatos/la_finquita/f_1',
      tipo: 'application/pdf', tamano: 2048, subidoPor: 'a@x', fecha: '2026-10-01' }],
    respuestas: {
      directores: { ...respuestaVacia(), estado: 'bien' },
      horario: { ...respuestaVacia(), estado: 'respondido',
        entrada: { texto: 'ver archivo', refs: [{ etiqueta: 'A1', donde: 'p.2' }],
          audios: [{ ruta: 'sedeDatos/la_finquita/v_1', nombre: 'n', tipo: 'audio/webm', tamano: 10, duracionSeg: 5 }] } },
      asistencia: { ...respuestaVacia(), estado: 'respondido',
        preguntas: { lista: { valor: 'Mixto', detalle: '3°3', entrada: entradaVacia() } } },
    },
  };
  const hojas = armarFilasExcel('la_finquita', doc, { 'sedeDatos/la_finquita/v_1': 'https://x/audio' });
  it('crea las 7 hojas de tema y «Archivos»', () => {
    expect(Object.keys(hojas)).toEqual([
      'Docentes', 'Directores', 'Horario', 'Horas y descansos', 'Acompañamientos', 'Asistencia', 'Estudiantes', 'Archivos',
    ]);
    expect(hojas.Docentes[0]).toEqual(COLUMNAS_TEMA);
  });
  it('confirmado trae los datos prellenados; no confirmado no', () => {
    const fila = hojas.Directores[1];
    expect(fila[0]).toBe('la_finquita');
    expect(fila[2]).toBe('bien');
    expect(fila[6]).toContain('3°3');
    expect(hojas.Docentes[1][2]).toBe('pendiente');
    expect(hojas.Docentes[1][6]).toBe('');
  });
  it('archivo referenciado como «A1 p.2» y audio como enlace', () => {
    const fila = hojas.Horario.find(f => f[1] === 'Horario de las dos jornadas')!;
    expect(fila[4]).toBe('A1 p.2');
    expect(fila[5]).toBe('https://x/audio');
  });
  it('una fila por pregunta contestada de asistencia', () => {
    expect(hojas.Asistencia).toHaveLength(3);
    expect(hojas.Asistencia[2][3]).toBe('Mixto · 3°3');
  });
  it('hoja Archivos con etiqueta, nombre y enlace', () => {
    expect(hojas.Archivos[1].slice(0, 3)).toEqual(['A1', 'Horario', 'sedeDatos/la_finquita/f_1']);
  });
  it('sin documento no revienta', () => {
    expect(armarFilasExcel('gustavo_rodas', null).Archivos).toHaveLength(1);
    expect(estadoExcel(undefined)).toBe('pendiente');
    expect(estadoExcel({ ...respuestaVacia(), estado: 'despues' })).toBe('después');
  });
});

describe('audio', () => {
  it('elige webm en Chrome y mp4 en Safari', () => {
    expect(elegirMimeType(t => t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(elegirMimeType(t => t === 'audio/mp4')).toBe('audio/mp4');
    expect(elegirMimeType(() => false)).toBeNull();
    expect(elegirMimeType(() => { throw new Error('x'); })).toBeNull();
  });
  it('extensión y duración', () => {
    expect(extensionDeMime('audio/webm;codecs=opus')).toBe('webm');
    expect(extensionDeMime('audio/mp4')).toBe('m4a');
    expect(formatearDuracion(125)).toBe('2:05');
  });
});

describe('archivos', () => {
  it('etiquetas A1, A2… sin reutilizar', () => {
    expect(siguienteEtiqueta([])).toBe('A1');
    expect(siguienteEtiqueta([{ etiqueta: 'A1' }, { etiqueta: 'A3' }])).toBe('A4');
  });
  it('valida tipo y tamaño (≤20 MB) y deduce tipo por extensión', () => {
    expect(validarArchivo('a.pdf', 'application/pdf', 100)).toBeNull();
    expect(validarArchivo('a.xlsx', '', 100)).toBeNull();
    expect(validarArchivo('a.exe', 'application/x-msdownload', 100)).not.toBeNull();
    expect(validarArchivo('a.jpg', 'image/jpeg', 21 * 1024 * 1024)).not.toBeNull();
    expect(validarArchivo('v.m4a', 'audio/mp4', 5)).toBeNull();
  });
  it('nombre corto y referencia', () => {
    expect(nombreCorto('Horario_manana-2026.pdf')).toBe('Horario manana 2026');
    expect(formatearRef({ etiqueta: 'A2', donde: '' })).toBe('A2');
    expect(formatearRef({ etiqueta: 'A2', donde: 'hoja 3' })).toBe('A2 hoja 3');
  });
});
