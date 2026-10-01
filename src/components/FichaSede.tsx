// Ficha de una sede que todavía no está configurada.
//
// Antes, al cambiar a una sede de primaria aparecía un cartel de dos líneas
// diciendo "en configuración". Es cierto, pero no sirve para nada: ni el
// coordinador ve qué tenemos suyo, ni sabe qué falta. Esta ficha muestra lo que
// ya está cargado y lo que se está esperando, para que la conversación con la
// sede sea sobre datos concretos y no sobre una promesa.
import {
  ASIGNATURAS_TARDE_GUSTAVO_RODAS,
  ASIGNATURAS_TARDE_LA_FINQUITA,
  BLOQUES_POR_JORNADA_GUSTAVO_RODAS,
  DIRECTORES_GUSTAVO_RODAS,
  DIRECTORES_LA_FINQUITA,
  GRUPOS_GUSTAVO_RODAS,
  GRUPOS_LA_FINQUITA,
  USUARIOS,
  type Sede,
} from '../data/maestros';

function nombreDe(id: string): string {
  return USUARIOS.find((u) => u.id === id)?.nombre ?? id;
}

function Etiqueta({ tono, children }: { tono: 'ok' | 'falta'; children: React.ReactNode }) {
  return (
    <span
      className={
        'text-[10px] px-2 py-0.5 rounded-full border ' +
        (tono === 'ok'
          ? 'bg-success-soft border-success text-success-soft-fg'
          : 'bg-warning-soft border-warning text-warning-soft-fg')
      }
    >
      {children}
    </span>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-card p-3 space-y-2">
      <h3 className="text-sm font-semibold text-strong">{titulo}</h3>
      {children}
    </section>
  );
}

