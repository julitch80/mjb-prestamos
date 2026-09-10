import { textoAvisoEvasion, textoSinCenso } from './domain/evasion';

/**
 * El aviso de posible evasion, justo despues de que el docente pone la falta.
 *
 * UNA SOLA PANTALLA PARA LOS DOS SITIOS: la planilla de clase y la de un centro de
 * interes. El centro de interes es en la jornada escolar (Julian, 2026-09-09), asi que el
 * censo de la tercera hora vale igual en los dos y no hay razon para que el aviso se vea
 * ni se comporte distinto segun donde se marque.
 *
 * NO BLOQUEA NADA. La falta ya quedo registrada antes de que esto aparezca; aqui solo se
 * decide si ademas se reclasifica como evasion. Por eso «Dejar la falta» es una salida
 * legitima y no un «cancelar»: el docente puede saber algo que el sistema no sabe.
 *
 * ⚠️ LO QUE EL TEXTO DICE Y LO QUE NO. Afirma «no está entre los que se reportaron como
 * ausentes» —un hecho comprobable— y nunca «está en el colegio» —una deduccion que falla
 * con el que se fue para la casa despues de la tercera hora—. Esa diferencia es justo la
 * que resuelve el coordinador, que si sabe quien salio con permiso.
 */
export default function AvisoEvasion({
  nombre,
  grado,
  tipo,
  guardando,
  onMarcarEvasion,
  onDejarFalta,
}: {
  nombre: string;
  grado: string;
  /** `sin_censo`: no se paso lista a tercera hora, no hay con que cruzar. */
  tipo: 'posible_evasion' | 'sin_censo';
  /** Mientras se escribe la evasion y su aviso al coordinador. */
  guardando: boolean;
  onMarcarEvasion: () => void;
  onDejarFalta: () => void;
}) {
  const esAviso = tipo === 'posible_evasion';

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4">
      <div
        className={[
          'w-full max-w-md rounded-t-2xl border p-4 sm:rounded-2xl',
          esAviso ? 'border-warning-soft bg-warning-soft' : 'border-line bg-card',
        ].join(' ')}
      >
        <p
          className={[
            'text-sm font-semibold',
            esAviso ? 'text-warning-soft-fg' : 'text-strong',
          ].join(' ')}
        >
          {esAviso ? '⚠️ Posible evasión' : 'Sin lista de tercera hora'}
        </p>

        <p
          className={[
            'mt-1 text-sm',
            esAviso ? 'text-warning-soft-fg' : 'text-soft',
          ].join(' ')}
        >
          {esAviso ? textoAvisoEvasion(nombre, grado) : textoSinCenso(grado)}
        </p>

        {esAviso && (
          <p className="mt-2 text-xs text-warning-soft-fg opacity-90">
            Si la marca como evasión, le llega el aviso a coordinación: allá saben si salió
            con permiso, y si no, lo pueden ir a buscar.
          </p>
        )}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {esAviso && (
            <button
              onClick={onMarcarEvasion}
              disabled={guardando}
              className="min-h-[44px] flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-50"
            >
              {guardando ? 'Avisando a coordinación…' : 'Marcar como Evasión'}
            </button>
          )}
          <button
            onClick={onDejarFalta}
            disabled={guardando}
            className="min-h-[44px] flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm text-soft disabled:opacity-50"
          >
            {esAviso ? 'Dejar la falta' : 'Entendido'}
          </button>
        </div>
      </div>
    </div>
  );
}
