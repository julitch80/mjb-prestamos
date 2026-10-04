import { useState } from 'react';
import type { ReactNode } from 'react';
import { MetronomoRcp } from './MetronomoRcp';
import { RespiracionGuiada } from './RespiracionGuiada';
import TomaPulso from './TomaPulso';
import { Bitacora } from './botiquin/Bitacora';
import { Convulsion } from './botiquin/Convulsion';
import { Respiraciones } from './botiquin/Respiraciones';
import { Quemaduras } from './botiquin/Quemaduras';
import { Ubicacion } from './botiquin/Ubicacion';
import { Linterna } from './botiquin/Linterna';
import { Instrucciones } from './botiquin/compartido';
import { FlechaNeon } from './FlechaNeon';

interface Herramienta {
  id: string;
  icono: string;
  nombre: string;
  cuando: string;
  pasos: string[];
  render: () => ReactNode;
}

// Orden por urgencia.
const HERRAMIENTAS: Herramienta[] = [
  {
    id: 'bitacora', icono: '📝', nombre: 'Bitácora de la emergencia',
    cuando: 'Desde que empieza la emergencia, para anotar horas exactas.',
    pasos: ['Pulse «Empezar» apenas ocurra el hecho: fija la hora 0.', 'Toque cada botón en el momento en que pase.', 'Al final, «Copiar bitácora» y entréguela a los paramédicos o péguela en el reporte.'],
    render: () => <Bitacora />,
  },
  {
    id: 'reanimacion', icono: '❤️‍🩹', nombre: 'Reanimación',
    cuando: 'No responde y no respira o no respira normal.',
    pasos: ['Llame al 123 o pida que lo hagan.', 'Manos al centro del pecho, comprima fuerte y rápido siguiendo el ritmo.', 'No pare hasta que lleguen los paramédicos o la persona reaccione.'],
    render: () => <MetronomoRcp />,
  },
  {
    id: 'convulsion', icono: '⚡', nombre: 'Cronómetro de convulsión',
    cuando: 'Alguien está convulsionando: mida cuánto dura.',
    pasos: ['Pulse «Empezó la convulsión» para medir el tiempo.', 'No meta nada en la boca ni lo sujete; retire objetos cercanos.', 'A los 5 minutos suena la alarma: llame al 123.'],
    render: () => <Convulsion />,
  },
  {
    id: 'pulso', icono: '💓', nombre: 'Tomar el pulso',
    cuando: 'Para saber si el corazón late a un ritmo normal.',
    pasos: ['Elija la edad de la persona.', 'Dos dedos en la muñeca o el cuello, persona en reposo.', 'Cuente los latidos hasta el pitido.'],
    render: () => <TomaPulso />,
  },
  {
    id: 'respiraciones', icono: '🫁', nombre: 'Contador de respiraciones',
    cuando: 'Respira muy rápido, muy lento o con esfuerzo.',
    pasos: ['Elija la edad de la persona.', 'Mire el pecho o el abdomen: subir y bajar es una respiración.', 'Toque la pantalla en cada respiración durante 30 segundos.'],
    render: () => <Respiraciones />,
  },
  {
    id: 'quemaduras', icono: '🔥', nombre: 'Quemaduras',
    cuando: 'Quemadura con calor, líquido caliente o fuego.',
    pasos: ['Agua fría del grifo 20 minutos; no hielo ni cremas.', 'Retire anillos y ropa no pegada.', 'Llame al 123 si es grande, en cara, manos, genitales, o por químicos o electricidad.'],
    render: () => <Quemaduras />,
  },
  {
    id: 'ubicacion', icono: '📍', nombre: 'Mi ubicación',
    cuando: 'Debe decirle al 123 dónde está.',
    pasos: ['Pulse «Obtener mi ubicación» y permita el acceso.', 'Lea las coordenadas al operador o envíe el enlace.', 'Salga a un lugar abierto si la precisión es baja.'],
    render: () => <Ubicacion />,
  },
  {
    id: 'linterna', icono: '🔦', nombre: 'Linterna',
    cuando: 'Hay poca luz para atender o buscar.',
    pasos: ['Pulse «Encender linterna» y permita la cámara.', 'Si no se puede, use la pantalla blanca.', 'Apáguela al terminar para liberar la cámara.'],
    render: () => <Linterna />,
  },
  {
    id: 'respiracion_guiada', icono: '🌬️', nombre: 'Respiración guiada',
    cuando: 'Para calmar a alguien (o a usted) en una crisis de angustia.',
    pasos: ['Hable con calma y siéntese al lado.', 'Elija una técnica y siga el círculo.', 'Respiren juntos hasta que baje la tensión.'],
    render: () => <RespiracionGuiada />,
  },
];

export function Botiquin({ onVolver }: { onVolver?: () => void }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const h = HERRAMIENTAS.find(x => x.id === abierta);

  return (
    <div className="flex flex-col gap-4">
      {onVolver && !h && (
        <button onClick={onVolver} className="self-start px-3 py-2 rounded-lg text-xs font-semibold text-soft border border-line bg-elevated hover:bg-hover transition group inline-flex items-center gap-1"><FlechaNeon direccion="izquierda" tamano="sm" /> Volver</button>
      )}

      {h ? (
        <section aria-labelledby="botiquin-herr" className="flex flex-col gap-4">
          <button onClick={() => setAbierta(null)} className="self-start min-h-[44px] px-4 rounded-lg text-sm font-semibold text-soft border border-line bg-elevated hover:bg-hover transition group inline-flex items-center gap-1"><FlechaNeon direccion="izquierda" tamano="sm" /> Botiquín</button>
          <h2 id="botiquin-herr" className="text-lg font-bold text-strong flex items-center gap-2"><span aria-hidden="true">{h.icono}</span>{h.nombre}</h2>
          <div className="rounded-xl border border-line bg-card px-4 py-3"><Instrucciones items={h.pasos} /></div>
          {h.render()}
        </section>
      ) : (
        <>
          <header>
            <h2 className="text-lg font-bold text-strong">🧰 Botiquín digital</h2>
            <p className="text-sm text-soft">Herramientas para atender una emergencia con el celular</p>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {HERRAMIENTAS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setAbierta(t.id)}
                className="w-full min-h-[88px] text-left rounded-2xl border border-line bg-card px-5 py-4 flex items-center gap-4 hover:bg-elevated active:bg-hover transition"
              >
                <span className="text-4xl leading-none flex-shrink-0" aria-hidden="true">{t.icono}</span>
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-strong text-base font-semibold">{t.nombre}</span>
                  <span className="text-muted text-xs leading-relaxed"><strong>Cuándo usarla:</strong> {t.cuando}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <p className="text-[11px] text-muted text-center">Orientativo; no reemplaza la atención profesional. Ante la duda, llame al 123.</p>
    </div>
  );
}