function TablaGrupos({
  jornada,
  grupos,
  directores,
  asignaturas,
}: {
  jornada: 'manana' | 'tarde';
  grupos: string[];
  directores: Record<string, string>;
  asignaturas: Record<string, string>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-line text-muted">
            <th className="text-left py-1.5 pr-3 font-medium">Grupo</th>
            <th className="text-left py-1.5 pr-3 font-medium">Director de grupo</th>
            {jornada === 'tarde' && <th className="text-left py-1.5 font-medium">Dicta</th>}
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => {
            const docenteId = directores[g];
            return (
              <tr key={g} className="border-b border-line/50">
                <td className="py-1.5 pr-3 text-strong font-medium whitespace-nowrap">{g}</td>
                <td className="py-1.5 pr-3 text-soft">{nombreDe(docenteId)}</td>
                {jornada === 'tarde' && (
                  <td className="py-1.5 text-muted">{asignaturas[docenteId] ?? '—'}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FichaGustavoRodas() {
  const docentes = USUARIOS.filter((u) => u.sede === 'gustavo_rodas');
  const bloquesTarde = BLOQUES_POR_JORNADA_GUSTAVO_RODAS.tarde;

  return (
    <div className="space-y-3">
      <Bloque titulo={`Docentes (${docentes.length})`}>
        <p className="text-xs text-muted">
          Ya cargados con su jornada y su sede. El correo institucional de cada uno no viaja en
          la app — se resuelve desde Firestore solo cuando esa persona inicia sesión (ver
          src/data/maestros.ts). En cuanto se les cree la cuenta quedarán dentro de los canales
          de chat de la sede automáticamente.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {docentes.map((d) => (
            <span
              key={d.id}
              className="text-[11px] px-2 py-1 rounded-full bg-elevated border border-line"
              style={{ color: d.color }}
              title={`${d.correo ? d.correo : 'correo aún no resuelto (pendiente de login)'} · jornada ${d.jornada === 'manana' ? 'mañana' : 'tarde'}`}
            >
              {d.nombreCorto}
            </span>
          ))}
        </div>
      </Bloque>

      <Bloque titulo="Jornada de la mañana">
        <TablaGrupos
          jornada="manana"
          grupos={GRUPOS_GUSTAVO_RODAS.manana}
          directores={DIRECTORES_GUSTAVO_RODAS}
          asignaturas={ASIGNATURAS_TARDE_GUSTAVO_RODAS}
        />
        <p className="text-xs text-muted">
          Cada docente dicta todas las asignaturas de su grupo. 1.° y 2.° de 7:00 a 12:00;
          Transición de 7:30 a 11:45.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Etiqueta tono="ok">Docentes</Etiqueta>
          <Etiqueta tono="ok">Dirección de grupo</Etiqueta>
          <Etiqueta tono="falta">Horario detallado</Etiqueta>
          <Etiqueta tono="falta">Horas de cada bloque</Etiqueta>
        </div>
      </Bloque>

      <Bloque titulo="Jornada de la tarde">
        <TablaGrupos
          jornada="tarde"
          grupos={GRUPOS_GUSTAVO_RODAS.tarde}
          directores={DIRECTORES_GUSTAVO_RODAS}
          asignaturas={ASIGNATURAS_TARDE_GUSTAVO_RODAS}
        />
        <p className="text-xs text-muted">
          Cada docente dicta su asignatura en todos los grupos.{' '}
          {bloquesTarde ? `${bloquesTarde} bloques diarios. ` : ''}
          3.°, 4.° y 5.° de 12:30 a 5:30; Transición de 12:30 a 4:45.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Etiqueta tono="ok">Docentes</Etiqueta>
          <Etiqueta tono="ok">Asignaturas</Etiqueta>
          <Etiqueta tono="ok">Horario general</Etiqueta>
          <Etiqueta tono="falta">Dirección de grupo por confirmar</Etiqueta>
          <Etiqueta tono="falta">Horas de cada bloque</Etiqueta>
        </div>
      </Bloque>

      <Bloque titulo="Lo que falta para activar la sede">
        <ul className="text-xs text-muted space-y-1 list-disc pl-4">
          <li>El horario detallado de la mañana.</li>
          <li>Las horas exactas de inicio y fin de cada bloque, en las dos jornadas.</li>
          <li>Los espacios de la sede y qué salón usa cada grupo.</li>
          <li>Los turnos de acompañamiento en los descansos.</li>
          <li>Confirmar la dirección de grupo de la tarde.</li>
        </ul>
        <p className="text-xs text-muted">
          Se solicitó formalmente a la coordinación el 30 de julio de 2026.
        </p>
      </Bloque>

      <Bloque titulo="Lo que ya funciona hoy para esta sede">
        <p className="text-xs text-muted leading-relaxed">
          El <strong className="text-soft">chat</strong> es institucional: hay canales propios de la
          sede y de cada jornada, y sus docentes entran solos.{' '}
          La <strong className="text-soft">agenda semanal</strong> y la{' '}
          <strong className="text-soft">gestión del riesgo</strong> también son de toda la
          institución — las brigadas de esta sede ya están cargadas desde la Resolución 33.{' '}
          Y el módulo <strong className="text-soft">Manual de convivencia</strong> (chatbots,
          versión digital y versión clásica) también está disponible: no depende de datos
          académicos de la sede, así que ya funciona igual que en central.
        </p>
      </Bloque>
    </div>
  );
}

function FichaLaFinquita() {
  const docentes = USUARIOS.filter((u) => u.sede === 'la_finquita');

  return (
    <div className="space-y-3">
      <Bloque titulo={`Docentes (${docentes.length})`}>
        <p className="text-xs text-muted">
          Cargadas con su jornada y su sede. El correo institucional no viaja en la app: se
          resuelve desde Firestore cuando la persona inicia sesión, una vez creada su cuenta con
          su puesto.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {docentes.map((d) => (
            <span
              key={d.id}
              className="text-[11px] px-2 py-1 rounded-full bg-elevated border border-line"
              style={{ color: d.color }}
              title={`jornada ${d.jornada === 'manana' ? 'mañana' : 'tarde'}`}
            >
              {d.nombreCorto}
            </span>
          ))}
        </div>
      </Bloque>

      <Bloque titulo="Jornada de la mañana">
        <TablaGrupos
          jornada="manana"
          grupos={GRUPOS_LA_FINQUITA.manana}
          directores={DIRECTORES_LA_FINQUITA}
          asignaturas={ASIGNATURAS_TARDE_LA_FINQUITA}
        />
        <p className="text-xs text-muted">
          Cada docente dicta todas las asignaturas de su grupo. 1.° y 2.° de 7:00 a 12:00;
          Transición de 7:30 a 11:45.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Etiqueta tono="ok">Docentes</Etiqueta>
          <Etiqueta tono="ok">Dirección de grupo</Etiqueta>
          <Etiqueta tono="falta">Horario por bloques</Etiqueta>
          <Etiqueta tono="falta">Horas de bloques y descansos</Etiqueta>
        </div>
      </Bloque>

      <Bloque titulo="Jornada de la tarde">
        <TablaGrupos
          jornada="tarde"
          grupos={GRUPOS_LA_FINQUITA.tarde}
          directores={DIRECTORES_LA_FINQUITA}
          asignaturas={ASIGNATURAS_TARDE_LA_FINQUITA}
        />
        <p className="text-xs text-muted">
          3.°, 4.° y 5.° de 12:30 a 5:30, con reparto de asignaturas entre tres docentes.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Etiqueta tono="ok">Docentes</Etiqueta>
          <Etiqueta tono="ok">Asignaturas</Etiqueta>
          <Etiqueta tono="ok">Dirección de grupo</Etiqueta>
          <Etiqueta tono="falta">Jornada de 3°3 por confirmar</Etiqueta>
          <Etiqueta tono="falta">Horario por bloques</Etiqueta>
        </div>
      </Bloque>

      <Bloque titulo="Lo que falta para activar la sede">
        <ul className="text-xs text-muted space-y-1 list-disc pl-4">
          <li>
            La jornada de 3°3: el documento de horarios la ubica en la mañana (1.°, 2.° y 3.°) y
            en la tarde (3.°, 4.° y 5.°) a la vez.
          </li>
          <li>El horario por bloques de las dos jornadas.</li>
          <li>Las horas de cada bloque y de los descansos.</li>
          <li>Los turnos de acompañamiento.</li>
          <li>Las reglas de asistencia de la sede.</li>
          <li>Los espacios de la sede y qué salón usa cada grupo.</li>
        </ul>
      </Bloque>

      <Bloque titulo="Lo que ya funciona hoy para esta sede">
        <p className="text-xs text-muted leading-relaxed">
          El <strong className="text-soft">chat</strong>, la{' '}
          <strong className="text-soft">agenda semanal</strong>, la{' '}
          <strong className="text-soft">gestión del riesgo</strong> (brigadas de la Resolución 33)
          y el <strong className="text-soft">Manual de convivencia</strong> son institucionales y
          ya sirven a esta sede. El coordinador de la sede es Juan Diego Salazar.
        </p>
      </Bloque>
    </div>
  );
}

export default function FichaSede({ sede }: { sede: Sede }) {
  const hayFicha = sede.id === 'gustavo_rodas' || sede.id === 'la_finquita';

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-strong">{sede.nombre}</h2>
        <p className="text-sm text-muted mt-0.5">
          {sede.nivel === 'primaria' ? 'Primaria' : 'Bachillerato'} · sede en configuración
        </p>
      </div>

      {hayFicha ? (
        sede.id === 'la_finquita' ? <FichaLaFinquita /> : <FichaGustavoRodas />
      ) : (
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="text-sm text-soft leading-relaxed">
            Todavía no tenemos cargados los datos académicos de esta sede. Se solicitaron a la
            coordinación el 30 de julio de 2026: docentes, dirección de grupo, horarios, espacios
            y turnos de acompañamiento.
          </p>
          <p className="text-xs text-muted mt-2 leading-relaxed">
            Mientras tanto, el chat, la agenda semanal y la gestión del riesgo ya funcionan para
            toda la institución, esta sede incluida.
          </p>
        </div>
      )}
    </div>
  );
}
