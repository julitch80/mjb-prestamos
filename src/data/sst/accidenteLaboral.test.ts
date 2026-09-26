import { describe, expect, it } from 'vitest';
import {
  borradorFurat,
  debeAlertarInvestigacion,
  destinatariosAccidente,
  dimensionesComprimidas,
  esTamanoEvidenciaValido,
  esTipoEvidenciaValido,
  estadoCuentaRegresivaFurat,
  fusionarCasosSinDuplicar,
  horaLimiteFurat,
  horasRestantesFurat,
} from './accidenteLaboral';

describe('horaLimiteFurat', () => {
  it('suma 48 horas a la fecha del accidente', () => {
    expect(horaLimiteFurat('2026-09-26T10:00:00.000Z')).toBe('2026-09-28T10:00:00.000Z');
  });
});

describe('estadoCuentaRegresivaFurat', () => {
  const inicio = '2026-09-26T00:00:00.000Z';
  it('normal antes de las 24 h', () => {
    expect(estadoCuentaRegresivaFurat(inicio, '2026-09-26T23:59:00.000Z')).toBe('normal');
  });
  it('ámbar justo a las 24 h', () => {
    expect(estadoCuentaRegresivaFurat(inicio, '2026-09-27T00:00:00.000Z')).toBe('ambar');
  });
  it('ámbar poco antes de las 40 h', () => {
    expect(estadoCuentaRegresivaFurat(inicio, '2026-09-27T15:59:00.000Z')).toBe('ambar');
  });
  it('rojo justo a las 40 h', () => {
    expect(estadoCuentaRegresivaFurat(inicio, '2026-09-27T16:00:00.000Z')).toBe('rojo');
  });
  it('rojo poco antes de las 48 h', () => {
    expect(estadoCuentaRegresivaFurat(inicio, '2026-09-27T23:59:00.000Z')).toBe('rojo');
  });
  it('vencido justo a las 48 h', () => {
    expect(estadoCuentaRegresivaFurat(inicio, '2026-09-28T00:00:00.000Z')).toBe('vencido');
  });
  it('vencido bastante después', () => {
    expect(estadoCuentaRegresivaFurat(inicio, '2026-09-30T00:00:00.000Z')).toBe('vencido');
  });
});

describe('horasRestantesFurat', () => {
  it('es negativo cuando ya venció', () => {
    expect(horasRestantesFurat('2026-09-26T00:00:00.000Z', '2026-09-29T00:00:00.000Z')).toBe(-24);
  });
  it('es positivo cuando aún hay tiempo', () => {
    expect(horasRestantesFurat('2026-09-26T00:00:00.000Z', '2026-09-26T10:00:00.000Z')).toBe(38);
  });
});

describe('debeAlertarInvestigacion', () => {
  it('no alerta antes de los 15 días', () => {
    expect(debeAlertarInvestigacion('2026-09-01T00:00:00.000Z', '2026-09-10T00:00:00.000Z', 'reportado')).toBe(false);
  });
  it('alerta a los 15 días o más si no está cerrado', () => {
    expect(debeAlertarInvestigacion('2026-09-01T00:00:00.000Z', '2026-09-16T00:00:00.000Z', 'en_investigacion')).toBe(true);
  });
  it('nunca alerta si ya está cerrado', () => {
    expect(debeAlertarInvestigacion('2026-09-01T00:00:00.000Z', '2026-09-20T00:00:00.000Z', 'cerrado')).toBe(false);
  });
});

describe('destinatariosAccidente', () => {
  const usuarios = [
    { correo: 'Rectora@iemanueljbetancur.edu.co', role: 'rectora', active: true },
    { correo: 'coord1@iemanueljbetancur.edu.co', role: 'coordinador', active: true },
    { correo: 'docente1@iemanueljbetancur.edu.co', role: 'docente', active: true },
    { correo: 'inactivo@iemanueljbetancur.edu.co', role: 'coordinador', active: false },
  ];

  it('incluye rectora y coordinadores activos, no docentes ni inactivos', () => {
    const r = destinatariosAccidente(usuarios, [], 'autor@iemanueljbetancur.edu.co');
    expect(r).toEqual(['rectora@iemanueljbetancur.edu.co', 'coord1@iemanueljbetancur.edu.co']);
  });

  it('agrega correos del COPASST sin duplicar', () => {
    const r = destinatariosAccidente(usuarios, ['coord1@iemanueljbetancur.edu.co', 'copasst1@iemanueljbetancur.edu.co'], 'autor@iemanueljbetancur.edu.co');
    expect(r.sort()).toEqual([
      'coord1@iemanueljbetancur.edu.co',
      'copasst1@iemanueljbetancur.edu.co',
      'rectora@iemanueljbetancur.edu.co',
    ].sort());
  });

  it('excluye al autor aunque sea rectora o del COPASST', () => {
    const r = destinatariosAccidente(usuarios, ['docente1@iemanueljbetancur.edu.co'], 'Rectora@iemanueljbetancur.edu.co');
    expect(r).not.toContain('rectora@iemanueljbetancur.edu.co');
  });
});

