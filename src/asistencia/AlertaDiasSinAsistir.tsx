import { useEffect, useState } from 'react';
import { leerConfigAlertas, leerEstudiante, leerSesionesDeJornadaPorDias } from './datos';
import { addDays } from './domain/ids';
import { nombreCompleto } from './domain/nombres';
import {
  ALERT_CONFIG_POR_DEFECTO,
  activaAlertaDiasSinAsistir,
  diasSinAsistirConsecutivos,
} from './domain/alertas';
import type { AlertConfig, Jornada } from './domain/types';
import { colorGrado } from '../data/maestros';

/**
 * Alerta institucional: estudiantes con `diasSinAsistir` o mas dias seguidos sin asistir
 * a NINGUNA clase.
 *
 * Vivia en Llegadas tarde, donde no tenia nada que ver: la llegada tarde es de la puerta,
 * y esto es de ausentes y familias. Julián la movio al paso 2 de la tercera hora
 * (2026-09-25), que es donde la coordinadora ya esta llamando a las familias.
 *
 * Se consulta un dia a la vez y por jornada (`leerSesionesDeJornadaPorDias`): sirve igual
 * al coordinador acotado a una jornada —a quien la regla le rechaza la consulta de toda
 * la sede— que al de la sede entera. Ventana acotada (umbral + margen) para no traer todas
 * las sesiones desde siempre.
 */
export default function AlertaDiasSinAsistir({
  sede,
  fecha,
  jornada,
}: {
  sede: string;
  fecha: string;
  jornada: Jornada;
}) {
  const [config, setConfig] = useState<AlertConfig>(ALERT_CONFIG_POR_DEFECTO);
  const [alertas, setAlertas] = useState<
    { studentId: string; nombre: string; dias: number; grado: string | null }[]
  >([]);

  useEffect(() => {
    void leerConfigAlertas().then(setConfig);
  }, []);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const desde = addDays(fecha, -(config.diasSinAsistir + 4));
        const fechas: string[] = [];
        for (let d = desde; d <= fecha; d = addDays(d, 1)) fechas.push(d);
        const sesiones = await leerSesionesDeJornadaPorDias(sede, jornada, fechas);
        const ids = new Set<string>();
        for (const s of sesiones) for (const id of Object.keys(s.estudiantes ?? {})) ids.add(id);
        const candidatas = [...ids]
          .map((id) => ({ studentId: id, dias: diasSinAsistirConsecutivos(sesiones, id) }))
          .filter((a) => activaAlertaDiasSinAsistir(a.dias, config));
        if (!vivo) return;
        if (candidatas.length === 0) {
          setAlertas([]);
          return;
        }
        const fichas = await Promise.all(candidatas.map((a) => leerEstudiante(a.studentId)));
        if (!vivo) return;
        setAlertas(
          candidatas
            .map((a, i) => ({
              studentId: a.studentId,
              dias: a.dias,
              nombre: fichas[i] ? nombreCompleto(fichas[i]!) : a.studentId,
              grado: fichas[i]?.gradoActual ?? null,
            }))
            .sort((a, b) => b.dias - a.dias),
        );
      } catch {
        // Aviso adicional, no el trabajo de la pantalla: si falla, lo demas sigue.
        if (vivo) setAlertas([]);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [sede, fecha, jornada, config]);

  if (alertas.length === 0) return null;

  return (
    <section className="rounded-xl border border-danger-soft bg-danger-soft p-3">
      <h3 className="text-sm font-semibold text-danger-soft-fg">
        {alertas.length} estudiante(s) sin asistir {config.diasSinAsistir} días seguidos o más
      </h3>
      <p className="text-xs text-danger-soft-fg">
        Ninguna clase, en ningún bloque. Verifique con la familia qué ha informado y si hay
        ausencia proyectada. El número de días se ajusta en Llegadas tarde → Ajustar alertas.
      </p>
      <ul className="mt-2 space-y-1">
        {alertas.map((a) => (
          <li
            key={a.studentId}
            className="flex items-center gap-2 rounded-lg border border-line bg-card p-2 text-sm"
          >
            {a.grado && (
              <b style={{ color: colorGrado(a.grado) }} className="shrink-0">
                {a.grado}
              </b>
            )}
            <span className="min-w-0 flex-1 truncate text-strong">{a.nombre}</span>
            <span className="shrink-0 text-xs font-semibold text-danger-soft-fg">
              {a.dias} días seguidos
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
