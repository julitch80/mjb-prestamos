// «Cifras de uso» (superusuario): solo CONTEOS agregados, nunca documentos.
// Se hace con el Admin SDK porque las reglas de Firestore dejan fuera al superusuario
// de varios módulos (asistencia, casos de permanencia, etc.) y no se amplían por esto.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, type Query, type Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

export type Cifra = {
  id: string;
  grupo: string;
  etiqueta: string;
  valor: number | null;
  nota?: string; // razón si no está disponible
};

type Def = { id: string; grupo: string; etiqueta: string; q: (db: Firestore) => Query };

const DIA = 86_400_000;

function defs(ahora: number): Def[] {
  const hace30 = ahora - 30 * DIA;
  const col = (grupo: string, id: string, etiqueta: string, n: string): Def => ({
    id, grupo, etiqueta, q: (db) => db.collection(n),
  });
  const grp = (grupo: string, id: string, etiqueta: string, n: string): Def => ({
    id, grupo, etiqueta, q: (db) => db.collectionGroup(n),
  });
  return [
    col('Usuarios', 'users', 'Usuarios registrados', 'users'),
    { id: 'users_activos', grupo: 'Usuarios', etiqueta: 'Usuarios con cuenta activa', q: (db) => db.collection('users').where('active', '==', true) },
    col('Asistencia', 'sesiones', 'Sesiones de asistencia (total)', 'asistenciaSessions'),
    { id: 'sesiones30', grupo: 'Asistencia', etiqueta: 'Sesiones de asistencia (últimos 30 días)', q: (db) => db.collection('asistenciaSessions').where('createdAt', '>=', hace30) },
    col('Asistencia', 'estudiantes', 'Estudiantes en el sistema', 'asistenciaStudents'),
    col('Asistencia', 'tarde', 'Llegadas tarde registradas', 'asistenciaLateArrivals'),
    col('Asistencia', 'alertas', 'Alertas académicas generadas', 'asistenciaAlertas'),
    col('Asistencia', 'citaciones', 'Citaciones de alerta', 'asistenciaCitacionesAlerta'),
    col('Asistencia', 'avisos', 'Avisos a familias', 'asistenciaAvisos'),
    col('Asistencia', 'evasiones', 'Avisos de evasión', 'asistenciaEvasiones'),
    col('Asistencia', 'eventos', 'Eventos de asistencia', 'asistenciaEvents'),
    col('Guardianes de la Permanencia', 'casos', 'Casos registrados', 'asistenciaCasosPermanencia'),
    grp('Guardianes de la Permanencia', 'seguimientos', 'Seguimientos registrados', 'seguimientos'),
    col('Restaurante', 'rest_reg', 'Registros diarios', 'asistenciaRestaurante'),
    col('Restaurante', 'rest_ins', 'Inscritos', 'asistenciaRestauranteInscritos'),
    col('Centros de interés', 'programas', 'Programas / semestres', 'asistenciaProgramas'),
    grp('Centros de interés', 'centros', 'Centros (grupos)', 'grupos'),
    col('Centros de interés', 'inscripciones', 'Inscripciones de estudiantes', 'asistenciaEnrollments'),
    col('Plan Académico Especial', 'planes', 'Planes en casa', 'planesCasa'),
    grp('Plan Académico Especial', 'guias', 'Guías', 'guias'),
    grp('Plan Académico Especial', 'entregas', 'Entregas recibidas', 'entregas'),
    col('Plan Académico Especial', 'consultas', 'Consultas de familias', 'planesCasaConsultas'),
    col('Chat', 'canales', 'Canales', 'channels'),
    grp('Chat', 'mensajes', 'Mensajes', 'messages'),
    col('Otros módulos', 'simulacros', 'Simulacros', 'simulacros'),
    col('Otros módulos', 'reemplazos', 'Reemplazos temporales', 'reemplazosTemporales'),
    col('Otros módulos', 'calendario', 'Calendarios académicos', 'calendarioAcademico'),
    col('Otros módulos', 'sst', 'Reportes de accidentes (SST)', 'sstAccidentes'),
    col('Otros módulos', 'acomp', 'Acompañamientos publicados', 'acompanamientosPublicaciones'),
    col('Otros módulos', 'classroom', 'Tareas vinculadas a Classroom', 'classroomTareas'),
    grp('Otros módulos', 'dispositivos', 'Dispositivos con notificaciones', 'items'),
    col('Otros módulos', 'auditoria', 'Registros de auditoría', 'auditLogs'),
  ];
}

export const cifrasUso = onCall(
  { region: 'us-central1', timeoutSeconds: 120, invoker: 'public' },
  async (request) => {
    const email = (request.auth?.token?.email ?? '').toLowerCase();
    if (!request.auth || !email) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    const db = getFirestore();
    const snap = await db.doc(`users/${email}`).get();
    if (!snap.exists || snap.get('role') !== 'superusuario' || snap.get('active') !== true) {
      throw new HttpsError('permission-denied', 'Solo el superusuario puede ver las cifras de uso.');
    }

    const ahora = Date.now();
    const cifras: Cifra[] = await Promise.all(
      defs(ahora).map(async (d): Promise<Cifra> => {
        try {
          const r = await d.q(db).count().get();
          return { id: d.id, grupo: d.grupo, etiqueta: d.etiqueta, valor: r.data().count };
        } catch (e) {
          return { id: d.id, grupo: d.grupo, etiqueta: d.etiqueta, valor: null, nota: (e as Error).message.slice(0, 120) };
        }
      }),
    );

    // Último acceso: lo da Firebase Auth (lastSignInTime), no un campo propio.
    let acceso: Cifra[];
    try {
      let total = 0, d7 = 0, d30 = 0;
      let token: string | undefined;
      do {
        const page = await getAuth().listUsers(1000, token);
        for (const u of page.users) {
          total++;
          const t = Date.parse(u.metadata.lastSignInTime ?? '');
          if (!Number.isNaN(t)) {
            if (ahora - t <= 7 * DIA) d7++;
            if (ahora - t <= 30 * DIA) d30++;
          }
        }
        token = page.pageToken;
      } while (token);
      acceso = [
        { id: 'auth_total', grupo: 'Usuarios', etiqueta: 'Cuentas que han ingresado alguna vez', valor: total },
        { id: 'auth_7', grupo: 'Usuarios', etiqueta: 'Activos en los últimos 7 días', valor: d7 },
        { id: 'auth_30', grupo: 'Usuarios', etiqueta: 'Activos en los últimos 30 días', valor: d30 },
      ];
    } catch (e) {
      const nota = (e as Error).message.slice(0, 120);
      acceso = ['Activos en los últimos 7 días', 'Activos en los últimos 30 días'].map((etiqueta, i) => (
        { id: `auth_${i}`, grupo: 'Usuarios', etiqueta, valor: null, nota }));
    }

    return { generadoEn: ahora, cifras: [...cifras.slice(0, 2), ...acceso, ...cifras.slice(2)] };
  },
);
