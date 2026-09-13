/**
 * Ajuste manual del borrador: mover una clase arrastrándola.
 *
 * El motor da un horario válido, no el horario que el coordinador quiere. Casi
 * siempre hay tres o cuatro cambios que solo él sabe («esa clase mejor el
 * viernes», «no me dejes a Marta con dos primeras horas seguidas»). Esto es
 * para eso, y para nada más: se mueve lo que ya existe, no se crea ni se borra.
 *
 * La regla que gobierna todo: **un movimiento que rompe algo no se hace**, y se
 * dice quién estorba. «10.2 a la 3.ª hora ya tiene clase con Doris» le dice al
 * coordinador qué hacer; «conflicto» lo deja igual que estaba. El salón es la
 * excepción: avisa pero deja pasar, porque en el colegio dos grupos comparten
 * espacio a veces y bloquearlo impediría soluciones que él sí quiere.
 *
 * Hay cuatro formas de mirar la misma semana, y no sobra ninguna:
 *
 *   uno a uno      un grupo, o un docente, con sus días y sus horas. Se lee cómodo.
 *   vista general  TODOS los grupos, o TODOS los docentes, a la vez. Es ancha y
 *                  apretada, pero es la única que sirve para organizar: para
 *                  mover una clase hay que ver quién está libre a esa hora, y
 *                  eso solo se ve mirando la columna entera.
 *
 * Al levantar una clase se marcan en verde las horas donde SÍ cabe. Es la
 * diferencia entre probar a ciegas y ver el sitio antes de soltar.
 *
 * Nada de esto toca el horario vigente: al guardar se crea una versión nueva
 * del borrador, y la anterior queda en la lista.
 */

import { Fragment, useCallback, useMemo, useState } from 'react';
import {
  DndContext, PointerSensor, TouchSensor, closestCenter, useDraggable, useDroppable,
  useSensor, useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, RotateCcw, Save } from 'lucide-react';

import { ASIGNATURAS } from '../../data/asignacionAcademica';
import { USUARIOS } from '../../data/maestros';
import { franjasCambiadas, huellaEnFranja } from '../../data/horarios/comparar';
import { avisos as soloAvisos, duras, puedeColocar, validar } from '../../data/horarios/validador';
import type {
  ClaseGenerada, Dia, EntradaGenerador, SalidaGenerador,
} from '../../data/horarios/tipos';
import { cn } from '../../lib/utils';

const NOMBRE_DIA: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes',
};

/**
 * Qué identifica una fila: el grupo o el docente. Son las dos preguntas
 * distintas que se hacen al revisar un horario —«¿cómo le queda la semana a
 * 9.3?» y «¿cómo le queda a Marta?»— y los problemas de carga (dos días de seis
 * horas, huecos sueltos) solo se ven en la segunda.
 */
type Modo = 'grupo' | 'docente';

/** Una fila sola, o todas a la vez. */
type Alcance = 'detalle' | 'general';

const nombreDocente = (id: string) =>
  USUARIOS.find(u => u.id === id)?.nombreCorto ?? id;
const colorDocente = (id: string) =>
  USUARIOS.find(u => u.id === id)?.color ?? '#94a3b8';
const abrevAsignatura = (id?: string) =>
  ASIGNATURAS.find(a => a.id === id)?.abrev ?? id ?? '';

/**
 * La primera columna se queda quieta al desplazar en horizontal.
 *
 * Sin esto, al mirar el jueves ya no se sabe de quién es cada fila, que es
 * justo lo que hace falta saber. El fondo es opaco a propósito: la rejilla pasa
 * por debajo, y con fondo transparente se leerian los dos a la vez.
 */
const COLUMNA_FIJA = 'sticky left-0 z-10 bg-card pr-2 border-r border-line';

/**
 * Separacion entre un dia y el siguiente en la vista general.
 *
 * Sin ella, la 6.ª del lunes y la 1.ª del martes se ven exactamente igual de
 * juntas que dos horas del mismo dia, y se pierde de vista donde termina uno.
 * Va en la primera columna de cada dia --cabecera y celdas-- para que todas las
 * filas partan por el mismo sitio.
 */
const EMPIEZA_DIA = 'ml-3';

/** A qué fila pertenece una clase, según lo que se esté mirando. */
const filaDe = (c: ClaseGenerada, modo: Modo) => (modo === 'grupo' ? c.grado : c.docente);

