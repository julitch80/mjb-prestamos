// Avatar redondo con iniciales y color estable por correo; ícono de grupo opcional.
import { Users } from 'lucide-react';
import { colorAvatar, iniciales } from '../data/chatFormato';

export default function Avatar({
  nombre,
  email,
  grupo = false,
  tamano = 40,
}: {
  nombre: string;
  email?: string;
  grupo?: boolean;
  tamano?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center rounded-full flex-shrink-0 font-semibold select-none"
      style={{
        width: tamano,
        height: tamano,
        background: colorAvatar(email || nombre),
        color: '#fff',
        fontSize: Math.max(12, Math.round(tamano * 0.4)),
      }}
    >
      {grupo ? <Users size={Math.round(tamano * 0.5)} /> : iniciales(nombre)}
    </span>
  );
}
