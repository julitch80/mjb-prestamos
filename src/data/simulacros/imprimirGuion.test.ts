import { describe, it, expect } from 'vitest';
import { construirHtmlGuion, esc } from './imprimirGuion';
import * as P from './plantillaSismo2026';
import type { SimulacroDoc } from './logica';

const plantilla = {
  ROLES: P.ROLES, MISION: P.MISION, PASOS: P.PASOS, ANTES_BASE: P.ANTES_BASE,
  ANTES_EX: P.ANTES_EX, RUTAS: P.RUTAS, PUESTOS: P.PUESTOS,
};
const sim: SimulacroDoc = {
  titulo: 'Simulacro <b>2026</b>', sede: 'Sede Principal', evento: 'Evento X', plantilla: 'sismo2026',
  estado: 'publicado', nacional: { fecha: '2026-10-21', hora: '10:00' }, editores: {},
  jornadas: { manana: { fecha: '2026-10-21', hora: '11:30', motivo: 'Lluvia' }, tarde: { fecha: '2026-10-21', hora: '16:00' } },
  asignaciones: {},
  avisos: { a: { texto: 'Traer <script>', jornada: 'manana', tipo: 'importante' } },
};
const ahora = new Date('2026-10-13T15:00:00Z');

describe('construirHtmlGuion', () => {
  it('incluye rol, hora reprogramada y pie', () => {
    const h = construirHtmlGuion(plantilla, sim, 'manana', 'docente', { preparacion: true, rutas: true, encargados: false }, ahora);
    expect(h).toContain('Guion del simulacro — Docente de aula');
    expect(h).toContain('11:31 a. m.');
    expect(h).toContain('Impreso el');
    expect(h).toContain('Ante cualquier cambio');
  });
  it('escapa texto', () => {
    const h = construirHtmlGuion(plantilla, sim, 'manana', 'docente', { preparacion: true, rutas: true, encargados: false }, ahora);
    expect(h).not.toContain('<script>');
    expect(h).toContain('Simulacro &lt;b&gt;2026&lt;/b&gt;');
    expect(esc('a<b')).toBe('a&lt;b');
  });
  it('activa y desactiva secciones', () => {
    const on = construirHtmlGuion(plantilla, sim, 'tarde', 'coord', { preparacion: true, rutas: true, encargados: true }, ahora);
    const off = construirHtmlGuion(plantilla, sim, 'tarde', 'coord', { preparacion: false, rutas: false, encargados: false }, ahora);
    expect(on).toContain('Lista de preparación');
    expect(on).toContain('Rutas de evacuación');
    expect(on).toContain('Por asignar');
    expect(off).not.toContain('Lista de preparación');
    expect(off).not.toContain('Rutas de evacuación');
    expect(off).not.toContain('<h2>Encargados');
  });
});
