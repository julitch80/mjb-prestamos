// Textos fijos de la portada y de la pestaña Rutas de la guía del simulacro de sismo 2026.
// Transcritos de la guía HTML. Sin teléfonos (repositorio público).

export const PORTADA_SISMO = {
  titulo: 'Simulacro de sismo',
  sede: 'Sede Principal, I.E. Manuel J. Betancur',
  resumen: 'Es un sismo simulado: evacuación hasta el patio central, unos 20 minutos.',
  duo: [
    { f: 'antes', titulo: 'Protégete', texto: 'Timbre largo (no es el descanso): en cuclillas y con las manos sobre la cabeza.' },
    { f: 'durante', titulo: 'Sal en hilera', texto: 'Sirena: tu ruta, tu turno, sin correr.' },
  ] as { f: 'antes' | 'durante'; titulo: string; texto: string }[],
  recuerda: [
    'Nadie sale al descanso con el timbre largo: el descanso llega al terminar el ejercicio.',
    'Tú sales de último y haces el barrido visual del aula.',
    'Sin empujar, sin gritar, sin celular y sin cargar objetos.',
    'En el patio, en fila frente a la paleta de tu salón.',
    'Grupo completo: paleta verde y tarjeta de conteo.',
  ],
  evita: 'Correr, empujar, gritar, devolverte por objetos, usar el celular y cerrar la puerta del aula.',
  responsable: 'Julián David Medina Tamayo',
};

export const PUNTOS_ESPACIOS: { t: string; d: string }[] = [
  { t: 'Punto de encuentro', d: 'Patio central. Cada grupo forma frente a la paleta de su salón; con más de 30 estudiantes, dos filas, a 1,5 m del andén y de la malla.' },
  { t: 'Salidas de emergencia', d: 'Biblioteca y restaurante escolar.' },
  { t: 'Punto de encuentro externo', d: 'Cancha María Auxiliadora, solo si se evacúa por completo fuera de la sede.' },
  { t: 'Personal directivo, administrativo, de tienda y de restaurante', d: 'Espacio exclusivo dentro del punto de encuentro.' },
];

export const SOTANO_NOTA = 'Patio o aula de educación física bajo el restaurante escolar. El responsable debe fijar la ruta y quién la regula.';