/** El índice va delante porque es lo que identifica la ficha al soltarla. */
function idDeFicha(c: ClaseGenerada, i: number): string {
  return `${i}:${c.docente}:${c.grado}:${c.asignatura ?? ''}`;
}

/**
 * La celda lleva su fila dentro. Sin eso, soltar una clase de 9.1 en la fila de
 * 10.2 parecería un movimiento válido, cuando en realidad sería cambiarle el
 * grupo a la clase: eso no es mover el horario, es rehacer la asignación.
 */
function celdaId(fila: string, dia: string, bloque: number): string {
  return `celda␟${fila}␟${dia}␟${bloque}`;
}

function leerCeldaId(id: string): { fila: string; dia: string; bloque: number } | null {
  const partes = id.split('␟');
  if (partes.length !== 4 || partes[0] !== 'celda') return null;
  return { fila: partes[1], dia: partes[2], bloque: Number(partes[3]) };
}

// --------------------------------------------------------------------------

function Ficha({ id, clase, movida, modo, compacta }: {
  id: string; clase: ClaseGenerada; movida: boolean; modo: Modo; compacta: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const color = colorDocente(clase.docente);
  const elOtro = modo === 'grupo' ? nombreDocente(clase.docente) : clase.grado;
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: CSS.Translate.toString(transform),
        borderColor: color,
        backgroundColor: `${color}20`,
        opacity: isDragging ? 0.4 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        // Sin esto el arrastre no funciona con el dedo: el navegador se queda el
        // gesto como desplazamiento de la página y lo cancela antes de empezar.
        touchAction: 'none',
      }}
      className={cn(
        'h-full w-full rounded-md border flex flex-col items-center justify-center',
        'select-none overflow-hidden',
        compacta ? 'px-0.5' : 'px-1 py-1 gap-0.5',
        movida && 'ring-2 ring-accent',
      )}
      title={`${abrevAsignatura(clase.asignatura)} · ${nombreDocente(clase.docente)}`
        + ` · ${clase.grado} · ${clase.aula}`}
    >
      <span
        className={cn('font-bold leading-none truncate w-full text-center',
          compacta ? 'text-[9px]' : 'text-[10px]')}
        style={{ color }}
      >
        {compacta ? elOtro : abrevAsignatura(clase.asignatura)}
      </span>
      <span className={cn('leading-none truncate w-full text-center text-muted',
        compacta ? 'text-[8px]' : 'text-[9px]')}
      >
        {compacta ? abrevAsignatura(clase.asignatura) : elOtro}
      </span>
    </div>
  );
}

function Celda({
  fila, dia, bloque, reservada, permitida, arrastrando, alto, separa, children,
}: {
  fila: string; dia: string; bloque: number;
  reservada: boolean; permitida: boolean; arrastrando: boolean;
  alto: string; separa?: boolean; children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: celdaId(fila, dia, bloque),
    disabled: reservada,
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        alto,
        separa && EMPIEZA_DIA,
        'rounded-md border border-dashed border-line transition',
        arrastrando && permitida && 'border-success bg-success-soft',
        isOver && permitida && 'ring-2 ring-success',
        isOver && !permitida && 'border-danger',
        reservada && 'bg-card/40 border-solid',
      )}
    >
      {reservada
        ? <div className="h-full flex items-center justify-center text-[8px] text-muted">CI</div>
        : children}
    </div>
  );
}

// --------------------------------------------------------------------------

