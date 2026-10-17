// Banco de pruebas local del calendario académico — SOLO DESARROLLO.
// Se monta desde App.tsx con React.lazy tras `import.meta.env.DEV`; no entra al
// build de producción. Simula un usuario (?rol=docente|coordinador) sin login.
import { useEffect } from 'react';
import { useAppStore } from '../data/store';
import PanelAcademico from '../components/calendarioAcademico/PanelAcademico';
import AlertasCalendario from '../components/calendarioAcademico/AlertasCalendario';

export default function BancoCalendario() {
  const rol = new URLSearchParams(window.location.search).get('rol') ?? 'docente';
  // La inicialización de sesión puede borrar el usuario simulado: se reaplica.
  useEffect(() => {
    const fijar = () => useAppStore.setState({ userId: rol === 'docente' ? 'julian' : 'coord_manana', rol });
    fijar();
    return useAppStore.subscribe(s => { if (s.rol !== rol) fijar(); });
  }, [rol]);
  return (
    <div className="min-h-screen p-4 space-y-4">
      <AlertasCalendario />
      <PanelAcademico />
    </div>
  );
}
