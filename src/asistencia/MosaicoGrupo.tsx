import { useEffect, useMemo, useState } from 'react';
import { Printer, X } from 'lucide-react';
import { mosaicoDe, faltantesDeFoto, ALTO_NOMBRE_MM } from './domain/mosaico';
import { iniciales, nombreCompleto, nombresDePila } from './domain/nombres';
import { urlDeFoto } from './fotos';
import { leerDirectores, leerMiCuenta, leerNombresDeDirectores } from './datos';
import { useAppStore } from '../data/store';
import type { Student } from './domain/types';

/**
 * Mosaico de fotos del grupo, para la CARATULA DEL OBSERVADOR FISICO.
 *
 * No es una pantalla de consulta: es una hoja tamaño oficio que se imprime una vez, se
 * mete en la carpeta del grupo y se queda todo el año en coordinacion. El requisito es
 * que se vea bien EN PAPEL; que se vea bien en el monitor es secundario.
 *
 * Tres decisiones que vienen de eso y no de gusto:
 *
 *  - **Se espera a que TODAS las fotos esten descargadas antes de dejar imprimir.** Una
 *    `<img>` que aun no cargo sale en blanco en el papel y nadie se entera hasta que la
 *    hoja esta fuera de la impresora. En pantalla eso se corrige recargando; en papel
 *    cuesta una hoja oficio. Por eso hay un "preparando…" y el boton nace deshabilitado.
 *
 *  - **Las fotos van en `<img>`, nunca como `background-image`.** Los navegadores no
 *    imprimen fondos CSS salvo que el usuario active «Gráficos de fondo» en el dialogo
 *    de impresion, y nadie lo hace. El ovalo se consigue con un contenedor
 *    `border-radius: 50%` + `overflow: hidden`: se ve igual y el color sobrevive.
 *
 *  - **La hoja va en blanco con texto negro, pero las FOTOS Y EL ESCUDO a todo color.**
 *    El tema oscuro de la aplicacion no debe llegar al papel (gasta tinta y sale
 *    ilegible), y por eso los colores se fijan literales aqui en vez de usar los tokens
 *    del tema. Nada de `grayscale`. `print-color-adjust: exact` es lo que evita que el
 *    navegador blanquee el escudo y los bordes al imprimir.
 *
 * DATOS DE MENORES: en esta hoja van SOLO foto y nombre. Ni documento, ni telefonos, ni
 * acudiente. Es un papel que circula por una oficina.
 */

/**
 * Identificador del contenedor imprimible. El CSS de impresion oculta TODO lo demas de
 * la pagina por `visibility`, que a diferencia de `display:none` conserva la maquetacion
 * de lo que si se imprime.
 */
const ID_IMPRIMIBLE = 'mosaico-para-imprimir';

/**
 * `import.meta.env.BASE_URL` sin depender de los tipos de Vite.
 *
 * En MJB este componente compila con `vite/client` cargado y la expresion es la misma
 * que usa `AgendaPublica.tsx` para el escudo. Aqui el tsconfig no incluye esos tipos, y
 * un `as any` seria peor: esto acota el ensanchamiento a la forma exacta que se lee.
 */
