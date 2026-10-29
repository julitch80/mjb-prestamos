// Aviso push «Nueva entrega» del Plan Académico Especial. Lógica pura (sin Firestore)
// para poder probarla y compartirla con la Cloud Function alNuevaEntregaPlanCasa.
// Privacidad: solo el primer nombre y el grupo; nunca apellidos, motivo ni salud.

export interface DatosAvisoEntrega {
  nombres?: string;
  grupo?: string;
  tituloPaso?: string;
  docentesCorreos?: string[];
  responsableCorreo?: string;
}

export const TITULO_AVISO_ENTREGA = 'Nueva entrega · Plan Académico Especial';

export function primerNombre(nombres: string | undefined): string {
  return String(nombres ?? '').trim().split(/\s+/)[0] ?? '';
}

export function cuerpoAvisoEntrega(d: DatosAvisoEntrega): string {
  const nombre = primerNombre(d.nombres) || 'Un estudiante';
  const grupo = String(d.grupo ?? '').trim();
  const quien = grupo ? `${nombre} (${grupo})` : nombre;
  const paso = String(d.tituloPaso ?? '').trim();
  return (paso ? `${quien} entregó: ${paso}` : `${quien} hizo una entrega`).slice(0, 150);
}

/** Docentes de la guía ∪ responsable, en minúsculas y sin repetidos ni vacíos. */
export function destinatariosAvisoEntrega(d: DatosAvisoEntrega): string[] {
  const todos = [...(d.docentesCorreos ?? []), d.responsableCorreo ?? '']
    .map(c => String(c ?? '').trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(todos)];
}
