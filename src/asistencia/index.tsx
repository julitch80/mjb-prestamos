import { useMemo, useState } from 'react';
import Planilla from './Planilla';
import { sessionId as construirSessionId } from './domain/ids';
import type { MarkCode } from './domain/marks';
import type { Enrollment, Session, Student } from './domain/types';
import { useAppStore } from '../data/store';

/**
 * Componente raiz del modulo de asistencia. ESTE es el punto de pegado.
 *
 * Se exporta por defecto y no recibe props obligatorias, como pide el contrato. En MJB
 * se enchufa con `{vistaActual === 'asistencia' && <Asistencia />}`; la navegacion
 * interna se hace con estado local, nunca con URLs.
 *
 * PENDIENTE: conectar con Firestore. Hoy trabaja sobre un conjunto en memoria para que
 * la pantalla se pueda ver y probar. Al conectar, recordar dos cosas:
 *   1. `await esperarAuth()` antes de la primera lectura.
 *   2. Las consultas van SIEMPRE filtradas — `where('slotId','==',<el propio>)` para un
 *      docente, `where('grado','==',<el suyo>)` para un director. Firestore rechaza la
 *      consulta entera si no puede probar que todo el resultado sera legible, aunque el
 *      usuario tuviera derecho a cada documento por separado.
 *   3. Las escrituras al mapa van con rutas de campo puntuales
 *      (`estudiantes.est_0412.estado`), jamas reemplazando el mapa completo, y el autor
 *      sale de `exigirAutor()` de ./identidad, nunca del store.
 */
export default function Asistencia() {
  const rol = useAppStore((s) => s.rol);
  const sede = useAppStore((s) => s.sedeActual);

  // La rectora consulta pero no registra (decision de Julian, 2026-07-30). El servidor
  // ya lo impide; esto solo evita ofrecerle botones que fallarian.
  const puedeRegistrar = rol !== 'rectora' && rol !== 'superusuario';

  const [datos, setDatos] = useState(() => conjuntoDeMuestra(sede));

  const grado = '6º1';
  const asignatura = 'MAT';

  const sesiones = useMemo(
    () => datos.sesiones.filter((s) => s.grado === grado && s.subjectId === asignatura),
    [datos.sesiones],
  );

  function marcar(sessionId: string, studentId: string, estado: MarkCode) {
    setDatos((prev) => ({
      ...prev,
      sesiones: prev.sesiones.map((s) =>
        s.sessionId !== sessionId
          ? s
          : {
              ...s,
              estudiantes: {
                ...s.estudiantes,
                [studentId]: {
                  estado,
                  registradoPor: 'pendiente@local',
                  registradoEn: Date.now(),
                  motivo: null,
                  observacion: null,
                  modificadoPor: null,
                  modificadoEn: null,
                },
              },
            },
      ),
    }));
  }

  function cerrarSesion(sessionId: string, sinRegistrar: number) {
    const ok = window.confirm(
      sinRegistrar > 0
        ? `Quedan ${sinRegistrar} casillas SIN REGISTRAR. Al cerrar NO se convierten en ` +
          'ausencias: siguen contando como sin registrar.\n\n¿Cerrar de todos modos?'
        : '¿Cerrar la sesión de clase?',
    );
    if (!ok) return;
    setDatos((prev) => ({
      ...prev,
      sesiones: prev.sesiones.map((s) =>
        s.sessionId === sessionId ? { ...s, closed: true } : s,
      ),
    }));
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-warning-soft bg-warning-soft p-3 text-sm text-warning-soft-fg">
        <strong>Vista previa con datos ficticios.</strong> La planilla todavía no está
        conectada a Firestore: lo que registre aquí no se guarda en ninguna parte y
        ningún dato real de estudiantes está involucrado.
      </div>

      <Planilla
        grado={grado}
        asignatura={asignatura}
        estudiantes={datos.estudiantes}
        sesiones={sesiones}
        matriculas={datos.matriculas}
        puedeRegistrar={puedeRegistrar}
        onMarcar={marcar}
        onCerrarSesion={cerrarSesion}
        onAbrirFicha={(id) => window.alert(`Ficha de ${id} — pendiente de construir.`)}
        onNuevaSesion={() => window.alert('Crear sesión — pendiente de conectar.')}
      />
    </div>
  );
}

/** Conjunto ficticio para poder ver la pantalla. Se elimina al conectar Firestore. */
function conjuntoDeMuestra(sede: string): {
  estudiantes: Student[];
  sesiones: Session[];
  matriculas: Enrollment[];
} {
  const nombres = [
    ['Ficticia Prueba', 'Ana Lucia'],
    ['Demo Ejemplo', 'Brayan Steven'],
    ['Muestra Simulada', 'Camila Andrea'],
    ['Ejemplo Demo', 'Daniel Felipe'],
    ['Inventado Falso', 'Estefania'],
    ['Figurado Ilustrativo', 'Fabian Andres'],
  ];

  const estudiantes: Student[] = nombres.map(([apellidos, nombresPila], i) => ({
    studentId: `est_${String(i + 1).padStart(4, '0')}`,
    nombres: nombresPila,
    apellidos,
    docHash: `hash-demo-${i}`,
    docType: 'TI',
    acudiente: 'Acudiente Ficticio',
    telefonos: ['3000000000'],
    fotoPath: null,
    qrToken: `TOKENDEMO${i}`,
    sede: 'central',
    gradoActual: '6º1',
    activo: true,
  }));

  const marcas: (MarkCode | null)[][] = [
    ['ausencia_justificada', 'ausencia', 'asistencia', 'asistencia'],
    ['asistencia', 'asistencia', 'retraso', 'asistencia'],
    ['asistencia', null, 'asistencia', 'asistencia'],
    ['ausencia', 'ausencia', 'ausencia', 'asistencia'],
    ['asistencia', 'asistencia', 'asistencia', null],
    ['evasion', 'asistencia', 'asistencia', 'asistencia'],
  ];

  const fechas = ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16'];
  const sesiones: Session[] = fechas.map((fecha, col) => {
    const estudiantesMapa: Session['estudiantes'] = {};
    estudiantes.forEach((e, fila) => {
      const estado = marcas[fila][col];
      if (!estado) return;
      estudiantesMapa[e.studentId] = {
        estado,
        registradoPor: 'julian.medina@iemanueljbetancur.edu.co',
        registradoEn: 0,
        motivo: null,
        observacion: null,
        modificadoPor: null,
        modificadoEn: null,
      };
    });
    return {
      sessionId: construirSessionId('central', '6º1', fecha, 3),
      grado: '6º1',
      jornada: 'tarde',
      sede: (sede as Session['sede']) ?? 'central',
      fecha,
      bloque: 3,
      subjectId: 'MAT',
      slotId: 'julian',
      createdBy: 'julian.medina@iemanueljbetancur.edu.co',
      createdAt: 0,
      closed: col < 2,
      closedBy: null,
      closedAt: null,
      estudiantes: estudiantesMapa,
      ultimaEscrituraPor: 'julian.medina@iemanueljbetancur.edu.co',
      ultimaEscrituraEn: 0,
    };
  });

  const matriculas: Enrollment[] = estudiantes.map((e) => ({
    studentId: e.studentId,
    anio: 2026,
    grado: '6º1',
    seq: 1,
    desde: '2026-01-20',
    hasta: null,
  }));

  return { estudiantes, sesiones, matriculas };
}