const BASE_URL =
  (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
const ESCUDO = `${BASE_URL}mjb_escudo.png`;

export interface MosaicoGrupoProps {
  /** Grado LITERAL tal como se escribe: `9.1` (mañana) o `6º1` (tarde). Nunca saneado. */
  grado: string;
  /** Se pinta bajo el grado cuando el mosaico no es de un grupo de clase (p. ej. un centro). */
  subtitulo?: string;
  estudiantes: Student[];
  /**
   * Año lectivo del encabezado. La caratula vive un año entero: sin el, la del año que
   * viene es indistinguible de la de este.
   */
  anio?: number;
  /**
   * Nombre del director de grupo, si el llamante ya lo tiene resuelto.
   *
   * Cuando no llega, el mosaico lo intenta: `asistenciaConfig/directores` da el PUESTO
   * (slotId) del grado, no un nombre, y en este modulo no hay ningun mapa puesto->nombre
   * —lo tiene MJB—. Asi que solo se puede rellenar solo cuando quien imprime ES el
   * director del grupo, tomando su nombre del store. En cualquier otro caso la linea
   * queda VACIA y editable: antes eso que estampar `julian` en la caratula de una
   * carpeta que va a coordinacion.
   */
  directorNombre?: string | null;
  onCerrar: () => void;
}

type Fase = 'preparando' | 'listo';

export default function MosaicoGrupo({
  grado,
  subtitulo,
  estudiantes,
  anio = new Date().getFullYear(),
  directorNombre,
  onCerrar,
}: MosaicoGrupoProps) {
  const nombreEnStore = useAppStore((s) => s.nombre);
  const [fase, setFase] = useState<Fase>('preparando');
  const [listas, setListas] = useState(0);
  /** studentId -> URL de la foto YA descargada. Sin entrada = va con iniciales. */
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [director, setDirector] = useState(directorNombre ?? '');

  /** Orden alfabetico por apellidos: es como se busca a alguien en una caratula. */
  const ordenados = useMemo(
    () =>
      [...estudiantes]
        .filter((e) => e.activo !== false)
        .sort((a, b) =>
          nombreCompleto(a).localeCompare(nombreCompleto(b), 'es', { sensitivity: 'base' }),
        ),
    [estudiantes],
  );

  const { rejilla, paginas } = useMemo(() => mosaicoDe(ordenados), [ordenados]);

  /**
   * Descarga de las fotos, en paralelo y esperando a que la imagen este DECODIFICADA:
   * tener la URL no basta, lo que sale en el papel es el pixel.
   */
  useEffect(() => {
    let vivo = true;
    setFase('preparando');
    setListas(0);
    if (ordenados.length === 0) {
      setFase('listo');
      return;
    }

    const conFoto = ordenados.filter((e) => e.fotoPath);

    async function traer(studentId: string): Promise<[string, string] | null> {
      const url = await urlDeFoto(studentId);
      if (!url) return null;
      await precargar(url);
      return [studentId, url];
    }

    void Promise.all(
      conFoto.map((e) =>
        traer(e.studentId)
          .catch(() => null)
          .then((r) => {
            if (vivo) setListas((n) => n + 1);
            return r;
          }),
      ),
    ).then((res) => {
      if (!vivo) return;
      const mapa: Record<string, string> = {};
      for (const r of res) if (r) mapa[r[0]] = r[1];
      setFotos(mapa);
      setFase('listo');
    });

    return () => {
      vivo = false;
    };
  }, [ordenados]);

  /**
   * El director, cuando el llamante no lo sabe.
   *
   * Se resuelve para CUALQUIERA que imprima, no solo para el propio director. Esa
   * distincion importa: la caratula del observador se imprime desde COORDINACION, que es
   * donde reposa la carpeta fisica. Autocompletar solo para el director habria dejado el
   * campo en blanco justo en el unico caso que ocurre de verdad.
   *
   * `leerNombresDeDirectores` cruza `asistenciaConfig/directores` (grado -> puesto) con
   * `users` (puesto -> nombre). Si no hay nombre, la linea queda VACIA y editable: un
   * identificador tecnico impreso en una caratula es peor que un espacio en blanco.
   */
  useEffect(() => {
    if (directorNombre !== undefined && directorNombre !== null) return;
    let vivo = true;
    void leerNombresDeDirectores()
      .then((mapa) => {
        if (!vivo) return;
        if (mapa[grado]) setDirector(mapa[grado]);
        else if (nombreEnStore) {
          // Ultimo recurso: si quien imprime ES el director de este grado, su propio
          // nombre sirve aunque el cruce con `users` no haya dado.
          void leerDirectores().then((m) => {
            void leerMiCuenta().then((c) => {
              if (vivo && m[grado] && c?.slotId === m[grado]) setDirector(nombreEnStore);
            });
          });
        }
      })
      .catch(() => {
        /* Sin permiso o sin sesion: la linea queda vacia, que es el comportamiento pedido. */
      });
    return () => {
      vivo = false;
    };
  }, [grado, directorNombre, nombreEnStore]);

  const sinFoto = faltantesDeFoto(ordenados, (e) => Boolean(fotos[e.studentId]));
  const puedeImprimir = fase === 'listo' && paginas.length > 0;

  return (
    <div
      className="mosaico-raiz fixed inset-0 z-50 overflow-auto p-4"
      /* Gris de visor de PDF, literal: es el fondo CONTRA el que se juzga si la hoja
         blanca quedo bien. Un token del tema lo pondria blanco sobre blanco en claro. */
      style={{ backgroundColor: '#525659' }}
    >
      <style>{CSS_MOSAICO}</style>

      {/* Barra de control. `mosaico-solo-pantalla` = no llega al papel. */}
      <div className="mosaico-solo-pantalla mx-auto mb-4 flex max-w-[216mm] flex-wrap items-center gap-2 rounded-xl bg-surface p-3">
        <h2 className="text-sm font-semibold text-strong">
          Mosaico del observador · {grado}
        </h2>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          Director(a) de grupo
          <input
            value={director}
            onChange={(ev) => setDirector(ev.target.value)}
            placeholder="Escriba el nombre"
            className="w-52 rounded-lg border border-line bg-elevated px-2 py-1 text-sm text-strong"
          />
        </label>
        <span className="grow" />
        {fase === 'preparando' && (
          <span className="text-xs text-muted">
            Preparando fotografías… {listas}/{ordenados.filter((e) => e.fotoPath).length}
          </span>
        )}
        <button
          onClick={() => window.print()}
          disabled={!puedeImprimir}
          className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg disabled:opacity-50"
        >
          <Printer size={16} aria-hidden />
          Imprimir
        </button>
        <button
          onClick={onCerrar}
          className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-strong"
        >
          <X size={16} aria-hidden />
          Cerrar
        </button>

        {/* El aviso va ANTES de imprimir, no despues: hoy la jornada de la tarde no tiene
            ninguna foto cargada y su mosaico saldria con cuarenta ovalos vacios. */}
        {fase === 'listo' && sinFoto > 0 && (
          <p className="w-full rounded-lg bg-warning-soft p-2 text-xs text-warning-soft-fg">
            Faltan <b>{sinFoto} fotografías</b> de {ordenados.length} estudiantes. Los que
            no tienen salen con sus iniciales. Si va a cargarlas, hágalo antes de gastar
            la hoja.
          </p>
        )}
        {paginas.length === 0 && (
          <p className="w-full rounded-lg bg-info-soft p-2 text-xs text-info-soft-fg">
            Este grupo no tiene estudiantes activos: no hay nada que imprimir.
          </p>
        )}
        {paginas.length > 1 && (
          <p className="w-full text-xs text-muted">
            El grupo no cabe en una hoja: son {paginas.length} hojas oficio.
          </p>
        )}
      </div>

      {/* Lo unico que llega al papel. */}
      <div id={ID_IMPRIMIBLE} className="mosaico-imprimible">
        {paginas.map((p) => (
          <section key={p.numero} className="mosaico-hoja">
            <header className="mosaico-encabezado">
              <img src={ESCUDO} alt="" className="mosaico-escudo" />
              <div className="mosaico-titulos">
                <h1 className="mosaico-grado">{grado}</h1>
                {subtitulo && <p className="mosaico-subtitulo">{subtitulo}</p>}
                <p className="mosaico-director">
                  {director.trim() ? `Director(a) de grupo: ${director.trim()}` : ' '}
                </p>
              </div>
              <div className="mosaico-anio">
                <span>{anio}</span>
                {p.total > 1 && (
                  <span className="mosaico-folio">
                    Hoja {p.numero} de {p.total}
                  </span>
                )}
              </div>
            </header>

            <div
              className="mosaico-rejilla"
              style={{ gridTemplateColumns: `repeat(${rejilla.columnas}, 1fr)` }}
            >
              {p.items.map((e) => (
                <figure key={e.studentId} className="mosaico-celda">
                  <div
                    className="mosaico-ovalo"
                    style={{ height: `${rejilla.altoOvaloMm}mm` }}
                  >
                    {fotos[e.studentId] ? (
                      <img src={fotos[e.studentId]} alt="" />
                    ) : (
                      <span className="mosaico-iniciales">{iniciales(e)}</span>
                    )}
                  </div>
                  <figcaption
                    className="mosaico-nombre"
                    style={{ height: `${ALTO_NOMBRE_MM}mm` }}
                    title={nombreCompleto(e)}
                  >
                    <span>{nombresDePila(e.apellidos, e.nombres)}</span>
                    <span>{e.apellidos}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/** Resuelve cuando el navegador ya tiene los pixeles; nunca rechaza (una foto rota no bloquea). */
function precargar(url: string): Promise<void> {
  return new Promise((resolver) => {
    const img = new Image();
    img.onload = () => resolver();
    img.onerror = () => resolver();
    img.src = url;
  });
}

/**
 * Estilos de la hoja. Van en un `<style>` y no en clases de Tailwind por dos razones que
 * no son estilisticas: `@page` no existe como utilidad, y los colores tienen que ser
 * LITERALES —no tokens del tema— para que el modo oscuro no llegue al papel.
 */
const CSS_MOSAICO = `
@page { size: 216mm 330mm; margin: 10mm; }

#${ID_IMPRIMIBLE} {
  color: #000;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
.mosaico-hoja {
  width: 216mm;
  padding: 10mm;
  margin: 0 auto 6mm;
  background: #fff;
  color: #000;
  box-sizing: border-box;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}
.mosaico-encabezado {
  display: flex;
  align-items: center;
  gap: 4mm;
  height: 26mm;
  border-bottom: 0.4mm solid #000;
  margin-bottom: 4mm;
}
.mosaico-escudo { width: 20mm; height: 20mm; object-fit: contain; }
.mosaico-titulos { flex: 1 1 auto; min-width: 0; }
.mosaico-grado { font-size: 11mm; line-height: 1.05; font-weight: 800; margin: 0; letter-spacing: 0.5mm; }
.mosaico-subtitulo { font-size: 3.6mm; margin: 0.6mm 0 0; }
.mosaico-director { font-size: 3.6mm; margin: 0.8mm 0 0; }
.mosaico-anio { text-align: right; font-size: 4.5mm; font-weight: 700; display: flex; flex-direction: column; gap: 1mm; }
.mosaico-folio { font-size: 3mm; font-weight: 400; }

.mosaico-rejilla { display: grid; gap: 2mm; }
.mosaico-celda { margin: 0; break-inside: avoid; page-break-inside: avoid; }

/* El ovalo: caja mas alta que ancha + radio del 50%. La foto va DENTRO como <img> para
   que se imprima siempre; un background-image se lo comeria el navegador. */
.mosaico-ovalo {
  width: 100%;
  border-radius: 50%;
  overflow: hidden;
  border: 0.35mm solid #333;
  background: #fff;
  display: grid;
  place-items: center;
}
.mosaico-ovalo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mosaico-iniciales { font-size: 5mm; font-weight: 700; color: #555; }

.mosaico-nombre {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  text-align: center;
  font-size: 2.4mm;
  line-height: 1.25;
  /* Sin margin-top: el aire va DENTRO de los 7 mm que domain/mosaico.ts reservo para el
     nombre. Un milimetro de mas por fila son seis al final de la hoja, y la ultima fila
     de ovalos se sale del papel. */
  padding-top: 0.8mm;
  box-sizing: border-box;
  overflow: hidden;
}
.mosaico-nombre span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mosaico-nombre span:last-child { font-weight: 700; }

@media print {
  /* Nada de la aplicacion llega al papel: ni el header de MJB, ni la planilla que quedo
     debajo, ni esta propia barra de botones. "visibility" y no "display" para no
     recalcular la maquetacion del mosaico. */
  body * { visibility: hidden !important; }
  #${ID_IMPRIMIBLE}, #${ID_IMPRIMIBLE} * { visibility: visible !important; }
  .mosaico-solo-pantalla, .mosaico-solo-pantalla * { display: none !important; }

  /* La capa flotante deja de flotar: un "position: fixed" en impresion se comporta de
     forma distinta en cada navegador —hay quien lo repite en todas las paginas— y aqui
     hacen falta saltos de pagina de verdad. */
  .mosaico-raiz {
    position: static !important;
    overflow: visible !important;
    padding: 0 !important;
    background: #fff !important;
  }
  #${ID_IMPRIMIBLE} { background: #fff !important; }
  .mosaico-hoja {
    width: auto;
    padding: 0;
    margin: 0;
    break-after: page;
    page-break-after: always;
  }
  .mosaico-hoja:last-child { break-after: auto; page-break-after: auto; }
}
`;
