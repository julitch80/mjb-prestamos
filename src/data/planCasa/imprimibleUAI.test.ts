import { describe, expect, it } from 'vitest';
import { construirHtmlUAI } from './imprimibleUAI';
import type { AsignaturaPlan, Guia, GuiaPlan } from './tipos';

const guia: Guia = {
  productoFinal: 'Cartel sobre el agua',
  evidenciasAprendizaje: [{ asignatura: 'Ciencias', evidencia: 'Esquema del ciclo' }, { asignatura: 'Lengua', evidencia: 'Texto <breve>' }],
  criteriosEvaluacion: ['Explica el ciclo'],
  pasos: [
    { id: 'p1', titulo: 'Leer', instrucciones: 'Lee', momentos: 1, evidencia: 'foto', evidenciaDetalle: 'Foto', semana: 1, fecha: null },
    { id: 'p2', titulo: 'Esquema', instrucciones: 'Dibuja', momentos: 2, evidencia: 'foto', evidenciaDetalle: 'Foto del esquema', semana: 1,
      esEntregaParcial: true, canalEntrega: 'WhatsApp', ajusteAplicado: 'Apoyos gráficos', fecha: '2026-10-29' },
  ],
  sustentacion: { modalidad: 'esquema', fecha: null, hora: null, lugarOEnlace: '', preguntasGuia: ['¿Por qué llueve?'] },
};
const g: GuiaPlan = {
  id: 'g1', asignaturaIds: ['cn', 'len'], eje: '¿Cómo cuidamos el agua?', responsableCorreo: 'r@x', docentesCorreos: ['r@x'],
  vistosBuenos: {}, aprobada: guia, seguimiento: {}, sustentacionEstado: 'sin_citar', actualizadoEn: 1,
};
const asigs: AsignaturaPlan[] = [
  { asignaturaId: 'cn', docenteId: 'a', docenteCorreo: 'a@x', criteriosPromocion: '', ebcDba: 'DBA 4 ciclo del agua', actualizadoEn: 1 },
  { asignaturaId: 'len', docenteId: 'b', docenteCorreo: 'b@x', criteriosPromocion: '', ebcDba: 'EBC producción textual', actualizadoEn: 1 },
];
const nombres = { cn: { asignatura: 'Ciencias', docente: 'A' }, len: { asignatura: 'Lengua', docente: 'B' } };
const plan = { nombres: 'Ana María', grupo: '8º1', desde: '2026-10-26', hasta: '2026-11-13', ajustes: ['Lecturas cortas'], topeDiario: 3, ritmo: 'dia_por_medio' as const };

describe('construirHtmlUAI', () => {
  const html = construirHtmlUAI(plan, [g], asigs, nombres);
  it('reproduce las tablas del formato UAI', () => {
    for (const t of ['Componente curricular', 'EBC/DBA priorizado', 'Evidencias de aprendizaje', 'Producto integrado', 'Fase / Avance',
      'Entregable parcial esperado', 'Ajuste razonable', 'Canal / Formato de entrega', '¿Cómo cuidamos el agua?', 'DBA 4 ciclo del agua',
      'Esquema del ciclo', 'Cartel sobre el agua', 'Entrega parcial', 'Semana 1', 'Esquema o mapa de ideas', 'Lecturas cortas', 'día por medio']) {
      expect(html).toContain(t);
    }
  });
  it('escapa HTML y usa solo el primer nombre', () => {
    expect(html).toContain('Texto &lt;breve&gt;');
    expect(html).toContain('Ana');
    expect(html).not.toContain('María');
  });
  it('sin guías con contenido devuelve vacío', () => {
    expect(construirHtmlUAI(plan, [{ ...g, aprobada: undefined }], asigs, nombres)).toBe('');
  });
});
