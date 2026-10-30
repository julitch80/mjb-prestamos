// Datos FICTICIOS para la agenda de demostración (#/plan-demo). Ninguna persona real.
// Todo es relativo a un lunes (el de la semana actual) para que la demo siempre tenga sentido.
import type { FechaISO, PlanPublico } from './tipos';
import { aISO, lunesDe, sumarDias } from './calendarioAgenda';

export interface DemoAgenda {
  datos: PlanPublico;
  desde: FechaISO;
  hasta: FechaISO;
  /** Fechas de los atajos «Ver como si hoy fuera». */
  atajos: { inicio: FechaISO; mitad: FechaISO; entrega: FechaISO; despues: FechaISO };
}

export function crearDemoAgenda(hoyReal: FechaISO = aISO(new Date())): DemoAgenda {
  const lunes = lunesDe(hoyReal);
  const f = (n: number) => sumarDias(lunes, n);
  // Entregado ese día a las 3:40 p. m. (hora local).
  const ent = (n: number) => new Date(`${f(n)}T15:40:00`).getTime();
  const G = { fis: 'demo-fis', esp: 'demo-esp', mat: 'demo-mat', cie: 'demo-cie', int: 'demo-int' };
  const INT = 'Proyecto integrado: Ciencias, Matemáticas y Español';

  const datos: PlanPublico = {
    primerNombre: 'Valentina', grupo: '9.2', desde: f(0), hasta: f(18), actualizadoEn: Date.now(),
    pasos: [
      // ── Semana 1 ──
      { id: 'f1', semana: 1, asignatura: 'Física', docente: 'Docente de Física', guiaId: G.fis, titulo: 'Lee sobre el movimiento', instrucciones: 'Paso 1. Lee la lectura de este paso. Paso 2. Subraya tres ideas importantes. Paso 3. Toma una foto de tu cuaderno.', lectura: 'El movimiento se describe con la posición, el tiempo y la velocidad. Cuando un objeto cambia de lugar, decimos que se movió.', momentos: 1, evidencia: 'foto', evidenciaDetalle: 'Foto de tu cuaderno con las 3 ideas', fecha: f(0), enlaces: [{ url: 'https://example.com/lectura', nombre: 'Lectura en PDF' }], entregadoEn: ent(0), revisado: true, comentario: '¡Muy buenas ideas, Valentina! Sigue así.' },
      { id: 'e1', semana: 1, asignatura: 'Español', docente: 'Docente de Español', guiaId: G.esp, titulo: 'Resumen del cuento', instrucciones: 'Lee el cuento y escribe un resumen de 5 renglones.', momentos: 2, evidencia: 'texto', evidenciaDetalle: 'Un párrafo de 5 renglones', fecha: f(1), entregadoEn: ent(1) },
      { id: 'm1', semana: 1, asignatura: 'Matemáticas', docente: 'Docente de Matemáticas', guiaId: G.mat, titulo: 'Ejercicios de proporciones', instrucciones: 'Resuelve los 4 ejercicios del ejemplo. Muestra el procedimiento.', momentos: 2, evidencia: 'foto', evidenciaDetalle: 'Foto de los ejercicios resueltos', fecha: f(2), entregadoEn: ent(2), revisado: true, comentario: 'El ejercicio 3 tiene un error en el resultado; revísalo y me cuentas.' },
      { id: 'f2', semana: 1, esEntregaParcial: true, canalEntrega: 'Foto por WhatsApp', asignatura: 'Física', docente: 'Docente de Física', guiaId: G.fis, titulo: 'Problema de velocidad', instrucciones: 'Resuelve el problema 2 de la guía.', momentos: 1, evidencia: 'foto', evidenciaDetalle: 'Foto del problema resuelto', fecha: f(3), entregadoEn: ent(3), revisado: true, comentario: 'Excelente procedimiento.' },
      { id: 'e2', semana: 1, esEntregaParcial: true, canalEntrega: 'Audio por la plataforma', asignatura: 'Español', docente: 'Docente de Español', guiaId: G.esp, titulo: 'Audio de lectura', instrucciones: 'Graba un audio leyendo tu párrafo con buena entonación.', momentos: 1, evidencia: 'audio', evidenciaDetalle: 'Audio de 1 minuto', fecha: f(4), entregadoEn: ent(4) },
      // ── Semana 2 ──
      { id: 'f3', semana: 2, asignatura: 'Física', docente: 'Docente de Física', guiaId: G.fis, titulo: 'Experimento con una pelota', instrucciones: 'Mide cuánto tarda una pelota en recorrer 3 metros. Repite 3 veces. Anota los tiempos.', momentos: 2, evidencia: 'foto', evidenciaDetalle: 'Foto de tu tabla de tiempos', fecha: f(7), entregadoEn: ent(8) },
      { id: 'm2', semana: 2, asignatura: 'Matemáticas', docente: 'Docente de Matemáticas', guiaId: G.mat, titulo: 'Gráfica de la proporción', instrucciones: 'Dibuja la gráfica de la proporción directa del ejemplo.', momentos: 1, evidencia: 'foto', evidenciaDetalle: 'Foto de tu gráfica', fecha: f(8) },
      { id: 'e3', semana: 2, asignatura: 'Español', docente: 'Docente de Español', guiaId: G.esp, titulo: 'Lectura del poema', instrucciones: 'Lee el poema dos veces en voz alta. Escribe qué sentiste.', lectura: 'Cuando el día se apaga y la calle queda en silencio, / las palabras se encienden como luces pequeñas.', momentos: 1, evidencia: 'texto', evidenciaDetalle: 'Tres renglones con lo que sentiste', fecha: f(8), entregadoEn: ent(8) },
      { id: 'c1', semana: 2, asignatura: 'Ciencias Naturales', docente: 'Docente de Ciencias', guiaId: G.cie, titulo: 'Observa tu entorno', instrucciones: 'Sal al patio o al balcón y observa 5 seres vivos. Anótalos.', momentos: 1, evidencia: 'foto', evidenciaDetalle: 'Foto de tu lista', fecha: f(9), enlaces: [{ url: 'https://example.com/guia-ciencias', nombre: 'Guía de observación' }] },
      { id: 'm3', semana: 2, esEntregaParcial: true, canalEntrega: 'Escrito en la plataforma', asignatura: 'Matemáticas', docente: 'Docente de Matemáticas', guiaId: G.mat, titulo: 'Repaso de la semana', instrucciones: 'Repasa tus ejercicios y escribe qué fue lo más difícil.', momentos: 1, evidencia: 'texto', evidenciaDetalle: 'Escribe qué fue lo más difícil', fecha: f(10) },
      { id: 'e4', semana: 2, esEntregaParcial: true, canalEntrega: 'Audio por WhatsApp', asignatura: 'Español', docente: 'Docente de Español', guiaId: G.esp, titulo: 'Declama el poema', instrucciones: 'Graba un audio declamando el poema.', momentos: 1, evidencia: 'audio', evidenciaDetalle: 'Audio de 1 a 2 minutos', fecha: f(11), entregadoEn: ent(12) },
      // ── Semana 3 ──
      { id: 'f4', semana: 3, asignatura: 'Física', docente: 'Docente de Física', guiaId: G.fis, titulo: 'Prepara tu sustentación', instrucciones: 'Repasa tus apuntes y practica las preguntas para prepararte.', momentos: 1, evidencia: 'texto', evidenciaDetalle: 'Escribe tus respuestas a las preguntas', fecha: f(14) },
      { id: 'c2', semana: 3, asignatura: 'Ciencias Naturales', docente: 'Docente de Ciencias', guiaId: G.cie, titulo: 'Clasifica lo que observaste', instrucciones: 'Clasifica tus 5 seres vivos en una tabla.', momentos: 2, evidencia: 'foto', evidenciaDetalle: 'Foto de tu tabla', fecha: f(15) },
      { id: 'm4', semana: 3, asignatura: 'Matemáticas', docente: 'Docente de Matemáticas', guiaId: G.mat, titulo: 'Problema del mercado', instrucciones: 'Resuelve el problema aplicando proporciones.', momentos: 2, evidencia: 'foto', evidenciaDetalle: 'Foto del problema resuelto', fecha: f(16) },
      {
        id: 'i1', semana: 3, esEntregaParcial: true, canalEntrega: 'Documento por la plataforma', asignatura: INT, docente: 'Equipo docente', guiaId: G.int,
        titulo: 'Entrega integrada: el mercado del barrio', instrucciones: 'Reúne en un solo documento las tres partes de tu proyecto. Revisa que cada parte esté completa.',
        momentos: 3, evidencia: 'documento', evidenciaDetalle: 'Un documento con las tres partes', fecha: f(17),
        componentes: [
          { asignaturaId: 'ciencias', parte: 'Tabla de seres vivos observados', queRevisar: 'Clasificación', asignatura: 'Ciencias Naturales', revisado: true, comentario: 'Muy ordenada tu tabla.' },
          { asignaturaId: 'mat', parte: 'Problema de proporciones resuelto', queRevisar: 'Procedimiento', asignatura: 'Matemáticas', revisado: true },
          { asignaturaId: 'esp', parte: 'Texto de 8 renglones sobre el mercado', queRevisar: 'Redacción', asignatura: 'Español' },
        ],
      },
      { id: 'e5', semana: 3, esEntregaParcial: true, canalEntrega: 'Foto por WhatsApp', asignatura: 'Español', docente: 'Docente de Español', guiaId: G.esp, titulo: 'Texto final', instrucciones: 'Pasa en limpio tu texto y toma una foto.', momentos: 1, evidencia: 'foto', evidenciaDetalle: 'Foto del texto final', fecha: f(18) },
    ],
    sustentaciones: [{ asignatura: 'Física', docente: 'Docente de Física', modalidad: 'virtual', fecha: f(18), hora: '09:00', lugarOEnlace: 'https://meet.google.com/demo-demo-demo', preguntasGuia: ['¿Qué es la velocidad?', '¿Cómo la mediste en tu experimento?', '¿Qué fue lo más difícil?'] }],
  };

  return { datos, desde: f(0), hasta: f(18), atajos: { inicio: f(0), mitad: f(9), entrega: f(17), despues: f(21) } };
}
