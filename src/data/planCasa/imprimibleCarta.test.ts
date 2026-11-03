import { describe, expect, it } from 'vitest';
import { construirHtmlCartas, construirHtmlPlanilla , tratamiento, inicioCarta } from './imprimibleCarta';

const plan = { nombres: 'Ana María', apellidos: 'Pérez Gómez', grupo: '9.1', desde: '2026-11-02', hasta: '2026-11-27' };
// Un plan real trae motivo y ajustes; la carta no debe filtrarlos aunque lleguen en el objeto.
const planConMotivo = { ...plan, motivo: 'DIAGNOSTICO-SECRETO', ajustes: ['AJUSTE-SECRETO'] };

describe('construirHtmlCartas', () => {
  it('incluye nombre completo, grupo, URL y no el motivo', () => {
    const html = construirHtmlCartas([{ plan: planConMotivo, url: 'https://x.test/#/plan/abc123', qr: 'data:image/png;base64,AAA' }], new Date(2026, 10, 2));
    expect(html).toContain('Ana María Pérez Gómez');
    expect(html).toContain('9.1');
    expect(html).toContain('https://x.test/#/plan/abc123');
    expect(html).toContain('2 de noviembre de 2026');
    expect(html).not.toContain('DIAGNOSTICO-SECRETO');
    expect(html).not.toContain('AJUSTE-SECRETO');
    expect(html).not.toMatch(/motivo/i);
  });
  it('destinatario con acudiente y parentesco; genérico si no hay', () => {
    const con = construirHtmlCartas([{ plan, url: 'u', acudiente: 'Rosa Gómez', parentesco: 'Madre' }]);
    expect(con).toContain('Señora Rosa Gómez');
    expect(con).not.toContain('(madre de');
    const sin = construirHtmlCartas([{ plan, url: 'u' }]);
    expect(sin).toContain('Señores padres de familia / acudientes de Ana María Pérez Gómez');
  });
  it('firma del coordinador según jornada, sin desprendible ni equipo de apoyo', () => {
    const m = construirHtmlCartas([{ plan, url: 'u' }]);
    expect(m).toContain('Janneth Astrid Ocampo Carvajal');
    expect(m).toContain('Coordinadora');
    expect(m).not.toContain('Juan Diego');
    const t = construirHtmlCartas([{ plan: { ...plan, grupo: '7º1' }, url: 'u' }]);
    expect(t).toContain('Juan Diego Salazar Rendón');
    expect(t).not.toContain('Janneth');
    for (const h of [m, t]) {
      expect(h).not.toMatch(/Recib[ií]/);
      expect(h).not.toContain('desprendible');
      expect(h).not.toContain('Equipo de apoyo');
      expect(h).not.toContain('Coordinación académica');
    }
  });
  it('una página por carta y aviso de cuadernillo solo sin tecnología', () => {
    const e = { plan, url: 'u' };
    const dos = construirHtmlCartas([e, { ...e, plan: { ...plan, sinTecnologia: true } }]);
    expect(dos.match(/<section class="carta">/g)).toHaveLength(2);
    expect(dos.match(/cuadernillo impreso/g)).toHaveLength(1);
  });
  it('vacío si no hay entradas', () => { expect(construirHtmlCartas([])).toBe(''); });
});

describe('construirHtmlPlanilla', () => {
  const a = { plan: { nombres: 'Zoe', apellidos: 'Álvarez', grupo: '10.2' }, acudiente: 'Luz Álvarez' };
  const b = { plan: { nombres: 'Ana', apellidos: 'Pérez', grupo: '9.1' }, acudiente: 'Rosa Gómez' };
  const c = { plan: { nombres: 'Leo', apellidos: 'Ríos', grupo: '7º1' } };
  const html = construirHtmlPlanilla([a, b, c], new Date(2026, 10, 2));
  it('título, jornadas separadas y coordinadores', () => {
    expect(html).toContain('Planilla de entrega de planes académicos especiales');
    expect(html.match(/<section class="planilla">/g)).toHaveLength(2);
    expect(html).toContain('Janneth Astrid Ocampo Carvajal');
    expect(html).toContain('Juan Diego Salazar Rendón');
    expect(html).toContain('Nombre de quien recibe');
  });
  it('filas con nombre completo y acudiente, ordenadas por grupo', () => {
    expect(html).toContain('Ana Pérez');
    expect(html).toContain('Rosa Gómez');
    expect(html.indexOf('Ana Pérez')).toBeLessThan(html.indexOf('Zoe Álvarez'));
    expect(html.match(/<tr><td class="c">/g)).toHaveLength(3);
  });
  it('sin motivo y vacío sin entradas', () => {
    expect(html).not.toMatch(/motivo|diagn/i);
    expect(construirHtmlPlanilla([])).toBe('');
  });
});

describe('tratamiento', () => {
  it('usa el parentesco registrado, no el nombre', () => {
    expect(tratamiento('Madre')).toBe('Señora');
    expect(tratamiento('Tío')).toBe('Señor');
    expect(tratamiento('Vecino')).toBe('Señor(a)');
    expect(tratamiento('')).toBe('Señor(a)');
  });
});

describe('inicioCarta', () => {
  it('usa el día de entrega si es posterior al inicio del plan', () => {
    expect(inicioCarta('2026-11-03', new Date(2026, 10, 4))).toBe('2026-11-04');
    expect(inicioCarta('2026-11-03', new Date(2026, 10, 2))).toBe('2026-11-03');
  });
});

describe('carta: ventana de sustentación', () => {
  it('avisa que las sustentaciones son entre el 24 y el 27 de noviembre', () => {
    const html = construirHtmlCartas([{ plan: { nombres: 'Ana', apellidos: 'Pérez', grupo: '9.1', desde: '2026-11-02', hasta: '2026-11-20' }, url: 'https://x/#/plan/t' }], new Date(2026, 10, 2));
    expect(html).toContain('Las sustentaciones de las guías serán entre el 24 y el 27 de noviembre');
    expect(html).toContain('la fecha y hora exactas aparecerán en la agenda');
  });
});
