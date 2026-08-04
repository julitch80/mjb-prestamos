import { useEffect, useState } from 'react';
import { urlDeFoto } from './fotos';
import type { Student } from './domain/types';

/**
 * Fotografia del estudiante junto a su nombre.
 *
 * Muestra las iniciales de inmediato y resuelve la URL de la foto despues, si la hay:
 * asi la planilla se dibuja al instante y las fotos van apareciendo, en vez de dejar la
 * pantalla en blanco esperando treinta descargas.
 *
 * Las URL resueltas se guardan en una cache de modulo. Sin ella, cada vez que la
 * planilla se redibuja —y se redibuja en cada marca— se pediria de nuevo la URL de los
 * treinta estudiantes.
 */
const CACHE = new Map<string, string | null>();

export default function Avatar({
  estudiante,
  tamano = 32,
}: {
  estudiante: Pick<Student, 'studentId' | 'nombres' | 'apellidos' | 'fotoPath'>;
  tamano?: number;
}) {
  const [url, setUrl] = useState<string | null>(
    () => CACHE.get(estudiante.studentId) ?? null,
  );

  useEffect(() => {
    if (!estudiante.fotoPath) return;
    if (CACHE.has(estudiante.studentId)) {
      setUrl(CACHE.get(estudiante.studentId) ?? null);
      return;
    }
    let vivo = true;
    void urlDeFoto(estudiante.studentId).then((u) => {
      CACHE.set(estudiante.studentId, u);
      if (vivo) setUrl(u);
    });
    return () => {
      vivo = false;
    };
  }, [estudiante.studentId, estudiante.fotoPath]);

  const estilo = { width: tamano, height: tamano };

  if (url) {
    return (
      <img
        src={url}
        alt=""
        aria-hidden
        style={estilo}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }

  const iniciales =
    (estudiante.nombres[0] ?? '').toUpperCase() + (estudiante.apellidos[0] ?? '').toUpperCase();

  return (
    <span
      style={estilo}
      className="grid shrink-0 place-items-center rounded-full border border-dashed border-line-strong bg-elevated text-[0.6rem] font-bold text-muted"
      title={estudiante.fotoPath ? 'Cargando fotografía…' : 'Sin fotografía cargada'}
      aria-hidden
    >
      {iniciales}
    </span>
  );
}