export default function AjustarBorrador({ entrada, salida, onGuardar }: {
  entrada: EntradaGenerador;
  salida: SalidaGenerador;
  onGuardar: (horario: ClaseGenerada[]) => void;
}) {
  const original = salida.horario;
  const [horario, setHorario] = useState<ClaseGenerada[]>(() => original.map(c => ({ ...c })));
  const [rechazo, setRechazo] = useState<string | null>(null);
  const [avisoMovimiento, setAvisoMovimiento] = useState<string[]>([]);
  const [modo, setModo] = useState<Modo>('grupo');
  const [alcance, setAlcance] = useState<Alcance>('detalle');
  const [permitidas, setPermitidas] = useState<Set<string> | null>(null);

  const jornada = entrada.alcance.jornada;
  const dias = entrada.config.dias;
  const bloques = useMemo(
    () => Array.from({ length: entrada.config.bloques_por_jornada[jornada] }, (_, i) => i + 1),
    [entrada, jornada],
  );
  const franjaCI = entrada.config.centro_interes[jornada];
  const esCI = useCallback(
    (dia: string, bloque: number) => franjaCI?.dia === dia && franjaCI?.bloque === bloque,
    [franjaCI],
  );

  // Las filas del modo actual. Los docentes van por nombre, no por
  // identificador: la lista la lee una persona.
  const filas = useMemo(() => {
    if (modo === 'grupo') {
      return [...new Set(horario.map(c => c.grado))].sort()
        .map(id => ({ id, etiqueta: id }));
    }
    return [...new Set(horario.map(c => c.docente))]
      .map(id => ({ id, etiqueta: nombreDocente(id) }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta));
  }, [horario, modo]);

  const [elegida, setElegida] = useState('');
  const filaVisible = filas.some(f => f.id === elegida) ? elegida : (filas[0]?.id ?? '');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  // El resumen de cambios se calcula comparando con el horario generado, no
  // llevando un registro de lo que se hizo: así no se desincroniza si el
  // coordinador deshace un movimiento devolviendo la ficha a su sitio.
  const movidas = useMemo(() => franjasCambiadas(original, horario), [original, horario]);

  // Solo se cuenta lo que ESTE ajuste rompió. El borrador puede venir ya con
  // problemas --por ejemplo si se generó con una asignación distinta de la que
  // hoy tiene la app-- y achacárselos al coordinador que acaba de mover una
  // clase sería mentirle, además de enseñarle a ignorar el contador.
  const huella = (v: { tipo: string; mensaje: string }) => `${v.tipo}|${v.mensaje}`;
  const yaVenian = useMemo(
    () => new Set(validar(entrada, original).map(huella)),
    [entrada, original],
  );
  const violaciones = useMemo(() => validar(entrada, horario), [entrada, horario]);
  const nuevas = violaciones.filter(v => !yaVenian.has(huella(v)));
  const graves = duras(nuevas);
  const avisosDelHorario = soloAvisos(nuevas);
  const heredadas = yaVenian.size;

  /**
   * Al levantar una clase se calcula dónde cabe, y esas horas se marcan.
   *
   * Son treinta comprobaciones, que no cuestan nada, y le ahorran al coordinador
   * ir probando una por una a ver cuál le deja. Es la parte que convierte esto
   * en una herramienta para organizar y no en un juego de adivinanzas.
   */
  const alEmpezar = useCallback((evento: DragStartEvent) => {
    setRechazo(null);
    setAvisoMovimiento([]);
    const indice = Number(String(evento.active.id).split(':')[0]);
    const clase = horario[indice];
    if (!clase) return;
    const fila = filaDe(clase, modo);
    const libres = new Set<string>();
    for (const dia of dias) {
      for (const bloque of bloques) {
        if (esCI(dia, bloque)) continue;
        if (puedeColocar(entrada, horario, clase, { dia, bloque }, nombreDocente).permitido) {
          libres.add(celdaId(fila, dia, bloque));
        }
      }
    }
    setPermitidas(libres);
  }, [entrada, horario, modo, dias, bloques, esCI]);

  const alSoltar = useCallback((evento: DragEndEvent) => {
    setPermitidas(null);
    const destino = leerCeldaId(String(evento.over?.id ?? ''));
    if (!destino) return;

    const indice = Number(String(evento.active.id).split(':')[0]);
    const clase = horario[indice];
    if (!clase) return;

    // Cambiar de fila no es mover el horario: en la vista por grupo sería
    // cambiarle el grupo a la clase, y en la de docente, el profesor. Eso es la
    // asignación académica, que se decide en otra parte y no arrastrando aquí.
    if (destino.fila !== filaDe(clase, modo)) {
      setRechazo(modo === 'grupo'
        ? `Esa clase es de ${clase.grado}. Aquí se cambia la hora, no el grupo: `
          + 'quién le da clase a quién es la asignación académica.'
        : `Esa clase es de ${nombreDocente(clase.docente)}. Aquí se cambia la hora, `
          + 'no el docente: quién dicta cada materia es la asignación académica.');
      return;
    }
    if (clase.dia === destino.dia && clase.bloque === destino.bloque) return;

    const veredicto = puedeColocar(
      entrada, horario, clase,
      { dia: destino.dia as Dia, bloque: destino.bloque }, nombreDocente);
    if (!veredicto.permitido) {
      setRechazo(veredicto.motivo ?? 'No se puede mover ahí.');
      return;
    }
    setRechazo(null);
    setAvisoMovimiento(veredicto.avisos);
    setHorario(previo => previo.map((c, i) => (
      i === indice
        ? { ...c, dia: destino.dia as Dia, bloque: destino.bloque as ClaseGenerada['bloque'] }
        : c
    )));
  }, [entrada, horario, modo]);

  const deshacer = useCallback(() => {
    setHorario(original.map(c => ({ ...c })));
    setRechazo(null);
    setAvisoMovimiento([]);
  }, [original]);

  const conIndice = horario.map((c, i) => ({ clase: c, id: idDeFicha(c, i), indice: i }));
  const claseEn = (fila: string, dia: string, bloque: number) => conIndice.find(
    x => filaDe(x.clase, modo) === fila && x.clase.dia === dia && x.clase.bloque === bloque,
  );

  const arrastrando = permitidas !== null;
  const cabe = (fila: string, dia: string, bloque: number) =>
    permitidas?.has(celdaId(fila, dia, bloque)) ?? false;

  const Pastilla = ({ activa, onClick, children }: {
    activa: boolean; onClick: () => void; children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      className={cn(
        'rounded-lg border px-2.5 py-1 text-xs transition',
        activa
          ? 'border-accent bg-accent text-accent-fg font-medium'
          : 'border-line bg-card text-strong hover:bg-hover',
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <h3 className="text-strong text-base font-semibold">Ajustar el borrador</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={deshacer}
            disabled={movidas.size === 0}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5',
              'text-xs font-medium transition',
              movidas.size === 0
                ? 'text-muted opacity-50 cursor-not-allowed'
                : 'text-strong hover:bg-hover',
            )}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Deshacer todo
          </button>
          <button
            onClick={() => onGuardar(horario)}
            disabled={movidas.size === 0}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition',
              movidas.size === 0
                ? 'bg-card border border-line text-muted cursor-not-allowed'
                : 'bg-accent text-accent-fg hover:opacity-90',
            )}
          >
            <Save className="w-3.5 h-3.5" /> Guardar como versión nueva
          </button>
        </div>
      </div>
      <p className="text-muted text-sm mb-4">
        Arrastra una clase a otra hora. Al levantarla se marcan en verde las horas donde
        cabe. Si el cambio deja a alguien en dos sitios a la vez, no se hace y se dice
        quién estorba.
      </p>

      {rechazo && (
        <div className="rounded-xl border border-danger-soft bg-danger-soft px-4 py-2.5 mb-3
                        flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-danger-soft-fg flex-shrink-0 mt-0.5" />
          <p className="text-danger-soft-fg text-sm">{rechazo}</p>
        </div>
      )}

      {avisoMovimiento.length > 0 && (
        <div className="rounded-xl border border-line bg-hover px-4 py-2.5 mb-3">
          {avisoMovimiento.map((a, i) => (
            <p key={i} className="text-muted text-sm">⚠ {a}</p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-muted text-xs">Ver</span>
        <Pastilla activa={modo === 'grupo'} onClick={() => setModo('grupo')}>por grupo</Pastilla>
        <Pastilla activa={modo === 'docente'} onClick={() => setModo('docente')}>
          por docente
        </Pastilla>
        <span className="w-px h-5 bg-line mx-1" />
        <Pastilla activa={alcance === 'detalle'} onClick={() => setAlcance('detalle')}>
          uno a uno
        </Pastilla>
        <Pastilla activa={alcance === 'general'} onClick={() => setAlcance('general')}>
          vista general
        </Pastilla>
      </div>

      {alcance === 'detalle' && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {filas.map(f => (
            <Pastilla key={f.id} activa={f.id === filaVisible} onClick={() => setElegida(f.id)}>
              {f.etiqueta}
            </Pastilla>
          ))}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={alEmpezar}
        onDragEnd={alSoltar}
        onDragCancel={() => setPermitidas(null)}
      >
        {alcance === 'detalle' ? (
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `2.5rem repeat(${dias.length}, minmax(0, 1fr))` }}
          >
            <div />
            {dias.map(d => (
              <div key={d} className="text-muted text-[11px] font-medium text-center pb-1">
                {NOMBRE_DIA[d] ?? d}
              </div>
            ))}
            {bloques.map(b => (
              <Fragment key={b}>
                <div className="text-muted text-[11px] flex items-center justify-center">
                  {b}.ª
                </div>
                {dias.map(dia => {
                  const aqui = claseEn(filaVisible, dia, b);
                  return (
                    <Celda
                      key={dia}
                      fila={filaVisible}
                      dia={dia}
                      bloque={b}
                      reservada={esCI(dia, b)}
                      permitida={cabe(filaVisible, dia, b)}
                      arrastrando={arrastrando}
                      alto="h-14"
                    >
                      {aqui && (
                        <Ficha
                          id={aqui.id}
                          clase={aqui.clase}
                          movida={movidas.has(huellaEnFranja(aqui.clase))}
                          modo={modo}
                          compacta={false}
                        />
                      )}
                    </Celda>
                  );
                })}
              </Fragment>
            ))}
          </div>
        ) : (
          // La vista general es ancha por naturaleza: cinco días por seis horas.
          // Se deja desplazar en horizontal, como ya hacen las tablas de la
          // pantalla de Horario.
          <div className="overflow-x-auto pb-1">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns:
                  `5.5rem repeat(${dias.length * bloques.length}, minmax(3.2rem, 1fr))`,
                minWidth: `${5.5 + dias.length * bloques.length * 3.2
                  + (dias.length - 1) * 0.75}rem`,
              }}
            >
              <div className={COLUMNA_FIJA} />
              {dias.map((d, i) => (
                <div
                  key={d}
                  className={cn('text-strong text-[11px] font-semibold text-center pb-0.5',
                    'border-b border-line', i > 0 && EMPIEZA_DIA)}
                  style={{ gridColumn: `span ${bloques.length}` }}
                >
                  {NOMBRE_DIA[d] ?? d}
                </div>
              ))}

              <div className={COLUMNA_FIJA} />
              {dias.map((d, i) => bloques.map((b, j) => (
                <div
                  key={`${d}-${b}`}
                  className={cn('text-muted text-[10px] text-center pb-1',
                    i > 0 && j === 0 && EMPIEZA_DIA)}
                >
                  {b}
                </div>
              )))}

              {filas.map(f => (
                <Fragment key={f.id}>
                  <div className={cn(COLUMNA_FIJA,
                    'text-strong text-[11px] font-medium flex items-center truncate')}>
                    {f.etiqueta}
                  </div>
                  {dias.map((dia, i) => bloques.map((b, j) => {
                    const aqui = claseEn(f.id, dia, b);
                    return (
                      <Celda
                        key={`${dia}-${b}`}
                        fila={f.id}
                        dia={dia}
                        bloque={b}
                        reservada={esCI(dia, b)}
                        permitida={cabe(f.id, dia, b)}
                        arrastrando={arrastrando}
                        alto="h-10"
                        separa={i > 0 && j === 0}
                      >
                        {aqui && (
                          <Ficha
                            id={aqui.id}
                            clase={aqui.clase}
                            movida={movidas.has(huellaEnFranja(aqui.clase))}
                            modo={modo}
                            compacta
                          />
                        )}
                      </Celda>
                    );
                  }))}
                </Fragment>
              ))}
            </div>
          </div>
        )}
      </DndContext>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        <span className="text-muted">
          Clases movidas: <span className="text-strong font-medium">{movidas.size}</span>
        </span>
        <span className={graves.length ? 'text-danger-soft-fg' : 'text-muted'}>
          Problemas causados por el ajuste: <span className="font-medium">{graves.length}</span>
        </span>
        {avisosDelHorario.length > 0 && (
          <span className="text-muted">
            Avisos de salón: <span className="font-medium">{avisosDelHorario.length}</span>
          </span>
        )}
        {heredadas > 0 && (
          <span className="text-muted">
            El borrador ya traía <span className="font-medium">{heredadas}</span> desde antes
          </span>
        )}
      </div>

      {graves.length > 0 && (
        // No debería llegar a ocurrir: un movimiento que rompe algo se rechaza
        // antes de hacerse. Si aparece aquí, es que hay un caso que la
        // comprobación de un solo movimiento no vio, y conviene enterarse.
        <ul className="mt-2 text-danger-soft-fg text-xs list-disc pl-5 space-y-0.5">
          {graves.slice(0, 5).map((v, i) => <li key={i}>{v.mensaje}</li>)}
          {graves.length > 5 && <li>… y {graves.length - 5} más.</li>}
        </ul>
      )}
    </div>
  );
}
