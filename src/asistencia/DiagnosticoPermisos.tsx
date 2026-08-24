import { useState } from 'react';
import {
  leerAutoridadSedeCompleta,
  leerCuentaPorCorreo,
  leerDirectores,
  type CuentaDiagnostico,
} from './datos';

/** Nombre para mostrar de cada sede — solo para lectura humana, el id real es la clave. */
const NOMBRE_SEDE: Record<string, string> = {
  central: 'central',
  gustavo_rodas: 'Gustavo Rodas',
  la_finquita: 'La Finquita',
};

function nombreSede(sede: string): string {
  return NOMBRE_SEDE[sede] ?? sede;
}

interface Resultado {
  cuenta: CuentaDiagnostico;
  gradosDirector: string[];
  /** sede -> jornada a la que queda limitado, o null si manda en la sede completa. */
  sedesCoordina: { sede: string; jornadaLimitada: 'manana' | 'tarde' | null }[];
}

/**
 * Diagnóstico de permisos — pantalla del superusuario.
 *
 * "Ver como" no sirve para esto: solo cambia lo que pinta el navegador, pero el SERVIDOR
 * sigue viendo al superusuario, así que toda pantalla de asistencia simulada sale vacía y
 * parece un fallo del módulo cuando no lo es (costó una tarde entera de diagnóstico).
 *
 * Esta pantalla lee, para un correo cualquiera, los MISMOS documentos de configuración
 * que consultan las reglas (`users/{correo}`, `asistenciaConfig/directores`,
 * `asistenciaConfig/autoridadSede`) y reproduce a mano la misma cuenta que hacen las
 * reglas. Es una REPRODUCCIÓN, no una evaluación real — ver el aviso al pie.
 */
