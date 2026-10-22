// Banco de pruebas de la página pública del plan en casa — SOLO DESARROLLO.
import AgendaPlanPublica from '../components/planCasa/AgendaPlanPublica';
import type { PlanPublico } from '../data/planCasa/tipos';

const p = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const z = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

const datos: PlanPublico = {
  primerNombre: 'Camila', grupo: '8º2', desde: p(-2), hasta: p(12), actualizadoEn: Date.now(),
  pasos: [
    { id: 'p1', semana: 1, asignatura: 'Física', docente: 'Julián', titulo: 'Lee sobre la velocidad', instrucciones: 'Lee la página 12.\nSubraya 3 ideas.', momentos: 1, evidencia: 'foto', evidenciaDetalle: 'Foto de tu cuaderno con las 3 ideas', fecha: p(0), enlaces: [{ url: 'https://example.com', nombre: 'Lectura en PDF' }] },
    { id: 'p2', semana: 1, asignatura: 'Español', docente: 'Marta', titulo: 'Resumen del cuento', instrucciones: 'Escribe 5 renglones sobre el cuento.', momentos: 2, evidencia: 'texto', evidenciaDetalle: 'Un párrafo de 5 renglones', fecha: p(0) },
    { id: 'p3', semana: 1, asignatura: 'Matemáticas', docente: 'Hugo', titulo: 'Ejercicios resueltos', instrucciones: 'Resuelve los 4 ejercicios del ejemplo.', momentos: 2, evidencia: 'foto', evidenciaDetalle: 'Foto de los ejercicios', fecha: p(1) },
    { id: 'p4', semana: 1, esEntregaParcial: true, canalEntrega: 'Foto por WhatsApp', asignatura: 'Física', docente: 'Julián', titulo: 'Problema de movimiento', instrucciones: 'Resuelve el problema 2.', momentos: 1, evidencia: 'foto', evidenciaDetalle: 'Foto del problema', fecha: p(3) },
    { id: 'p5', semana: 1, asignatura: 'Español', docente: 'Marta', titulo: 'Audio de lectura', instrucciones: 'Graba un audio leyendo tu párrafo.', momentos: 1, evidencia: 'audio', evidenciaDetalle: 'Audio de 1 minuto', fecha: p(5) },
    { id: 'p6', semana: 2, esEntregaParcial: true, canalEntrega: 'Escrito en la plataforma', asignatura: 'Matemáticas', docente: 'Hugo', titulo: 'Repaso final', instrucciones: 'Repasa tus ejercicios.', momentos: 1, evidencia: 'texto', evidenciaDetalle: 'Escribe qué fue lo más difícil', fecha: p(6) },
  ],
  sustentaciones: [{ asignatura: 'Física', docente: 'Julián', modalidad: 'virtual', fecha: p(8), hora: '09:00', lugarOEnlace: 'https://meet.google.com/abc-defg-hij', preguntasGuia: ['¿Qué es la velocidad?', '¿Cómo la mediste?', '¿Qué fue lo más difícil?'] }],
};

export default function BancoPlanPublico() {
  return <AgendaPlanPublica token="dev" datos={datos} />;
}
