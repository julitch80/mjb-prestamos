import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

// Barra del reemplazo temporal (docs/reemplazo-temporal): avisa al titular que está en
// solo lectura y, discretamente, al reemplazo que ocupa el puesto de otra persona.

interface Datos {
  soloLectura?: boolean;
  soloLecturaHasta?: string;
  reemplazadoPor?: string;
  reemplazoTemporal?: { titularEmail: string; hasta: string };
}

const fmt = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export default function BarraReemplazoTemporal({ userId }: { userId: string | null }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [nombres, setNombres] = useState<Record<string, string>>({});

  useEffect(() => {
    const email = auth?.currentUser?.email?.toLowerCase();
    if (!db || !email || !userId) { setDatos(null); return; }
    return onSnapshot(doc(db, 'users', email), (s) => setDatos((s.data() as Datos) ?? null), () => setDatos(null));
  }, [userId]);

  // Nombre de la otra persona (users es legible para cualquier usuario activo).
  const otro = datos?.soloLectura ? datos.reemplazadoPor : datos?.reemplazoTemporal?.titularEmail;
  useEffect(() => {
    if (!db || !otro || nombres[otro]) return;
    return onSnapshot(doc(db, 'users', otro), (s) => {
      const n = s.get('displayName');
      if (typeof n === 'string') setNombres((p) => ({ ...p, [otro]: n }));
    }, () => { /* se muestra el correo */ });
  }, [otro, nombres]);

  if (!datos) return null;
  const quien = otro ? (nombres[otro] ?? otro) : 'otra persona';

  if (datos.soloLectura) {
    return (
      <div className="w-full border-b border-warning bg-warning-soft text-warning-soft-fg">
        <div className="max-w-7xl mx-auto px-4 py-2 text-xs sm:text-sm font-medium leading-snug">
          Estás en solo lectura{datos.soloLecturaHasta ? ` hasta el ${fmt(datos.soloLecturaHasta)}` : ''}: te reemplaza <strong>{quien}</strong>.
        </div>
      </div>
    );
  }
  if (datos.reemplazoTemporal) {
    return (
      <div className="w-full border-b border-line bg-elevated text-soft">
        <div className="max-w-7xl mx-auto px-4 py-1.5 text-xs leading-snug">
          Reemplazas temporalmente a <strong>{quien}</strong> hasta el {fmt(datos.reemplazoTemporal.hasta)}.
        </div>
      </div>
    );
  }
  return null;
}
