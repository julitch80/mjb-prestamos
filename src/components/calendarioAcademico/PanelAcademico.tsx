// Pestaña «Académico»: Calendario (por defecto) | Asignación.
import { useState } from 'react';
import { PestanasSubrayadas } from '../Navegacion';
import AsignacionAcademica from '../AsignacionAcademica';
import CalendarioAcademico from './CalendarioAcademico';

export default function PanelAcademico() {
  const [sub, setSub] = useState<'calendario' | 'asignacion'>('calendario');
  return (
    <div className="space-y-4">
      <PestanasSubrayadas opciones={[{ id: 'calendario', label: 'Calendario' }, { id: 'asignacion', label: 'Asignación' }]} activa={sub} onCambio={setSub} />
      {sub === 'calendario' ? <CalendarioAcademico /> : <AsignacionAcademica />}
    </div>
  );
}