export default function DiagnosticoPermisos() {
  const [correo, setCorreo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function consultar() {
    const normalizado = correo.trim().toLowerCase();
    if (!normalizado) return;
    setCargando(true);
    setError(null);
    setResultado(null);
    try {
      const [cuenta, directores, autoridadSede] = await Promise.all([
        leerCuentaPorCorreo(normalizado),
        leerDirectores(),
        leerAutoridadSedeCompleta(),
      ]);

      // De que grados es director: comparando su slotId (el del SERVIDOR, no el que la
      // interfaz resuelva de otro lado) contra el mapa espejo.
      const gradosDirector = cuenta.slotId
        ? Object.entries(directores)
            .filter(([, slotId]) => slotId === cuenta.slotId)
            .map(([grado]) => grado)
        : [];

      // Que sedes coordina, y si en cada una queda limitado a una jornada. El mismo
      // calculo que hace `leerAlcanceUsuario` para la cuenta propia, aqui para una ajena.
      const sedesCoordina = Object.entries(autoridadSede.mapa)
        .filter(([, correos]) => correos.includes(normalizado))
        .map(([sede]) => {
          const deEstaSede = autoridadSede.soloJornada[sede] ?? {};
          const jornadaLimitada: 'manana' | 'tarde' | null = (deEstaSede.manana ?? []).includes(
            normalizado,
          )
            ? 'manana'
            : (deEstaSede.tarde ?? []).includes(normalizado)
              ? 'tarde'
              : null;
          return { sede, jornadaLimitada };
        });

      setResultado({ cuenta, gradosDirector, sedesCoordina });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-card p-3">
      <h3 className="text-sm font-semibold text-strong">Diagnóstico de permisos</h3>
      <p className="text-xs text-muted">
        Escriba el correo institucional de alguien para ver qué le tocaría, según los
        documentos de configuración del módulo.
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <input
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void consultar()}
          placeholder="nombre@colegio.edu.co"
          className="min-w-0 flex-1 rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
        />
        <button
          disabled={correo.trim() === '' || cargando}
          onClick={() => void consultar()}
          className="min-h-[36px] rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          {cargando ? 'Consultando…' : 'Consultar'}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      {resultado && <ResultadoDiagnostico resultado={resultado} />}

      {/* Honestidad sobre lo que esto NO es: sin este aviso, una divergencia futura entre
          esta pantalla y las reglas de verdad mentiria con total confianza. */}
      <p className="mt-4 border-t border-line pt-2 text-xs text-muted">
        Esto muestra lo que dicen los documentos de configuración — no evalúa las reglas
        de Firestore, las reproduce a mano. La comprobación de verdad es siempre entrar
        con esa cuenta. Si algún día esta pantalla y las reglas llegan a decir cosas
        distintas, esta pantalla es la que está equivocada.
      </p>
    </section>
  );
}

function ResultadoDiagnostico({ resultado }: { resultado: Resultado }) {
  const { cuenta, gradosDirector, sedesCoordina } = resultado;

  if (!cuenta.existe) {
    return (
      <div className="mt-3 rounded-lg border border-danger-soft bg-danger-soft p-3 text-sm text-danger-soft-fg">
        No existe una cuenta de asistencia con ese correo (documento{' '}
        <code>users/{cuenta.correo}</code> no encontrado). Puede que este mal escrito, o
        que la cuenta este creada con otra combinacion de mayusculas — para Firestore es
        otro documento.
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted">Puesto (slotId)</dt>
        <dd className="text-strong">{cuenta.slotId ?? '— sin puesto asignado —'}</dd>
        <dt className="text-muted">Rol</dt>
        <dd className="text-strong">{cuenta.role ?? '— sin rol —'}</dd>
        <dt className="text-muted">Cuenta activa</dt>
        <dd className="text-strong">{cuenta.active ? 'Sí' : 'No (dada de baja)'}</dd>
        <dt className="text-muted">Solo consulta</dt>
        <dd className="text-strong">{cuenta.asistenciaConsulta ? 'Sí' : 'No'}</dd>
        <dt className="text-muted">Director de grupo</dt>
        <dd className="text-strong">
          {gradosDirector.length > 0 ? gradosDirector.join(', ') : '— de ninguno —'}
        </dd>
        <dt className="text-muted">Coordina</dt>
        <dd className="text-strong">
          {sedesCoordina.length > 0
            ? sedesCoordina
                .map((s) =>
                  s.jornadaLimitada
                    ? `${nombreSede(s.sede)} (solo ${s.jornadaLimitada === 'manana' ? 'mañana' : 'tarde'})`
                    : nombreSede(s.sede),
                )
                .join(', ')
            : '— ninguna sede —'}
        </dd>
      </dl>

      <p className="rounded-lg border border-info-soft bg-info-soft p-2 text-sm text-info-soft-fg">
        {conclusion(resultado)}
      </p>
    </div>
  );
}

/** Traduce el resultado a una frase en español llano, en el mismo orden de autoridad que
 *  usa `index.tsx` para resolver el alcance real: inactiva > consulta > coordinador >
 *  director > docente por puesto > nada. */
function conclusion(resultado: Resultado): string {
  const { cuenta, gradosDirector, sedesCoordina } = resultado;

  if (!cuenta.active) {
    return 'No vería ninguna planilla: su cuenta está dada de baja (inactiva).';
  }

  const partesConsulta: string[] = [];
  if (cuenta.role === 'rectora' || cuenta.asistenciaConsulta) {
    partesConsulta.push(
      'Vería en consulta las planillas de la sede que tenga abierta, sin poder registrar ni corregir nada.',
    );
  }

  if (sedesCoordina.length > 0) {
    const frase = sedesCoordina
      .map((s) =>
        s.jornadaLimitada
          ? `la jornada de la ${s.jornadaLimitada === 'manana' ? 'mañana' : 'tarde'} en ${nombreSede(s.sede)}`
          : `${nombreSede(s.sede)} completa`,
      )
      .join(', y ');
    partesConsulta.push(`Como coordinador, vería y registraría las planillas de ${frase}.`);
  }

  if (gradosDirector.length > 0) {
    partesConsulta.push(
      `Es director del grupo ${gradosDirector.join(', ')}: además de su propia asignatura, vería ` +
        'todas las planillas de ese grupo y el cuaderno de dirección.',
    );
  }

  if (partesConsulta.length > 0) return partesConsulta.join(' ');

  if (cuenta.slotId) {
    return (
      'Vería y registraría las planillas de los grupos que le asigne la asignación ' +
      'académica de MJB para su puesto.'
    );
  }

  return 'No vería ninguna planilla: su cuenta no tiene puesto asignado.';
}
