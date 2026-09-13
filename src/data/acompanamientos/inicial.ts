/**
 * La distribución inicial: la lista fija que estaba escrita en `maestros.ts`,
 * convertida al modelo de publicaciones.
 *
 * NO SE MIGRA NADA A LA BASE DE DATOS. Mientras una jornada no tenga ninguna
 * publicación, rige esta. Así el día que se activa el editor nadie ve un cambio, y
 * si la colección llegara a vaciarse, la aplicación vuelve a lo de siempre en vez de
 * quedarse sin acompañamientos.
 */

import { ACOMPAÑAMIENTOS, ZONAS_ACOMPANAMIENTO, ZONAS_ACOMPANAMIENTO_TARDE } from '../maestros';
import type { Asignacion, Dia, JornadaAcomp, Publicacion, Zona } from './tipos';

/** 'Segundo Piso (corredor y accesos)' -> 'segundo-piso-corredor-y-accesos' */
export function idDeZona(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Asignaciones que arrancan con candado. Decisión de Julián (2026-09-13): Doris y
 * Margarita mantienen el restaurante; lo demás se puede mover.
 */
const CANDADOS_INICIALES: Array<{ docenteId: string; dia: Dia; zona: string; jornada: JornadaAcomp }> = [
  { docenteId: 'doris', dia: 'lunes', zona: 'Restaurante', jornada: 'manana' },
  { docenteId: 'doris', dia: 'viernes', zona: 'Restaurante', jornada: 'manana' },
  { docenteId: 'margara', dia: 'miercoles', zona: 'Restaurante', jornada: 'manana' },
  { docenteId: 'margara', dia: 'jueves', zona: 'Restaurante', jornada: 'manana' },
];

export function distribucionInicial(jornada: JornadaAcomp): Publicacion {
  const nombres = jornada === 'tarde' ? ZONAS_ACOMPANAMIENTO_TARDE : ZONAS_ACOMPANAMIENTO;
  const zonas: Zona[] = nombres.map((nombre) => ({ id: idDeZona(nombre), nombre, cupo: 1 }));

  const asignaciones: Asignacion[] = ACOMPAÑAMIENTOS
    .filter((a) => a.jornada === jornada)
    .map((a) => ({
      zonaId: idDeZona(a.lugar),
      dia: a.dia as Dia,
      docenteId: a.docente,
      candado: CANDADOS_INICIALES.some(
        (c) => c.jornada === jornada && c.docenteId === a.docente && c.dia === a.dia && c.zona === a.lugar,
      ),
    }));

  return {
    id: 'inicial',
    jornada,
    zonas,
    asignaciones,
    // Anterior a cualquier fecha real: toda publicación la reemplaza desde su vigencia.
    vigenteDesde: '2000-01-01',
    publicadoPor: '',
    publicadoPorNombre: 'Distribución inicial',
    publicadoEn: null,
    esInicial: true,
  };
}
