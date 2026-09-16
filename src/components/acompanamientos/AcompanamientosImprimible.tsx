// Vista imprimible de una publicación de acompañamientos: la matriz Zona × Días
// dentro de la PLANTILLA INSTITUCIONAL (src/components/DocumentoInstitucional.tsx),
// la misma que usan los demás documentos que salen de la aplicación en papel.
//
// Va en vertical, con el membrete del colegio de fondo: en A4 vertical la tabla
// de seis zonas por cinco días cabe de sobra y el documento se ve oficial al
// pegarlo en cartelera.

import DocumentoInstitucional from '../DocumentoInstitucional';
import { USUARIOS } from '../../data/maestros';
import type { Distribucion, JornadaAcomp } from '../../data/acompanamientos/tipos';
import { DIAS } from '../../data/acompanamientos/tipos';
import { fechaLegibleAcomp } from '../../data/acompanamientos/textos';

const DIA_LABEL: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes',
};

interface Props {
  jornada: JornadaAcomp;
  distribucion: Distribucion;
  vigenteDesde: string;
  publicadoPorNombre: string;
  onCerrar: () => void;
}

export default function AcompanamientosImprimible({
  jornada,
  distribucion,
  vigenteDesde,
  publicadoPorNombre,
  onCerrar,
}: Props) {
  const nombreCorto = (docenteId: string) => USUARIOS.find((u) => u.id === docenteId)?.nombreCorto ?? docenteId;

  return (
    <DocumentoInstitucional
      titulo="Acompañamientos de descanso"
      subtitulo={`Jornada ${jornada === 'manana' ? 'Mañana' : 'Tarde'}${
        // La distribución inicial no tiene fecha real (año 2000): no se anuncia.
        vigenteDesde > '2001-01-01' ? ` · Rige desde el ${fechaLegibleAcomp(vigenteDesde)}` : ''
      }`}
      pie={publicadoPorNombre ? `Publicada por ${publicadoPorNombre}` : 'Distribución inicial'}
      onCerrar={onCerrar}
    >
      <table className="doc-inst-tabla">
        <thead>
          <tr>
            <th className="doc-inst-col-titulo">Zona</th>
            {DIAS.map((dia) => (
              <th key={dia}>{DIA_LABEL[dia]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {distribucion.zonas.map((zona) => (
            <tr key={zona.id}>
              <td className="doc-inst-col-titulo">{zona.nombre}</td>
              {DIAS.map((dia) => {
                const asignados = distribucion.asignaciones.filter((a) => a.zonaId === zona.id && a.dia === dia);
                return (
                  <td key={dia}>
                    {asignados.length === 0 ? '—' : asignados.map((a) => nombreCorto(a.docenteId)).join(', ')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </DocumentoInstitucional>
  );
}
