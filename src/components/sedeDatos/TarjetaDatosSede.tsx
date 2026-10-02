// Aviso en el inicio: coordinador de sede (avance de su formulario) y superusuario (indicador de envíos).
import { useEffect, useState } from 'react';
import { useAppStore } from '../../data/store';
import { firebaseConfigurado } from '../../lib/firebase';
import { calcularAvance } from '../../data/sedeDatos/avance';
import { escucharSedeDatos } from '../../data/sedeDatos/persistencia';
import { NOMBRE_SEDE, sedesDeUsuario, temasDeSede } from '../../data/sedeDatos/temas';
import type { SedeDatosDoc, SedeDatosId } from '../../data/sedeDatos/tipos';
import { fechaDeTimestamp } from './ResumenSedeDatos';

function Fila({ sede, verEnviados }: { sede: SedeDatosId; verEnviados: boolean }) {
  const [doc, setDoc] = useState<SedeDatosDoc | null | undefined>(undefined);
  useEffect(() => escucharSedeDatos(sede, setDoc), [sede]);
  if (doc === undefined) return null;
  const av = calcularAvance(temasDeSede(sede), doc?.respuestas ?? {});
  if (verEnviados) {
    return (
      <p className="text-sm text-strong">
        <b>{NOMBRE_SEDE[sede]}</b>: {doc?.enviadoEn ? `enviado ${fechaDeTimestamp(doc.enviadoEn)}` : 'sin enviar'} · {av.hechos} de {av.total} temas
      </p>
    );
  }
  return (
    <p className="text-sm text-soft">
      {NOMBRE_SEDE[sede]} · avance <b className="text-strong">{av.hechos} de {av.total}</b>
    </p>
  );
}

export default function TarjetaDatosSede() {
  const { userId, rol, setVistaActual } = useAppStore();
  const sedes = sedesDeUsuario(userId, rol);
  if (!firebaseConfigurado || sedes.length === 0) return null;
  const esSuper = rol === 'superusuario';
  return (
    <section className="rounded-xl border border-line bg-card px-4 py-4 space-y-2">
      <h2 className="text-sm font-semibold text-strong">
        {esSuper ? 'Datos de las sedes' : 'Datos de su sede — unos 10 minutos'}
      </h2>
      {!esSuper && <p className="text-xs text-muted">Lo que no tenga, déjelo para después.</p>}
      {sedes.map(s => <Fila key={s} sede={s} verEnviados={esSuper} />)}
      <button type="button" onClick={() => setVistaActual('sede_datos' as never)}
        className="min-h-[44px] px-4 rounded-lg bg-accent text-accent-fg text-sm font-medium">
        {esSuper ? 'Ver respuestas' : 'Abrir'}
      </button>
    </section>
  );
}
