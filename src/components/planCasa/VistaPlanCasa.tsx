// Pestaña «Planes en casa»: el equipo (UAI y orientación), coordinación, rectoría y el
// superusuario ven el panel de planes; todos los docentes ven sus guías. Quien está en
// ambos lados elige con dos pastillas.
import { useEffect, useState } from 'react';
import { useAppStore } from '../../data/store';
import { auth } from '../../lib/firebase';
import { leerEquipo } from '../../data/planCasa/persistencia';
import { PestanasSubrayadas } from '../Navegacion';
import PanelPlanCasa from './PanelPlanCasa';
import PlanCasaDocente from './PlanCasaDocente';

export default function VistaPlanCasa() {
  const rol = useAppStore(s => s.rol);
  const [enEquipo, setEnEquipo] = useState(false);
  const [vista, setVista] = useState<'panel' | 'guias'>('guias');

  useEffect(() => {
    const correo = auth?.currentUser?.email?.toLowerCase() ?? '';
    leerEquipo().then(lista => {
      const si = lista.includes(correo);
      setEnEquipo(si);
      if (si) setVista('panel');
    });
  }, []);

  const directivo = rol === 'coordinador' || rol === 'rectora' || rol === 'superusuario';
  const verPanel = directivo || enEquipo;
  useEffect(() => { if (directivo) setVista('panel'); }, [directivo]);

  if (!verPanel) return <PlanCasaDocente />;
  return (
    <div className="space-y-4">
      <PestanasSubrayadas opciones={[{ id: 'panel', label: 'Planes' }, { id: 'guias', label: 'Mis guías' }]} activa={vista} onCambio={setVista} />
      {vista === 'panel' ? <PanelPlanCasa /> : <PlanCasaDocente />}
    </div>
  );
}
