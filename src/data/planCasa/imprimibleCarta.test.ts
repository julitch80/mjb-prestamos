import { describe, expect, it } from 'vitest';
import { construirHtmlCartas } from './imprimibleCarta';

const plan = { nombres: 'Ana María', apellidos: 'Pérez Gómez', grupo: '9.1', desde: '2026-11-02', hasta: '2026-11-27' };
// Un plan real trae motivo y ajustes; la carta no debe filtrarlos aunque lleguen en el objeto.
const planConMotivo = { ...plan, motivo: 'DIAGNOSTICO-SECRETO', ajustes: ['AJUSTE-SECRETO'] };

describe('construirHtmlCartas', () => {
  it('incluye nombre, grupo, URL y no el motivo', () => {
    const html = construirHtmlCartas([{ plan: planConMotivo, url: 'https://x.test/#/plan/abc123', qr: 'data:image/png;base64,AAA' }], new Date(2026, 10, 2));
    expect(html).toContain('Ana María Pérez Gómez');
    expect(html).toContain('9.1');
    expect(html).toContain('https://x.test/#/plan/abc123');
    expect(html).toContain('2 de noviembre de 2026');
    expect(html).not.toContain('DIAGNOSTICO-SECRETO');
    expect(html).not.toContain('AJUSTE-SECRETO');
    expect(html).not.toMatch(/motivo/i);
  });
  it('una página por carta y aviso de cuadernillo solo sin tecnología', () => {
    const e = { plan, url: 'u' };
    const dos = construirHtmlCartas([e, { ...e, plan: { ...plan, sinTecnologia: true } }]);
    expect(dos.match(/<section class="carta">/g)).toHaveLength(2);
    expect(dos.match(/cuadernillo impreso/g)).toHaveLength(1);
  });
  it('vacío si no hay entradas', () => { expect(construirHtmlCartas([])).toBe(''); });
});
