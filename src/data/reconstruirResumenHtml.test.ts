import { describe, it, expect } from 'vitest';
import { generarResumenDifusion, reconstruirResumenHtml } from './horarioModificado';
import type { FichaEditor, HorarioModificado } from './horarioModificado';

// Reproduce un borrador con dos grupos afectados (G1 y G2), para verificar
// que reconstruirResumenHtml permite excluir un grupo del HTML final sin
// volver a tocar fichas/horarioBase — la base de la casilla "Grupos
// incluidos" del modal de revisión de publicación.
function ficha(docente: string, grupo: string, bloqueOrigen: number, bloqueNuevo: number): FichaEditor {
  return {
    id: `${docente}_${grupo}_${bloqueOrigen}`,
    origen: { dia: 'jueves', bloque: bloqueOrigen, docente, grupo, aula: 'Aula X' },
    ubicacion: { tipo: 'colocada', bloque: bloqueNuevo },
  };
}

const usuarios = [
  { id: 'D', nombre: 'Docente D', nombreCorto: 'D', correo: 'd@mjb.edu.co' },
  { id: 'E', nombre: 'Docente E', nombreCorto: 'E', correo: 'e@mjb.edu.co' },
];

function borradorConDosGrupos(): HorarioModificado {
  return {
    id: 'test', fecha: '2026-08-13', jornada: 'manana', autor: 'test',
    ausencias: [{ docenteId: 'D', bloques: [1] }],
    apoyos: [], modificaciones: [], estado: 'borrador', timestamp: new Date().toISOString(),
  };
}

describe('generarResumenDifusion — fragmentos por grupo', () => {
  it('captura cabecera, un fragmento HTML por grupo y un pie, que al unirse reproducen el html completo', () => {
    const fichas: FichaEditor[] = [
      ficha('E', 'G1', 1, 2), // clase movida en G1
      ficha('E', 'G2', 2, 1), // clase movida en G2
    ];
    const resumen = generarResumenDifusion(borradorConDosGrupos(), fichas, usuarios);

    expect(Object.keys(resumen.gruposHtml).sort()).toEqual(['G1', 'G2']);
    // La concatenación reproduce el mismo contenido que el html completo
    // (solo puede diferir en saltos de línea entre fragmentos, que son
    // cosméticos — reconstruirResumenHtml concatena sin separador).
    const soloTexto = (s: string) => s.replace(/\s+/g, '');
    expect(soloTexto(resumen.cabeceraHtml + resumen.gruposHtml['G1'] + resumen.gruposHtml['G2'] + resumen.pieHtml))
      .toBe(soloTexto(resumen.html));
  });

  it('reconstruirResumenHtml con un subconjunto de grupos excluye el grupo no incluido y conserva el resto', () => {
    const fichas: FichaEditor[] = [
      ficha('E', 'G1', 1, 2),
      ficha('E', 'G2', 2, 1),
    ];
    const resumen = generarResumenDifusion(borradorConDosGrupos(), fichas, usuarios);

    const soloG1 = reconstruirResumenHtml(
      resumen.cabeceraHtml,
      resumen.gruposHtml,
      ['G1'],
      resumen.pieHtml,
    );

    // El encabezado de sección por grupo (<h3>G1</h3> / <h3>G2</h3>) es lo
    // que identifica de forma inequívoca el bloque de ese grupo — el chip de
    // "Grupos afectados" en la cabecera lista ambos grupos siempre, así que
    // no sirve para distinguir inclusión/exclusión.
    expect(soloG1).toContain('padding-bottom:4px">G1</h3>');
    expect(soloG1).not.toContain('padding-bottom:4px">G2</h3>');

    const ambos = reconstruirResumenHtml(
      resumen.cabeceraHtml,
      resumen.gruposHtml,
      ['G1', 'G2'],
      resumen.pieHtml,
    );
    expect(ambos).toContain('padding-bottom:4px">G1</h3>');
    expect(ambos).toContain('padding-bottom:4px">G2</h3>');
    const soloTexto = (s: string) => s.replace(/\s+/g, '');
    expect(soloTexto(ambos)).toBe(soloTexto(resumen.html));
  });
});
