/**
 * Banco de iconos CURADO para columnas de tipo `icono` en Direccion de grupo.
 *
 * `lucide-react` ya es dependencia de MJB (ISC, uso comercial libre) y trae 5.885
 * iconos. El trabajo de este archivo es justamente NO exponerlos todos: Additio vuelca
 * cientos de iconos en su selector y la mayoria no se usan nunca — el docente termina
 * buscando en vez de elegir. Una lista de 53, agrupada por para-que-sirve, se recorre de
 * un vistazo; una de 500 obliga a escribir en un buscador.
 *
 * Los 53 nombres estan verificados uno por uno contra el export real de lucide-react.
 * NO anadir ni inventar nombres sin comprobarlos antes: un nombre inexistente no falla
 * al compilar (el modulo no importa lucide-react, ver abajo), revienta en pantalla
 * cuando el componente intente resolverlo.
 *
 * Este archivo NO importa `lucide-react`: solo guarda los nombres como texto. El
 * componente que pinte el icono es quien resuelve el nombre contra la libreria. Asi el
 * dominio se prueba sin React ni la dependencia, como el resto de `domain/`.
 */

export interface IconoDisponible {
  /** Nombre EXACTO del export de lucide-react: 'Brush', 'GraduationCap'. */
  nombre: string;
  /** Lo que lee el docente al elegirlo. En espanol. */
  etiqueta: string;
  grupo: string;
}

export const ICONOS_DIRECCION: IconoDisponible[] = [
  // Estado
  { nombre: 'Check', etiqueta: 'Cumplio', grupo: 'Estado' },
  { nombre: 'X', etiqueta: 'No cumplio', grupo: 'Estado' },
  { nombre: 'Star', etiqueta: 'Destacado', grupo: 'Estado' },
  { nombre: 'Flag', etiqueta: 'Bandera', grupo: 'Estado' },
  { nombre: 'CircleAlert', etiqueta: 'Alerta', grupo: 'Estado' },
  { nombre: 'CircleHelp', etiqueta: 'Pendiente', grupo: 'Estado' },
  { nombre: 'ThumbsUp', etiqueta: 'Aprobado', grupo: 'Estado' },
  { nombre: 'ThumbsDown', etiqueta: 'Rechazado', grupo: 'Estado' },

  // Animo
  { nombre: 'Smile', etiqueta: 'Contento', grupo: 'Animo' },
  { nombre: 'Meh', etiqueta: 'Regular', grupo: 'Animo' },
  { nombre: 'Frown', etiqueta: 'Triste', grupo: 'Animo' },

  // Dinero
  { nombre: 'Coins', etiqueta: 'Monedas', grupo: 'Dinero' },
  { nombre: 'Banknote', etiqueta: 'Billete', grupo: 'Dinero' },
  { nombre: 'Wallet', etiqueta: 'Billetera', grupo: 'Dinero' },
  { nombre: 'Receipt', etiqueta: 'Recibo', grupo: 'Dinero' },
  { nombre: 'HandCoins', etiqueta: 'Aporte', grupo: 'Dinero' },

  // Alimentacion
  { nombre: 'Utensils', etiqueta: 'Restaurante', grupo: 'Alimentacion' },
  { nombre: 'Milk', etiqueta: 'Lonchera de leche', grupo: 'Alimentacion' },
  { nombre: 'Apple', etiqueta: 'Fruta', grupo: 'Alimentacion' },
  { nombre: 'CupSoda', etiqueta: 'Bebida', grupo: 'Alimentacion' },

  // Salud
  { nombre: 'HeartPulse', etiqueta: 'Salud', grupo: 'Salud' },
  { nombre: 'Cross', etiqueta: 'Enfermeria', grupo: 'Salud' },
  { nombre: 'Thermometer', etiqueta: 'Fiebre', grupo: 'Salud' },
  { nombre: 'Pill', etiqueta: 'Medicamento', grupo: 'Salud' },
  { nombre: 'Stethoscope', etiqueta: 'Fonendoscopio', grupo: 'Salud' },

  // Aseo
  { nombre: 'Brush', etiqueta: 'Cepillo', grupo: 'Aseo' },
  { nombre: 'SprayCan', etiqueta: 'Aerosol', grupo: 'Aseo' },
  { nombre: 'Trash2', etiqueta: 'Basura', grupo: 'Aseo' },
  { nombre: 'Recycle', etiqueta: 'Reciclaje', grupo: 'Aseo' },

  // Transporte
  { nombre: 'Bus', etiqueta: 'Bus', grupo: 'Transporte' },
  { nombre: 'Bike', etiqueta: 'Bicicleta', grupo: 'Transporte' },
  { nombre: 'Car', etiqueta: 'Carro', grupo: 'Transporte' },
  { nombre: 'Footprints', etiqueta: 'A pie', grupo: 'Transporte' },

  // Escolar
  { nombre: 'Book', etiqueta: 'Libro', grupo: 'Escolar' },
  { nombre: 'BookOpen', etiqueta: 'Libro abierto', grupo: 'Escolar' },
  { nombre: 'Pencil', etiqueta: 'Lapiz', grupo: 'Escolar' },
  { nombre: 'GraduationCap', etiqueta: 'Birrete', grupo: 'Escolar' },
  { nombre: 'ClipboardCheck', etiqueta: 'Tarea revisada', grupo: 'Escolar' },
  { nombre: 'Backpack', etiqueta: 'Maleta', grupo: 'Escolar' },
  { nombre: 'Calculator', etiqueta: 'Calculadora', grupo: 'Escolar' },
  { nombre: 'Microscope', etiqueta: 'Microscopio', grupo: 'Escolar' },

  // Actividad
  { nombre: 'Music', etiqueta: 'Musica', grupo: 'Actividad' },
  { nombre: 'Palette', etiqueta: 'Arte', grupo: 'Actividad' },
  { nombre: 'Trophy', etiqueta: 'Trofeo', grupo: 'Actividad' },
  { nombre: 'Volleyball', etiqueta: 'Voleibol', grupo: 'Actividad' },
  { nombre: 'Dumbbell', etiqueta: 'Educacion fisica', grupo: 'Actividad' },
  { nombre: 'Drama', etiqueta: 'Teatro', grupo: 'Actividad' },

  // Contacto
  { nombre: 'Phone', etiqueta: 'Telefono', grupo: 'Contacto' },
  { nombre: 'Mail', etiqueta: 'Correo', grupo: 'Contacto' },
  { nombre: 'MessageCircle', etiqueta: 'Mensaje', grupo: 'Contacto' },
  { nombre: 'Megaphone', etiqueta: 'Aviso', grupo: 'Contacto' },
  { nombre: 'Users', etiqueta: 'Grupo', grupo: 'Contacto' },
  { nombre: 'House', etiqueta: 'Casa', grupo: 'Contacto' },
];

/**
 * Agrupados en el orden en que aparecen arriba, listo para pintar un selector con
 * secciones. No se ordena alfabeticamente: el orden es el de "para que sirve", que es
 * como un docente escanea la lista, no el orden del diccionario.
 */
export function iconosPorGrupo(): { grupo: string; iconos: IconoDisponible[] }[] {
  const grupos: { grupo: string; iconos: IconoDisponible[] }[] = [];
  for (const icono of ICONOS_DIRECCION) {
    let entrada = grupos.find((g) => g.grupo === icono.grupo);
    if (!entrada) {
      entrada = { grupo: icono.grupo, iconos: [] };
      grupos.push(entrada);
    }
    entrada.iconos.push(icono);
  }
  return grupos;
}