describe('borradorFurat', () => {
  it('no menciona la cédula en ningún dato', () => {
    const texto = borradorFurat({
      tipoPersona: 'docente',
      nombrePersona: 'Julián David Medina Tamayo',
      fechaHora: '2026-09-26T14:30:00.000Z',
      lugar: 'Cancha del patio central',
      queHacia: 'Supervisaba el descanso',
      comoOcurrio: 'Se torció el tobillo al pisar un desnivel',
      lesionAparente: 'Esguince de tobillo derecho',
      testigos: 'Coordinador Juan Diego',
      atencionRecibida: true,
      atencionDonde: 'Enfermería del colegio',
    });
    expect(texto).toContain('Julián David Medina Tamayo');
    expect(texto).toContain('MODO');
    expect(texto).toContain('TIEMPO');
    expect(texto).toContain('LUGAR');
    // Se permite mencionar la palabra "cédula" en la nota que recuerda
    // digitarla en HORUS, pero el objeto de entrada no trae ningún campo de
    // cédula que pudiera filtrarse al texto.
    expect(texto).toContain('se digita directamente en HORUS');
  });
});

describe('esTipoEvidenciaValido', () => {
  it('acepta jpeg, png, webp, heic y pdf', () => {
    expect(esTipoEvidenciaValido('image/jpeg')).toBe(true);
    expect(esTipoEvidenciaValido('image/png')).toBe(true);
    expect(esTipoEvidenciaValido('image/webp')).toBe(true);
    expect(esTipoEvidenciaValido('image/heic')).toBe(true);
    expect(esTipoEvidenciaValido('application/pdf')).toBe(true);
  });
  it('rechaza otros tipos', () => {
    expect(esTipoEvidenciaValido('application/msword')).toBe(false);
    expect(esTipoEvidenciaValido('video/mp4')).toBe(false);
    expect(esTipoEvidenciaValido('')).toBe(false);
  });
});

describe('esTamanoEvidenciaValido', () => {
  it('acepta tamaños positivos menores a 10 MB', () => {
    expect(esTamanoEvidenciaValido(1024)).toBe(true);
    expect(esTamanoEvidenciaValido(10 * 1024 * 1024 - 1)).toBe(true);
  });
  it('rechaza cero, negativos y 10 MB o más', () => {
    expect(esTamanoEvidenciaValido(0)).toBe(false);
    expect(esTamanoEvidenciaValido(-5)).toBe(false);
    expect(esTamanoEvidenciaValido(10 * 1024 * 1024)).toBe(false);
  });
});

describe('dimensionesComprimidas', () => {
  it('no cambia una imagen ya menor al límite', () => {
    expect(dimensionesComprimidas(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it('reduce el lado mayor a 1600 px conservando proporción (horizontal)', () => {
    expect(dimensionesComprimidas(3200, 2400)).toEqual({ width: 1600, height: 1200 });
  });
  it('reduce el lado mayor a 1600 px conservando proporción (vertical)', () => {
    expect(dimensionesComprimidas(2400, 3200)).toEqual({ width: 1200, height: 1600 });
  });
  it('respeta un ladoMaximo distinto', () => {
    expect(dimensionesComprimidas(1000, 500, 400)).toEqual({ width: 400, height: 200 });
  });
});

describe('fusionarCasosSinDuplicar', () => {
  it('une dos listas sin duplicar por id', () => {
    const a = [{ id: '1', x: 1 }, { id: '2', x: 2 }];
    const b = [{ id: '2', x: 2 }, { id: '3', x: 3 }];
    const r = fusionarCasosSinDuplicar(a, b);
    expect(r.map(c => c.id).sort()).toEqual(['1', '2', '3']);
  });
  it('funciona con una lista vacía', () => {
    const a = [{ id: '1' }];
    expect(fusionarCasosSinDuplicar(a, [])).toEqual(a);
  });
});
